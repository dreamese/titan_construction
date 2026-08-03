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

  function syncStaleMobileField(item, defaultItem, field) {
    if (!item || typeof item !== 'object') return;
    if (!item.mobile || typeof item.mobile !== 'object') item.mobile = {};
    const desktopValue = item[field];
    const mobileValue = item.mobile[field];
    const defaultDesktop = defaultItem?.[field];
    const defaultMobile = defaultItem?.mobile?.[field] ?? defaultDesktop;
    const mobileUnset = mobileValue === undefined || mobileValue === null || mobileValue === '';
    const desktopWasCustomized = desktopValue !== undefined && desktopValue !== defaultDesktop;
    const mobileStillDefault = mobileValue === defaultMobile;
    if (mobileUnset || (desktopWasCustomized && mobileStillDefault)) {
      item.mobile[field] = clone(desktopValue);
    }
  }

  function ensureNavigationEntry(navigation, defaults, target, afterTarget = '') {
    if (!Array.isArray(navigation)) return;
    if (navigation.some((item) => item?.target === target)) return;
    const defaultItem = (defaults || []).find((item) => item?.target === target) || { label: target, target };
    const entry = clone(defaultItem);
    const afterIndex = navigation.findIndex((item) => item?.target === afterTarget);
    navigation.splice(afterIndex >= 0 ? afterIndex + 1 : navigation.length, 0, entry);
  }

  function normalizeMediaUrl(value) {
    let href = String(value || '')
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .replace(/&amp;/gi, '&');
    if (!href || href === '#') return '';
    if (/^\/\//.test(href)) href = `https:${href}`;
    if (/^(?:www\.)?tiktok\.com\//i.test(href)) href = `https://${href}`;
    if (/^(?:vm|vt)\.tiktok\.com\//i.test(href)) href = `https://${href}`;
    return href;
  }

  function hasTikTokVideoId(value) {
    return /(?:\/video\/|\/player\/v1\/|\/embed\/v2\/)\d+/i.test(String(value || ''));
  }

  function normalizeV06(config, defaults) {
    const normalized = mergeDeep(clone(defaults), config || {});
    normalized.version = '0.7.3';

    normalized.brand.browserTitle = normalized.brand.browserTitle || normalized.brand.name || defaults.brand.browserTitle;
    normalized.brand.favicon = normalized.brand.favicon || normalized.brand.logo || defaults.brand.favicon;
    normalized.brand.metaDescription = normalized.brand.metaDescription || defaults.brand.metaDescription || '';
    normalized.brand.themeColor = normalized.brand.themeColor || defaults.brand.themeColor || '#050505';
    copyMobileFields(normalized.brand, ['name', 'tagline', 'logo', 'logoLink', 'email', 'phone', 'location', 'socialLabel', 'socialUrl']);
    // Nhận diện Header dùng chung giữa Desktop và Mobile. Điều này cũng sửa
    // các cấu hình cũ từng lưu riêng tên/logo Mobile trong IndexedDB.
    normalized.brand.mobile.name = normalized.brand.name;
    normalized.brand.mobile.tagline = normalized.brand.tagline;
    normalized.brand.mobile.logo = normalized.brand.logo;
    normalized.brand.mobile.logoLink = normalized.brand.logoLink;
    if (!Array.isArray(normalized.navigation)) normalized.navigation = [];
    ensureNavigationEntry(normalized.navigation, defaults.navigation, 'projects', 'about');
    normalized.navigation.forEach((item) => {
      copyMobileFields(item, ['label']);
      if (item.target === 'media') {
        if (!item.label || /^media$/i.test(item.label)) item.label = 'Blog';
        if (!item.mobile.label || /^media$/i.test(item.mobile.label)) item.mobile.label = item.label;
      }
      if (item.target === 'projects') {
        if (!item.label) item.label = 'Projects';
        if (!item.mobile.label) item.mobile.label = item.label;
      }
    });

    copyMobileFields(normalized.about, ['eyebrow', 'title', 'intro']);
    (normalized.about?.slides || []).forEach((item, index) => {
      copyMobileFields(item, ['label', 'title', 'body', 'image', 'link']);
      syncStaleMobileField(item, defaults.about?.slides?.[index], 'image');
    });

    if (!normalized.projectsSection || typeof normalized.projectsSection !== 'object') {
      normalized.projectsSection = clone(defaults.projectsSection || { eyebrow: 'Projects', title: '' });
    }
    copyMobileFields(normalized.projectsSection, ['eyebrow', 'title']);
    (normalized.projects || []).forEach((item, index) => {
      copyMobileFields(item, ['title', 'subtitle', 'category', 'image', 'description', 'href']);
      syncStaleMobileField(item, defaults.projects?.[index], 'image');
    });

    copyMobileFields(normalized.service, ['eyebrow', 'title']);
    (normalized.service?.items || []).forEach((item, index) => {
      copyMobileFields(item, ['name', 'summary', 'image', 'href', 'linkLabel']);
      syncStaleMobileField(item, defaults.service?.items?.[index], 'image');
    });

    copyMobileFields(normalized.media, ['eyebrow', 'title']);
    if (!normalized.media.eyebrow || /^media$/i.test(normalized.media.eyebrow)) normalized.media.eyebrow = 'Blog';
    if (!normalized.media.mobile.eyebrow || /^media$/i.test(normalized.media.mobile.eyebrow)) normalized.media.mobile.eyebrow = normalized.media.eyebrow;
    (normalized.media?.items || []).forEach((item, index) => {
      copyMobileFields(item, ['title', 'label', 'image', 'description', 'url']);
      syncStaleMobileField(item, defaults.media?.items?.[index], 'image');
      item.url = normalizeMediaUrl(item.url);
      item.mobile.url = normalizeMediaUrl(item.mobile?.url);
      // Tránh trường hợp người dùng đã gắn video Desktop nhưng Mobile vẫn giữ link kênh cũ.
      if (hasTikTokVideoId(item.url) && !hasTikTokVideoId(item.mobile.url)) {
        item.mobile.url = item.url;
      }
    });

    copyMobileFields(normalized.news, ['eyebrow', 'title']);
    (normalized.news?.items || []).forEach((item, index) => {
      copyMobileFields(item, ['date', 'category', 'title', 'subtitle', 'description', 'image', 'href']);
      syncStaleMobileField(item, defaults.news?.items?.[index], 'image');
      if (/^media$/i.test(item.category || '')) item.category = 'Blog';
      if (/^media$/i.test(item.mobile.category || '')) item.mobile.category = 'Blog';
    });

    copyMobileFields(normalized.contact, ['eyebrow', 'title']);
    (normalized.contact?.cards || []).forEach((item, index) => {
      copyMobileFields(item, ['title', 'lines', 'image', 'link', 'linkLabel']);
      syncStaleMobileField(item, defaults.contact?.cards?.[index], 'image');
      if (item.type !== 'social') return;

      if (!Array.isArray(item.socialLinks) || !item.socialLinks.length) {
        const legacyLines = Array.isArray(item.lines) && item.lines.length
          ? item.lines
          : ['Instagram', 'TikTok', 'Facebook'];
        const platformFromLabel = (label) => {
          const value = String(label || '').toLowerCase();
          if (value.includes('facebook')) return 'facebook';
          if (value.includes('tik')) return 'tiktok';
          if (value.includes('youtube')) return 'youtube';
          if (value.includes('linkedin')) return 'linkedin';
          if (value.includes('zalo')) return 'zalo';
          return 'instagram';
        };
        item.socialLinks = legacyLines.map((label) => {
          const platform = platformFromLabel(label);
          const legacyUrl = platform === 'tiktok' ? (item.link || '') : '';
          return { platform, label, url: legacyUrl, mobile: { label, url: legacyUrl } };
        });
      }

      item.socialLinks.forEach((social) => {
        social.platform = social.platform || 'website';
        copyMobileFields(social, ['label', 'url']);
      });
    });

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
