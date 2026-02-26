const ALGOLIA_SEARCH_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/algoliasearch@4.24.0/dist/algoliasearch-lite.umd.js';
const ALGOLIA_INSTANTSEARCH_URL = 'https://cdn.jsdelivr.net/npm/instantsearch.js@4.85.0/dist/instantsearch.production.min.js';

const TABS = [
  { id: 'pearson-ai', labelKey: 'pearsonAiLabel' },
  { id: 'shop', labelKey: 'shopLabel' },
  { id: 'study', labelKey: 'studyLabel' },
  { id: 'discover', labelKey: 'discoverLabel' },
  { id: 'support', labelKey: 'supportLabel' },
];

const SOURCES = [
  { key: 'shop', indexKey: 'shopIndex' },
  { key: 'study', indexKey: 'studyIndex' },
  { key: 'discover', indexKey: 'discoverIndex' },
  { key: 'support', indexKey: 'supportIndex' },
  { key: 'content', indexKey: 'contentIndex' },
];

let libsPromise;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.append(script);
  });
}

async function loadLibs() {
  if (window.algoliasearch && window.instantsearch) return;
  if (!libsPromise) {
    libsPromise = Promise.all([
      loadScript(ALGOLIA_SEARCH_CLIENT_URL),
      loadScript(ALGOLIA_INSTANTSEARCH_URL),
    ]);
  }
  await libsPromise;
}

function getAgentApiUrl(config) {
  if (config.chatAgentApiUrl) {
    const url = new URL(config.chatAgentApiUrl);
    if (!url.searchParams.has('compatibilityMode')) url.searchParams.set('compatibilityMode', 'ai-sdk-5');
    url.searchParams.delete('stream');
    return url.toString();
  }
  if (config.chatAgentId) {
    return `https://${config.appId}.algolia.net/agent-studio/1/agents/${config.chatAgentId}/completions?compatibilityMode=ai-sdk-5`;
  }
  return '';
}

function sanitize(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractProducts(text) {
  const re = /https?:\/\/www\.pearson\.com\/[^\s<>"]+\/(P\d{6,})/gi;
  const products = [];
  [...text.matchAll(re)].forEach((match) => {
    const [url, productId] = match;
    const parts = url.split('/');
    const slug = parts[parts.length - 2] || '';
    const titleFromSlug = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    products.push({ url, productId, titleFromSlug });
  });
  return products;
}

async function lookupAlgoliaProduct(productId, appId, apiKey, indexName) {
  try {
    const resp = await fetch(
      `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/${encodeURIComponent(productId)}`,
      { headers: { 'X-Algolia-Application-Id': appId, 'X-Algolia-API-Key': apiKey } },
    );
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

function createCustomChat(shell, config) {
  const { chatPanel: panel, chatTrigger } = shell;
  if (!panel) return;
  const apiUrl = getAgentApiUrl(config);
  if (!apiUrl || !config.searchApiKey) return;

  const closeBtn = panel.querySelector('.search-results-chatbot-close');
  const menuBtn = panel.querySelector('.search-results-chatbot-menu');
  const menuList = panel.querySelector('.search-results-chatbot-menu-list');
  const newChatBtn = panel.querySelector('.search-results-chatbot-menu-item');
  const messagesEl = panel.querySelector('.search-results-chatbot-messages');
  const form = panel.querySelector('.search-results-chatbot-form');
  const inputEl = panel.querySelector('.search-results-chatbot-input');
  const submitBtn = panel.querySelector('.search-results-chatbot-submit');

  let conversationId = `alg_cnv_${Date.now()}`;
  let messages = [];
  let isLoading = false;
  let hasGreeted = false;

  const setOpen = (open) => {
    panel.classList.toggle('is-open', open);
    panel.hidden = !open;
    chatTrigger?.classList.toggle('is-open', open);
    chatTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && inputEl) inputEl.focus();
  };

  const setMenuOpen = (open) => {
    if (!menuList || !menuBtn) return;
    menuList.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const appendMessage = (role, text, isPending = false) => {
    const row = document.createElement('div');
    row.className = `search-results-chatbot-message is-${role}${isPending ? ' is-pending' : ''}`;
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (role === 'assistant') {
      row.innerHTML = `
        <div class="search-results-chatbot-assistant-icon" aria-hidden="true">
          <img src="/icons/bi_stars.svg" alt="" loading="lazy" />
        </div>
        <p>${sanitize(text)}</p>
        <span class="search-results-chatbot-message-time">Sent ${time}</span>
      `;
    } else {
      row.innerHTML = `<p>${sanitize(text)}</p><span class="search-results-chatbot-message-time">Sent ${time}</span>`;
    }
    messagesEl.append(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  };

  const startNewChat = () => {
    conversationId = `alg_cnv_${Date.now()}`;
    messages = [];
    messagesEl.textContent = '';
    setMenuOpen(false);
  };

  const buildUserMessage = (text) => ({
    id: `alg_msg_${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  });

  const parseAiSdk5Stream = async (response) => {
    const raw = await response.text();
    let replyText = '';
    let replyId = `alg_msg_${Date.now()}`;
    raw.split('\n').forEach((line) => {
      // SSE format: "data: {...}"
      if (!line.startsWith('data:')) return;
      const json = line.slice(5).trim();
      if (!json || json === '[DONE]') return;
      try {
        const chunk = JSON.parse(json);
        if (chunk.type === 'start' && chunk.messageId) replyId = chunk.messageId;
        if (chunk.type === 'text-delta' && chunk.delta) replyText += chunk.delta;
      } catch (e) { /* skip malformed lines */ }
    });
    return { replyText: replyText.trim() || 'I could not generate a response.', replyId };
  };

  const send = async (text) => {
    if (isLoading) return;
    isLoading = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
    }
    const userMsg = buildUserMessage(text);
    messages.push(userMsg);
    const pendingRow = appendMessage('assistant', '…', true);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-algolia-application-id': config.appId,
          'x-algolia-api-key': config.searchApiKey,
        },
        body: JSON.stringify({ id: conversationId, messages }),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const { replyText, replyId } = await parseAiSdk5Stream(response);
      messages.push({ id: replyId, role: 'assistant', parts: [{ type: 'text', text: replyText }] });
      pendingRow.classList.remove('is-pending');
      const products = extractProducts(replyText);
      const sentTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (products.length > 0) {
        pendingRow.classList.add('has-cards');
        const cardHtmls = await Promise.all(
          products.map(({ productId, url, titleFromSlug }) => lookupAlgoliaProduct(
            productId,
            config.appId,
            config.searchApiKey,
            config.shopIndex,
          // eslint-disable-next-line no-use-before-define
          ).then((hit) => buildProductCardHtml(url, titleFromSlug, hit))),
        );
        let leadText = replyText;
        products.forEach(({ url }) => {
          leadText = leadText
            .replace(/[-\u2013\u2014]+\s*product page:\s*/gi, '')
            .replace(url, '');
        });
        leadText = leadText.trim().replace(/\s{2,}/g, ' ').replace(/^[^\w]+|[^\w?!.]+$/g, '').trim();
        pendingRow.innerHTML = `
          <div class="search-results-chatbot-assistant-icon" aria-hidden="true">
            <img src="/icons/bi_stars.svg" alt="" loading="lazy" />
          </div>
          ${leadText ? `<p>${sanitize(leadText)}</p>` : ''}
          <ul class="search-results-chatbot-cards">${cardHtmls.join('')}</ul>
          <span class="search-results-chatbot-message-time">Sent ${sentTime}</span>
        `;
      } else {
        pendingRow.innerHTML = `
          <div class="search-results-chatbot-assistant-icon" aria-hidden="true">
            <img src="/icons/bi_stars.svg" alt="" loading="lazy" />
          </div>
          <p>${sanitize(replyText)}</p>
          <span class="search-results-chatbot-message-time">Sent ${sentTime}</span>
        `;
      }
    } catch (err) {
      pendingRow.remove();
      appendMessage('assistant', 'Sorry, something went wrong. Please try again.');
    } finally {
      isLoading = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  };

  const openChat = () => {
    setOpen(true);
    if (!hasGreeted) {
      hasGreeted = true;
      appendMessage('assistant', 'What can we help you find?');
    }
  };

  chatTrigger?.addEventListener('click', () => {
    if (panel.classList.contains('is-open')) setOpen(false);
    else openChat();
  });
  closeBtn?.addEventListener('click', () => setOpen(false));
  menuBtn?.addEventListener('click', () => setMenuOpen(menuList.hidden));
  newChatBtn?.addEventListener('click', startNewChat);

  document.addEventListener('click', (e) => {
    const wrap = panel.querySelector('.search-results-chatbot-menu-wrap');
    if (wrap && !wrap.contains(e.target)) setMenuOpen(false);
  });

  messagesEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.search-results-chatbot-card-format-btn');
    if (!btn) return;
    const card = btn.closest('.search-results-chatbot-card');
    if (!card) return;
    card.querySelectorAll('.search-results-chatbot-card-format-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const priceEl = card.querySelector('.search-results-chatbot-card-price');
    if (priceEl && btn.dataset.price) {
      priceEl.textContent = `from ${btn.dataset.currency || '$'}${btn.dataset.price}/mo`;
      priceEl.classList.remove('is-updating');
      setTimeout(() => priceEl.classList.add('is-updating'), 0);
    }
  });

  const tabsEl = panel.closest('.search-results-main-content')?.querySelector('.search-results-tabs');
  if (tabsEl) {
    tabsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.search-results-tab');
      if (!btn) return;
      if (btn.dataset.tab === 'pearson-ai') openChat();
      else setOpen(false);
    });
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputEl?.value.trim() || '';
    if (!text || isLoading) return;
    appendMessage('user', text);
    inputEl.value = '';
    send(text);
  });
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toBoolean(value, defaultValue = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function readConfig(block) {
  const config = {
    appId: 'XFOI9EBBHR',
    title: 'Search Results',
    placeholder: 'Search products, resources, or ask a question...',
    initialQuery: '',
    hitsPerPage: 4,
    shopIndex: 'live-learner-program-index-vector',
    contentIndex: 'live-en-us-learner-content-index',
    studyIndex: 'live-study-prep-course-catalog',
    discoverIndex: 'live-en-us-learner-content-support-index',
    supportIndex: 'live-en-us-learner-content-support-index',
    pearsonAiLabel: 'View All',
    shopLabel: 'Shop',
    studyLabel: 'Study',
    discoverLabel: 'Discover',
    supportLabel: 'Support',
    contentLabel: 'Content',
    chatEnabled: true,
    chatAgentId: '',
    chatAgentApiUrl: '',
    chatTitle: 'Pearson AI Assistant',
    chatPlaceholder: 'Ask Pearson AI a question...',
    chatDisclaimer: 'Answers are generated by AI and may contain mistakes.',
    chatPersistence: true,
    chatCardLimit: 4,
    chatUrlPrefix: 'https://www.pearson.com/store/en-us/',
  };

  const setters = {
    appid: (v) => { config.appId = v; },
    algoliaappid: (v) => { config.appId = v; },
    searchapikey: (v) => { config.searchApiKey = v; },
    apikey: (v) => { config.searchApiKey = v; },
    algoliasearchapikey: (v) => { config.searchApiKey = v; },
    title: (v) => { config.title = v; },
    placeholder: (v) => { config.placeholder = v; },
    query: (v) => { config.initialQuery = v; },
    initialquery: (v) => { config.initialQuery = v; },
    hitsperpage: (v) => {
      const parsed = Number.parseInt(v, 10);
      if (!Number.isNaN(parsed)) config.hitsPerPage = Math.max(1, Math.min(parsed, 10));
    },
    shopindex: (v) => { config.shopIndex = v; },
    learnerprogramindex: (v) => { config.shopIndex = v; },
    studyindex: (v) => { config.studyIndex = v; },
    discoverindex: (v) => { config.discoverIndex = v; },
    supportindex: (v) => { config.supportIndex = v; },
    contentindex: (v) => { config.contentIndex = v; },
    learnercontentindex: (v) => { config.contentIndex = v; },
    pearsonailabel: (v) => { config.pearsonAiLabel = v; },
    shoplabel: (v) => { config.shopLabel = v; },
    studylabel: (v) => { config.studyLabel = v; },
    discoverlabel: (v) => { config.discoverLabel = v; },
    supportlabel: (v) => { config.supportLabel = v; },
    contentlabel: (v) => { config.contentLabel = v; },
    chatenabled: (v) => { config.chatEnabled = toBoolean(v, true); },
    agentid: (v) => { config.chatAgentId = v; },
    chatagentid: (v) => { config.chatAgentId = v; },
    chatagentapiurl: (v) => { config.chatAgentApiUrl = v; },
    agentapiurl: (v) => { config.chatAgentApiUrl = v; },
    chattitle: (v) => { config.chatTitle = v; },
    chatplaceholder: (v) => { config.chatPlaceholder = v; },
    chatdisclaimer: (v) => { config.chatDisclaimer = v; },
    chatpersistence: (v) => { config.chatPersistence = toBoolean(v, true); },
    chatcardlimit: (v) => {
      const parsed = Number.parseInt(v, 10);
      if (!Number.isNaN(parsed)) config.chatCardLimit = Math.max(1, Math.min(parsed, 8));
    },
    chaturlprefix: (v) => { config.chatUrlPrefix = v; },
    urlprefix: (v) => { config.chatUrlPrefix = v; },
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!cells.length) return;

    if (cells.length > 1) {
      const key = normalizeKey(cells[0].textContent.trim());
      const value = cells[1].textContent.trim();
      if (value && setters[key]) setters[key](value);
      return;
    }

    const single = cells[0].textContent.trim();
    const [rawKey, ...rest] = single.split(':');
    const key = normalizeKey(rawKey);
    const value = rest.join(':').trim();
    if (value && setters[key]) setters[key](value);
  });

  return config;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getFirstString(item, keys) {
  for (let index = 0; index < keys.length; index += 1) {
    const value = item[keys[index]];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function getFirstArrayValue(item, keys) {
  for (let index = 0; index < keys.length; index += 1) {
    const value = item[keys[index]];
    if (Array.isArray(value) && value[0]) return value[0];
  }
  return '';
}

function cardTitle(item) {
  return getFirstString(item, ['name_en', 'name', 'title', 'webpagetitle']) || 'Untitled';
}

function cardDescription(item) {
  return stripHtml(getFirstString(item, ['summary_en', 'summary', 'description_en', 'description', 'metaDescription']));
}

function cardHref(item) {
  return getFirstString(item, ['url_en', 'defaultProgramUrl', 'url']) || '#';
}

function buildProductCardHtml(url, titleFromSlug, hit) {
  const title = (hit && cardTitle(hit)) || titleFromSlug;
  const edition = hit ? getFirstString(hit, ['programEdition', 'edition', 'editionName']) : '';
  const price = hit ? (hit.lowestDiscountedProgramPriceValue || hit.lowestProgramPriceValue || '') : '';
  const currency = (hit && hit.currencySymbol) || '$';
  const formats = hit ? (hit.subFormats || hit.mainFormats || []) : [];
  const rawImage = hit ? getFirstString(hit, ['smallThumbnail', 'coverImageUrl', 'coverImage', 'thumbnailUrl', 'thumbnail', 'image']) : '';
  const coverImage = rawImage && rawImage.startsWith('/') ? `https://www.pearson.com/store/en-us${rawImage}` : rawImage;
  const imageHtml = coverImage
    ? `<img class="search-results-chatbot-card-image" src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)}" loading="lazy" />`
    : '<div class="search-results-chatbot-card-image"></div>';
  const formatsHtml = formats.length
    ? `<ul class="search-results-chatbot-card-formats">${formats.map((f, i) => `<li><button type="button" class="search-results-chatbot-card-format-btn${i === 0 ? ' is-active' : ''}" data-price="${escapeHtml(String(price))}" data-currency="${escapeHtml(String(currency))}">${escapeHtml(f)}</button></li>`).join('')}</ul>`
    : '';
  const priceHtml = price
    ? `<p class="search-results-chatbot-card-price">from ${escapeHtml(String(currency))}${escapeHtml(String(price))}/mo</p>`
    : '';
  return `
    <li class="search-results-chatbot-card">
      ${imageHtml}
      <div class="search-results-chatbot-card-body">
        <h4 class="search-results-chatbot-card-title"><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h4>
        ${edition ? `<p class="search-results-chatbot-card-edition">${escapeHtml(edition)}</p>` : ''}
        ${formatsHtml}
        ${priceHtml}
        <div class="search-results-chatbot-card-cta-wrap">
          <a href="${escapeHtml(url)}" class="search-results-chatbot-card-cta" target="_blank" rel="noopener noreferrer">Add to cart</a>
        </div>
      </div>
    </li>
  `;
}

function cardMeta(item, sourceLabel, sourceKey = '') {
  const category = getFirstArrayValue(item, ['topics', 'contentType', 'learningStage'])
    || item.categoriesHierarchical_en?.lvl0?.[0]
    || item.categoriesHierarchical?.lvl0?.[0]
    || item.qualificationLevel
    || '';

  const contentType = getFirstArrayValue(item, ['contentType'])
     || getFirstString(item, ['contentType', 'resourceType', 'type']);

  const format = getFirstArrayValue(item, ['subFormats', 'mainFormats'])
    || getFirstString(item, ['format', 'deliveryMode', 'programType', 'resourceType']);

  const edition = getFirstString(item, ['programEdition', 'edition', 'editionName']);
  const price = getFirstString(item, ['lowestDiscountedProgramPriceValue', 'lowestProgramPriceValue', 'price']);

  const sourceMetaMap = {
    shop: [sourceLabel, category, edition || format || price],
    study: [sourceLabel, category, format || edition || price],
    discover: [sourceLabel, contentType || category, format || edition],
    support: [sourceLabel, contentType || category, format || edition],
    content: [sourceLabel, contentType || category, format || edition],
  };

  const fallback = [sourceLabel, category, format || edition || price];
  const selected = sourceMetaMap[sourceKey] || sourceMetaMap[item.sourceKey] || fallback;

  return selected.filter(Boolean);
}

function renderCards(container, items, emptyText, metaContext = {}) {
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<p class="search-results-empty">${escapeHtml(emptyText)}</p>`;
    return;
  }

  const list = document.createElement('ul');
  list.className = 'search-results-list';

  items.forEach((item) => {
    const title = cardTitle(item);
    const href = cardHref(item);
    const description = cardDescription(item);
    const meta = cardMeta(
      item,
      item.sourceLabel || metaContext.sourceLabel || '',
      item.sourceKey || metaContext.sourceKey || '',
    );

    const row = document.createElement('li');
    row.className = 'search-results-list-item';
    row.innerHTML = `
       <article class="search-results-card">
         <h3 class="search-results-card-title"><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></h3>
         ${description ? `<p class="search-results-card-text">${escapeHtml(description)}</p>` : ''}
         ${meta.length ? `<p class="search-results-card-meta">${meta.map((entry) => `<span>${escapeHtml(entry)}</span>`).join('')}</p>` : ''}
       </article>
     `;
    list.append(row);
  });

  container.replaceChildren(list);
}

function renderShell(block, config) {
  block.textContent = '';

  const shell = document.createElement('div');
  shell.className = 'search-results-shell';

  const heading = document.createElement('h2');
  heading.className = 'search-results-title';
  heading.textContent = config.title;

  const searchBox = document.createElement('div');
  searchBox.className = 'search-results-searchbox';

  const tabs = document.createElement('div');
  tabs.className = 'search-results-tabs';
  tabs.setAttribute('role', 'tablist');

  const panels = document.createElement('div');
  panels.className = 'search-results-panels';

  const mainContent = document.createElement('div');
  mainContent.className = 'search-results-main-content';

  const chatTrigger = document.createElement('button');
  chatTrigger.type = 'button';
  chatTrigger.className = 'search-results-chatbot-trigger';
  chatTrigger.setAttribute('aria-expanded', 'false');
  chatTrigger.innerHTML = `
    <div class="search-results-chatbot-brand">
      <img class="search-results-chatbot-logo-mark" src="/icons/pearson-logo-full-purple.svg" alt="Pearson AI" loading="lazy" />
      <span class="search-results-chatbot-ai-label">AI</span>
    </div>
  `;

  const chatPanel = document.createElement('div');
  chatPanel.className = 'search-results-chatbot';
  chatPanel.hidden = true;
  chatPanel.innerHTML = `
    <div class="search-results-chatbot-header">
      <div class="search-results-chatbot-brand">
        <img class="search-results-chatbot-logo-mark" src="/icons/pearson-logo-full-purple.svg" alt="Pearson AI" loading="lazy" />
        <span class="search-results-chatbot-ai-label">AI</span>
      </div>
      <div class="search-results-chatbot-controls">
        <div class="search-results-chatbot-menu-wrap">
          <button type="button" class="search-results-chatbot-menu" aria-label="More options" aria-expanded="false">&#8942;</button>
          <div class="search-results-chatbot-menu-list" role="menu" hidden>
            <button type="button" class="search-results-chatbot-menu-item" role="menuitem">Start new chat</button>
          </div>
        </div>
        <button type="button" class="search-results-chatbot-close" aria-label="Close chat"><img src="/icons/close-icon.svg" alt="" aria-hidden="true" /></button>
      </div>
    </div>
    <div class="search-results-chatbot-messages" aria-live="polite"></div>
    <form class="search-results-chatbot-form">
      <div class="search-results-chatbot-input-wrap">
        <img class="search-results-chatbot-input-icon" src="/icons/chatbot-vector.svg" alt="" aria-hidden="true" />
        <input class="search-results-chatbot-input" type="text" name="chatPrompt" placeholder="${escapeHtml(config.chatPlaceholder)}" autocomplete="off" />
        <button type="submit" class="search-results-chatbot-submit" aria-label="Send">&#8593;</button>
      </div>
    </form>
  `;

  const contentLayout = document.createElement('div');
  contentLayout.className = 'search-results-content-layout';
  const searchRow = document.createElement('div');
  searchRow.className = 'search-results-search-row';
  searchRow.append(searchBox, chatTrigger);
  mainContent.append(heading, searchRow, chatPanel, tabs, panels);
  contentLayout.append(mainContent);

  const containers = {};
  const panelHeading = (tabId) => {
    if (tabId === 'pearson-ai') return 'Find more information';
    if (tabId === 'shop') return 'Shop for products';
    if (tabId === 'study') return 'Explore study resources';
    if (tabId === 'discover') return 'Discover more resources';
    if (tabId === 'support') return 'Support resources';
    return '';
  };

  TABS.forEach((tab, index) => {
    const buttonId = `search-results-tab-${tab.id}`;
    const panelId = `search-results-panel-${tab.id}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `search-results-tab${index === 0 ? ' is-active' : ''}`;
    button.dataset.tab = tab.id;
    button.id = buttonId;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    button.setAttribute('tabindex', index === 0 ? '0' : '-1');
    button.textContent = config[tab.labelKey];
    tabs.append(button);

    const panel = document.createElement('section');
    panel.className = `search-results-panel${index === 0 ? ' is-active' : ''}`;
    panel.dataset.panel = tab.id;
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', buttonId);
    panel.hidden = index !== 0;
    panel.innerHTML = `
      <div class="search-results-panel-head">
        <h3 class="search-results-panel-title">${escapeHtml(panelHeading(tab.id) || config[tab.labelKey])}</h3>
        <div class="search-results-stats" data-target="${tab.id}-stats"></div>
      </div>
      <div class="search-results-hits" data-target="${tab.id}-hits"></div>
      <div class="search-results-pagination" data-target="${tab.id}-pagination"></div>
    `;
    panels.append(panel);
    containers[tab.id] = panel;
  });

  tabs.addEventListener('click', (event) => {
    const target = event.target.closest('.search-results-tab');
    if (!target) return;
    const tabId = target.dataset.tab;

    tabs.querySelectorAll('.search-results-tab').forEach((button) => {
      const isActive = button === target;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.querySelectorAll('.search-results-panel').forEach((panel) => {
      const isActive = panel.dataset.panel === tabId;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
  });

  shell.append(contentLayout);
  block.append(shell);
  return {
    searchBox, containers, chatPanel, chatTrigger,
  };
}

function setPanel(panel, label, data, sourceKey = '') {
  if (!panel) return;
  const stats = panel.querySelector('[data-target$="-stats"]');
  const hits = panel.querySelector('[data-target$="-hits"]');

  if (stats) stats.textContent = `${(data.nbHits || 0).toLocaleString()} ${label.toLowerCase()} found`;
  renderCards(hits, data.hits || [], `No ${label.toLowerCase()} found for this query.`, {
    sourceLabel: label,
    sourceKey,
  });
}

function renderClientPagination(container, currentPage, totalPages, onPageChange) {
  if (!container || totalPages <= 1) {
    if (container) container.textContent = '';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'ais-Pagination-list';

  const addItem = (label, page, disabled, selected) => {
    const li = document.createElement('li');
    li.className = `ais-Pagination-item${disabled ? ' ais-Pagination-item--disabled' : ''}${selected ? ' ais-Pagination-item--selected' : ''}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ais-Pagination-link';
    btn.textContent = label;
    btn.setAttribute('aria-label', `Page ${page + 1}`);
    if (!disabled) btn.addEventListener('click', () => onPageChange(page));
    else btn.disabled = true;
    li.append(btn);
    ul.append(li);
  };

  addItem('‹', currentPage - 1, currentPage === 0, false);
  for (let i = 0; i < totalPages; i += 1) {
    addItem(String(i + 1), i, false, i === currentPage);
  }
  addItem('›', currentPage + 1, currentPage === totalPages - 1, false);

  container.textContent = '';
  container.append(ul);
}

function updateUrlQuery(query) {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  window.history.replaceState({}, '', url);
}

function findQueryInUiState(uiState, config) {
  return SOURCES
    .map((source) => uiState?.[config[source.indexKey]]?.query)
    .find(Boolean) || '';
}

export default async function decorate(block) {
  const section = block.closest('.section');
  if (section) {
    section.classList.add('search-results-section');
  }
  const config = readConfig(block);
  const queryFromUrl = new URLSearchParams(window.location.search).get('q') || '';
  const initialQuery = queryFromUrl || config.initialQuery;

  if (!config.searchApiKey) {
    block.innerHTML = '<p class="search-results-error">Missing Algolia search key.</p>';
    return;
  }

  const shell = renderShell(block, config);

  const videoSrc = 'https://content.da.live/horizon-sandbox/horizon-v1/content/dam/global/shared/brand/horizon/video/waves-turquoiseburn-1-light-16x9-l2r.mp4';
  const media = document.createElement('div');
  media.className = 'search-results-media';
  media.setAttribute('aria-hidden', 'true');
  media.innerHTML = `<video autoplay muted loop playsinline preload="metadata"><source src="${videoSrc}" type="video/mp4" /></video>`;
  block.prepend(media);

  try {
    await loadLibs();

    let initialUiState;
    if (initialQuery) {
      initialUiState = {};
      SOURCES.forEach((source) => {
        initialUiState[config[source.indexKey]] = { query: initialQuery };
      });
    }

    const search = window.instantsearch({
      indexName: config.shopIndex,
      searchClient: window.algoliasearch(config.appId, config.searchApiKey),
      initialUiState,
      onStateChange({ uiState, setUiState }) {
        const query = findQueryInUiState(uiState, config);
        updateUrlQuery(query);
        setUiState(uiState);
      },
    });

    const {
      searchBox,
      index,
      configure,
      pagination,
    } = window.instantsearch.widgets;
    const { connectHits } = window.instantsearch.connectors;

    search.addWidgets([
      searchBox({
        container: shell.searchBox,
        placeholder: config.placeholder,
        showReset: false,
        showSubmit: true,
        showLoadingIndicator: false,
      }),
    ]);

    const state = {
      shop: { hits: [], nbHits: 0 },
      study: { hits: [], nbHits: 0 },
      discover: { hits: [], nbHits: 0 },
      support: { hits: [], nbHits: 0 },
      content: { hits: [], nbHits: 0 },
    };

    let aiPage = 0;
    const AI_PAGE_SIZE = config.hitsPerPage * 2;

    const refresh = () => {
      setPanel(shell.containers.shop, config.shopLabel, state.shop, 'shop');
      setPanel(shell.containers.study, config.studyLabel, state.study, 'study');
      setPanel(shell.containers.discover, config.discoverLabel, state.discover, 'discover');
      setPanel(shell.containers.support, config.supportLabel, state.support, 'support');

      const aiPanel = shell.containers['pearson-ai'];
      const aiStats = aiPanel.querySelector('[data-target="pearson-ai-stats"]');
      const aiHits = aiPanel.querySelector('[data-target="pearson-ai-hits"]');
      const aiPagination = aiPanel.querySelector('[data-target="pearson-ai-pagination"]');

      const aiItems = [];
      let aiCount = 0;
      const seen = new Set();

      [
        { key: 'shop', label: config.shopLabel },
        { key: 'study', label: config.studyLabel },
        { key: 'discover', label: config.discoverLabel },
        { key: 'support', label: config.supportLabel },
        { key: 'content', label: config.contentLabel },
      ].forEach((source) => {
        aiCount += state[source.key].nbHits;
        state[source.key].hits.forEach((hit) => {
          if (!seen.has(hit.objectID)) {
            seen.add(hit.objectID);
            aiItems.push({ ...hit, sourceLabel: source.label, sourceKey: source.key });
          }
        });
      });

      const totalAiPages = Math.ceil(aiItems.length / AI_PAGE_SIZE);
      if (aiPage >= totalAiPages) aiPage = Math.max(0, totalAiPages - 1);
      const pageItems = aiItems.slice(aiPage * AI_PAGE_SIZE, (aiPage + 1) * AI_PAGE_SIZE);

      if (aiStats) aiStats.textContent = `${aiCount.toLocaleString()} results found`;
      renderCards(aiHits, pageItems, 'No results found for this query.');
      renderClientPagination(aiPagination, aiPage, totalAiPages, (page) => {
        aiPage = page;
        refresh();
        aiPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    const makeHitsWidget = (sourceKey) => connectHits((renderOptions) => {
      const { hits, results } = renderOptions;
      const isFirstSource = sourceKey === 'shop';
      if (isFirstSource) aiPage = 0;
      state[sourceKey] = { hits, nbHits: results?.nbHits || 0 };
      refresh();
    })({});

    const sourceWidgets = SOURCES.map((source) => {
      const subIndex = index({ indexName: config[source.indexKey] });
      const widgets = [
        configure({ hitsPerPage: config.hitsPerPage }),
        makeHitsWidget(source.key),
      ];

      if (source.key === 'shop' || source.key === 'study' || source.key === 'discover' || source.key === 'support') {
        widgets.push(
          pagination({
            container: shell.containers[source.key].querySelector(`[data-target="${source.key}-pagination"]`),
            showFirst: false,
            showLast: false,
            scrollTo: false,
          }),
        );
      }

      subIndex.addWidgets(widgets);
      return subIndex;
    });

    if (config.chatEnabled && (config.chatAgentId || config.chatAgentApiUrl)) {
      createCustomChat(shell, config);
    }

    search.addWidgets(sourceWidgets);
    refresh();
    search.start();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Algolia search initialization failed', error);
    block.innerHTML = '<p class="search-results-error">Unable to initialize Algolia search right now.</p>';
  }
}
