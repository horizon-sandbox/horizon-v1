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

  // Container appended to body so the chat widget renders in its natural bottom-corner position
  const chatContainer = document.createElement('div');
  chatContainer.id = 'hero-algolia-chat';
  document.body.append(chatContainer);

  // Navigate to /search on submit (Enter or button click)
  const searchForm = staticPlaceholder;
  if (searchForm) {
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = placeholderInput?.value.trim() || '';
      window.location.href = query ? `/search.html?q=${encodeURIComponent(query)}` : '/search.html';
    });
  }
  // ── Shared cart state (used by autocomplete ATC tiles and chat tool handlers) ──
  // Note: BigCommerce cart is shared across sessions until an order is placed.
  const BACKEND_URL = 'https://algolia-agent-alb-485198481.us-east-1.elb.amazonaws.com';
  const CART_KEY = 'pearson_agent_cart';
  const cartState = (() => {
    try {
      const r = localStorage.getItem(CART_KEY);
      return r ? JSON.parse(r) : {};
    } catch { return {}; }
  })();
  const saveCart = (s) => {
    try {
      if (s.cartId) localStorage.setItem(CART_KEY, JSON.stringify(s));
      else localStorage.removeItem(CART_KEY);
    } catch { /* ignore storage errors */ }
  };
  const mergeCart = (data) => {
    if (data.cart) cartState.cart = data.cart;
    if (data.cartId) cartState.cartId = data.cartId;
    if (data.checkoutUrl) cartState.checkoutUrl = data.checkoutUrl;
    saveCart(cartState);
    window.dispatchEvent(new CustomEvent('pearson:cart-updated'));
  };
  const apiCall = async (method, path, body) => {
    const res = await fetch(BACKEND_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json?.error?.message || `HTTP ${res.status}`), { data: json, statusCode: res.status });
    return json;
  };
  const clearCart = () => {
    delete cartState.cartId;
    delete cartState.cart;
    delete cartState.checkoutUrl;
    localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new CustomEvent('pearson:cart-updated'));
  };
  // Add to cart with automatic retry: if the stored cartId is rejected (400),
  // clear it and try again so BigCommerce creates a fresh cart.
  const addToCartCall = async (productId, quantity = 1) => {
    const payload = { productId, quantity };
    if (cartState.cartId) payload.cartId = cartState.cartId;
    try {
      return await apiCall('POST', '/api/tools/add-to-cart', payload);
    } catch (err) {
      if (err.statusCode === 400 && payload.cartId) {
        clearCart();
        return apiCall('POST', '/api/tools/add-to-cart', { productId, quantity });
      }
      throw err;
    }
  };
  // ── Autocomplete dropdown ──────────────────────────────────────────────────
  async function initAutocomplete() {
    try {
      // eslint-disable-next-line import/no-unresolved
      const { liteClient } = await import('https://esm.sh/algoliasearch@5/lite');
      const client = liteClient('XFOI9EBBHR', '3b463119b3996ce4822a14242b948870');

      const PRODUCT_INDEX = 'live-learner-program-index';
      const IMG_PREFIX = 'https://www.pearson.com/store/en-us';
      const STORE_HOST = 'https://www.pearson.com';

      // Plain X clear button — only visible when input has text
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'hero-search-clear';
      clearBtn.setAttribute('aria-label', 'Clear search');
      clearBtn.innerHTML = '<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 5.58579L12.2929 0.292893C12.6834 -0.0976311 13.3166 -0.0976311 13.7071 0.292893C14.0976 0.683418 14.0976 1.31658 13.7071 1.70711L8.41421 7L13.7071 12.2929C14.0976 12.6834 14.0976 13.3166 13.7071 13.7071C13.3166 14.0976 12.6834 14.0976 12.2929 13.7071L7 8.41421L1.70711 13.7071C1.31658 14.0976 0.683418 14.0976 0.292893 13.7071C-0.0976311 13.3166 -0.0976311 12.6834 0.292893 12.2929L5.58579 7L0.292893 1.70711C-0.0976311 1.31658 -0.0976311 0.683418 0.292893 0.292893C0.683418 -0.0976311 1.31658 -0.0976311 1.70711 0.292893L7 5.58579Z" fill="currentColor"/></svg>';
      clearBtn.hidden = true;
      staticPlaceholder.insertBefore(clearBtn, placeholderBtn);

      // Append dropdown to body so it renders above all page stacking contexts
      const dropdown = document.createElement('div');
      dropdown.className = 'hero-search-dropdown';
      dropdown.setAttribute('role', 'region');
      dropdown.setAttribute('aria-label', 'Search suggestions');
      dropdown.hidden = true;
      document.body.append(dropdown);

      // Position the dropdown to align with the search bar
      const positionDropdown = () => {
        const rect = staticPlaceholder.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY + 8}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.style.width = `${rect.width}px`;
      };

      let debounceTimer;

      const closeDropdown = () => {
        dropdown.hidden = true;
        clearBtn.hidden = true;
      };
      const openDropdown = () => {
        positionDropdown();
        dropdown.hidden = false;
        clearBtn.hidden = !placeholderInput.value;
      };

      // Product card template
      const productCardHtml = (hit) => {
        const hitTitle = hit.name || hit.objectID;
        const author = hit.authorsAggregated || '';
        const thumb = hit.smallThumbnail ? `${IMG_PREFIX}${hit.smallThumbnail}` : '';
        const rawUrl = hit.url || '';
        const url = rawUrl.startsWith('http') ? rawUrl : `${STORE_HOST}${rawUrl || `#${hit.objectID}`}`;
        const isbn = (hit.isbn13 && hit.isbn13[0]) || hit.objectID;
        return `<li class="hero-search-product">
          <a class="hero-search-product-link" href="${url}">
            ${thumb
    ? `<img class="hero-search-product-thumb" src="${thumb}" alt="" loading="lazy">`
    : '<div class="hero-search-product-thumb is-placeholder"></div>'}
            <div class="hero-search-product-info">
              <span class="hero-search-product-title">${hitTitle}</span>
              ${author ? `<span class="hero-search-product-author">${author}</span>` : ''}
            </div>
          </a>
          <button class="hero-search-product-atc" type="button" data-product-id="${isbn}" aria-label="Add ${hitTitle} to cart">
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10a4 4 0 01-8 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </li>`;
      };

      // Best Selling Products section HTML
      const bestSellersHtml = (hits) => `
        <p class="hero-search-section-heading">BEST SELLING PRODUCTS</p>
        <ul class="hero-search-products" role="list">${hits.map(productCardHtml).join('')}</ul>`;

      // Show empty state — focus with no query
      const showBestSellers = async () => {
        try {
          const { results } = await client.search({
            requests: [{ indexName: PRODUCT_INDEX, query: '', hitsPerPage: 4 }],
          });
          const hits = results[0]?.hits ?? [];
          const nbHits = results[0]?.nbHits ?? 0;
          if (!hits.length) { closeDropdown(); return; }
          const searchUrl = '/search.html';
          dropdown.innerHTML = `${bestSellersHtml(hits)}
            <div class="hero-search-footer">
              <a class="hero-search-footer-count" href="${searchUrl}">${nbHits.toLocaleString()} items found</a>
              <a class="hero-search-footer-viewall" href="${searchUrl}">View all</a>
            </div>`;
          openDropdown();
        } catch { closeDropdown(); }
      };

      // Show results — query row + products + footer, all from one index
      const showResults = async (query) => {
        try {
          const { results } = await client.search({
            requests: [{ indexName: PRODUCT_INDEX, query, hitsPerPage: 4 }],
          });
          const prodHits = results[0]?.hits ?? [];
          const nbHits = results[0]?.nbHits ?? 0;

          if (!nbHits) { closeDropdown(); return; }

          const searchUrl = `/search.html?q=${encodeURIComponent(query)}`;
          let html = `<ul class="hero-search-suggestions" role="list">
            <li class="hero-search-suggestion">
              <a class="hero-search-suggestion-link" href="${searchUrl}">&ldquo;${query}&rdquo; <span class="hero-search-suggestion-count">(${nbHits.toLocaleString()})</span></a>
            </li>
          </ul>`;

          if (prodHits.length) {
            html += `<hr class="hero-search-divider">${bestSellersHtml(prodHits)}`;
          }

          html += `<div class="hero-search-footer">
            <a class="hero-search-footer-count" href="${searchUrl}">${nbHits.toLocaleString()} items found</a>
            <a class="hero-search-footer-viewall" href="${searchUrl}">View all</a>
          </div>`;

          dropdown.innerHTML = html;
          openDropdown();
        } catch { closeDropdown(); }
      };

      if (placeholderInput) {
        // Update suggestions as user types
        placeholderInput.addEventListener('input', () => {
          const query = placeholderInput.value.trim();
          clearTimeout(debounceTimer);
          if (!query) {
            debounceTimer = setTimeout(showBestSellers, 100);
          } else if (query.length >= 2) {
            debounceTimer = setTimeout(() => showResults(query), 200);
          }
        });

        // Any click or focus inside the search bar opens the dropdown
        staticPlaceholder.addEventListener('click', () => {
          const query = placeholderInput.value.trim();
          if (query.length >= 2) showResults(query);
          else showBestSellers();
        });

        placeholderInput.addEventListener('focus', () => {
          const query = placeholderInput.value.trim();
          if (query.length >= 2) showResults(query);
          else showBestSellers();
        });

        // Clear button: reset input and show best sellers
        clearBtn.addEventListener('click', () => {
          placeholderInput.value = '';
          clearBtn.hidden = true;
          placeholderInput.focus();
          showBestSellers();
        });

        placeholderInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { closeDropdown(); placeholderInput.blur(); }
        });

        // Keep input focused when clicking inside dropdown
        dropdown.addEventListener('mousedown', (e) => e.preventDefault());

        // Add-to-cart button on product tile (event delegation)
        dropdown.addEventListener('click', async (e) => {
          const btn = e.target.closest('.hero-search-product-atc');
          if (!btn || btn.disabled) return;
          e.preventDefault();
          const { productId } = btn.dataset;
          btn.disabled = true;
          btn.dataset.state = 'loading';
          try {
            const data = await addToCartCall(productId, 1);
            mergeCart(data);
            btn.dataset.state = 'done';
          } catch (err) {
            btn.dataset.state = 'error';
            btn.title = err.message;
            setTimeout(() => { btn.disabled = false; btn.dataset.state = ''; }, 2000);
          }
        });

        // Close when clicking outside search bar or dropdown
        document.addEventListener('click', (e) => {
          if (!staticPlaceholder.contains(e.target) && !dropdown.contains(e.target)) {
            closeDropdown();
          }
        });

        // Reposition on resize/scroll
        window.addEventListener('resize', () => { if (!dropdown.hidden) positionDropdown(); });
        window.addEventListener('scroll', () => { if (!dropdown.hidden) positionDropdown(); }, { passive: true });
      }
    } catch {
      // autocomplete unavailable — static form still works
    }
  }

  initAutocomplete();

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

      // ── Tool handlers ───────────────────────────────────────────────────────
      // Trim the BigCommerce response to only the fields the LLM and templates
      // need — full payload causes provider 400 (context too large).
      const summarizeCart = (data) => ({
        cartId: data.cartId,
        checkoutUrl: data.checkoutUrl,
        cart: data.cart ? {
          items: (data.cart.items || []).map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            imageUrl: i.imageUrl,
          })),
          total: data.cart.total,
          itemCount: data.cart.itemCount,
          currencyCode: data.cart.currencyCode,
        } : undefined,
      });

      const toolAddToCart = async ({ input, addToolResult }) => {
        const productId = String(input?.productId || input?.product_id || '');
        const quantity = Number(input?.quantity) || 1;
        try {
          const data = await addToCartCall(productId, quantity);
          mergeCart(data);
          addToolResult({ output: summarizeCart(data) });
        } catch (err) {
          addToolResult({ output: { error: err.message } });
        }
      };

      const toolGetCart = async ({ input, addToolResult }) => {
        const id = input?.cartId || cartState.cartId;
        if (!id) { addToolResult({ output: { error: 'No active cart. Add an item first.' } }); return; }
        try {
          const data = await apiCall('GET', `/api/tools/get-cart?cartId=${encodeURIComponent(id)}`);
          mergeCart(data);
          addToolResult({ output: summarizeCart(data) });
        } catch (err) {
          addToolResult({ output: { error: err.message } });
        }
      };

      const toolGetCheckoutLink = async ({ input, addToolResult }) => {
        const id = input?.cartId || cartState.cartId;
        if (!id) { addToolResult({ output: { error: 'No active cart. Add an item first.' } }); return; }
        try {
          const data = await apiCall('GET', `/api/tools/get-checkout?cartId=${encodeURIComponent(id)}`);
          mergeCart(data);
          if (data.checkoutUrl) window.open(data.checkoutUrl, '_blank', 'noopener');
          addToolResult({ output: { checkoutUrl: data.checkoutUrl } });
        } catch (err) {
          addToolResult({ output: { error: err.message } });
        }
      };

      searchInstance.addWidgets([
        chat({
          container: chatContainer,
          agentId: '0284fb45-aa25-4f6d-b34f-2278708f970b',

          // ── Client-side tools (must match names in Agent Studio) ───────────
          tools: {
            add_to_cart: {
              onToolCall: toolAddToCart,
              templates: {
                layout({ message }, { html }) {
                  const input = message.input || {};
                  const { output } = message;
                  if (output == null) {
                    return html`<div class="tc"><div class="tc-title">🛒 Add to cart</div><div class="tc-row"><span class="tc-key">Product</span><span class="tc-val">${input.productId}</span></div><span class="tc-status tc-loading">Adding to cart…</span></div>`;
                  }
                  if (output.error) {
                    return html`<div class="tc"><div class="tc-title">🛒 Add to cart</div><span class="tc-status tc-error">✗ ${output.error}</span></div>`;
                  }
                  const items = output.cart?.items || [];
                  const total = (output.cart?.total || 0).toFixed(2);
                  const currency = output.cart?.currencyCode || '';
                  const renderCartItem = (item, idx) => {
                    const { imageUrl, name } = item;
                    const isLast = idx === items.length - 1;
                    const imgDiv = imageUrl ? html`<div class="tc-item-image"><img src="${imageUrl}" alt="${name}" loading="lazy" /></div>` : html`<div class="tc-item-image"></div>`;
                    const titleDiv = html`<div class="tc-item-title">${name}${isLast ? html`<span class="tc-new-badge">new</span>` : ''}</div>`;
                    return html`<div class="tc-item">${imgDiv}<div class="tc-item-body">${titleDiv}<div class="tc-item-meta"><span class="tc-item-qty">Qty: ${item.quantity}</span><span class="tc-item-price">${currency} $${(item.price || 0).toFixed(2)}</span></div></div></div>`;
                  };
                  return html`
                    <div class="tc">
                      <div class="tc-title">🛒 Add to cart <span class="tc-status tc-done" style="float:right">✓ Added</span></div>
                      ${items.map(renderCartItem)}
                      <hr class="tc-divider" />
                      <div class="tc-total-row">
                        <span>Cart total (${output.cart?.itemCount} item${output.cart?.itemCount !== 1 ? 's' : ''})</span>
                        <span>${currency} $${total}</span>
                      </div>
                    </div>`;
                },
              },
            },

            get_cart: {
              onToolCall: toolGetCart,
              templates: {
                layout({ message }, { html }) {
                  const { output } = message;
                  if (output == null) {
                    return html`<div class="tc"><div class="tc-title">🛒 Cart</div><span class="tc-status tc-loading">Loading cart…</span></div>`;
                  }
                  if (output.error) {
                    return html`<div class="tc"><div class="tc-title">🛒 Cart</div><span class="tc-status tc-error">✗ ${output.error}</span></div>`;
                  }
                  const items = output.cart?.items || [];
                  return html`
                    <div class="tc">
                      <div class="tc-title">🛒 Cart</div>
                      ${items.map((item) => html`
                        <div class="tc-row">
                          <span class="tc-key">${item.name}</span>
                          <span class="tc-val">×${item.quantity} $${(item.price || 0).toFixed(2)}</span>
                        </div>`)}
                      <div class="tc-row">
                        <span class="tc-key"><strong>Total</strong></span>
                        <span class="tc-val"><strong>$${(output.cart?.total || 0).toFixed(2)}</strong></span>
                      </div>
                      <span class="tc-status tc-done">✓ Cart loaded</span>
                    </div>`;
                },
              },
            },

            get_checkout_link: {
              onToolCall: toolGetCheckoutLink,
              templates: {
                layout({ message }, { html }) {
                  const { output } = message;
                  if (output == null) {
                    return html`<div class="tc"><div class="tc-title">💳 Checkout</div><span class="tc-status tc-loading">Generating checkout link…</span></div>`;
                  }
                  if (output.error) {
                    return html`<div class="tc"><div class="tc-title">💳 Checkout</div><span class="tc-status tc-error">✗ ${output.error}</span></div>`;
                  }
                  return html`
                    <div class="tc">
                      <div class="tc-title">💳 Checkout</div>
                      <span class="tc-status tc-done">✓ Redirecting to checkout…</span>
                      <a class="tc-link" href="${output.checkoutUrl}" target="_blank" rel="noopener">🛍️ Complete Purchase</a>
                    </div>`;
                },
              },
            },
          },

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
