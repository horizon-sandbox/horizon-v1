const ALGOLIA_SEARCH_CLIENT_URL = 'https://cdn.jsdelivr.net/npm/algoliasearch@4.24.0/dist/algoliasearch-lite.umd.js';
const ALGOLIA_INSTANTSEARCH_URL = 'https://cdn.jsdelivr.net/npm/instantsearch.js@4.85.0/dist/instantsearch.production.min.js';
const CHATBOT_LOGO_MARK_URL = '/icons/ai-home/pearson-logo-mark.svg';
const CHATBOT_LOGO_WORDMARK_URL = '/icons/ai-home/pearson-logo-wordmark.svg';

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

function createId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}${window.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `${prefix}${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
}

function getAgentApiUrl(config) {
  if (config.chatAgentApiUrl) return config.chatAgentApiUrl;
  if (config.chatAgentId) {
    return `https://${config.appId}.algolia.net/agent-studio/1/agents/${config.chatAgentId}/completions?compatibilityMode=ai-sdk-5`;
  }
  return '';
}

function withStreamDisabled(urlString) {
  const url = new URL(urlString);
  if (!url.searchParams.has('stream')) {
    url.searchParams.set('stream', 'false');
  }
  return url.toString();
}

function toAssistantText(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;

  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .filter((part) => part?.type === 'text' || (typeof part?.text === 'string' && !part.type))
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function createCustomChat(shell, config) {
  const apiUrl = getAgentApiUrl(config);
  if (!apiUrl || !config.searchApiKey) return;

  const sanitize = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const stripTags = (value) => String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedPrefix = String(config.chatUrlPrefix || 'https://www.pearson.com/store/en-us/')
    .replace(/\/+$/, '');
  const normalizedPrefixWithSlash = `${normalizedPrefix}/`;

  const normalizeWithPrefix = (value) => {
    const urlValue = String(value || '').trim();
    if (!urlValue) return '';
    if (/^(https?:)?\/\//i.test(urlValue)) return urlValue;

    const stripped = urlValue
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');

    return `${normalizedPrefixWithSlash}${stripped}`;
  };

  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-chatbot';
  wrapper.innerHTML = `
    <button type="button" class="search-results-chatbot-toggle" aria-expanded="false" aria-controls="search-results-chatbot-panel">
      Ask Pearson AI
    </button>
    <section id="search-results-chatbot-panel" class="search-results-chatbot-panel" hidden>
      <header class="search-results-chatbot-header">
        <div class="search-results-chatbot-brand">
          <span class="search-results-chatbot-logo" aria-hidden="true">
            <img class="search-results-chatbot-logo-mark" src="${CHATBOT_LOGO_MARK_URL}" alt="" loading="lazy" />
            <img class="search-results-chatbot-logo-wordmark" src="${CHATBOT_LOGO_WORDMARK_URL}" alt="" loading="lazy" />
          </span>
          <h3 class="search-results-chatbot-title">AI</h3>
          <span class="search-results-chatbot-beta">beta</span>
        </div>
        <div class="search-results-chatbot-controls">
          <div class="search-results-chatbot-menu-wrap">
            <button type="button" class="search-results-chatbot-menu" aria-label="More options" aria-expanded="false" aria-controls="search-results-chatbot-menu-list">⋮</button>
            <div id="search-results-chatbot-menu-list" class="search-results-chatbot-menu-list" role="menu" hidden>
              <button type="button" class="search-results-chatbot-menu-item" role="menuitem">Start new chat</button>
            </div>
          </div>
          <button type="button" class="search-results-chatbot-close" aria-label="Close chat">−</button>
        </div>
      </header>
      <div class="search-results-chatbot-messages" aria-live="polite"></div>
      <form class="search-results-chatbot-form">
        <div class="search-results-chatbot-input-wrap">
          <span class="search-results-chatbot-input-icon" aria-hidden="true">✧</span>
          <input class="search-results-chatbot-input" type="text" name="chatPrompt" id="chatPrompt" placeholder="${sanitize(config.chatPlaceholder)}" />
          <button type="submit" class="search-results-chatbot-submit" aria-label="Send">→</button>
        </div>
      </form>
      <p class="search-results-chatbot-disclaimer">${sanitize(config.chatDisclaimer)}</p>
    </section>
  `;

  shell.chatContainer.replaceChildren(wrapper);

  const toggle = wrapper.querySelector('.search-results-chatbot-toggle');
  const panel = wrapper.querySelector('.search-results-chatbot-panel');
  const closeButton = wrapper.querySelector('.search-results-chatbot-close');
  const menuButton = wrapper.querySelector('.search-results-chatbot-menu');
  const menuList = wrapper.querySelector('.search-results-chatbot-menu-list');
  const newChatButton = wrapper.querySelector('.search-results-chatbot-menu-item');
  const form = wrapper.querySelector('.search-results-chatbot-form');
  const textarea = wrapper.querySelector('.search-results-chatbot-input');
  const messagesRoot = wrapper.querySelector('.search-results-chatbot-messages');
  const submit = wrapper.querySelector('.search-results-chatbot-submit');

  const storageKey = `search-results-chat:${config.appId}:${config.chatAgentId || config.chatAgentApiUrl}`;
  let conversationId = createId('alg_cnv_');
  let messages = [];

  const saveState = () => {
    if (!config.chatPersistence) return;
    const state = {
      conversationId,
      messages,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  };

  const loadState = () => {
    if (!config.chatPersistence) return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const state = JSON.parse(raw);
      if (state?.conversationId) conversationId = state.conversationId;
      if (Array.isArray(state?.messages)) messages = state.messages;
    } catch (error) {
      window.localStorage.removeItem(storageKey);
    }
  };

  const setOpen = (isOpen) => {
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) textarea.focus();
  };

  const setMenuOpen = (isOpen) => {
    if (!menuList || !menuButton) return;
    menuList.hidden = !isOpen;
    menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  const appendMessage = (role, text, isPending = false) => {
    const row = document.createElement('div');
    row.className = `search-results-chatbot-message is-${role}${isPending ? ' is-pending' : ''}`;
    row.innerHTML = `<p>${sanitize(text)}</p>`;
    messagesRoot.append(row);
    messagesRoot.scrollTop = messagesRoot.scrollHeight;
    return row;
  };

  const toCardItem = (item) => {
    if (!item || typeof item !== 'object') return null;

    const asString = (value) => (typeof value === 'string' ? value.trim() : '');

    const firstString = (values) => values
      .map((value) => asString(value))
      .find(Boolean) || '';

    const imageFromValue = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value.trim();
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
          const maybeImage = imageFromValue(value[index]);
          if (maybeImage) return maybeImage;
        }
        return '';
      }
      if (typeof value === 'object') {
        return firstString([
          value.url,
          value.src,
          value.href,
          value.original,
          value.large,
          value.medium,
          value.small,
        ]);
      }
      return '';
    };

    const title = item.title
      || item.name
      || item.name_en
      || item.productName
      || item.webpagetitle
      || '';

    const rawUrl = item.url
      || item.url_en
      || item.defaultProgramUrl
      || item.productUrl
      || '';
    const url = normalizeWithPrefix(rawUrl);

    if (!title && !url) return null;

    const description = stripTags(
      item.description
      || item.description_en
      || item.summary
      || item.summary_en
      || '',
    );

    const image = firstString([
      normalizeWithPrefix(imageFromValue(item.image)),
      normalizeWithPrefix(imageFromValue(item.imageUrl)),
      normalizeWithPrefix(imageFromValue(item.image_url)),
      normalizeWithPrefix(imageFromValue(item.thumbnail)),
      normalizeWithPrefix(imageFromValue(item.smallThumbnail)),
      normalizeWithPrefix(imageFromValue(item.mediumThumbnail)),
      normalizeWithPrefix(imageFromValue(item.largeThumbnail)),
      normalizeWithPrefix(imageFromValue(item.productImage)),
      normalizeWithPrefix(imageFromValue(item.imageUrls)),
      normalizeWithPrefix(imageFromValue(item.images)),
    ]);

    const price = item.price
      || item.lowestProgramPriceValue
      || item.lowestDiscountedProgramPriceValue
      || '';

    const edition = firstString([
      item.programEdition,
      item.edition,
      item.editionName,
      item.programEditionNumber ? `Edition ${item.programEditionNumber}` : '',
    ]);

    const format = firstString([
      Array.isArray(item.subFormats) ? item.subFormats[0] : '',
      Array.isArray(item.mainFormats) ? item.mainFormats[0] : '',
      item.format,
      item.deliveryMode,
    ]);

    const category = item.category
      || item.categoriesHierarchical_en?.lvl0?.[0]
      || item.categoriesHierarchical?.lvl0?.[0]
      || item.learningStage
      || '';

    return {
      title,
      url,
      description,
      image,
      price,
      edition,
      format,
      category,
    };
  };

  const collectCardsFromValue = (value, items, depth = 0) => {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => collectCardsFromValue(entry, items, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;

    const card = toCardItem(value);
    if (card) items.push(card);

    Object.keys(value).forEach((key) => {
      const shouldTraverse = [
        'parts',
        'content',
        'toolInvocations',
        'items',
        'hits',
        'results',
        'output',
        'data',
        'records',
        'products',
        'documents',
      ].includes(key);
      if (shouldTraverse) {
        collectCardsFromValue(value[key], items, depth + 1);
      }
    });
  };

  const extractProductCards = (assistantMessage, payload) => {
    const products = [];

    collectCardsFromValue(assistantMessage, products);
    if (products.length < 2) {
      collectCardsFromValue(payload, products);
    }

    const scoreCard = (item) => [
      item.image,
      item.description,
      item.edition,
      item.format,
      item.category,
      item.price,
    ].filter(Boolean).length;

    const byKey = new Map();
    products.forEach((item) => {
      const key = `${item.title}|${item.url}`;
      const current = byKey.get(key);
      if (!current || scoreCard(item) > scoreCard(current)) {
        byKey.set(key, item);
      }
    });

    return [...byKey.values()].slice(0, config.chatCardLimit);
  };

  const extractProductCardsFromText = (text) => {
    if (!text) return [];

    const urlRegex = /(https?:\/\/[^\s)]+)(?=\s|$)/g;
    const matches = [...text.matchAll(urlRegex)];
    if (!matches.length) return [];

    const cards = matches.map((match) => {
      const url = match[1];
      const urlStart = match.index || 0;
      const contextStart = Math.max(0, urlStart - 180);
      const context = text.slice(contextStart, urlStart);
      const segment = context.split(/\n|\s[-•]\s/).pop() || context;
      const title = segment
        .replace(/[—–-]\s*$/, '')
        .replace(/^\s*[-•]\s*/, '')
        .trim();

      const cleanTitle = title || new URL(url).pathname.split('/').filter(Boolean).pop() || 'View product';
      return {
        title: cleanTitle,
        url,
        description: '',
        image: '',
        price: '',
        category: '',
      };
    });

    const unique = [];
    const seen = new Set();
    cards.forEach((item) => {
      const key = `${item.title}|${item.url}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });

    return unique.slice(0, config.chatCardLimit);
  };

  const normalizeAssistantText = (text, hasCards) => {
    if (!hasCards) return text;
    const compact = String(text || '')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/\s[-•]\s/g, '\n- ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return compact || 'Here are a few options.';
  };

  const renderProductCards = (container, cards) => {
    if (!cards.length) return;

    const list = document.createElement('ul');
    list.className = 'search-results-chatbot-cards';

    cards.forEach((card) => {
      const row = document.createElement('li');
      row.className = 'search-results-chatbot-card';
      row.innerHTML = `
        ${card.image ? `<img class="search-results-chatbot-card-image" src="${sanitize(card.image)}" alt="${sanitize(card.title)}" loading="lazy" />` : ''}
        <div class="search-results-chatbot-card-body">
          ${card.edition ? '<span class="search-results-chatbot-card-chip">Edition</span>' : ''}
          <h4 class="search-results-chatbot-card-title">
            ${card.url ? `<a href="${sanitize(card.url)}" target="_blank" rel="noopener noreferrer">${sanitize(card.title)}</a>` : sanitize(card.title)}
          </h4>
          ${card.edition ? `<p class="search-results-chatbot-card-edition">${sanitize(card.edition)}</p>` : ''}
          ${card.format ? `<p class="search-results-chatbot-card-format">${sanitize(card.format)}</p>` : ''}
          ${card.description ? `<p class="search-results-chatbot-card-text">${sanitize(card.description)}</p>` : ''}
          <div class="search-results-chatbot-card-meta">
            ${card.category ? `<span>${sanitize(card.category)}</span>` : ''}
            ${card.price ? `<span>${sanitize(card.price)}</span>` : ''}
          </div>
          ${card.url ? `<p class="search-results-chatbot-card-cta-wrap"><a class="search-results-chatbot-card-cta" href="${sanitize(card.url)}" target="_blank" rel="noopener noreferrer">Add to cart</a></p>` : ''}
        </div>
      `;
      list.append(row);
    });

    container.append(list);
  };

  const appendAssistantResponse = (text, cards = [], isPending = false) => {
    const row = document.createElement('div');
    row.className = `search-results-chatbot-message is-assistant${isPending ? ' is-pending' : ''}`;
    row.innerHTML = `<p>${sanitize(normalizeAssistantText(text, cards.length > 0))}</p>`;
    if (cards.length) {
      row.classList.add('has-cards');
      renderProductCards(row, cards);
    }
    messagesRoot.append(row);
    messagesRoot.scrollTop = messagesRoot.scrollHeight;
    return row;
  };

  const hydrateTranscript = () => {
    if (!messages.length) {
      appendAssistantResponse('Hi! I can help with products, support, and content.');
      return;
    }

    messages.forEach((message) => {
      if (message.role === 'user') {
        const text = message.parts?.[0]?.text || '';
        if (text) appendMessage('user', text);
      } else if (message.role === 'assistant') {
        const text = toAssistantText(message) || 'Response received.';
        const structuredCards = extractProductCards(message, message);
        const textCards = extractProductCardsFromText(text);
        const cards = structuredCards.length ? structuredCards : textCards;
        appendAssistantResponse(text, cards);
      }
    });
  };

  const startNewChat = () => {
    conversationId = createId('alg_cnv_');
    messages = [];
    messagesRoot.replaceChildren();
    appendAssistantResponse('Hi! I can help with products, support, and content.');
    textarea.value = '';
    saveState();
    setMenuOpen(false);
    textarea.focus();
  };

  const send = async (userText) => {
    submit.disabled = true;
    const pending = appendAssistantResponse('Thinking…', [], true);

    const userMessage = {
      id: createId('alg_msg_'),
      role: 'user',
      parts: [{ text: userText }],
    };
    messages.push(userMessage);
    saveState();

    try {
      const response = await fetch(withStreamDisabled(apiUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-algolia-application-id': config.appId,
          'x-algolia-api-key': config.searchApiKey,
        },
        body: JSON.stringify({
          id: conversationId,
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent request failed (${response.status})`);
      }

      const payload = await response.json();
      const assistantMessage = payload.message || payload;
      const assistantText = toAssistantText(assistantMessage) || 'I could not generate a response.';
      const structuredCards = extractProductCards(assistantMessage, payload);
      const textCards = extractProductCardsFromText(assistantText);
      const cards = structuredCards.length ? structuredCards : textCards;

      if (assistantMessage?.role) {
        messages.push({
          id: assistantMessage.id || createId('alg_msg_'),
          role: assistantMessage.role,
          parts: Array.isArray(assistantMessage.parts)
            ? assistantMessage.parts
            : [{ type: 'text', text: assistantText }],
        });
        saveState();
      }

      pending.classList.remove('is-pending');
      pending.innerHTML = `<p>${sanitize(normalizeAssistantText(assistantText, cards.length > 0))}</p>`;
      if (cards.length) {
        pending.classList.add('has-cards');
        renderProductCards(pending, cards);
      }
    } catch (error) {
      pending.classList.remove('is-pending');
      pending.innerHTML = '<p>Sorry, I could not reach Pearson AI right now.</p>';
      // eslint-disable-next-line no-console
      console.error('Algolia Agent Studio request failed', error);
    } finally {
      submit.disabled = false;
      textarea.focus();
    }
  };

  loadState();
  hydrateTranscript();

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  menuButton?.addEventListener('click', () => setMenuOpen(menuList.hidden));
  newChatButton?.addEventListener('click', startNewChat);

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) {
      setMenuOpen(false);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    appendMessage('user', text);
    textarea.value = '';
    send(text);
  });

  setOpen(window.innerWidth >= 900);
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
    pearsonAiLabel: 'Pearson AI',
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

  const chatContainer = document.createElement('div');
  chatContainer.className = 'search-results-chat';

  const mainContent = document.createElement('div');
  mainContent.className = 'search-results-main-content';

  const contentLayout = document.createElement('div');
  contentLayout.className = 'search-results-content-layout';
  mainContent.append(heading, searchBox, tabs, panels);
  contentLayout.append(mainContent, chatContainer);

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
  return { searchBox, containers, chatContainer };
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
  const config = readConfig(block);
  const queryFromUrl = new URLSearchParams(window.location.search).get('q') || '';
  const initialQuery = queryFromUrl || config.initialQuery;

  if (!config.searchApiKey) {
    block.innerHTML = '<p class="search-results-error">Missing Algolia search key.</p>';
    return;
  }

  const shell = renderShell(block, config);

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
      content: { hits: [], nbHits: 0 },
    };

    const refresh = () => {
      setPanel(shell.containers.shop, config.shopLabel, state.shop, 'shop');
      setPanel(shell.containers.study, config.studyLabel, state.study, 'study');
      setPanel(shell.containers.discover, config.discoverLabel, state.discover, 'discover');
      setPanel(shell.containers.support, config.supportLabel, state.discover, 'support');

      const aiPanel = shell.containers['pearson-ai'];
      const aiStats = aiPanel.querySelector('[data-target="pearson-ai-stats"]');
      const aiHits = aiPanel.querySelector('[data-target="pearson-ai-hits"]');
      const aiPagination = aiPanel.querySelector('[data-target="pearson-ai-pagination"]');

      const aiItems = [];
      let aiCount = 0;

      [
        { key: 'shop', label: config.shopLabel },
        { key: 'study', label: config.studyLabel },
        { key: 'discover', label: config.discoverLabel },
        { key: 'content', label: config.contentLabel },
      ].forEach((source) => {
        aiCount += state[source.key].nbHits;
        state[source.key].hits.forEach((hit) => {
          aiItems.push({ ...hit, sourceLabel: source.label, sourceKey: source.key });
        });
      });

      if (aiStats) aiStats.textContent = `${aiCount.toLocaleString()} results found`;
      if (aiPagination) aiPagination.textContent = '';
      renderCards(aiHits, aiItems, 'No pearson ai results found for this query.');

      const supportPagination = shell.containers.support.querySelector('[data-target="support-pagination"]');
      if (supportPagination) supportPagination.textContent = '';
    };

    const makeHitsWidget = (sourceKey) => connectHits((renderOptions) => {
      const { hits, results } = renderOptions;
      state[sourceKey] = { hits, nbHits: results?.nbHits || 0 };
      refresh();
    })({});

    const sourceWidgets = SOURCES.map((source) => {
      const subIndex = index({ indexName: config[source.indexKey] });
      const widgets = [
        configure({ hitsPerPage: config.hitsPerPage }),
        makeHitsWidget(source.key),
      ];

      if (source.key === 'shop' || source.key === 'study' || source.key === 'discover') {
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
