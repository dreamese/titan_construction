(() => {
  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const editor = q('#managerEditor');
  const preview = q('#sitePreview');
  const status = q('#saveStatus');
  const tabs = q('#managerTabs');
  const previewStage = q('#previewStage');

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

  const templates = {
    navigation: { label: 'Mục mới', target: 'about' },
    aboutSlide: { label: '00 / Nội dung', title: 'Tiêu đề mới', body: 'Nội dung mới', image: 'assets/projects/01-tt-villa.svg', link: '#' },
    project: { chapter: '00', title: 'Dự án mới', subtitle: 'Mô tả ngắn', category: 'Loại dự án', image: 'assets/projects/01-tt-villa.svg', description: 'Nội dung giới thiệu dự án.', href: '#' },
    service: { number: '00', name: 'Dịch vụ mới', summary: 'Mô tả dịch vụ.', image: 'assets/projects/01-tt-villa.svg', href: '#', linkLabel: 'Xem thêm →' },
    media: { title: 'Video mới', label: 'TikTok / Social Media', image: 'assets/projects/01-tt-villa.svg', description: 'Mô tả video.', url: 'https://www.tiktok.com/' },
    news: { number: '00', date: '31.07.2026', category: 'News', title: 'Tiêu đề tin tức mới', subtitle: 'Tiêu đề phụ', description: 'Nội dung chi tiết của bài viết.', image: 'assets/projects/01-tt-villa.svg', href: '#contact' },
    contact: { type: 'info', title: 'Thẻ liên hệ', lines: ['Dòng nội dung 1'], image: '', link: '#', linkLabel: 'Xem thêm →' }
  };

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
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
    const help = options.help ? `<small>${escapeHtml(options.help)}</small>` : '';

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
            <small>${escapeHtml(options.help || 'Ảnh được chọn từ máy sẽ lưu trực tiếp vào cấu hình trình duyệt.')}</small>
          </div>
        </div>
      </div>`;
  }

  function panelHeading(title, description) {
    return `<header class="panel-heading"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></header>`;
  }

  function devicePath(basePath, key) {
    return editingDevice === 'mobile' ? `${basePath}.mobile.${key}` : `${basePath}.${key}`;
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
    return `<div class="device-mode-banner"><strong>${editingDevice === 'mobile' ? 'MOBILE' : 'DESKTOP'}</strong><span>${editingDevice === 'mobile'
      ? 'Bạn đang chỉnh nội dung riêng cho màn hình mobile. Thứ tự các mục vẫn dùng chung với Desktop.'
      : 'Bạn đang chỉnh nội dung hiển thị trên Desktop. Chuyển sang Nội dung Mobile ở thanh trên để nhập phiên bản riêng.'}</span></div>`;
  }

  function mobileBlock(title, body) {
    return `<details class="editor-section device-override-section"><summary><strong>${escapeHtml(title)}</strong><span>Mobile override</span></summary><div class="editor-section-body">${body}<p class="device-override-help">Để trống trường Mobile để website tự dùng nội dung Desktop tương ứng.</p></div></details>`;
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
            <button type="button" class="editor-toggle-button" data-toggle-editor-section aria-expanded="${shouldOpen ? 'true' : 'false'}">${shouldOpen ? 'Thu gọn' : 'Chỉnh sửa'}</button>
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
      ${panelHeading('Thương hiệu & Header', 'Chỉnh riêng logo, tên studio và tagline cho Desktop hoặc Mobile.')}
      ${deviceModeBanner()}
      <div class="field-grid">
        ${deviceImageField('Logo', 'brand', 'logo')}
        ${deviceField('Tên thương hiệu', 'brand', 'name')}
        ${deviceField('Tagline', 'brand', 'tagline')}
        ${deviceField('Link khi bấm logo', 'brand', 'logoLink', { help: 'Ví dụ: #projects hoặc URL trang khác.' })}
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
      ${panelHeading('Projects', 'Nắm vùng trống của toàn bộ thẻ để đổi thứ tự. Chỉ nút Chỉnh sửa mới mở nội dung; kéo thả không tác động trạng thái mở.')}
      ${deviceModeBanner()}
      ${repeaterToolbar('projects', 'Thêm dự án', 'project')}
      <div class="project-reorder-note"><span aria-hidden="true">⠿</span><p>Nắm vùng trống của thẻ để sắp xếp. Nút Chỉnh sửa hoạt động độc lập với kéo thả.</p></div>
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
        ${deviceField('Tiêu đề video', `media.items.${index}`, 'title', { full: true })}
        ${deviceField('Nhãn / Kênh', `media.items.${index}`, 'label')}
        ${deviceField('Link TikTok / video', `media.items.${index}`, 'url')}
        ${deviceField('Mô tả popup', `media.items.${index}`, 'description', { type: 'textarea', full: true })}
        ${deviceImageField('Ảnh bìa video', `media.items.${index}`)}
      </div>`,
      index,
      'media.items',
      { draggable: true, itemRef: item }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('Media', 'Có thể thêm nhiều video, kéo toàn bộ thẻ để đổi thứ tự và dùng nút Chỉnh sửa để mở nội dung.')}
      ${deviceModeBanner()}
      <div class="field-grid">${deviceField('Nhãn section', 'media', 'eyebrow')}${deviceField('Tiêu đề section', 'media', 'title', { full: true })}</div>
      ${repeaterToolbar('media.items', 'Thêm video', 'media')}
      <div class="project-reorder-note"><span aria-hidden="true">⠿</span><p>Nắm vùng trống của thẻ để đổi vị trí. Chỉ nút Chỉnh sửa mới đóng hoặc mở nội dung.</p></div>
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

  function renderContact() {
    const items = config.contact.cards.map((item, index) => itemDetails(
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
        ${deviceField('Các dòng nội dung', `contact.cards.${index}`, 'lines', { type: 'textarea', lines: true, full: true, help: 'Mỗi dòng trong ô tương ứng một dòng nội dung.' })}
        ${deviceField('Link', `contact.cards.${index}`, 'link')}
        ${deviceImageField('Hình thẻ (có thể để trống)', `contact.cards.${index}`)}
      </div>`,
      index,
      'contact.cards',
      { draggable: true, itemRef: item, allowCountChange: false }
    )).join('');

    return `<div class="editor-panel">
      ${panelHeading('Contact', 'Bốn thẻ: Thông tin liên hệ — Địa chỉ — Maps — Social.')}
      ${deviceModeBanner()}
      <div class="field-grid">${deviceField('Nhãn section', 'contact', 'eyebrow')}${deviceField('Tiêu đề section', 'contact', 'title', { full: true })}</div>
      <div class="repeater-list project-reorder-list">${items}</div>
    </div>`;
  }

  function renderLayout() {
    return `<div class="editor-panel">
      ${panelHeading('Kích thước & Font', 'v0.6 khóa mỗi section trong đúng một khung nhìn; bạn có thể chỉnh thẻ, khoảng cách và kích thước chữ.')}
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
        ${field('Thẻ Media', 'layout.mediaCardWidth', { type: 'range', min: 180, max: 500 })}
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
      <div class="backup-card"><h3>Xuất cấu hình website</h3><p>Tải file <strong>site-config.json</strong>, sau đó đặt file này cùng cấp với index.html trên hosting.</p><div class="backup-actions"><button type="button" data-backup-action="export">Xuất site-config.json</button></div></div>
      <div class="backup-card"><h3>Nhập cấu hình</h3><p>Khôi phục dữ liệu từ một file JSON đã xuất trước đó.</p><div class="backup-actions"><label class="ghost-button file-button">Chọn file JSON<input type="file" data-backup-import accept="application/json"></label></div></div>
      <div class="backup-card"><h3>Khôi phục mặc định</h3><p>Xóa toàn bộ chỉnh sửa đang lưu trong trình duyệt và quay lại dữ liệu ban đầu của v0.6.</p><div class="backup-actions"><button type="button" class="danger-button" data-backup-action="reset">Khôi phục mặc định</button></div></div>
      <div class="backup-card"><h3>Font Charlotte & Caviar</h3><p>Website đã khai báo sẵn hai font. Để đóng gói hoàn chỉnh, đặt UTM_Charlotte.ttf và UTM_Caviar.ttf vào thư mục assets/fonts.</p></div>
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
    setPath(config, path, dataUrl);
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
    qa('[data-project-reorder-item]', editor).forEach((item) => {
      item.classList.remove('is-dragging', 'drag-before', 'drag-after');
    });
    draggedProjectIndex = null;
    draggedProjectArrayPath = '';
    draggedProjectElement = null;
    dragProjectMoved = false;
    dragProjectTargetIndex = null;
    dragProjectPlaceAfter = false;
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

  async function save() {
    await DreameseStore.saveConfig(config);
    setDirty(false);
    showToast('Đã lưu thay đổi trong trình duyệt.');
    syncPreview();
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
      const item = event.target.closest('[data-project-reorder-item]');
      if (!item) return;

      // Các trường nhập liệu và nút vẫn thao tác bình thường; toàn bộ phần còn lại của thẻ là vùng nắm kéo.
      if (event.target.closest('input, textarea, select, button, a, label, .image-preview')) return;

      draggedProjectIndex = Number(item.dataset.index);
      draggedProjectArrayPath = item.dataset.arrayPath || 'projects';
      draggedProjectElement = item;
      dragProjectStartY = event.clientY;
      dragProjectMoved = false;
      dragProjectTargetIndex = draggedProjectIndex;
      dragProjectPlaceAfter = false;
    });

    editor.addEventListener('pointermove', (event) => {
      if (draggedProjectIndex === null || !draggedProjectElement) return;
      const distance = Math.abs(event.clientY - dragProjectStartY);
      if (!dragProjectMoved && distance < 8) return;

      if (!dragProjectMoved) {
        dragProjectMoved = true;
        draggedProjectElement.classList.add('is-dragging');
        draggedProjectElement.setPointerCapture?.(event.pointerId);
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
      if (draggedProjectIndex === null) return;
      if (draggedProjectElement?.hasPointerCapture?.(event.pointerId)) draggedProjectElement.releasePointerCapture(event.pointerId);

      if (dragProjectMoved && dragProjectTargetIndex !== null) {
        suppressProjectToggleUntil = performance.now() + 260;
        reorderProject(
          draggedProjectArrayPath,
          draggedProjectIndex,
          dragProjectTargetIndex,
          dragProjectPlaceAfter
        );
        return;
      }

      clearProjectDragState();
    };

    editor.addEventListener('pointerup', finishProjectPointerDrag);
    editor.addEventListener('pointercancel', finishProjectPointerDrag);

    // Mở/đóng chỉ bằng nút Chỉnh sửa; click phát sinh sau kéo thả bị loại bỏ hoàn toàn.
    editor.addEventListener('click', (event) => {
      const reorderItem = event.target.closest('[data-project-reorder-item]');
      if (performance.now() < suppressProjectToggleUntil && reorderItem) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const toggle = event.target.closest('[data-toggle-editor-section]');
      if (toggle) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const details = toggle.closest('details.editor-section');
        if (!details) return;
        details.open = !details.open;
        toggle.textContent = details.open ? 'Thu gọn' : 'Chỉnh sửa';
        toggle.setAttribute('aria-expanded', String(details.open));
        return;
      }

      // Không cho summary tự toggle khi người dùng bấm vào vùng dùng để nắm kéo.
      if (event.target.closest('summary') && reorderItem) {
        event.preventDefault();
      }
    }, true);

    editor.addEventListener('input', (event) => {
      const input = event.target.closest('[data-path]');
      if (!input) return;
      let value = input.value;
      if (input.dataset.number === 'true') value = Number(value);
      if (input.dataset.lines === 'true') value = value.split('\n').map((line) => line.trim()).filter(Boolean);
      setPath(config, input.dataset.path, value);

      if (input.type === 'range') {
        qa(`[data-path="${CSS.escape(input.dataset.path)}"]`, editor).forEach((peer) => {
          if (peer !== input) peer.value = input.value;
        });
      }

      if (input.dataset.path.endsWith('.image') || input.dataset.path === 'brand.logo') {
        const zone = q(`[data-drop-image-path="${CSS.escape(input.dataset.path)}"]`, editor);
        if (zone) zone.innerHTML = value ? `<img src="${escapeHtml(value)}" alt="Xem trước">` : '<span>Kéo thả hình vào đây</span>';
      }

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
    bindEvents();
    syncPreview();
  }

  init().catch((error) => {
    console.error(error);
    config = DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG);
    status.textContent = 'Dùng dữ liệu mặc định';
    renderPanel();
    bindEvents();
    syncPreview();
  });
})();
