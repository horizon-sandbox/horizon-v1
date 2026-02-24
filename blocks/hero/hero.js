export default function decorate(block) {
  document.body.style.overflowY = '';
  document.documentElement.style.overflowY = '';
  document.body.classList.add('has-custom-hero');

  const section = block.closest('.section');
  if (section) {
    section.classList.add('hero-section');
  }

  const values = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean);

  const [title = '', subtitle = '', placeholder = 'What can I help you find?'] = values;
  const backgroundVideoSrc = 'https://content.da.live/horizon-sandbox/horizon-v1/content/dam/global/shared/brand/horizon/waves-fucsia-3-pearsonpurple-slow-16x9-l2r-hires-v01.mp4';
  const heroDropdowns = [
    {
      label: 'By Customer',
      items: ['Institution', 'Enterprise', 'Consumer'],
    },
    {
      label: 'For Education',
      items: ['Learn', 'Progress', 'Career Readiness', 'Whole Learner', 'Educator Excellence'],
    },
    {
      label: 'For Work',
      items: ['Talent Solutions', 'Professional Assessments', 'Clinical'],
    },
  ];
  const dropdownMarkup = heroDropdowns
    .map((dropdown) => {
      const menuItems = dropdown.items
        .map((item) => `<li><a href="#">${item}</a></li>`)
        .join('');
      return `<div class="hero-nav-item has-dropdown">
        <a class="hero-nav-trigger" href="#" aria-haspopup="true">
          ${dropdown.label}
        </a>
        <ul class="hero-nav-menu">
          ${menuItems}
        </ul>
      </div>`;
    })
    .join('');

  block.innerHTML = `
    <div class="hero-media" aria-hidden="true">
      <video autoplay muted loop playsinline preload="metadata">
        <source src="${backgroundVideoSrc}" type="video/mp4" />
      </video>
      <div class="hero-overlay"></div>
    </div>
    <div class="hero-shell">
      <div class="hero-topbar">
        <div class="hero-brand-links">
          <a class="hero-logo" href="/" aria-label="Pearson home">
            <img src="/icons/logo-full-white.svg" alt="Pearson" width="164" height="31" loading="eager" />
          </a>
          ${dropdownMarkup}
        </div>
        <div class="hero-tools-links">
          <a class="hero-tool hero-tool-sales" href="/">Contact Sales</a>
          <a class="hero-tool" href="/">Get Support</a>
          <a class="hero-tool" href="/">Sign In</a>
          <a class="hero-tool hero-tool-icon" href="/" aria-label="Cart">🛒</a>
          <a class="hero-tool hero-tool-icon" href="/" aria-label="Locale">🌐</a>
        </div>
      </div>
      <div class="hero-content">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <div class="hero-search">
          <div class="hero-search-placeholder">
            <input type="text" placeholder="${placeholder}" aria-label="Search" />
            <button type="button" aria-label="Submit search">
              <img src="/icons/search.svg" alt="" width="18" height="18" loading="lazy" />
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Lazy-load Algolia after LCP — does not block page render
  const staticPlaceholder = block.querySelector('.hero-search-placeholder');
  const placeholderInput = staticPlaceholder?.querySelector('input');
  const placeholderBtn = staticPlaceholder?.querySelector('button');
  const placeholderBtnImg = placeholderBtn?.querySelector('img');

  // Container appended to body so the widget renders in its natural bottom-corner position
  const chatContainer = document.createElement('div');
  chatContainer.id = 'hero-algolia-chat';
  document.body.append(chatContainer);

  function triggerAlgoliaOpen() {
    // Click the widget's own toggle button so Algolia manages its own open state
    const widgetBtn = chatContainer.querySelector('button[aria-expanded]');
    if (widgetBtn && widgetBtn.getAttribute('aria-expanded') !== 'true') widgetBtn.click();
  }

  if (placeholderInput) placeholderInput.addEventListener('focus', triggerAlgoliaOpen);
  if (placeholderBtn) placeholderBtn.addEventListener('click', triggerAlgoliaOpen);

  async function initAlgoliaChat() {
    try {
      // Load chat CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/instantsearch.css/components/chat.css';
      document.head.append(link);

      // Load Algolia modules from CDN (ESM, no build step needed)
      const [{ liteClient }, { default: instantsearch }, { chat }] = await Promise.all([
        // eslint-disable-next-line import/no-unresolved
        import('https://esm.sh/algoliasearch@5/lite'),
        // eslint-disable-next-line import/no-unresolved
        import('https://esm.sh/instantsearch.js'),
        // eslint-disable-next-line import/no-unresolved
        import('https://esm.sh/instantsearch.js/es/widgets'),
      ]);

      const searchClient = liteClient('XFOI9EBBHR', '3b463119b3996ce4822a14242b948870');
      const searchInstance = instantsearch({ searchClient });

      searchInstance.addWidgets([
        chat({
          container: chatContainer,
          agentId: '8839c362-66e6-4eac-98a1-8fca6e1d1b68',
        }),
      ]);

      searchInstance.start();

      // Swap search icon → sparkle once the AI widget is ready
      if (placeholderBtnImg) placeholderBtnImg.remove();
      if (placeholderBtn) {
        placeholderBtn.classList.add('is-ai-ready');
        placeholderBtn.setAttribute('aria-label', 'Search with Algolia AI');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Algolia chat failed to load, keeping static search.', e);
    }
  }

  // Load Algolia shortly after LCP — early enough that the icon swap
  // happens before the user interacts, but non-blocking for render.
  setTimeout(initAlgoliaChat, 800);
}
