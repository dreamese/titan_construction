(() => {
  const DB_NAME = 'dreamese-site-v04';
  const DB_VERSION = 1;
  const STORE_NAME = 'settings';
  const CONFIG_KEY = 'site-config-v05';
  const LEGACY_CONFIG_KEY = 'site-config';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(target, source) {
    if (Array.isArray(source)) return clone(source);
    if (!source || typeof source !== 'object') return source;
    const output = { ...(target && typeof target === 'object' ? target : {}) };
    Object.keys(source).forEach((key) => {
      const value = source[key];
      if (Array.isArray(value)) output[key] = clone(value);
      else if (value && typeof value === 'object') output[key] = mergeDeep(output[key], value);
      else output[key] = value;
    });
    return output;
  }

  function copyMobileFields(item, fields) {
    if (!item || typeof item !== 'object') return;
    if (!item.mobile || typeof item.mobile !== 'object') item.mobile = {};
    fields.forEach((field) => {
      if (item.mobile[field] === undefined && item[field] !== undefined) {
        item.mobile[field] = clone(item[field]);
      }
    });
  }

  function normalizeV06(config, defaults) {
    const normalized = mergeDeep(clone(defaults), config || {});
    normalized.version = '0.6';

    copyMobileFields(normalized.brand, ['name', 'tagline', 'logo', 'logoLink', 'email', 'phone', 'location', 'socialLabel', 'socialUrl']);
    (normalized.navigation || []).forEach((item) => copyMobileFields(item, ['label']));

    copyMobileFields(normalized.about, ['eyebrow', 'title', 'intro']);
    (normalized.about?.slides || []).forEach((item) => copyMobileFields(item, ['label', 'title', 'body', 'image', 'link']));

    (normalized.projects || []).forEach((item) => copyMobileFields(item, ['title', 'subtitle', 'category', 'image', 'description', 'href']));

    copyMobileFields(normalized.service, ['eyebrow', 'title']);
    (normalized.service?.items || []).forEach((item) => copyMobileFields(item, ['name', 'summary', 'image', 'href', 'linkLabel']));

    copyMobileFields(normalized.media, ['eyebrow', 'title']);
    (normalized.media?.items || []).forEach((item) => copyMobileFields(item, ['title', 'label', 'image', 'description', 'url']));

    copyMobileFields(normalized.news, ['eyebrow', 'title']);
    (normalized.news?.items || []).forEach((item) => copyMobileFields(item, ['date', 'category', 'title', 'subtitle', 'description', 'image', 'href']));

    copyMobileFields(normalized.contact, ['eyebrow', 'title']);
    (normalized.contact?.cards || []).forEach((item) => copyMobileFields(item, ['title', 'lines', 'image', 'link', 'linkLabel']));

    // Nếu dữ liệu v0.4 vẫn đang dùng link kênh chung, tự gắn ba video thử nghiệm của v0.6.
    const starterLinks = [
      'https://www.tiktok.com/@quoclinh258/video/7666387664395963655',
      'https://www.tiktok.com/@quoclinh258/video/7609638041191238919',
      'https://www.tiktok.com/@quoclinh258/video/7657872311017688327'
    ];
    starterLinks.forEach((url, index) => {
      const item = normalized.media?.items?.[index];
      if (!item) return;
      if (!String(item.url || '').includes('/video/')) item.url = url;
      if (!String(item.mobile?.url || '').includes('/video/')) item.mobile.url = item.url;
    });

    return normalized;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB không khả dụng.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Không thể mở IndexedDB.'));
    });
  }

  async function idbGetByKey(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      });
    } catch (error) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
  }

  async function idbSet(config) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(clone(config), CONFIG_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch (error) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }
  }

  async function idbClear() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(CONFIG_KEY);
        store.delete(LEGACY_CONFIG_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch {
      localStorage.removeItem(CONFIG_KEY);
      localStorage.removeItem(LEGACY_CONFIG_KEY);
    }
  }

  async function loadFileConfig() {
    try {
      const response = await fetch(`site-config.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async function loadConfig(options = {}) {
    const defaults = clone(window.DREAMESE_DEFAULT_CONFIG || {});
    const fileConfig = options.skipFile ? null : await loadFileConfig();
    let storedConfig = options.skipStored ? null : await idbGetByKey(CONFIG_KEY);
    let migratedLegacy = false;

    if (!storedConfig && !options.skipStored) {
      storedConfig = await idbGetByKey(LEGACY_CONFIG_KEY);
      migratedLegacy = Boolean(storedConfig);
    }

    const combined = mergeDeep(mergeDeep(defaults, fileConfig || {}), storedConfig || {});
    const normalized = normalizeV06(combined, defaults);

    if (migratedLegacy) {
      try { await idbSet(normalized); } catch (error) { console.warn(error); }
    }

    return normalized;
  }

  function downloadJson(config, filename = 'site-config.json') {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.DreameseStore = {
    clone,
    mergeDeep,
    normalizeV06,
    loadConfig,
    saveConfig: idbSet,
    clearConfig: idbClear,
    downloadJson
  };
})();
