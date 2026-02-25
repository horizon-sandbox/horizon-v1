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
  const backgroundVideoSrc = 'https://content.da.live/horizon-sandbox/horizon-v1/content/dam/global/shared/brand/horizon/video/waves-turquoiseburn-1-light-16x9-l2r.mp4';
  const heroDropdowns = [
    {
      label: 'Customer',
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
    <div class="hero-topbar">
      <div class="hero-brand-links">
        <a class="hero-logo" href="/" aria-label="Pearson home">
          <img src="/icons/pearson-logo-full-purple.svg" alt="Pearson" width="164" height="31" loading="eager" />
        </a>
        ${dropdownMarkup}
      </div>
      <div class="hero-tools-links">
        <a class="hero-tool hero-tool-sales" href="/">Contact Sales</a>
        <a class="hero-tool hero-tool-signin" href="/">Sign In</a>
        <a class="hero-tool hero-tool-icon hero-tool-support" href="/" aria-label="Get Support"></a>
        <a class="hero-tool hero-tool-icon hero-tool-cart" href="/" aria-label="Cart"></a>
      </div>
    </div>
    <div class="hero-shell">
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
      // Load chat CSS (full satellite theme for complete widget + item card styles)
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/instantsearch.css@8/themes/satellite-min.css';
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
          templates: {
            item(hit, { html }) {
              const hitTitle = hit.name || hit.title || hit.productName || hit.objectID;
              const image = hit.image || hit.cover_image || hit.thumbnail || hit.imageUrl;
              const author = hit.author || hit.authors || '';
              const url = hit.url || hit.productPageUrl || hit.pdpUrl || `#${hit.objectID}`;
              const price = hit.price != null ? `$${Number(hit.price).toFixed(2)}` : '';
              return html`
                <a class="ais-Chat-item-card" href="${url}" target="_blank" rel="noopener">
                  ${image ? html`<img class="ais-Chat-item-card-image" src="${image}" alt="${hitTitle}" />` : ''}
                  <div class="ais-Chat-item-card-body">
                    <p class="ais-Chat-item-card-title">${hitTitle}</p>
                    ${author ? html`<p class="ais-Chat-item-card-author">${author}</p>` : ''}
                    ${price ? html`<p class="ais-Chat-item-card-price">${price}</p>` : ''}
                  </div>
                </a>
              `;
            },
          },
        }),
      ]);

      searchInstance.start();

      // Swap search icon → AI icon once the widget is ready
      if (placeholderBtnImg) placeholderBtnImg.setAttribute('src', '/icons/ai-search.svg');
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
