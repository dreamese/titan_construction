(() => {
  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const editor = q('#managerEditor');
  const preview = q('#sitePreview');
  const status = q('#saveStatus');
  const tabs = q('#managerTabs');
  const previewStage = q('#previewStage');

  const GITHUB_SETTINGS_KEY = 'dreamese-chapter-github-settings-v1';
  const GITHUB_TOKEN_SESSION_KEY = 'dreamese-chapter-github-token-v1';
  const GITHUB_API_VERSION = '2022-11-28';
  const GITHUB_CONFIG_PATH = 'site-config.json';
  const GITHUB_UPLOAD_DIRECTORY = 'assets/uploads';
  const DEFAULT_GITHUB_REPOSITORY = inferDefaultGitHubRepository();

  let config = null;
  let activePanel = 'brand';
  let editingDevice = 'desktop';
  let previewTimer = 0;
  let toastTimer = 0;
  let dirty = false;
  let draggedProjectIndex = null;
  let draggedProjectArrayPath = '';
  let draggedProjectElement = null;
  let dragProjectStartY = 0;
  let dragProjectMoved = false;
  let dragProjectTargetIndex = null;
  let dragProjectPlaceAfter = false;
  let preservedOpenItemsAfterReorder = null;
  let suppressProjectToggleUntil = 0;
  let dragPressTimer = 0;
  let dragProjectArmed = false;
  let dragProjectPointerId = null;
  let dragProjectPointerType = '';
  let dragProjectStartX = 0;
  let dragProjectStartScrollTop = 0;
  let dragProjectGestureScrolling = false;
  let githubPublishInProgress = false;

  const templates = {
    navigation: { label: 'Mục mới', target: 'about' },
    aboutSlide: { label: '00 / Nội dung', title: 'Tiêu đề mới', body: 'Nội dung mới', image: 'assets/projects/01-tt-villa.svg', link: '#' },
    project: { chapter: '00', title: 'Dự án mới', subtitle: 'Mô tả ngắn', category: 'Loại dự án', image: 'assets/projects/01-tt-villa.svg', description: 'Nội dung giới thiệu dự án.', href: '#' },
    service: { number: '00', name: 'Dịch vụ mới', summary: 'Mô tả dịch vụ.', image: 'assets/projects/01-tt-villa.svg', href: '#', linkLabel: 'Xem thêm →' },
    media: { title: 'Bài Blog mới', label: 'TikTok / Blog', image: 'assets/projects/01-tt-villa.svg', description: 'Mô tả video.', url: 'https://www.tiktok.com/' },
    news: { number: '00', date: '31.07.2026', category: 'News', title: 'Tiêu đề tin tức mới', subtitle: 'Tiêu đề phụ', description: 'Nội dung chi tiết của bài viết.', image: 'assets/projects/01-tt-villa.svg', href: '#contact' },
    contact: { type: 'info', title: 'Thẻ liên hệ', lines: ['Dòng nội dung 1'], image: '', link: '#', linkLabel: 'Xem thêm →' },
    socialLink: { platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/', mobile: { label: 'Instagram', url: 'https://www.instagram.com/' } }
  };

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function normalizeMediaUrlInput(value) {
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

  function getPath(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((current, key) => {
      if (current[key] === undefined) current[key] = /^\d+$/.test(key) ? [] : {};
      return current[key];
    }, object);
    parent[last] = value;
  }

  function field(label, path, options = {}) {
    const value = getPath(config, path) ?? '';
    const full = options.full ? ' full' : '';
    const type = options.type || 'text';
    const help = ''; // Giao diện quản trị chỉ hiển thị nhãn và trường nhập.

    if (type === 'textarea') {
      const text = options.lines && Array.isArray(value) ? value.join('\n') : value;
      return `<div class="field${full}"><label>${escapeHtml(label)}</label><textarea data-path="${escapeHtml(path)}" ${options.lines ? 'data-lines="true"' : ''}>${escapeHtml(text)}</textarea>${help}</div>`;
    }

    if (type === 'select') {
      return `<div class="field${full}"><label>${escapeHtml(label)}</label><select data-path="${escapeHtml(path)}">${options.options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select>${help}</div>`;
    }

    if (type === 'range') {
      return `<div class="field${full}"><label>${escapeHtml(label)}</label><div class="range-field"><input type="range" data-path="${escapeHtml(path)}" data-number="true" min="${options.min}" max="${options.max}" step="${options.step || 1}" value="${escapeHtml(value)}"><input class="range-value" type="number" data-path="${escapeHtml(path)}" data-number="true" min="${options.min}" max="${options.max}" step="${options.step || 1}" value="${escapeHtml(value)}"></div>${help}</div>`;
    }

    return `<div class="field${full}"><label>${escapeHtml(label)}</label><input type="${type}" data-path="${escapeHtml(path)}" ${type === 'number' ? 'data-number="true"' : ''} value="${escapeHtml(value)}" ${options.min !== undefined ? `min="${options.min}"` : ''} ${options.max !== undefined ? `max="${options.max}"` : ''} ${options.step !== undefined ? `step="${options.step}"` : ''}>${help}</div>`;
  }

  function imageField(label, path, options = {}) {
    const value = getPath(config, path) || '';
    const previewHtml = value ? `<img src="${escapeHtml(value)}" alt="Xem trước">` : '<span>Kéo thả hình vào đây</span>';
    return `
      <div class="field full">
        <label>${escapeHtml(label)}</label>
        <div class="image-editor">
          <div class="image-preview" data-drop-image-path="${escapeHtml(path)}">${previewHtml}</div>
          <div class="image-inputs">
            <input type="text" data-path="${escapeHtml(path)}" value="${escapeHtml(value)}" placeholder="URL hình hoặc đường dẫn assets/...">
            <input type="file" data-image-path="${escapeHtml(path)}" accept="image/*">
          </div>
        </div>
      </div>`;
  }

  function panelHeading(title) {
    return `<header class="panel-heading"><h1>${escapeHtml(title)}</h1></header>`;
  }

  function devicePath(basePath, key) {
    return editingDevice === 'mobile' ? `${basePath}.mobile.${key}` : `${basePath}.${key}`;
  }

  function matchingMobilePath(path) {
    if (!path || path.includes('.mobile.')) return '';
    const supported = [
      /^navigation\.\d+\.label$/,
      /^brand\.(?:name|tagline|logo|logoLink|email|phone|location|socialLabel|socialUrl)$/,
      /^about\.(?:eyebrow|title|intro)$/,
      /^about\.slides\.\d+\.(?:label|title|body|image|link)$/,
      /^projectsSection\.(?:eyebrow|title)$/,
      /^projects\.\d+\.(?:title|subtitle|category|image|description|href)$/,
      /^service\.(?:eyebrow|title)$/,
      /^service\.items\.\d+\.(?:name|summary|image|href|linkLabel)$/,
      /^media\.(?:eyebrow|title)$/,
      /^media\.items\.\d+\.(?:title|label|image|description|url)$/,
      /^news\.(?:eyebrow|title)$/,
      /^news\.items\.\d+\.(?:date|category|title|subtitle|description|image|href)$/,
      /^contact\.(?:eyebrow|title)$/,
      /^contact\.cards\.\d+\.(?:title|lines|image|link|linkLabel)$/,
      /^contact\.cards\.\d+\.socialLinks\.\d+\.(?:label|url)$/
    ];
    if (!supported.some((pattern) => pattern.test(path))) return '';
    const keys = path.split('.');
    const fieldName = keys.pop();
    const parentPath = keys.join('.');
    return `${parentPath}.mobile.${fieldName}`;
  }

  function syncDesktopValueToMobile(path, previousValue, nextValue) {
    const mobilePath = matchingMobilePath(path);
    if (!mobilePath) return;
    const mobileValue = getPath(config, mobilePath);
    const isUnset = mobileValue === undefined || mobileValue === null || mobileValue === '';
    const stillFollowingDesktop = mobileValue === previousValue;
    if (isUnset || stillFollowingDesktop) setPath(config, mobilePath, nextValue);
  }

  function modeValue(item, key, fallback = '') {
    if (!item) return fallback;
    if (editingDevice === 'mobile') {
      const mobileValue = item.mobile?.[key];
      if (mobileValue !== undefined && mobileValue !== null && mobileValue !== '') return mobileValue;
    }
    return item[key] ?? fallback;
  }

  function deviceField(label, basePath, key, options = {}) {
    const path = devicePath(basePath, key);
    const mobileHelp = editingDevice === 'mobile'
      ? 'Đây là nội dung riêng cho mobile. Để trống, website sẽ tự dùng nội dung Desktop.'
      : '';
    const help = [options.help, mobileHelp].filter(Boolean).join(' ');
    return field(label, path, { ...options, help });
  }

  function deviceImageField(label, basePath, key = 'image', options = {}) {
    const mobileHelp = editingDevice === 'mobile'
      ? 'Có thể dùng hình khác riêng cho mobile. Để trống sẽ dùng hình Desktop.'
      : '';
    const help = [options.help, mobileHelp].filter(Boolean).join(' ');
    return imageField(label, devicePath(basePath, key), { ...options, help });
  }

  function deviceModeBanner() {
    return '';
  }

  function mobileBlock(title, body) {
    return `<details class="editor-section device-override-section"><summary><strong>${escapeHtml(title)}</strong></summary><div class="editor-section-body">${body}</div></details>`;
  }

  function itemDetails(title, subtitle, body, index, arrayPath, options = {}) {
    const isDraggable = options.draggable !== false;
    const reorderAttributes = isDraggable
      ? ` data-project-reorder-item data-array-path="${escapeHtml(arrayPath)}" data-index="${index}"`
      : '';
    const dragIndicator = isDraggable
      ? `<span class="project-drag-indicator" aria-hidden="true">⠿</span>`
      : '';
    const shouldOpen = preservedOpenItemsAfterReorder
      ? preservedOpenItemsAfterReorder.has(options.itemRef)
      : false;
    const countActions = options.allowCountChange === false
      ? ''
      : `<button type="button" data-duplicate-item data-array-path="${arrayPath}" data-index="${index}">Nhân bản</button>
         <button type="button" class="danger" data-delete-item data-array-path="${arrayPath}" data-index="${index}">Xóa</button>`;

    return `
      <details class="editor-section${isDraggable ? ' is-reorderable' : ''}"${reorderAttributes}${shouldOpen ? ' open' : ''}>
        <summary>
          <span class="editor-section-title">${dragIndicator}<strong>${escapeHtml(title || `Mục ${index + 1}`)}</strong></span>
          <span class="editor-section-controls">
            <span class="editor-section-meta">${escapeHtml(subtitle || `#${index + 1}`)}</span>
          </span>
        </summary>
        <div class="editor-section-body">
          ${body}
          <div class="item-actions">
            <button type="button" data-move-item="up" data-array-path="${arrayPath}" data-index="${index}">↑ Lên</button>
            <button type="button" data-move-item="down" data-array-path="${arrayPath}" data-index="${index}">↓ Xuống</button>
            ${countActions}
          </div>
        </div>
      </details>`;
  }

  function repeaterToolbar(arrayPath, label, templateKey) {
    const count = getPath(config, arrayPath)?.length || 0;
    return `<div class="repeater-toolbar"><p>${count} mục</p><button type="button" data-add-item data-array-path="${arrayPath}" data-template="${templateKey}">+ ${escapeHtml(label)}</button></div>`;
  }

  function renderBrand() {
    const navItems = config.navigation.map((item, index) => itemDetails(
      modeValue(item, 'label', item.label),
      item.target,
      `<div class="field-grid">
        ${deviceField('Tên hiển thị', `navigation.${index}`, 'label')}
        ${field('ID section đích (dùng chung)', `navigation.${index}.target`)}
      </div>`,
      index,
      'navigation',
      { draggable: true, itemRef: item }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('Thương hiệu & Header', 'Logo, tên thương hiệu và tagline dùng chung cho Desktop lẫn Mobile. Nội dung section vẫn có thể chỉnh riêng theo thiết bị.')}
      ${deviceModeBanner()}
      <section class="editor-section browser-brand-section" open>
        <summary><strong>Tab trình duyệt & nhận diện website</strong></summary>
        <div class="editor-section-body">
          <div class="field-grid">
            ${field('Tên trên tab trình duyệt', 'brand.browserTitle', { full: true, help: 'Ví dụ: TITAN CONSTRUCTION — Architecture & Interior Design.' })}
            ${imageField('Biểu tượng tab trình duyệt (Favicon)', 'brand.favicon', { help: 'Nên dùng PNG vuông hoặc ICO. Có thể chọn trực tiếp logo thương hiệu.' })}
            ${field('Mô tả website', 'brand.metaDescription', { type: 'textarea', full: true, help: 'Dùng cho mô tả khi chia sẻ link và tối ưu tìm kiếm.' })}
            ${field('Màu thanh trình duyệt', 'brand.themeColor', { type: 'color' })}
          </div>
        </div>
      </section>
      <section class="editor-section" open>
        <summary><strong>Nhận diện Header dùng chung</strong></summary>
        <div class="editor-section-body">
          <div class="field-grid">
            ${imageField('Logo trong Header', 'brand.logo', { help: 'Logo này được dùng chung cho Desktop và Mobile.' })}
            ${field('Tên thương hiệu trong Header', 'brand.name')}
            ${field('Tagline', 'brand.tagline')}
            ${field('Link khi bấm logo', 'brand.logoLink', { help: 'Ví dụ: #projects hoặc URL trang khác.' })}
          </div>
        </div>
      </section>
      <div class="field-grid">
        ${deviceField('Email footer', 'brand', 'email', { type: 'email' })}
        ${deviceField('Điện thoại footer', 'brand', 'phone')}
        ${deviceField('Địa điểm ngắn', 'brand', 'location')}
        ${deviceField('Tên Social', 'brand', 'socialLabel')}
        ${deviceField('Link Social', 'brand', 'socialUrl', { full: true })}
      </div>
      ${repeaterToolbar('navigation', 'Thêm menu', 'navigation')}
      <div class="repeater-list project-reorder-list">${navItems}</div>
    </div>`;
  }

  function renderAbout() {
    const items = config.about.slides.map((item, index) => itemDetails(
      modeValue(item, 'title', item.title),
      modeValue(item, 'label', item.label),
      `<div class="field-grid">
        ${deviceField('Nhãn', `about.slides.${index}`, 'label')}
        ${deviceField('Link khi bấm', `about.slides.${index}`, 'link')}
        ${deviceField('Tiêu đề', `about.slides.${index}`, 'title', { full: true })}
        ${deviceField('Nội dung', `about.slides.${index}`, 'body', { type: 'textarea', full: true })}
        ${deviceImageField('Hình nền chuyển cảnh', `about.slides.${index}`)}
      </div>`,
      index,
      'about.slides',
      { draggable: true, itemRef: item }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('About Us', 'Chỉnh phần text editorial và hình nền chuyển cảnh riêng cho từng thiết bị.')}
      ${deviceModeBanner()}
      <div class="field-grid">
        ${deviceField('Nhãn section', 'about', 'eyebrow')}
        ${deviceField('Tiêu đề lớn', 'about', 'title', { full: true })}
        ${deviceField('Đoạn giới thiệu', 'about', 'intro', { type: 'textarea', full: true })}
      </div>
      ${repeaterToolbar('about.slides', 'Thêm nội dung', 'aboutSlide')}
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  function renderProjects() {
    const items = config.projects.map((item, index) => itemDetails(
      modeValue(item, 'title', item.title),
      `Chapter ${item.chapter}`,
      `<div class="field-grid">
        ${field('Chapter (dùng chung)', `projects.${index}.chapter`)}
        ${deviceField('Loại dự án', `projects.${index}`, 'category')}
        ${deviceField('Tên dự án', `projects.${index}`, 'title', { full: true })}
        ${deviceField('Câu mô tả ngắn', `projects.${index}`, 'subtitle', { full: true })}
        ${deviceField('Link chuyển trang', `projects.${index}`, 'href', { full: true })}
        ${deviceImageField('Hình dự án', `projects.${index}`)}
      </div>`,
      index,
      'projects',
      { draggable: true, itemRef: item }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('Projects')}
      ${deviceModeBanner()}
      <div class="field-grid">
        ${deviceField('Nhãn section', 'projectsSection', 'eyebrow')}
        ${deviceField('Tiêu đề section', 'projectsSection', 'title', { full: true })}
      </div>
      ${repeaterToolbar('projects', 'Thêm dự án', 'project')}
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  function renderService() {
    const items = config.service.items.map((item, index) => itemDetails(
      modeValue(item, 'name', item.name),
      item.number,
      `<div class="field-grid">
        ${field('Số thứ tự (dùng chung)', `service.items.${index}.number`)}
        ${deviceField('Tên dịch vụ', `service.items.${index}`, 'name', { full: true })}
        ${deviceField('Mô tả', `service.items.${index}`, 'summary', { type: 'textarea', full: true })}
        ${deviceField('Link chuyển trang', `service.items.${index}`, 'href', { full: true })}
        ${deviceImageField('Hình vuông / nền chuyển cảnh', `service.items.${index}`)}
      </div>`,
      index,
      'service.items',
      { draggable: true, itemRef: item, allowCountChange: false }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('Service', 'Bốn dịch vụ dùng chung thứ tự; tên, mô tả, hình và link có thể khác giữa Desktop và Mobile.')}
      ${deviceModeBanner()}
      <div class="field-grid">${deviceField('Nhãn section', 'service', 'eyebrow')}${deviceField('Tiêu đề section', 'service', 'title', { full: true })}</div>
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  function renderMedia() {
    const items = config.media.items.map((item, index) => itemDetails(
      modeValue(item, 'title', item.title),
      modeValue(item, 'label', item.label),
      `<div class="field-grid">
        ${deviceField('Tiêu đề bài Blog / video', `media.items.${index}`, 'title', { full: true })}
        ${deviceField('Nhãn Blog / Kênh', `media.items.${index}`, 'label')}
        ${deviceField('Link TikTok / trang liên kết', `media.items.${index}`, 'url', { help: 'Nên dùng link đầy đủ có dạng tiktok.com/@tenkenh/video/123… Link Desktop sẽ tự đồng bộ sang Mobile nếu Mobile chưa có link riêng.' })}
        <div class="field full media-link-tools">
          <label>Kiểm tra liên kết</label>
          <button type="button" class="ghost-button" data-test-media-link data-path="${escapeHtml(devicePath(`media.items.${index}`, 'url'))}">Mở thử link video ↗</button>
        </div>
        ${deviceField('Mô tả nội dung popup', `media.items.${index}`, 'description', { type: 'textarea', full: true })}
        ${deviceImageField('Ảnh bìa Blog / video', `media.items.${index}`)}
      </div>`,
      index,
      'media.items',
      { draggable: true, itemRef: item }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('Blog')}
      ${deviceModeBanner()}
      <div class="field-grid">${deviceField('Nhãn section', 'media', 'eyebrow')}${deviceField('Tiêu đề section', 'media', 'title', { full: true })}</div>
      ${repeaterToolbar('media.items', 'Thêm bài Blog / video', 'media')}
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  function renderNews() {
    const items = config.news.items.map((item, index) => itemDetails(
      modeValue(item, 'title', item.title),
      `${item.number} · ${modeValue(item, 'date', item.date)}`,
      `<div class="field-grid">
        ${field('Số thứ tự (dùng chung)', `news.items.${index}.number`)}
        ${deviceField('Ngày đăng', `news.items.${index}`, 'date')}
        ${deviceField('Danh mục', `news.items.${index}`, 'category')}
        ${deviceField('Link cuối bài', `news.items.${index}`, 'href')}
        ${deviceField('Tiêu đề thẻ', `news.items.${index}`, 'title', { full: true })}
        ${deviceField('Tiêu đề phụ trong khung chi tiết', `news.items.${index}`, 'subtitle', { full: true })}
        ${deviceField('Nội dung tin tức', `news.items.${index}`, 'description', { type: 'textarea', full: true })}
        ${deviceImageField('Hình đi kèm trong khung chi tiết', `news.items.${index}`)}
      </div>`,
      index,
      'news.items',
      { draggable: true, itemRef: item }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('News', 'Giao diện theo Góc giải đáp: bình thường chỉ có số và tiêu đề; bấm thẻ để mở hình và nội dung chi tiết.')}
      ${deviceModeBanner()}
      <div class="field-grid">${deviceField('Nhãn section', 'news', 'eyebrow')}${deviceField('Tiêu đề section', 'news', 'title', { full: true })}</div>
      ${repeaterToolbar('news.items', 'Thêm tin tức', 'news')}
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  const socialPlatformOptions = [
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'zalo', label: 'Zalo' },
    { value: 'website', label: 'Website khác' }
  ];

  function socialLinksEditor(card, cardIndex) {
    const links = Array.isArray(card.socialLinks) ? card.socialLinks : [];
    const rows = links.map((social, socialIndex) => {
      const base = `contact.cards.${cardIndex}.socialLinks.${socialIndex}`;
      return `<div class="social-link-editor">
        <div class="social-link-editor-head">
          <strong>${escapeHtml(modeValue(social, 'label', social.label) || `Mạng xã hội ${socialIndex + 1}`)}</strong>
          <button type="button" class="danger" data-delete-social-link data-card-index="${cardIndex}" data-social-index="${socialIndex}">Xóa</button>
        </div>
        <div class="field-grid">
          ${field('Nền tảng / Logo', `${base}.platform`, { type: 'select', options: socialPlatformOptions })}
          ${deviceField('Tên hiển thị', base, 'label')}
          ${deviceField('Link riêng', base, 'url', { full: true, help: 'Mỗi nền tảng có một link độc lập. Logo được tạo tự động theo nền tảng đã chọn.' })}
        </div>
      </div>`;
    }).join('');

    return `<div class="social-links-manager full">
      <div class="social-links-manager-heading">
        <div><strong>Các nền tảng Social</strong></div>
        <button type="button" class="ghost-button" data-add-social-link data-card-index="${cardIndex}">+ Thêm nền tảng</button>
      </div>
      ${rows || '<p class="empty-repeater-note">Chưa có nền tảng Social.</p>'}
    </div>`;
  }

  function renderContact() {
    const items = config.contact.cards.map((item, index) => {
      const socialFields = item.type === 'social' ? socialLinksEditor(item, index) : '';
      return itemDetails(
        modeValue(item, 'title', item.title),
        item.type,
        `<div class="field-grid">
          ${field('Loại thẻ (dùng chung)', `contact.cards.${index}.type`, { type: 'select', options: [
            { value: 'info', label: 'Thông tin liên hệ' },
            { value: 'address', label: 'Địa chỉ' },
            { value: 'maps', label: 'Maps' },
            { value: 'social', label: 'Social' }
          ] })}
          ${deviceField('Tên thẻ', `contact.cards.${index}`, 'title')}
          ${item.type === 'social' ? '' : deviceField('Các dòng nội dung', `contact.cards.${index}`, 'lines', { type: 'textarea', lines: true, full: true, help: 'Mỗi dòng trong ô tương ứng một dòng nội dung.' })}
          ${item.type === 'social' ? '' : deviceField('Link toàn thẻ', `contact.cards.${index}`, 'link')}
          ${deviceImageField('Hình thẻ (có thể để trống)', `contact.cards.${index}`)}
          ${socialFields}
        </div>`,
        index,
        'contact.cards',
        { draggable: true, itemRef: item, allowCountChange: false }
      );
    }).join('');

    return `<div class="editor-panel">
      ${panelHeading('Contact', 'Bốn thẻ: Thông tin liên hệ — Địa chỉ — Maps — Social. Trong thẻ Social, mỗi nền tảng có logo và link riêng.')}
      ${deviceModeBanner()}
      <div class="field-grid">${deviceField('Nhãn section', 'contact', 'eyebrow')}${deviceField('Tiêu đề section', 'contact', 'title', { full: true })}</div>
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  function renderLayout() {
    return `<div class="editor-panel">
      ${panelHeading('Kích thước & Font', 'v0.7.3 khóa mỗi section trong đúng một khung nhìn; bạn có thể chỉnh thẻ, khoảng cách và kích thước chữ.')}
      <details class="editor-section" open><summary><strong>Chiều cao Header / Footer</strong><span>px</span></summary><div class="editor-section-body"><div class="field-grid">
        ${field('Header desktop', 'layout.headerHeightDesktop', { type: 'range', min: 56, max: 140 })}
        ${field('Footer desktop', 'layout.footerHeightDesktop', { type: 'range', min: 40, max: 140 })}
        ${field('Header mobile', 'layout.headerHeightMobile', { type: 'range', min: 80, max: 160 })}
        ${field('Footer mobile', 'layout.footerHeightMobile', { type: 'range', min: 40, max: 120 })}
      </div></div></details>
      <div class="device-mode-banner"><strong>SECTION</strong><span>Mỗi section được khóa đúng một khung nhìn để không lộ nội dung kế bên. Phần dài sẽ cuộn bên trong section.</span></div>
      <details class="editor-section" open><summary><strong>Chiều rộng thẻ & Bo góc</strong><span>px</span></summary><div class="editor-section-body"><div class="field-grid">
        ${field('Thẻ dự án', 'layout.projectCardWidth', { type: 'range', min: 200, max: 620 })}
        ${field('Thẻ dịch vụ', 'layout.serviceCardWidth', { type: 'range', min: 240, max: 600 })}
        ${field('Thẻ Blog', 'layout.mediaCardWidth', { type: 'range', min: 180, max: 500 })}
        ${field('Thẻ Contact', 'layout.contactCardWidth', { type: 'range', min: 240, max: 600 })}
        ${field('Độ bo góc', 'layout.cardRadius', { type: 'range', min: 0, max: 60 })}
        ${field('Chiều cao thẻ Project mobile', 'layout.mobileProjectCardHeight', { type: 'range', min: 150, max: 420 })}
        ${field('Khoảng cách Project mobile', 'layout.mobileProjectGap', { type: 'range', min: 4, max: 40 })}
        ${field('Lề section mobile', 'layout.mobileSectionPadding', { type: 'range', min: 4, max: 36 })}
      </div></div></details>
      <details class="editor-section" open><summary><strong>Kích thước chữ</strong><span>px</span></summary><div class="editor-section-body"><div class="field-grid">
        ${field('Tiêu đề desktop', 'layout.headingSizeDesktop', { type: 'range', min: 34, max: 130 })}
        ${field('Tiêu đề mobile', 'layout.headingSizeMobile', { type: 'range', min: 28, max: 90 })}
        ${field('Nội dung', 'layout.bodySize', { type: 'range', min: 11, max: 24 })}
        ${field('Tên dự án', 'layout.projectTitleSize', { type: 'range', min: 30, max: 100 })}
        ${field('Menu header', 'layout.navSize', { type: 'range', min: 7, max: 20 })}
        ${field('Tên thương hiệu', 'layout.brandSize', { type: 'range', min: 10, max: 32 })}
      </div></div></details>
    </div>`;
  }

  function renderBackup() {
    return `<div class="editor-panel">
      ${panelHeading('Sao lưu & Đưa lên hosting', 'Dữ liệu quản trị được lưu trong trình duyệt. Xuất site-config.json để dùng cùng website khi đưa lên hosting.')}
      <div class="backup-card"><h3>Xuất cấu hình website</h3><div class="backup-actions"><button type="button" data-backup-action="export">Xuất site-config.json</button></div></div>
      <div class="backup-card"><h3>Nhập cấu hình</h3><div class="backup-actions"><label class="ghost-button file-button">Chọn file JSON<input type="file" data-backup-import accept="application/json"></label></div></div>
      <div class="backup-card"><h3>Khôi phục mặc định</h3><div class="backup-actions"><button type="button" class="danger-button" data-backup-action="reset">Khôi phục mặc định</button></div></div>
    </div>`;
  }

  const renderers = {
    brand: renderBrand,
    about: renderAbout,
    projects: renderProjects,
    service: renderService,
    media: renderMedia,
    news: renderNews,
    contact: renderContact,
    layout: renderLayout,
    backup: renderBackup
  };

  function renderPanel() {
    editor.innerHTML = renderers[activePanel]?.() || renderBrand();
    bindImageDropZones();
  }

  function setDirty(value = true) {
    dirty = value;
    status.textContent = value ? 'Có thay đổi chưa lưu' : 'Đã lưu';
    status.style.color = value ? '#efbf83' : '';
  }

  function updateManagerBrandChrome() {
    if (!config?.brand) return;
    const brandName = String(config.brand.name || 'Website').trim() || 'Website';
    const browserTitle = String(config.brand.browserTitle || brandName).trim() || brandName;
    const favicon = String(config.brand.favicon || config.brand.logo || '').trim();

    document.title = `${browserTitle} — Site Manager`;
    const productName = q('#managerProductName');
    if (productName) productName.textContent = `${brandName} Site Manager`;
    const sidebarLogo = q('#managerSidebarLogo');
    if (sidebarLogo && favicon) sidebarLogo.src = config.brand.logo || favicon;
    const managerFavicon = q('#managerFavicon');
    if (managerFavicon && favicon) managerFavicon.href = favicon;
  }

  function syncPreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      preview.contentWindow?.postMessage({ type: 'DREAMESE_PREVIEW_CONFIG', config }, '*');
    }, 90);
  }

  function showToast(message) {
    let toast = q('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }

  async function handleImageFile(file, path) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Vui lòng chọn đúng file hình ảnh.');
      return;
    }
    const openItems = captureOpenItems();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const previousValue = getPath(config, path);
    setPath(config, path, dataUrl);
    syncDesktopValueToMobile(path, previousValue, dataUrl);
    if (path === 'brand.logo') setPath(config, 'brand.mobile.logo', dataUrl);
    setDirty();
    renderPanelPreservingOpen(openItems);
    syncPreview();
  }

  function bindImageDropZones() {
    qa('[data-drop-image-path]', editor).forEach((zone) => {
      const path = zone.dataset.dropImagePath;
      zone.addEventListener('click', () => q(`[data-image-path="${CSS.escape(path)}"]`, editor)?.click());
      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('is-dragging');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('is-dragging');
        handleImageFile(event.dataTransfer.files?.[0], path);
      });
    });
  }

  function captureOpenItems() {
    const openItems = new Set();
    qa('[data-project-reorder-item]', editor).forEach((details) => {
      if (!details.open) return;
      const array = getPath(config, details.dataset.arrayPath || '');
      const item = Array.isArray(array) ? array[Number(details.dataset.index)] : null;
      if (item && typeof item === 'object') openItems.add(item);
    });
    return openItems;
  }

  function renderPanelPreservingOpen(openItems = captureOpenItems()) {
    preservedOpenItemsAfterReorder = openItems;
    renderPanel();
    preservedOpenItemsAfterReorder = null;
  }

  function clearProjectDragState() {
    window.clearTimeout(dragPressTimer);
    dragPressTimer = 0;
    qa('[data-project-reorder-item]', editor).forEach((item) => {
      item.classList.remove('is-dragging', 'is-drag-ready', 'drag-before', 'drag-after');
    });
    draggedProjectIndex = null;
    draggedProjectArrayPath = '';
    draggedProjectElement = null;
    dragProjectMoved = false;
    dragProjectTargetIndex = null;
    dragProjectPlaceAfter = false;
    dragProjectArmed = false;
    dragProjectPointerId = null;
    dragProjectPointerType = '';
    dragProjectGestureScrolling = false;
  }

  function reorderProject(arrayPath, sourceIndex, targetIndex, placeAfter) {
    const array = getPath(config, arrayPath);
    if (!Array.isArray(array)) return;
    if (sourceIndex < 0 || sourceIndex >= array.length || targetIndex < 0 || targetIndex >= array.length) return;

    // Ghi nhớ chính xác các thẻ đang mở trước khi kéo. Sau khi đổi thứ tự,
    // trạng thái mở/đóng được phục hồi theo chính đối tượng dữ liệu, không theo vị trí.
    // Vì vậy thao tác sắp xếp không thể tự mở thẻ đầu tiên hoặc đóng thẻ đang chỉnh.
    const openItems = captureOpenItems();

    let insertionIndex = targetIndex + (placeAfter ? 1 : 0);
    const [movedItem] = array.splice(sourceIndex, 1);
    if (sourceIndex < insertionIndex) insertionIndex -= 1;
    insertionIndex = clampNumber(insertionIndex, 0, array.length);
    array.splice(insertionIndex, 0, movedItem);

    if (insertionIndex === sourceIndex) {
      clearProjectDragState();
      return;
    }

    clearProjectDragState();
    setDirty();
    renderPanelPreservingOpen(openItems);
    syncPreview();
    showToast(`Đã chuyển mục sang vị trí ${insertionIndex + 1}.`);
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function moveItem(arrayPath, index, direction) {
    const array = getPath(config, arrayPath);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (!Array.isArray(array) || nextIndex < 0 || nextIndex >= array.length) return;
    const openItems = captureOpenItems();
    [array[index], array[nextIndex]] = [array[nextIndex], array[index]];
    setDirty();
    renderPanelPreservingOpen(openItems);
    syncPreview();
  }

  function inferDefaultGitHubRepository() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    const pathParts = String(window.location.pathname || '').split('/').filter(Boolean);
    if (hostname.endsWith('.github.io') && pathParts[0]) {
      return `${hostname.replace(/\.github\.io$/, '')}/${pathParts[0]}`;
    }
    return 'dreamese/titan_construction';
  }

  function readGitHubSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(GITHUB_SETTINGS_KEY) || 'null');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function parseRepositoryName(value) {
    const cleanValue = String(value || '')
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');
    const parts = cleanValue.split('/').filter(Boolean);
    if (parts.length !== 2) throw new Error('Repository phải có dạng tài-khoản/tên-repository.');
    return { owner: parts[0], repo: parts[1] };
  }

  async function getGitHubConnection() {
    const saved = readGitHubSettings();
    const repositoryInput = window.prompt(
      'Repository đang chứa website (dạng tài-khoản/repository):',
      saved.repository || DEFAULT_GITHUB_REPOSITORY
    );
    if (repositoryInput === null) throw new DOMException('Đã hủy xuất bản.', 'AbortError');

    const repository = parseRepositoryName(repositoryInput);
    localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify({
      repository: `${repository.owner}/${repository.repo}`
    }));

    let token = sessionStorage.getItem(GITHUB_TOKEN_SESSION_KEY) || '';
    if (!token) {
      token = window.prompt(
        'Dán GitHub Fine-grained Personal Access Token có quyền Contents: Read and write. Token sẽ tự mất khi đóng tab:'
      ) || '';
    }
    token = token.trim();
    if (!token) throw new DOMException('Chưa nhập GitHub token.', 'AbortError');
    sessionStorage.setItem(GITHUB_TOKEN_SESSION_KEY, token);

    status.textContent = 'Đang kiểm tra kết nối GitHub…';
    const repositoryInfo = await githubRequest(
      `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`,
      { token }
    );

    return {
      ...repository,
      token,
      branch: repositoryInfo.default_branch || 'main'
    };
  }

  async function githubRequest(url, {
    token,
    method = 'GET',
    body = null,
    allowNotFound = false
  } = {}) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (allowNotFound && response.status === 404) return null;

    const responseText = await response.text();
    let responseData = null;
    if (responseText) {
      try { responseData = JSON.parse(responseText); }
      catch { responseData = responseText; }
    }

    if (!response.ok) {
      const detail = responseData?.message || responseData || response.statusText;
      const error = new Error(`GitHub ${response.status}: ${detail}`);
      error.status = response.status;
      throw error;
    }
    return responseData;
  }

  function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function textToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(String(text || '')));
  }

  function dataUrlToBase64(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i);
    if (!match) throw new Error('Không thể đọc dữ liệu hình ảnh.');
    if (match[2]) return match[3].replace(/\s/g, '');
    return textToBase64(decodeURIComponent(match[3]));
  }

  function imageExtensionFromDataUrl(dataUrl) {
    const mime = String(dataUrl || '').match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || '';
    const extensions = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'image/avif': 'avif',
      'image/bmp': 'bmp'
    };
    return extensions[mime] || 'png';
  }

  async function shortHash(value) {
    if (window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(String(value || ''))
      );
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 24);
    }

    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
  }

  async function preparePublishedConfig(sourceConfig) {
    const publishedConfig = DreameseStore.clone(sourceConfig);
    const uploadMap = new Map();

    async function visit(value, parent, key) {
      if (typeof value === 'string' && /^data:image\//i.test(value)) {
        let upload = uploadMap.get(value);
        if (!upload) {
          const fileName = `${await shortHash(value)}.${imageExtensionFromDataUrl(value)}`;
          upload = {
            path: `${GITHUB_UPLOAD_DIRECTORY}/${fileName}`,
            contentBase64: dataUrlToBase64(value),
            skipIfExists: true
          };
          uploadMap.set(value, upload);
        }
        parent[key] = upload.path;
        return;
      }

      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
          await visit(value[index], value, index);
        }
        return;
      }

      if (value && typeof value === 'object') {
        for (const childKey of Object.keys(value)) {
          await visit(value[childKey], value, childKey);
        }
      }
    }

    await visit(publishedConfig, { root: publishedConfig }, 'root');
    return { publishedConfig, uploads: [...uploadMap.values()] };
  }

  async function putGitHubFile(connection, path, contentBase64, message, skipIfExists = false) {
    const encodedPath = String(path || '')
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${encodedPath}`;
    const existing = await githubRequest(
      `${endpoint}?ref=${encodeURIComponent(connection.branch)}`,
      { token: connection.token, allowNotFound: true }
    );

    if (skipIfExists && existing?.sha) return false;

    const normalizedContent = String(contentBase64 || '').replace(/\s/g, '');
    const existingContent = String(existing?.content || '').replace(/\s/g, '');
    if (existing?.sha && existingContent && existingContent === normalizedContent) return false;

    const body = {
      message,
      content: normalizedContent,
      branch: connection.branch
    };
    if (existing?.sha) body.sha = existing.sha;

    await githubRequest(endpoint, {
      token: connection.token,
      method: 'PUT',
      body
    });
    return true;
  }

  async function publishConfigToGitHub(connection) {
    const prepared = await preparePublishedConfig(config);
    const files = [
      ...prepared.uploads,
      {
        path: GITHUB_CONFIG_PATH,
        contentBase64: textToBase64(JSON.stringify(prepared.publishedConfig, null, 2))
      }
    ];
    const commitMessage = 'Update Dreamese Chapter Site from Manager';
    let changedFiles = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      status.textContent = `Đang xuất bản ${index + 1}/${files.length}: ${file.path}`;
      if (await putGitHubFile(connection, file.path, file.contentBase64, commitMessage, file.skipIfExists)) {
        changedFiles += 1;
      }
    }

    return { totalFiles: files.length, changedFiles };
  }

  async function save() {
    if (githubPublishInProgress) return;
    githubPublishInProgress = true;

    const saveButton = q('#saveConfig');
    const originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'Đang lưu…';

    try {
      status.textContent = 'Đang lưu bản dự phòng trên trình duyệt…';
      await DreameseStore.saveConfig(config);
      setDirty(false);
      syncPreview();

      const connection = await getGitHubConnection();
      const result = await publishConfigToGitHub(connection);
      status.textContent = result.changedFiles
        ? `Đã xuất bản ${result.changedFiles} file lên GitHub.`
        : 'Nội dung trên GitHub đã là bản mới nhất.';
      showToast('Đã lưu và đồng bộ cho mọi thiết bị.');
    } catch (error) {
      console.error(error);
      if (error?.name === 'AbortError') {
        status.textContent = 'Đã lưu trên trình duyệt, chưa xuất bản lên GitHub.';
        showToast('Đã lưu bản dự phòng trên thiết bị này.');
      } else {
        if (Number(error?.status) === 401 || Number(error?.status) === 403) {
          sessionStorage.removeItem(GITHUB_TOKEN_SESSION_KEY);
        }
        status.textContent = `Đã lưu cục bộ nhưng xuất bản thất bại: ${error?.message || error}`;
        showToast('Không thể xuất bản lên GitHub.');
      }
    } finally {
      githubPublishInProgress = false;
      saveButton.disabled = false;
      saveButton.textContent = originalLabel;
    }
  }

  function exportConfig() {
    DreameseStore.downloadJson(config, 'site-config.json');
    showToast('Đã xuất site-config.json.');
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      config = DreameseStore.mergeDeep(DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG), parsed);
      await DreameseStore.saveConfig(config);
      setDirty(false);
      renderPanel();
      syncPreview();
      showToast('Đã nhập cấu hình thành công.');
    } catch (error) {
      console.error(error);
      showToast('File JSON không hợp lệ.');
    }
  }

  async function resetDefaults() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ chỉnh sửa và quay về dữ liệu mặc định?')) return;
    await DreameseStore.clearConfig();
    config = DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG);
    setDirty(false);
    renderPanel();
    syncPreview();
    showToast('Đã khôi phục dữ liệu mặc định.');
  }

  function bindEvents() {
    q('#deviceEditSwitch').addEventListener('click', (event) => {
      const button = event.target.closest('[data-edit-device]');
      if (!button) return;
      editingDevice = button.dataset.editDevice;
      qa('[data-edit-device]', q('#deviceEditSwitch')).forEach((item) => item.classList.toggle('is-active', item === button));
      renderPanel();
      editor.scrollTop = 0;
      if (editingDevice === 'mobile') preview.style.width = `${Math.min(390, previewStage.clientWidth)}px`;
      else preview.style.width = '100%';
      syncPreview();
    });

    tabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-panel]');
      if (!button) return;
      activePanel = button.dataset.panel;
      qa('[data-panel]', tabs).forEach((tab) => tab.classList.toggle('is-active', tab === button));
      renderPanel();
      editor.scrollTop = 0;
    });

    editor.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const summary = event.target.closest('summary');
      const item = summary?.closest('[data-project-reorder-item]');
      if (!item) return;
      if (event.target.closest('input, textarea, select, button, a, label, .image-preview')) return;

      window.clearTimeout(dragPressTimer);
      draggedProjectIndex = Number(item.dataset.index);
      draggedProjectArrayPath = item.dataset.arrayPath || 'projects';
      draggedProjectElement = item;
      dragProjectStartX = event.clientX;
      dragProjectStartY = event.clientY;
      dragProjectStartScrollTop = editor.scrollTop;
      dragProjectMoved = false;
      dragProjectArmed = false;
      dragProjectGestureScrolling = false;
      dragProjectPointerId = event.pointerId;
      dragProjectPointerType = event.pointerType || 'mouse';
      dragProjectTargetIndex = draggedProjectIndex;
      dragProjectPlaceAfter = false;

      dragPressTimer = window.setTimeout(() => {
        if (!draggedProjectElement || dragProjectGestureScrolling) return;
        dragProjectArmed = true;
        draggedProjectElement.classList.add('is-drag-ready');
        try { draggedProjectElement.setPointerCapture?.(dragProjectPointerId); } catch {}
        try { navigator.vibrate?.(18); } catch {}
      }, 360);
    });

    editor.addEventListener('pointermove', (event) => {
      if (draggedProjectIndex === null || !draggedProjectElement || event.pointerId !== dragProjectPointerId) return;
      const dx = event.clientX - dragProjectStartX;
      const dy = event.clientY - dragProjectStartY;
      const distance = Math.hypot(dx, dy);

      // Vuốt ngay lập tức vẫn cuộn trang quản trị. Chỉ khi giữ đủ lâu mới chuyển sang kéo thẻ.
      if (!dragProjectArmed) {
        if (distance < 7) return;
        window.clearTimeout(dragPressTimer);
        dragPressTimer = 0;
        if (dragProjectPointerType === 'touch' || dragProjectPointerType === 'pen') {
          dragProjectGestureScrolling = true;
          suppressProjectToggleUntil = performance.now() + 320;
          editor.scrollTop = dragProjectStartScrollTop - dy;
          event.preventDefault();
        } else {
          suppressProjectToggleUntil = performance.now() + 260;
          clearProjectDragState();
        }
        return;
      }

      if (!dragProjectMoved && distance < 4) return;
      if (!dragProjectMoved) {
        dragProjectMoved = true;
        draggedProjectElement.classList.remove('is-drag-ready');
        draggedProjectElement.classList.add('is-dragging');
      }

      event.preventDefault();
      const editorRect = editor.getBoundingClientRect();
      if (event.clientY < editorRect.top + 60) editor.scrollBy({ top: -22, behavior: 'auto' });
      if (event.clientY > editorRect.bottom - 60) editor.scrollBy({ top: 22, behavior: 'auto' });

      const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
      const target = elementAtPoint?.closest?.('[data-project-reorder-item]');
      if (!target || target.dataset.arrayPath !== draggedProjectArrayPath) return;

      qa('[data-project-reorder-item]', editor).forEach((projectItem) => projectItem.classList.remove('drag-before', 'drag-after'));
      const rect = target.getBoundingClientRect();
      dragProjectPlaceAfter = event.clientY > rect.top + rect.height / 2;
      dragProjectTargetIndex = Number(target.dataset.index);
      target.classList.add(dragProjectPlaceAfter ? 'drag-after' : 'drag-before');
    });

    const finishProjectPointerDrag = (event) => {
      if (draggedProjectIndex === null || event.pointerId !== dragProjectPointerId) return;
      window.clearTimeout(dragPressTimer);
      dragPressTimer = 0;
      try {
        if (draggedProjectElement?.hasPointerCapture?.(event.pointerId)) draggedProjectElement.releasePointerCapture(event.pointerId);
      } catch {}

      if (dragProjectGestureScrolling) {
        suppressProjectToggleUntil = performance.now() + 320;
        clearProjectDragState();
        return;
      }

      if (dragProjectArmed) {
        suppressProjectToggleUntil = performance.now() + 320;
        if (dragProjectMoved && dragProjectTargetIndex !== null) {
          reorderProject(
            draggedProjectArrayPath,
            draggedProjectIndex,
            dragProjectTargetIndex,
            dragProjectPlaceAfter
          );
          return;
        }
        clearProjectDragState();
        return;
      }

      clearProjectDragState();
    };

    editor.addEventListener('pointerup', finishProjectPointerDrag);
    editor.addEventListener('pointercancel', finishProjectPointerDrag);

    // Bấm một lần vào đầu thẻ để mở/thu gọn. Click sau thao tác giữ-kéo sẽ bị loại bỏ.
    editor.addEventListener('click', (event) => {
      const reorderItem = event.target.closest('[data-project-reorder-item]');
      if (performance.now() < suppressProjectToggleUntil && reorderItem) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const summary = event.target.closest('summary');
      if (!summary || !reorderItem) return;
      if (event.target.closest('input, textarea, select, button, a, label')) return;
      event.preventDefault();
      const details = summary.closest('details.editor-section');
      if (details) details.open = !details.open;
    }, true);

    editor.addEventListener('input', (event) => {
      const input = event.target.closest('[data-path]');
      if (!input) return;
      const path = input.dataset.path;
      const previousValue = getPath(config, path);
      let value = input.value;
      if (input.dataset.number === 'true') value = Number(value);
      if (input.dataset.lines === 'true') value = value.split('\n').map((line) => line.trim()).filter(Boolean);
      if (/^media\.items\.\d+\.(?:mobile\.)?url$/.test(path)) {
        value = normalizeMediaUrlInput(value);
        if (input.value !== value) input.value = value;
      }
      setPath(config, path, value);
      syncDesktopValueToMobile(path, previousValue, value);

      if (/^contact\.cards\.\d+\.type$/.test(path)) {
        const openItems = captureOpenItems();
        setDirty();
        renderPanelPreservingOpen(openItems);
        syncPreview();
        return;
      }

      // Nhận diện Header là dữ liệu dùng chung. Giữ bản mobile trong cấu hình
      // được đồng bộ để file JSON xuất ra không còn giá trị cũ.
      const sharedBrandField = path.match(/^brand\.(name|tagline|logoLink)$/);
      if (sharedBrandField) setPath(config, `brand.mobile.${sharedBrandField[1]}`, value);


      if (input.type === 'range') {
        qa(`[data-path="${CSS.escape(input.dataset.path)}"]`, editor).forEach((peer) => {
          if (peer !== input) peer.value = input.value;
        });
      }

      const zone = q(`[data-drop-image-path="${CSS.escape(input.dataset.path)}"]`, editor);
      if (zone) zone.innerHTML = value ? `<img src="${escapeHtml(value)}" alt="Xem trước">` : '<span>Kéo thả hình vào đây</span>';

      updateManagerBrandChrome();
      setDirty();
      syncPreview();
    });

    editor.addEventListener('change', (event) => {
      const fileInput = event.target.closest('[data-image-path]');
      if (fileInput) handleImageFile(fileInput.files?.[0], fileInput.dataset.imagePath);
      const importInput = event.target.closest('[data-backup-import]');
      if (importInput) importFile(importInput.files?.[0]);
    });

    editor.addEventListener('click', (event) => {
      const add = event.target.closest('[data-add-item]');
      if (add) {
        const openItems = captureOpenItems();
        const array = getPath(config, add.dataset.arrayPath);
        array.push(DreameseStore.clone(templates[add.dataset.template]));
        setDirty();
        renderPanelPreservingOpen(openItems);
        syncPreview();
        return;
      }
      const del = event.target.closest('[data-delete-item]');
      if (del) {
        const openItems = captureOpenItems();
        const array = getPath(config, del.dataset.arrayPath);
        const index = Number(del.dataset.index);
        if (array.length <= 1) { showToast('Cần giữ lại ít nhất một mục.'); return; }
        array.splice(index, 1);
        setDirty();
        renderPanelPreservingOpen(openItems);
        syncPreview();
        return;
      }
      const duplicate = event.target.closest('[data-duplicate-item]');
      if (duplicate) {
        const openItems = captureOpenItems();
        const array = getPath(config, duplicate.dataset.arrayPath);
        const index = Number(duplicate.dataset.index);
        array.splice(index + 1, 0, DreameseStore.clone(array[index]));
        setDirty();
        renderPanelPreservingOpen(openItems);
        syncPreview();
        return;
      }
      const move = event.target.closest('[data-move-item]');
      if (move) {
        moveItem(move.dataset.arrayPath, Number(move.dataset.index), move.dataset.moveItem);
        return;
      }
      const testMediaLink = event.target.closest('[data-test-media-link]');
      if (testMediaLink) {
        event.preventDefault();
        const href = normalizeMediaUrlInput(getPath(config, testMediaLink.dataset.path));
        if (!href) {
          showToast('Link video chưa hợp lệ.');
          return;
        }
        const opened = window.open(href, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.href = href;
        return;
      }

      const addSocial = event.target.closest('[data-add-social-link]');
      if (addSocial) {
        const openItems = captureOpenItems();
        const card = config.contact.cards[Number(addSocial.dataset.cardIndex)];
        if (!Array.isArray(card.socialLinks)) card.socialLinks = [];
        card.socialLinks.push(DreameseStore.clone(templates.socialLink));
        setDirty();
        renderPanelPreservingOpen(openItems);
        syncPreview();
        return;
      }

      const deleteSocial = event.target.closest('[data-delete-social-link]');
      if (deleteSocial) {
        const openItems = captureOpenItems();
        const card = config.contact.cards[Number(deleteSocial.dataset.cardIndex)];
        const links = card?.socialLinks;
        if (!Array.isArray(links)) return;
        links.splice(Number(deleteSocial.dataset.socialIndex), 1);
        setDirty();
        renderPanelPreservingOpen(openItems);
        syncPreview();
        return;
      }

      const backup = event.target.closest('[data-backup-action]');
      if (backup?.dataset.backupAction === 'export') exportConfig();
      if (backup?.dataset.backupAction === 'reset') resetDefaults();
    });

    q('#saveConfig').addEventListener('click', save);
    q('#exportConfig').addEventListener('click', exportConfig);
    q('#importConfig').addEventListener('change', (event) => importFile(event.target.files?.[0]));
    q('#openWebsite').addEventListener('click', () => window.open('index.html', '_blank'));
    q('#refreshPreview').addEventListener('click', () => {
      preview.src = `index.html?preview=1&ts=${Date.now()}`;
    });
    qa('[data-preview-width]').forEach((button) => {
      button.addEventListener('click', () => {
        const width = Number(button.dataset.previewWidth);
        preview.style.width = `${Math.min(width, previewStage.clientWidth)}px`;
      });
    });
    preview.addEventListener('load', syncPreview);
    window.addEventListener('beforeunload', (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  async function init() {
    config = await DreameseStore.loadConfig();
    status.textContent = 'Đã tải dữ liệu';
    renderPanel();
    updateManagerBrandChrome();
    bindEvents();
    syncPreview();
  }

  init().catch((error) => {
    console.error(error);
    config = DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG);
    status.textContent = 'Dùng dữ liệu mặc định';
    renderPanel();
    updateManagerBrandChrome();
    bindEvents();
    syncPreview();
  });
})();
