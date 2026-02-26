export default function decorate(block) {
  const section = block.closest('.section');
  if (section) {
    section.classList.add('hero-section');
  }

  const values = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean);

  const [title = '', subtitle = '', placeholder = 'What can I help you find?'] = values;
  const backgroundVideoSrc = 'https://content.da.live/horizon-sandbox/horizon-v1/content/dam/global/shared/brand/horizon/video/waves-turquoiseburn-1-light-16x9-l2r.mp4';

  block.innerHTML = `
    <div class="hero-media" aria-hidden="true">
      <video autoplay muted loop playsinline preload="metadata">
        <source src="${backgroundVideoSrc}" type="video/mp4" />
      </video>
      <div class="hero-overlay"></div>
    </div>
    <div class="hero-shell">
      <div class="hero-content">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <div class="hero-search">
          <form class="hero-search-placeholder" action="/search" method="get">
            <input type="text" name="q" placeholder="${placeholder}" aria-label="Search" autocomplete="off" />
            <button type="submit" aria-label="Submit search">
              <img src="/icons/agentic-search.svg" alt="" width="18" height="18" loading="lazy" />
            </button>
          </form>
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

  // Navigate to /search on submit (Enter or button click)
  const searchForm = staticPlaceholder;
  if (searchForm) {
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = placeholderInput?.value.trim() || '';
      window.location.href = query ? `/search?q=${encodeURIComponent(query)}` : '/search';
    });
  }

  if (placeholderInput) placeholderInput.addEventListener('focus', triggerAlgoliaOpen);

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
                <a class="ais-Carousel-hit-link" href="${url}" target="_blank" rel="noopener">
                  ${image ? html`
                    <div class="ais-Carousel-hit-image">
                      <img src="${image}" alt="${hitTitle}" loading="lazy" />
                    </div>` : ''}
                  <span class="ais-Carousel-hit-title">${hitTitle}</span>
                  ${author ? html`<p class="ais-Carousel-hit-subtitle">${author}</p>` : ''}
                  ${price ? html`<p class="ais-Carousel-hit-price">${price}</p>` : ''}
                </a>
              `;
            },
          },
        }),
      ]);

      searchInstance.start();

      // Post-process assistant messages: fetch real product data from Algolia
      // and render rich tiles in place of inline links.
      const PRODUCT_INDEX = 'live-learner-program-index';
      const PEARSON_HOST = 'https://www.pearson.com/store/en-us';

      // Extract a readable slug from a Pearson product URL to use as an Algolia query.
      // e.g. .../p/elements-of-ecology/P200.../978... → "elements of ecology"
      const queryFromHref = (href, text) => {
        const match = href.match(/\/p\/([^/]+)\//i);
        return match ? match[1].replace(/-/g, ' ') : text;
      };

      const buildProductTile = (href, fallbackText, hit) => {
        const hitTitle = hit?.name || fallbackText;
        const raw = hit?.smallThumbnail || '';
        const image = raw && raw.startsWith('/') ? `${PEARSON_HOST}${raw}` : raw;
        const author = hit?.authorsAggregated || '';
        const sym = hit?.currencySymbol || '$';
        const price = hit?.lowestProgramPriceValue != null
          ? `from ${sym}${Number(hit.lowestProgramPriceValue).toFixed(2)}/mo` : '';
        const url = hit?.url || href;
        const tile = document.createElement('a');
        tile.className = 'ais-chat-product-tile';
        tile.href = url;
        tile.target = '_blank';
        tile.rel = 'noopener';
        tile.innerHTML = `
          ${image ? `<div class="ais-chat-product-tile-image"><img src="${image}" alt="${hitTitle}" loading="lazy" /></div>` : ''}
          <div class="ais-chat-product-tile-body">
            <span class="ais-chat-product-tile-title">${hitTitle}</span>
            ${author ? `<span class="ais-chat-product-tile-author">${author}</span>` : ''}
            ${price ? `<span class="ais-chat-product-tile-price">${price}</span>` : ''}
          </div>`;
        return tile;
      };

      const renderLinksAsTiles = async (messageEl) => {
        if (messageEl.dataset.tilesRendered) return;
        const anchors = [...messageEl.querySelectorAll('a[href]')];
        if (!anchors.length) return;
        messageEl.dataset.tilesRendered = '1';

        // Insert grid with loading placeholders immediately
        const grid = document.createElement('div');
        grid.className = 'ais-chat-product-tiles';
        const linkData = anchors.map((anchor) => {
          const { href } = anchor;
          const rawText = anchor.textContent.trim();
          const query = queryFromHref(href, rawText);
          return { href, text: rawText, query };
        });
        linkData.forEach(({ query }) => {
          const loadingTile = document.createElement('div');
          loadingTile.className = 'ais-chat-product-tile ais-chat-product-tile--loading';
          loadingTile.innerHTML = `
            <div class="ais-chat-product-tile-image"></div>
            <div class="ais-chat-product-tile-body">
              <span class="ais-chat-product-tile-title">${query}</span>
            </div>`;
          grid.append(loadingTile);
        });
        anchors.forEach((anchor) => anchor.remove());
        messageEl.append(grid);

        // Fetch real hits from Algolia in one multi-query call
        try {
          const { results } = await searchClient.search({
            requests: linkData.map(({ query }) => ({
              indexName: PRODUCT_INDEX,
              query,
              hitsPerPage: 1,
            })),
          });
          linkData.forEach(({ href, text }, i) => {
            const hit = results[i]?.hits?.[0];
            const tile = buildProductTile(href, text, hit || {});
            grid.replaceChild(tile, grid.children[i]);
          });
        } catch (fetchErr) {
          // eslint-disable-next-line no-console
          console.warn('Product tile fetch failed, showing text fallback.', fetchErr);
        }
      };

      // Watch for new/updated assistant messages and convert inline links to tiles.
      // Uses a debounce map so each message element is only processed once
      // streaming has settled (links appear mid-stream as content is added).
      const pendingMessages = new Map();
      const chatObserver = new MutationObserver((mutations) => {
        const seen = new Set();
        mutations.forEach((mutation) => {
          // Collect candidate message containers from added nodes and their ancestors
          const candidates = [];
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.classList?.contains('ais-ChatMessage-message')) {
              candidates.push(node);
            } else {
              const parent = node.closest?.('.ais-ChatMessage-message');
              if (parent) candidates.push(parent);
              candidates.push(...node.querySelectorAll('.ais-ChatMessage-message'));
            }
          });
          candidates.forEach((el) => {
            if (seen.has(el)) return;
            seen.add(el);
            // Debounce: wait 300 ms after last mutation before processing
            if (pendingMessages.has(el)) clearTimeout(pendingMessages.get(el));
            pendingMessages.set(el, setTimeout(() => {
              pendingMessages.delete(el);
              renderLinksAsTiles(el);
            }, 300));
          });
        });
      });
      chatObserver.observe(chatContainer, { childList: true, subtree: true });

      // Swap search icon → AI icon once the widget is ready
      if (placeholderBtnImg) placeholderBtnImg.setAttribute('src', '/icons/agentic-search.svg');
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
