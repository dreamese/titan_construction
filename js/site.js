(() => {
  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const desktopQuery = window.matchMedia('(min-width: 821px)');

  const mainScroll = q('#mainScroll');
  const projectsStage = q('#projectsStage');
  const projectsTrack = q('#projectsTrack');
  const serviceRail = q('#serviceRail');
  const mediaRail = q('#mediaRail');
  const newsGrid = q('#newsGrid');
  const contactGrid = q('#contactGrid');

  let config = null;
  let projectCards = [];
  let currentProjectIndex = 0;
  let scrollFrame = 0;
  let sectionTargetIndex = 0;
  let sectionWheelDirection = 0;
  let sectionWheelLockedUntil = 0;
  let globalEventsBound = false;
  let activeMediaSourceUrl = '';
  let activeMediaPlayerUrl = '';
  let activeMediaVideoId = '';
  let mediaPlayerLoadTimer = 0;
  let mediaPlayerReady = false;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function safeHref(value, fallback = '#') {
    const href = String(value || '').trim();
    return href || fallback;
  }

  function socialPlatformIcon(platform) {
    const key = String(platform || 'website').toLowerCase();
    const icons = {
      facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V3.9c-.8-.1-1.6-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2V10H8v3h2.5v8h3.2Z" fill="currentColor"/></svg>',
      instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.5" cy="6.8" r="1.1" fill="currentColor"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.4 3.2c.5 2.5 1.9 4 4.4 4.4v3.1a9 9 0 0 1-4.3-1.3v6.1a5.6 5.6 0 1 1-4.8-5.5v3.2a2.5 2.5 0 1 0 1.6 2.3V3.2h3.1Z" fill="currentColor"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8.1a3 3 0 0 0-2.1-2.2C17 5.4 12 5.4 12 5.4s-5 0-6.9.5A3 3 0 0 0 3 8.1 31 31 0 0 0 2.6 12 31 31 0 0 0 3 15.9a3 3 0 0 0 2.1 2.2c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .4-3.9 31 31 0 0 0-.4-3.9ZM10 15.3V8.7l5.7 3.3-5.7 3.3Z" fill="currentColor"/></svg>',
      linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 8.1H2V21h3.2V8.1ZM3.6 3A1.9 1.9 0 1 0 3.6 6.8 1.9 1.9 0 0 0 3.6 3ZM21 13.6c0-3.9-2.1-5.8-4.9-5.8-2.3 0-3.3 1.3-3.9 2.1V8.1H9V21h3.2v-6.4c0-1.7.3-3.4 2.5-3.4 2.2 0 2.2 2 2.2 3.5V21H21v-7.4Z" fill="currentColor"/></svg>',
      zalo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 9h5l-5 6h5M13 15V9h3.2c1.2 0 2 .7 2 1.8 0 1-.8 1.8-2 1.8H13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      website: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
    };
    return icons[key] || icons.website;
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
    if (/^\d{15,22}$/.test(href)) return `https://www.tiktok.com/player/v1/${href}`;

    try {
      const parsed = new URL(href, window.location.href);
      if (!/^https?:$/.test(parsed.protocol)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function getTikTokVideoId(url) {
    const source = String(url || '').trim().replace(/&amp;/gi, '&');
    const patterns = [
      /\/video\/(\d{15,22})/i,
      /\/player\/v1\/(\d{15,22})/i,
      /\/embed\/v2\/(\d{15,22})/i,
      /[?&](?:item_id|video_id)=(\d{15,22})/i,
      /data-video-id=["'](\d{15,22})["']/i,
      /(?:^|\D)(\d{15,22})(?:\D|$)/
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return match[1];
    }
    return /^\d{15,22}$/.test(source) ? source : '';
  }

  function getTikTokPlayerUrl(url) {
    const videoId = getTikTokVideoId(url);
    if (!videoId) return '';
    const params = new URLSearchParams({
      autoplay: '0',
      controls: '1',
      play_button: '1',
      progress_bar: '1',
      volume_control: '1',
      fullscreen_button: '1',
      timestamp: '1',
      loop: '0',
      music_info: '1',
      description: '1',
      rel: '0',
      muted: '0',
      native_context_menu: '1'
    });
    return `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`;
  }


  function ensureMediaOverlayStructure() {
    const overlay = q('#mediaOverlay');
    if (!overlay) return;

    let shell = q('.media-player-shell', overlay);
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'overlay-media media-player-shell';
      overlay.insertBefore(shell, q('.overlay-copy', overlay));
    }

    const hasCompletePlayer =
      q('#mediaOverlayPlayer', overlay) &&
      q('#mediaPlayerPoster', overlay) &&
      q('#mediaOverlayImage', overlay) &&
      q('#mediaPosterPlaceholder', overlay) &&
      q('#mediaPosterVideoId', overlay) &&
      q('#mediaOverlayPlay', overlay) &&
      q('#mediaPlayerMessage', overlay);

    if (!hasCompletePlayer) {
      shell.innerHTML = `
        <iframe id="mediaOverlayPlayer" title="TikTok video player" src="about:blank"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen
          referrerpolicy="origin" hidden></iframe>
        <div class="media-player-poster" id="mediaPlayerPoster">
          <img id="mediaOverlayImage" alt="">
          <div class="media-poster-placeholder" id="mediaPosterPlaceholder" hidden>
            <span class="media-poster-icon">♪</span>
            <small id="mediaPosterVideoId"></small>
          </div>
          <button class="media-player-start" id="mediaOverlayPlay" type="button">
            <span aria-hidden="true">▶</span>
            <strong>PHÁT VIDEO</strong>
          </button>
        </div>
        <p class="media-player-message" id="mediaPlayerMessage" hidden></p>`;
    }

    if (!q('#mediaOverlayLink', overlay)) {
      const copy = q('.overlay-copy', overlay);
      if (copy) {
        const link = document.createElement('a');
        link.id = 'mediaOverlayLink';
        link.href = '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'MỞ VIDEO GỐC ↗';
        copy.appendChild(link);
      }
    }
  }

  async function loadTikTokThumbnail(item, card) {
    const sourceUrl = normalizeMediaUrl(deviceValue(item, 'url', item.url));
    const videoId = getTikTokVideoId(sourceUrl);
    if (!videoId || !card) return;

    const img = q('img', card);
    const placeholder = q('.media-cover-placeholder', card);

    try {
      const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
      const response = await fetch(endpoint, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) return;
      const metadata = await response.json();
      if (!metadata?.thumbnail_url) return;

      let targetImage = img;
      if (!targetImage) {
        targetImage = document.createElement('img');
        targetImage.loading = 'lazy';
        targetImage.alt = deviceValue(item, 'title', item.title);
        q('.media-visual', card)?.prepend(targetImage);
      }
      targetImage.src = metadata.thumbnail_url;
      targetImage.hidden = false;
      placeholder?.classList.add('is-hidden');
    } catch {
      // Giữ ảnh được cấu hình trong Manager nếu TikTok/oEmbed bị chặn.
    }
  }

  function setMediaPlayerState(state, message = '') {
    const player = q('#mediaOverlayPlayer');
    const poster = q('#mediaPlayerPoster');
    const playButton = q('#mediaOverlayPlay');
    const playerMessage = q('#mediaPlayerMessage');

    if (!player || !poster || !playButton || !playerMessage) return;

    const showNativePlayer = state === 'player';
    player.hidden = !showNativePlayer;
    poster.hidden = showNativePlayer;
    playerMessage.textContent = '';
    playerMessage.hidden = true;

    playButton.hidden = showNativePlayer;
    playButton.disabled = false;
    const label = playButton.querySelector('strong');
    if (label) {
      label.textContent = state === 'external'
        ? 'MỞ VIDEO GỐC'
        : 'PHÁT VIDEO';
    }
  }

  function resetMediaPlayer() {
    window.clearTimeout(mediaPlayerLoadTimer);
    mediaPlayerLoadTimer = 0;
    mediaPlayerReady = false;
    const player = q('#mediaOverlayPlayer');
    if (player) {
      player.dataset.expectedVideoId = '';
      player.src = 'about:blank';
      player.hidden = true;
    }
  }

  function openMediaExternally() {
    if (!activeMediaSourceUrl) return;
    const opened = window.open(activeMediaSourceUrl, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = activeMediaSourceUrl;
  }

  function startMediaPlayback(event) {
    event?.preventDefault?.();

    if (!activeMediaSourceUrl) return;

    const buttonLabel = q('#mediaOverlayPlay strong')?.textContent || '';
    const requestsExternalOpen = buttonLabel.includes('MỞ VIDEO');

    // TikTok's embedded player is unreliable when the website is opened as file://.
    // In that case, or after an embed error, the same button becomes a guaranteed direct navigation.
    if (requestsExternalOpen || window.location.protocol === 'file:' || !activeMediaPlayerUrl) {
      openMediaExternally();
      return;
    }

    resetMediaPlayer();
    const player = q('#mediaOverlayPlayer');
    if (!player) return;

    player.dataset.expectedVideoId = activeMediaVideoId;
    player.src = activeMediaPlayerUrl;
    setMediaPlayerState('player');

    mediaPlayerLoadTimer = window.setTimeout(() => {
      if (mediaPlayerReady) return;
      setMediaPlayerState('external');
    }, 7000);
  }

  function deviceValue(item, key, fallback = '') {
    if (!item) return fallback;
    const mobileValue = item.mobile?.[key];
    if (!desktopQuery.matches && mobileValue !== undefined && mobileValue !== null && mobileValue !== '') {
      if (Array.isArray(mobileValue)) return mobileValue.length ? mobileValue : (item[key] ?? fallback);
      return mobileValue;
    }
    return item[key] ?? fallback;
  }

  function setCssVariables(layout) {
    const root = document.documentElement;
    const values = {
      '--header-h': `${desktopQuery.matches ? layout.headerHeightDesktop : layout.headerHeightMobile}px`,
      '--footer-h': `${desktopQuery.matches ? layout.footerHeightDesktop : layout.footerHeightMobile}px`,
      '--project-card-w': `${layout.projectCardWidth}px`,
      '--service-card-w': `${layout.serviceCardWidth}px`,
      '--media-card-w': `${layout.mediaCardWidth}px`,
      '--contact-card-w': `${layout.contactCardWidth}px`,
      '--card-radius': `${layout.cardRadius}px`,
      '--heading-size': `${layout.headingSizeDesktop}px`,
      '--heading-size-mobile': `${layout.headingSizeMobile}px`,
      '--body-size': `${layout.bodySize}px`,
      '--project-title-size': `${layout.projectTitleSize}px`,
      '--nav-size': `${layout.navSize}px`,
      '--brand-size': `${layout.brandSize}px`,
      '--mobile-project-card-h': `${layout.mobileProjectCardHeight || 220}px`,
      '--mobile-project-gap': `${layout.mobileProjectGap || 12}px`,
      '--mobile-section-pad': `${layout.mobileSectionPadding || 10}px`
    };
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
  }

  function renderBrand() {
    // Logo, tên thương hiệu, tagline và link logo là một nhận diện dùng chung
    // cho Desktop lẫn Mobile. Các nội dung section vẫn có thể tách riêng theo thiết bị.
    const headerLogo = config.brand.logo || '';
    const headerName = config.brand.name || '';
    const headerTagline = config.brand.tagline || '';
    const headerLogoLink = config.brand.logoLink || '#projects';
    const browserTitle = String(config.brand.browserTitle || headerName || 'Website').trim();
    const favicon = String(config.brand.favicon || headerLogo || '').trim();
    const description = String(config.brand.metaDescription || '').trim();
    const themeColor = String(config.brand.themeColor || '#050505').trim();

    document.title = browserTitle;
    const faviconLink = q('#siteFavicon');
    const touchIcon = q('#siteAppleTouchIcon');
    if (faviconLink && favicon) faviconLink.href = favicon;
    if (touchIcon && favicon) touchIcon.href = favicon;
    const descriptionMeta = q('#siteDescription');
    if (descriptionMeta && description) descriptionMeta.content = description;
    const themeMeta = q('#siteThemeColor');
    if (themeMeta && themeColor) themeMeta.content = themeColor;

    q('#brandLogo').src = headerLogo;
    q('#brandName').textContent = headerName;
    q('#brandTagline').textContent = headerTagline;
    q('#brandLink').href = safeHref(headerLogoLink, '#projects');

    const mainNav = q('#mainNav');
    mainNav.innerHTML = config.navigation.map((item) => `
      <button class="main-nav-link" type="button" data-jump="${escapeHtml(item.target)}">${escapeHtml(deviceValue(item, 'label', item.label))}</button>
    `).join('');

    // Tự chia đều toàn bộ chiều ngang theo đúng số mục menu hiện có.
    // Kích thước chữ và khoảng cách ký tự giảm nhẹ khi số mục tăng,
    // nhờ đó menu luôn nằm trên một hàng và không tạo hàng thứ hai.
    const navigationCount = Math.max(1, config.navigation.length);
    const baseNavSize = Number(config.layout?.navSize) || 11;
    const desktopNavSize = Math.max(6.4, Math.min(baseNavSize, baseNavSize - Math.max(0, navigationCount - 6) * 0.72));
    const mobileNavSize = Math.max(5.2, Math.min(7.5, 7.5 - Math.max(0, navigationCount - 5) * 0.42));
    const letterSpacing = Math.max(0.015, 0.1 - Math.max(0, navigationCount - 5) * 0.014);
    mainNav.style.setProperty('--nav-count', String(navigationCount));
    mainNav.style.setProperty('--nav-fit-size', `${desktopNavSize}px`);
    mainNav.style.setProperty('--nav-fit-size-mobile', `${mobileNavSize}px`);
    mainNav.style.setProperty('--nav-letter-spacing', `${letterSpacing}em`);

    const email = deviceValue(config.brand, 'email', config.brand.email);
    const phone = deviceValue(config.brand, 'phone', config.brand.phone);
    const location = deviceValue(config.brand, 'location', config.brand.location);
    const socialLabel = deviceValue(config.brand, 'socialLabel', config.brand.socialLabel);
    const socialUrl = deviceValue(config.brand, 'socialUrl', config.brand.socialUrl);
    q('#footerContact').innerHTML = `
      <p><span>Email</span><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><span>Phone</span><a href="tel:${escapeHtml(String(phone).replace(/\s+/g, ''))}">${escapeHtml(phone)}</a></p>
      <p><span>Studio</span><span>${escapeHtml(location)}</span></p>
      <p><span>Social</span><a href="${escapeHtml(safeHref(socialUrl))}" target="_blank" rel="noopener">${escapeHtml(socialLabel)}</a></p>
    `;
  }

  function renderBackgrounds(container, items) {
    container.innerHTML = items.map((item, index) => `
      <div class="scene-background${index === 0 ? ' is-active' : ''}" data-scene-index="${index}" style="background-image:url('${String(deviceValue(item, 'image', item.image) || '').replace(/'/g, '%27')}')"></div>
    `).join('');
  }

  function activateScene(container, index) {
    qa('.scene-background', container).forEach((scene, sceneIndex) => {
      scene.classList.toggle('is-active', sceneIndex === index);
    });
  }

  function renderAbout() {
    q('#aboutEyebrow').textContent = deviceValue(config.about, 'eyebrow', config.about.eyebrow);
    q('#aboutTitle').textContent = deviceValue(config.about, 'title', config.about.title);
    q('#aboutIntro').textContent = deviceValue(config.about, 'intro', config.about.intro);
    renderBackgrounds(q('#aboutBackgrounds'), config.about.slides);
    q('#aboutTextList').innerHTML = config.about.slides.map((item, index) => `
      <article class="about-text-item${index === 0 ? ' is-active' : ''}" tabindex="0" data-about-index="${index}" data-link="${escapeHtml(deviceValue(item, 'link', item.link || ''))}">
        <small>${escapeHtml(deviceValue(item, 'label', item.label))}</small>
        <h3>${escapeHtml(deviceValue(item, 'title', item.title))}</h3>
        <p>${escapeHtml(deviceValue(item, 'body', item.body))}</p>
      </article>
    `).join('');
    qa('.about-text-item').forEach((item) => {
      const index = Number(item.dataset.aboutIndex);
      const activate = () => {
        qa('.about-text-item').forEach((other) => other.classList.remove('is-active'));
        item.classList.add('is-active');
        activateScene(q('#aboutBackgrounds'), index);
      };
      item.addEventListener('mouseenter', activate);
      item.addEventListener('focus', activate);
      item.addEventListener('click', () => item.dataset.link && navigateLink(item.dataset.link));
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.click();
        }
      });
    });
  }

  function projectTemplate(project, index) {
    const href = safeHref(deviceValue(project, 'href', project.href));
    const title = deviceValue(project, 'title', project.title);
    return `
      <article class="project-card linked-card" tabindex="0" role="link" data-project-index="${index}" data-card-link="${escapeHtml(href)}" aria-label="Mở dự án ${escapeHtml(title)}">
        <img class="project-image" src="${escapeHtml(deviceValue(project, 'image', project.image))}" alt="${escapeHtml(title)}" loading="${index < 2 ? 'eager' : 'lazy'}">
        <div class="project-shade"></div>
        <p class="project-chapter">CHAPTER ${escapeHtml(project.chapter)}</p>
        <div class="project-title-wrap">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(deviceValue(project, 'subtitle', project.subtitle))}</p>
        </div>
        <div class="project-bottom">
          <span>${escapeHtml(deviceValue(project, 'category', project.category))}</span>
        </div>
      </article>`;
  }

  function renderProjects() {
    const section = config.projectsSection || { eyebrow: 'Projects', title: '' };
    const eyebrow = q('#projectsEyebrow');
    const title = q('#projectsTitle');
    if (eyebrow) eyebrow.textContent = deviceValue(section, 'eyebrow', section.eyebrow || 'Projects');
    if (title) title.textContent = deviceValue(section, 'title', section.title || '');
    projectsTrack.innerHTML = config.projects.map(projectTemplate).join('');
    projectCards = qa('.project-card');
    projectCards.forEach((card, index) => {
      const activate = () => setActiveProject(index);
      const openLink = () => navigateLink(card.dataset.cardLink);
      card.addEventListener('mouseenter', activate);
      card.addEventListener('focus', activate);
      card.addEventListener('click', openLink);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLink();
        }
      });
    });
    setActiveProject(0);
  }

  function setActiveProject(index) {
    currentProjectIndex = Math.max(0, Math.min(index, projectCards.length - 1));
    projectCards.forEach((card, cardIndex) => card.classList.toggle('is-active', cardIndex === currentProjectIndex));
  }

  function updateProjectActive() {
    if (!projectCards.length) return;
    if (!desktopQuery.matches) {
      const stageRect = projectsStage.getBoundingClientRect();
      const focusY = stageRect.top + stageRect.height * .42;
      let best = 0;
      let distance = Infinity;
      projectCards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const d = Math.abs(rect.top + rect.height * .5 - focusY);
        if (d < distance) { distance = d; best = index; }
      });
      setActiveProject(best);
      return;
    }
    const focusX = projectsStage.scrollLeft + projectsStage.clientWidth * .34;
    let best = 0;
    let distance = Infinity;
    projectCards.forEach((card, index) => {
      const d = Math.abs(card.offsetLeft + card.offsetWidth * .5 - focusX);
      if (d < distance) { distance = d; best = index; }
    });
    setActiveProject(best);
  }

  function renderService() {
    q('#serviceEyebrow').textContent = deviceValue(config.service, 'eyebrow', config.service.eyebrow);
    q('#serviceTitle').textContent = deviceValue(config.service, 'title', config.service.title);
    renderBackgrounds(q('#serviceBackgrounds'), config.service.items);
    serviceRail.innerHTML = config.service.items.map((item, index) => {
      const href = safeHref(deviceValue(item, 'href', item.href));
      const name = deviceValue(item, 'name', item.name);
      return `
        <article class="service-card linked-card" tabindex="0" role="link" data-service-index="${index}" data-card-link="${escapeHtml(href)}" aria-label="Mở dịch vụ ${escapeHtml(name)}">
          <div class="service-image"><img src="${escapeHtml(deviceValue(item, 'image', item.image))}" alt="${escapeHtml(name)}" loading="lazy"></div>
          <p class="service-number">${escapeHtml(item.number)}</p>
          <h3>${escapeHtml(name)}</h3>
          <p>${escapeHtml(deviceValue(item, 'summary', item.summary))}</p>
        </article>`;
    }).join('');
    qa('.service-card').forEach((card) => {
      const index = Number(card.dataset.serviceIndex);
      const openLink = () => navigateLink(card.dataset.cardLink);
      card.addEventListener('mouseenter', () => activateScene(q('#serviceBackgrounds'), index));
      card.addEventListener('focusin', () => activateScene(q('#serviceBackgrounds'), index));
      card.addEventListener('click', openLink);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLink();
        }
      });
    });
  }

  function renderMedia() {
    q('#mediaEyebrow').textContent = deviceValue(config.media, 'eyebrow', config.media.eyebrow);
    q('#mediaTitle').textContent = deviceValue(config.media, 'title', config.media.title);
    mediaRail.innerHTML = config.media.items.map((item, index) => {
      const title = deviceValue(item, 'title', item.title);
      const image = String(deviceValue(item, 'image', item.image) || '').trim();
      return `
        <article class="media-card" tabindex="0" data-media-index="${index}">
          <div class="media-visual">
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">` : ''}
            <div class="media-cover-placeholder${image ? ' is-hidden' : ''}">
              <span>♪</span>
            </div>
            <span class="media-play">▶</span>
          </div>
          <div class="media-copy"><small>${escapeHtml(deviceValue(item, 'label', item.label))}</small><h3>${escapeHtml(title)}</h3></div>
        </article>
      `;
    }).join('');
    qa('.media-card').forEach((card) => {
      const index = Number(card.dataset.mediaIndex);
      const image = q('img', card);
      const placeholder = q('.media-cover-placeholder', card);
      image?.addEventListener('error', () => {
        image.hidden = true;
        placeholder?.classList.remove('is-hidden');
      });
      loadTikTokThumbnail(config.media.items[index], card);
      card.addEventListener('click', () => openMedia(index));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openMedia(index);
        }
      });
    });
    enableHorizontalWheel(mediaRail);
    enableDragScroll(mediaRail);
  }

  function renderNews() {
    q('#newsEyebrow').textContent = deviceValue(config.news, 'eyebrow', config.news.eyebrow);
    q('#newsTitle').textContent = deviceValue(config.news, 'title', config.news.title);
    closeNewsPanel();
    newsGrid.innerHTML = config.news.items.map((item, index) => `
      <button class="news-title-card" type="button" data-news-index="${index}" aria-expanded="false">
        <span class="news-no">${escapeHtml(item.number)}</span>
        <h3>${escapeHtml(deviceValue(item, 'title', item.title))}</h3>
      </button>
    `).join('');
    qa('.news-title-card').forEach((button) => {
      button.addEventListener('click', () => openNews(Number(button.dataset.newsIndex)));
    });
  }

  function renderContact() {
    q('#contactEyebrow').textContent = deviceValue(config.contact, 'eyebrow', config.contact.eyebrow);
    q('#contactTitle').textContent = deviceValue(config.contact, 'title', config.contact.title);
    contactGrid.innerHTML = config.contact.cards.map((card, index) => {
      const image = deviceValue(card, 'image', card.image);
      const lines = deviceValue(card, 'lines', card.lines) || [];
      const link = safeHref(deviceValue(card, 'link', card.link));
      const title = deviceValue(card, 'title', card.title);
      const isSocial = card.type === 'social';
      const socialLinks = Array.isArray(card.socialLinks) ? card.socialLinks : [];
      const socialHtml = isSocial ? `<div class="social-platform-list">
        ${socialLinks.map((social) => {
          const label = deviceValue(social, 'label', social.label);
          const url = safeHref(deviceValue(social, 'url', social.url), '');
          if (!label || !url || url === '#') return '';
          const platform = social.platform || 'website';
          return `<a class="social-platform-link social-${escapeHtml(platform)}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="Mở ${escapeHtml(label)}">
            <span class="social-platform-icon">${socialPlatformIcon(platform)}</span>
            <span>${escapeHtml(label)}</span>
            <span class="social-platform-arrow" aria-hidden="true">↗</span>
          </a>`;
        }).join('')}
      </div>` : '';
      const cardAttributes = isSocial
        ? `class="contact-card contact-${escapeHtml(card.type)}" data-contact-index="${index}"`
        : `class="contact-card contact-${escapeHtml(card.type)} linked-card" tabindex="0" role="link" data-contact-index="${index}" data-card-link="${escapeHtml(link)}" aria-label="Mở ${escapeHtml(title)}"`;
      return `
        <article ${cardAttributes}>
          ${image ? `<div class="contact-card-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy"></div>` : (card.type === 'maps' ? '<div class="map-placeholder">MAPS<br>Dreamese Studio</div>' : '')}
          <div class="contact-card-body">
            <h3>${escapeHtml(title)}</h3>
            ${isSocial ? socialHtml : lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        </article>`;
    }).join('');
    qa('.contact-card.linked-card').forEach((card) => {
      const openLink = () => navigateLink(card.dataset.cardLink);
      card.addEventListener('click', openLink);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLink();
        }
      });
    });
    qa('.social-platform-link').forEach((link) => {
      link.addEventListener('click', (event) => event.stopPropagation());
    });
  }

  function openMedia(index) {
    const item = config.media.items[index];
    if (!item) return;

    // Mở lớp phủ trước. openOverlay() sẽ dọn trạng thái video cũ, vì vậy dữ liệu
    // của video mới phải được gán sau bước này để không bị xóa ngay lập tức.
    openOverlay(q('#mediaOverlay'));

    activeMediaSourceUrl = normalizeMediaUrl(deviceValue(item, 'url', item.url));
    activeMediaVideoId = getTikTokVideoId(activeMediaSourceUrl);
    activeMediaPlayerUrl = getTikTokPlayerUrl(activeMediaSourceUrl);

    ensureMediaOverlayStructure();
    const fallbackImage = q('#mediaOverlayImage');
    const placeholder = q('#mediaPosterPlaceholder');
    const placeholderVideoId = q('#mediaPosterVideoId');
    const directLink = q('#mediaOverlayLink');
    const cardImage = q(`.media-card[data-media-index="${index}"] img`)?.currentSrc || q(`.media-card[data-media-index="${index}"] img`)?.src || '';
    const configuredImage = cardImage || String(deviceValue(item, 'image', item.image) || '').trim();

    resetMediaPlayer();

    if (configuredImage) {
      fallbackImage.src = configuredImage;
      fallbackImage.alt = deviceValue(item, 'title', item.title);
      fallbackImage.hidden = false;
      if (placeholder) placeholder.hidden = true;
    } else {
      fallbackImage.removeAttribute('src');
      fallbackImage.alt = '';
      fallbackImage.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (placeholderVideoId) placeholderVideoId.textContent = '';
    }

    q('#mediaOverlayKicker').textContent = deviceValue(item, 'label', item.label);
    q('#mediaOverlayTitle').textContent = deviceValue(item, 'title', item.title);
    q('#mediaOverlayDescription').textContent = deviceValue(item, 'description', item.description);

    if (directLink && activeMediaSourceUrl) {
      directLink.href = activeMediaSourceUrl;
      directLink.hidden = false;
      directLink.removeAttribute('aria-disabled');
      directLink.textContent = activeMediaPlayerUrl ? 'MỞ VIDEO GỐC ↗' : 'MỞ LIÊN KẾT ↗';
    } else if (directLink) {
      directLink.href = '#';
      directLink.hidden = true;
      directLink.setAttribute('aria-disabled', 'true');
    }

    if (window.location.protocol === 'file:' && activeMediaSourceUrl) {
      setMediaPlayerState('external');
    } else if (activeMediaPlayerUrl) {
      // Load the official player immediately. The user then clicks TikTok's own play button,
      // avoiding conflicts with our custom overlay and browser autoplay rules.
      const player = q('#mediaOverlayPlayer');
      if (player) {
        player.dataset.expectedVideoId = activeMediaVideoId;
        player.src = activeMediaPlayerUrl;
      }
      setMediaPlayerState('player');
    } else if (activeMediaSourceUrl) {
      setMediaPlayerState('external');
    } else {
      setMediaPlayerState('external');
    }

  }

  function openNews(index) {
    const item = config.news.items[index];
    if (!item) return;
    qa('.news-title-card').forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-expanded', String(isActive));
    });
    q('#newsAnswerImage').src = deviceValue(item, 'image', item.image);
    q('#newsAnswerImage').alt = deviceValue(item, 'title', item.title);
    q('#newsAnswerNumber').textContent = item.number;
    q('#newsAnswerDate').textContent = deviceValue(item, 'date', item.date);
    q('#newsAnswerCategory').textContent = deviceValue(item, 'category', item.category);
    q('#newsAnswerTitle').textContent = deviceValue(item, 'title', item.title);
    q('#newsAnswerSubtitle').textContent = deviceValue(item, 'subtitle', item.subtitle);
    q('#newsAnswerDescription').textContent = deviceValue(item, 'description', item.description);
    q('#newsAnswerLink').href = safeHref(deviceValue(item, 'href', item.href), '#contact');
    q('#newsAnswerEmpty').hidden = true;
    q('#newsAnswerContent').hidden = false;
    q('.news-qa-layout')?.classList.add('has-open-answer');
    q('#newsAnswerPanel').classList.add('is-open');
    q('#newsAnswerPanel').setAttribute('aria-hidden', 'false');
  }

  function closeNewsPanel() {
    const panel = q('#newsAnswerPanel');
    if (!panel) return;
    q('.news-qa-layout')?.classList.remove('has-open-answer');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    q('#newsAnswerEmpty').hidden = true;
    q('#newsAnswerContent').hidden = true;
    qa('.news-title-card').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function openOverlay(element) {
    closeOverlays();
    element.classList.add('is-open');
    element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    q('.overlay-close', element)?.focus();
  }

  function closeOverlays() {
    qa('.overlay').forEach((element) => {
      element.classList.remove('is-open');
      element.setAttribute('aria-hidden', 'true');
    });
    resetMediaPlayer();
    activeMediaSourceUrl = '';
    activeMediaPlayerUrl = '';
    activeMediaVideoId = '';
    document.body.classList.remove('overlay-open');
  }

  function navigateLink(link) {
    const href = String(link || '').trim();
    if (!href || href === '#') return;
    if (href.startsWith('#')) {
      jumpTo(href.slice(1));
      return;
    }
    try {
      const targetUrl = new URL(href, window.location.href);
      if (targetUrl.origin === window.location.origin) window.location.href = targetUrl.href;
      else window.open(targetUrl.href, '_blank', 'noopener');
    } catch {
      window.location.href = href;
    }
  }

  function getSections() {
    return qa('.page-section');
  }

  function getClosestSectionIndex() {
    const sections = getSections();
    if (!sections.length) return 0;
    const position = desktopQuery.matches ? mainScroll.scrollTop : mainScroll.scrollLeft;
    let closest = 0;
    let distance = Infinity;
    sections.forEach((section, index) => {
      const offset = desktopQuery.matches ? section.offsetTop : section.offsetLeft;
      const currentDistance = Math.abs(offset - position);
      if (currentDistance < distance) {
        distance = currentDistance;
        closest = index;
      }
    });
    return closest;
  }

  function scrollToSectionIndex(index, behavior = 'smooth') {
    const sections = getSections();
    if (!sections.length) return;
    const safeIndex = Math.max(0, Math.min(index, sections.length - 1));
    sectionTargetIndex = safeIndex;
    const target = sections[safeIndex];
    if (desktopQuery.matches) {
      mainScroll.scrollTo({ top: target.offsetTop, left: 0, behavior });
    } else {
      mainScroll.scrollTo({ left: target.offsetLeft, top: 0, behavior });
    }
  }

  function jumpTo(id, behavior = 'smooth') {
    const sections = getSections();
    const index = sections.findIndex((section) => section.id === id);
    if (index >= 0) scrollToSectionIndex(index, behavior);
  }

  function enableHorizontalWheel(element) {
    if (element.dataset.wheelBound === 'true') return;
    element.dataset.wheelBound = 'true';
    element.addEventListener('wheel', (event) => {
      if (!desktopQuery.matches) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      const max = Math.max(0, element.scrollWidth - element.clientWidth);
      const forward = delta > 0 && element.scrollLeft < max - 1;
      const backward = delta < 0 && element.scrollLeft > 1;
      if (!(forward || backward)) return;
      event.preventDefault();
      element.scrollLeft += delta;
    }, { passive: false });
  }

  function enableDragScroll(element) {
    if (element.dataset.dragBound === 'true') return;
    element.dataset.dragBound = 'true';

    let down = false;
    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let pointerId = null;

    element.addEventListener('pointerdown', (event) => {
      if (!desktopQuery.matches || event.pointerType === 'touch' || event.target.closest('a,button')) return;
      down = true;
      dragging = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startLeft = element.scrollLeft;
    });

    element.addEventListener('pointermove', (event) => {
      if (!down || event.pointerId !== pointerId) return;
      const distance = event.clientX - startX;
      if (!dragging && Math.abs(distance) < 7) return;
      if (!dragging) {
        dragging = true;
        element.classList.add('is-dragging');
        try { element.setPointerCapture(pointerId); } catch {}
      }
      element.scrollLeft = startLeft - distance;
      event.preventDefault();
    });

    const stop = (event) => {
      if (!down || (event?.pointerId != null && event.pointerId !== pointerId)) return;
      down = false;
      if (dragging) {
        element.dataset.suppressClick = 'true';
        requestAnimationFrame(() => { element.dataset.suppressClick = 'false'; });
      }
      dragging = false;
      element.classList.remove('is-dragging');
      try { if (pointerId != null) element.releasePointerCapture(pointerId); } catch {}
      pointerId = null;
    };

    element.addEventListener('pointerup', stop);
    element.addEventListener('pointercancel', stop);
    element.addEventListener('click', (event) => {
      if (element.dataset.suppressClick === 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function enableMobileProjectSectionSwipe() {
    if (projectsStage.dataset.mobileSectionSwipeBound === 'true') return;
    projectsStage.dataset.mobileSectionSwipeBound = 'true';

    let gesture = null;

    projectsStage.addEventListener('touchstart', (event) => {
      if (desktopQuery.matches || document.body.classList.contains('overlay-open') || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        startLeft: mainScroll.scrollLeft,
        startedAt: performance.now(),
        axis: null,
        moved: false
      };
    }, { passive: true });

    projectsStage.addEventListener('touchmove', (event) => {
      if (desktopQuery.matches || !gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      if (!gesture.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.15) gesture.axis = 'x';
        else if (Math.abs(dy) > Math.abs(dx) * 1.15) gesture.axis = 'y';
        else return;
      }

      // Vuốt dọc tiếp tục do projectsStage xử lý. Vuốt ngang được chuyển
      // trực tiếp cho mainScroll để rời Projects sang About/Service.
      if (gesture.axis === 'x') {
        gesture.moved = true;
        mainScroll.classList.add('is-project-horizontal-swipe');
        event.preventDefault();
        const max = Math.max(0, mainScroll.scrollWidth - mainScroll.clientWidth);
        mainScroll.scrollLeft = Math.max(0, Math.min(gesture.startLeft - dx, max));
      }
    }, { passive: false });

    const finish = (event, cancelled = false) => {
      if (!gesture) return;
      const lastTouch = event.changedTouches?.[0];
      const dx = lastTouch ? lastTouch.clientX - gesture.startX : 0;
      const elapsed = Math.max(1, performance.now() - gesture.startedAt);
      const velocity = Math.abs(dx) / elapsed;
      const wasHorizontal = gesture.axis === 'x';
      const moved = gesture.moved;
      gesture = null;

      if (!wasHorizontal) return;

      mainScroll.classList.remove('is-project-horizontal-swipe');
      const sections = getSections();
      const projectIndex = sections.findIndex((section) => section.id === 'projects');
      const threshold = Math.min(72, innerWidth * .17);
      const shouldChange = !cancelled && (Math.abs(dx) >= threshold || velocity >= .42);
      const direction = dx < 0 ? 1 : -1;
      scrollToSectionIndex(shouldChange ? projectIndex + direction : projectIndex, 'smooth');

      if (moved) {
        projectsStage.dataset.suppressClick = 'true';
        window.setTimeout(() => { projectsStage.dataset.suppressClick = 'false'; }, 360);
      }
    };

    projectsStage.addEventListener('touchend', (event) => finish(event, false), { passive: true });
    projectsStage.addEventListener('touchcancel', (event) => finish(event, true), { passive: true });
    projectsStage.addEventListener('click', (event) => {
      if (projectsStage.dataset.suppressClick === 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function enableDesktopTouchSwipe() {
    if (mainScroll.dataset.desktopTouchSwipeBound === 'true') return;
    mainScroll.dataset.desktopTouchSwipeBound = 'true';

    let gesture = null;

    mainScroll.addEventListener('touchstart', (event) => {
      if (!desktopQuery.matches || document.body.classList.contains('overlay-open') || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: performance.now(),
        startSection: getClosestSectionIndex(),
        axis: null,
        rail: event.target.closest('.projects-stage, .media-rail, .service-rail'),
        newsScrollTarget: getNewsScrollTarget(event.target),
        nestedScroll: false,
        moved: false
      };
    }, { passive: true });

    mainScroll.addEventListener('touchmove', (event) => {
      if (!desktopQuery.matches || !gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      if (!gesture.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        gesture.axis = Math.abs(dy) >= Math.abs(dx) * 1.1 ? 'y' : 'x';
      }

      // Horizontal touch remains native inside Projects/Media rails.
      // Vertical touch is reserved for switching complete desktop sections.
      if (gesture.axis === 'y') {
        const nestedDelta = -dy;
        if (gesture.newsScrollTarget && canConsumeVerticalWheel(gesture.newsScrollTarget, nestedDelta)) {
          gesture.nestedScroll = true;
          return;
        }
        gesture.moved = true;
        event.preventDefault();
      } else if (gesture.axis === 'x' && !gesture.rail) {
        gesture.moved = true;
        event.preventDefault();
      }
    }, { passive: false });

    const finish = (event, cancelled = false) => {
      if (!gesture) return;
      const current = gesture;
      gesture = null;
      const touch = event.changedTouches?.[0];
      if (!touch || cancelled || current.nestedScroll) return;

      const dx = touch.clientX - current.startX;
      const dy = touch.clientY - current.startY;
      const elapsed = Math.max(1, performance.now() - current.startedAt);
      const distance = current.axis === 'y' ? Math.abs(dy) : Math.abs(dx);
      const velocity = distance / elapsed;
      const threshold = Math.min(90, (current.axis === 'y' ? innerHeight : innerWidth) * .12);

      if (current.axis === 'y' && (distance >= threshold || velocity >= .38)) {
        scrollToSectionIndex(current.startSection + (dy < 0 ? 1 : -1), 'smooth');
      } else if (current.axis === 'x' && !current.rail && (distance >= threshold || velocity >= .38)) {
        scrollToSectionIndex(current.startSection + (dx < 0 ? 1 : -1), 'smooth');
      } else if (current.moved) {
        scrollToSectionIndex(current.startSection, 'smooth');
      }

      if (current.moved) {
        mainScroll.dataset.suppressTouchClick = 'true';
        window.setTimeout(() => { mainScroll.dataset.suppressTouchClick = 'false'; }, 420);
      }
    };

    mainScroll.addEventListener('touchend', (event) => finish(event, false), { passive: true });
    mainScroll.addEventListener('touchcancel', (event) => finish(event, true), { passive: true });
    mainScroll.addEventListener('click', (event) => {
      if (mainScroll.dataset.suppressTouchClick === 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function handleProjectsWheel(event) {
    if (!desktopQuery.matches || document.body.classList.contains('overlay-open')) return;
    if (!projectsStage.contains(event.target)) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    const max = Math.max(0, projectsStage.scrollWidth - projectsStage.clientWidth);
    const forward = delta > 0 && projectsStage.scrollLeft < max - 1;
    const backward = delta < 0 && projectsStage.scrollLeft > 1;
    if (!(forward || backward)) return;
    event.preventDefault();
    projectsStage.scrollLeft += delta;
    updateProjectActive();
  }

  function getNewsScrollTarget(target) {
    const candidates = [
      target?.closest?.('.news-title-grid'),
      target?.closest?.('.news-answer-copy'),
      target?.closest?.('.news-question-column')
    ].filter(Boolean);
    return candidates.find((element) => element.scrollHeight > element.clientHeight + 2) || null;
  }

  function canConsumeVerticalWheel(element, delta) {
    if (!element || !delta) return false;
    const max = Math.max(0, element.scrollHeight - element.clientHeight);
    if (delta > 0) return element.scrollTop < max - 1;
    return element.scrollTop > 1;
  }

  function handleSectionWheel(event) {
    if (!desktopQuery.matches || document.body.classList.contains('overlay-open')) return;
    if (event.defaultPrevented || event.ctrlKey) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 2) return;

    const newsScrollTarget = getNewsScrollTarget(event.target);
    if (newsScrollTarget && canConsumeVerticalWheel(newsScrollTarget, delta)) return;

    const direction = delta > 0 ? 1 : -1;
    const sections = getSections();
    if (!sections.length) return;

    event.preventDefault();
    const now = performance.now();
    const locked = now < sectionWheelLockedUntil;
    if (locked && direction === sectionWheelDirection) return;

    const baseIndex = locked ? sectionTargetIndex : getClosestSectionIndex();
    const targetIndex = Math.max(0, Math.min(baseIndex + direction, sections.length - 1));
    if (targetIndex === baseIndex) return;

    sectionWheelDirection = direction;
    sectionWheelLockedUntil = now + (config.layout.sectionSnapDuration || 620);
    scrollToSectionIndex(targetIndex, 'smooth');
  }

  function updateNav() {
    const sections = getSections();
    const activeIndex = getClosestSectionIndex();
    const active = sections[activeIndex]?.dataset.nav || 'projects';
    qa('.main-nav-link').forEach((button) => {
      const isActive = button.dataset.jump === active;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function bindGlobalEvents() {
    if (globalEventsBound) return;
    globalEventsBound = true;

    q('#newsAnswerClose')?.addEventListener('click', closeNewsPanel);
    q('#newsAnswerLink')?.addEventListener('click', (event) => {
      const href = q('#newsAnswerLink').getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      event.preventDefault();
      closeNewsPanel();
      jumpTo(href.slice(1));
    });

    // Event delegation keeps the controls working even if the popup structure is rebuilt.
    document.addEventListener('click', (event) => {
      const playButton = event.target.closest('#mediaOverlayPlay');
      if (playButton) {
        startMediaPlayback(event);
        return;
      }

      const directLink = event.target.closest('#mediaOverlayLink');
      if (directLink && !activeMediaSourceUrl) event.preventDefault();
    });

    q('#mediaOverlayPlayer')?.addEventListener('load', (event) => {
      const player = event.currentTarget;
      if (!activeMediaPlayerUrl || !activeMediaVideoId) return;
      if (player.dataset.expectedVideoId !== activeMediaVideoId) return;
      if (!String(player.src).includes(`/player/v1/${activeMediaVideoId}`)) return;
      window.setTimeout(() => {
        if (player.dataset.expectedVideoId !== activeMediaVideoId) return;
        mediaPlayerReady = true;
        window.clearTimeout(mediaPlayerLoadTimer);
        setMediaPlayerState('player');
      }, 700);
    });

    window.addEventListener('message', (event) => {
      if (!String(event.origin || '').includes('tiktok.com')) return;
      const payload = event.data || {};
      if (!payload['x-tiktok-player']) return;

      if (payload.type === 'onPlayerReady') {
        mediaPlayerReady = true;
        window.clearTimeout(mediaPlayerLoadTimer);
        setMediaPlayerState('player');
      }

      if (payload.type === 'onPlayerError') {
        mediaPlayerReady = false;
        window.clearTimeout(mediaPlayerLoadTimer);
        setMediaPlayerState('external');
      }
    });

    enableMobileProjectSectionSwipe();
    enableDesktopTouchSwipe();
    window.addEventListener('wheel', handleProjectsWheel, { passive: false });
    window.addEventListener('wheel', handleSectionWheel, { passive: false });
    projectsStage.addEventListener('scroll', updateProjectActive, { passive: true });
    mainScroll.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        updateProjectActive();
        updateNav();
        if (performance.now() >= sectionWheelLockedUntil) sectionTargetIndex = getClosestSectionIndex();
      });
    }, { passive: true });

    document.addEventListener('click', (event) => {
      const jump = event.target.closest('[data-jump]');
      if (jump) {
        event.preventDefault();
        jumpTo(jump.dataset.jump);
      }
      if (event.target.matches('[data-close-overlay]')) closeOverlays();
    });

    q('#brandLink').addEventListener('click', (event) => {
      const href = q('#brandLink').getAttribute('href') || '#projects';
      if (href.startsWith('#')) {
        event.preventDefault();
        jumpTo(href.slice(1));
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { closeOverlays(); closeNewsPanel(); }
      if (!desktopQuery.matches || !isProjectsCentered() || document.body.classList.contains('overlay-open')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); scrollToProject(currentProjectIndex + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); scrollToProject(currentProjectIndex - 1); }
    });

    desktopQuery.addEventListener('change', () => {
      const activeId = getSections()[getClosestSectionIndex()]?.id || 'projects';
      renderAll(false);
      requestAnimationFrame(() => jumpTo(activeId, 'auto'));
    });

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'DREAMESE_PREVIEW_CONFIG' && event.data.config) {
        config = DreameseStore.mergeDeep(DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG), event.data.config);
        renderAll(false);
      }
    });
  }

  function isProjectsCentered() {
    const rect = q('#projects').getBoundingClientRect();
    return desktopQuery.matches
      ? rect.top < innerHeight * .5 && rect.bottom > innerHeight * .5
      : rect.left < innerWidth * .5 && rect.right > innerWidth * .5;
  }

  function scrollToProject(index) {
    const safe = Math.max(0, Math.min(index, projectCards.length - 1));
    const card = projectCards[safe];
    if (!card) return;
    if (desktopQuery.matches) {
      const max = Math.max(0, projectsStage.scrollWidth - projectsStage.clientWidth);
      projectsStage.scrollTo({ left: Math.max(0, Math.min(card.offsetLeft, max)), behavior: 'smooth' });
    } else {
      projectsStage.scrollTo({ top: card.offsetTop, behavior: 'smooth' });
    }
    setActiveProject(safe);
  }

  function renderAll(initial = true) {
    setCssVariables(config.layout);
    renderBrand();
    renderAbout();
    renderProjects();
    renderService();
    renderMedia();
    renderNews();
    renderContact();
    updateNav();
    if (initial) requestAnimationFrame(() => {
      const hash = location.hash.replace('#', '');
      jumpTo(hash || 'projects', 'auto');
      sectionTargetIndex = getClosestSectionIndex();
    });
  }

  async function init() {
    ensureMediaOverlayStructure();
    const isManagerPreview = new URLSearchParams(window.location.search).has('preview');
    config = await DreameseStore.loadConfig({ skipStored: !isManagerPreview });
    renderAll(true);
    bindGlobalEvents();
  }

  init().catch((error) => {
    console.error(error);
    ensureMediaOverlayStructure();
    config = DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG);
    renderAll(true);
    bindGlobalEvents();
  });
})();
