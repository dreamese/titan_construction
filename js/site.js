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

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function safeHref(value, fallback = '#') {
    const href = String(value || '').trim();
    return href || fallback;
  }

  function getTikTokVideoId(url) {
    const match = String(url || '').match(/\/video\/(\d+)/i);
    return match ? match[1] : '';
  }

  function getTikTokPlayerUrl(url) {
    const videoId = getTikTokVideoId(url);
    if (!videoId) return '';
    const params = new URLSearchParams({
      autoplay: '1',
      controls: '1',
      loop: '0',
      music_info: '1',
      description: '1',
      rel: '0'
    });
    return `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`;
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
    q('#brandLogo').src = deviceValue(config.brand, 'logo', config.brand.logo);
    q('#brandName').textContent = deviceValue(config.brand, 'name', config.brand.name);
    q('#brandTagline').textContent = deviceValue(config.brand, 'tagline', config.brand.tagline);
    q('#brandLink').href = safeHref(deviceValue(config.brand, 'logoLink', config.brand.logoLink), '#projects');

    q('#mainNav').innerHTML = config.navigation.map((item) => `
      <button class="main-nav-link" type="button" data-jump="${escapeHtml(item.target)}">${escapeHtml(deviceValue(item, 'label', item.label))}</button>
    `).join('');

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
    mediaRail.innerHTML = config.media.items.map((item, index) => `
      <article class="media-card" tabindex="0" data-media-index="${index}">
        <div class="media-visual">
          <img src="${escapeHtml(deviceValue(item, 'image', item.image))}" alt="${escapeHtml(deviceValue(item, 'title', item.title))}" loading="lazy">
          <span class="media-play">▶</span>
        </div>
        <div class="media-copy"><small>${escapeHtml(deviceValue(item, 'label', item.label))}</small><h3>${escapeHtml(deviceValue(item, 'title', item.title))}</h3></div>
      </article>
    `).join('');
    qa('.media-card').forEach((card) => {
      const index = Number(card.dataset.mediaIndex);
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
      return `
        <article class="contact-card contact-${escapeHtml(card.type)} linked-card" tabindex="0" role="link" data-contact-index="${index}" data-card-link="${escapeHtml(link)}" aria-label="Mở ${escapeHtml(title)}">
          ${image ? `<div class="contact-card-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy"></div>` : (card.type === 'maps' ? '<div class="map-placeholder">MAPS<br>Dreamese Studio</div>' : '')}
          <div class="contact-card-body">
            <h3>${escapeHtml(title)}</h3>
            ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        </article>`;
    }).join('');
    qa('.contact-card').forEach((card) => {
      const openLink = () => navigateLink(card.dataset.cardLink);
      card.addEventListener('click', openLink);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLink();
        }
      });
    });
  }

  function openMedia(index) {
    const item = config.media.items[index];
    if (!item) return;

    const videoUrl = safeHref(deviceValue(item, 'url', item.url));
    const playerUrl = getTikTokPlayerUrl(videoUrl);
    const player = q('#mediaOverlayPlayer');
    const fallbackImage = q('#mediaOverlayImage');
    const playerMessage = q('#mediaPlayerMessage');

    fallbackImage.src = deviceValue(item, 'image', item.image);
    fallbackImage.alt = deviceValue(item, 'title', item.title);
    q('#mediaOverlayKicker').textContent = deviceValue(item, 'label', item.label);
    q('#mediaOverlayTitle').textContent = deviceValue(item, 'title', item.title);
    q('#mediaOverlayDescription').textContent = deviceValue(item, 'description', item.description);
    q('#mediaOverlayLink').href = videoUrl;

    if (playerUrl) {
      player.src = playerUrl;
      player.hidden = false;
      fallbackImage.hidden = true;
      playerMessage.hidden = true;
    } else {
      player.src = 'about:blank';
      player.hidden = true;
      fallbackImage.hidden = false;
      playerMessage.hidden = false;
    }

    openOverlay(q('#mediaOverlay'));
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
    q('#newsAnswerPanel').classList.add('is-open');
    q('#newsAnswerPanel').setAttribute('aria-hidden', 'false');
  }

  function closeNewsPanel() {
    const panel = q('#newsAnswerPanel');
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    q('#newsAnswerEmpty').hidden = false;
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
    const mediaPlayer = q('#mediaOverlayPlayer');
    if (mediaPlayer) mediaPlayer.src = 'about:blank';
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
    let startX = 0;
    let startLeft = 0;
    element.addEventListener('pointerdown', (event) => {
      if (!desktopQuery.matches || event.pointerType === 'touch' || event.target.closest('a,button')) return;
      down = true;
      startX = event.clientX;
      startLeft = element.scrollLeft;
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', (event) => {
      if (!down) return;
      element.scrollLeft = startLeft - (event.clientX - startX);
    });
    const stop = () => { down = false; };
    element.addEventListener('pointerup', stop);
    element.addEventListener('pointercancel', stop);
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

  function handleSectionWheel(event) {
    if (!desktopQuery.matches || document.body.classList.contains('overlay-open')) return;
    if (event.defaultPrevented || event.ctrlKey) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 2) return;
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
    config = await DreameseStore.loadConfig();
    renderAll(true);
    bindGlobalEvents();
  }

  init().catch((error) => {
    console.error(error);
    config = DreameseStore.clone(window.DREAMESE_DEFAULT_CONFIG);
    renderAll(true);
    bindGlobalEvents();
  });
})();
