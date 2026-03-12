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

const SF_EMBEDDED_CHAT_CONFIG = {
  orgId: '00D9Z00000Cnrp3',
  deploymentName: 'Pearson_com_Hackathon_ECv2',
  siteUrl: 'https://pearson--projects.sandbox.my.site.com/ESWPearsoncomHackathon1773259988116',
  bootstrapUrl: 'https://pearson--projects.sandbox.my.site.com/ESWPearsoncomHackathon1773259988116/assets/js/bootstrap.min.js',
  scrt2URL: 'https://pearson--projects.sandbox.my.salesforce-scrt.com',
};

const SF_BOOTSTRAP_SCRIPT_ID = 'sf-enhanced-chat-bootstrap';
let sfBootstrapScriptPromise;

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

function loadSalesforceBootstrapScript() {
  if (window.embeddedservice_bootstrap) {
    return Promise.resolve();
  }

  if (sfBootstrapScriptPromise) {
    return sfBootstrapScriptPromise;
  }

  sfBootstrapScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SF_BOOTSTRAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Salesforce Embedded Messaging bootstrap script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SF_BOOTSTRAP_SCRIPT_ID;
    script.type = 'text/javascript';
    script.src = SF_EMBEDDED_CHAT_CONFIG.bootstrapUrl;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load Salesforce Embedded Messaging bootstrap script.')), { once: true });
    document.head.append(script);
  });

  return sfBootstrapScriptPromise;
}

async function initInlineEmbeddedMessaging(container) {
  if (!container || container.dataset.sfEnhancedChatReady === 'true') return;

  await loadSalesforceBootstrapScript();

  const bootstrap = window.embeddedservice_bootstrap;
  if (!bootstrap?.init || !bootstrap?.settings) {
    throw new Error('Salesforce Embedded Messaging API is unavailable on window.embeddedservice_bootstrap.');
  }

  bootstrap.settings.language = 'en_US';
  bootstrap.settings.displayMode = 'inline';
  bootstrap.settings.headerEnabled = false;
  bootstrap.settings.displayHelpButton = false;
  bootstrap.settings.targetElement = container;

  await bootstrap.init(
    SF_EMBEDDED_CHAT_CONFIG.orgId,
    SF_EMBEDDED_CHAT_CONFIG.deploymentName,
    SF_EMBEDDED_CHAT_CONFIG.siteUrl,
    {
      scrt2URL: SF_EMBEDDED_CHAT_CONFIG.scrt2URL,
    },
  );

  container.dataset.sfEnhancedChatReady = 'true';
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
    hitsPerPage: 12,
    shopIndex: 'live-learner-program-index-vector',
    contentIndex: 'live-en-us-learner-content-index',
    studyIndex: 'live-study-prep-course-catalog',
    discoverIndex: 'live-en-us-learner-content-support-index',
    supportIndex: 'live-en-us-learner-content-support-index',
    assessmentsAppId: 'XFOI9EBBHR',
    assessmentsApiKey: '1e7c60a2d332875433b8e237db632d41',
    assessmentsIndex: 'live-usassessments-product-index',
    pearsonAiLabel: 'View All',
    shopLabel: 'Shop',
    studyLabel: 'Study',
    discoverLabel: 'Discover',
    supportLabel: 'Support',
    contentLabel: 'Content',
    assessmentsLabel: 'Assessments',
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
      if (!Number.isNaN(parsed)) config.hitsPerPage = Math.max(1, Math.min(parsed, 20));
    },
    shopindex: (v) => { config.shopIndex = v; },
    learnerprogramindex: (v) => { config.shopIndex = v; },
    studyindex: (v) => { config.studyIndex = v; },
    discoverindex: (v) => { config.discoverIndex = v; },
    supportindex: (v) => { config.supportIndex = v; },
    contentindex: (v) => { config.contentIndex = v; },
    learnercontentindex: (v) => { config.contentIndex = v; },
    assessmentsindex: (v) => { config.assessmentsIndex = v; },
    assessmentsappid: (v) => { config.assessmentsAppId = v; },
    assessmentsapikey: (v) => { config.assessmentsApiKey = v; },
    pearsonailabel: (v) => { config.pearsonAiLabel = v; },
    shoplabel: (v) => { config.shopLabel = v; },
    studylabel: (v) => { config.studyLabel = v; },
    discoverlabel: (v) => { config.discoverLabel = v; },
    supportlabel: (v) => { config.supportLabel = v; },
    contentlabel: (v) => { config.contentLabel = v; },
    assessmentslabel: (v) => { config.assessmentsLabel = v; },
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
  return getFirstString(item, ['name_en', 'name', 'title', 'webpagetitle', 'productName', 'assessmentTitle', 'programName', 'displayName']) || 'Untitled';
}

function cardDescription(item) {
  return stripHtml(getFirstString(item, ['summary_en', 'summary', 'description_en', 'description', 'metaDescription', 'shortDescription', 'overview']));
}

function cardHref(item) {
  const href = getFirstString(item, ['url_en', 'defaultProgramUrl', 'url', 'productUrl', 'pageUrl', 'canonicalUrl', 'slug']) || '#';
  if (!href.startsWith('/')) return href;
  const base = item.sourceKey === 'assessments' ? 'https://www.pearsonassessments.com' : 'https://www.pearson.com';
  return `${base}${href}`;
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

  const trainingType = getFirstArrayValue(item, ['trainingType_en', 'reportType_en', 'materialType_en', 'platformType_en']);

  const edition = getFirstString(item, ['programEdition', 'edition', 'editionName']);
  const price = getFirstString(item, ['lowestDiscountedProgramPriceValue', 'lowestProgramPriceValue', 'price']);
  const qualLevel = getFirstString(item, ['qualificationLevel']);

  const sourceMetaMap = {
    shop: [sourceLabel, category, edition || format || price],
    study: [sourceLabel, category, format || edition || price],
    discover: [sourceLabel, contentType || category, format || edition],
    support: [sourceLabel, contentType || category, format || edition],
    content: [sourceLabel, contentType || category, format || edition],
    assessments: [sourceLabel, trainingType || contentType || format, qualLevel || category],
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
         <h3 class="search-results-card-title"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></h3>
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

  const embeddedChatLauncher = document.createElement('button');
  embeddedChatLauncher.type = 'button';
  embeddedChatLauncher.className = 'search-results-chatbot-trigger';
  embeddedChatLauncher.disabled = true;
  embeddedChatLauncher.setAttribute('aria-disabled', 'true');
  embeddedChatLauncher.setAttribute('aria-expanded', 'false');
  embeddedChatLauncher.setAttribute('aria-controls', 'search-results-embedded-chat-panel');
  embeddedChatLauncher.innerHTML = `
    <div class="search-results-chatbot-brand">
      <img class="search-results-chatbot-logo-mark" src="/icons/pearson-logo-full-purple.svg" alt="Pearson AI" loading="lazy" />
      <span class="search-results-chatbot-ai-label">AI</span>
    </div>
  `;

  const embeddedChatPanel = document.createElement('div');
  embeddedChatPanel.className = 'search-results-embedded-chat';
  embeddedChatPanel.id = 'search-results-embedded-chat-panel';
  embeddedChatPanel.hidden = true;

  const embeddedChatTarget = document.createElement('div');
  embeddedChatTarget.className = 'search-results-embedded-chat-target';
  embeddedChatTarget.id = `search-results-enhanced-chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  embeddedChatTarget.setAttribute('aria-live', 'polite');

  embeddedChatPanel.append(embeddedChatTarget);

  const contentLayout = document.createElement('div');
  contentLayout.className = 'search-results-content-layout';
  const searchRow = document.createElement('div');
  searchRow.className = 'search-results-search-row';
  searchRow.append(searchBox, embeddedChatLauncher);
  mainContent.append(heading, searchRow, embeddedChatPanel, tabs, panels);
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
    searchBox,
    containers,
    embeddedChatLauncher,
    embeddedChatPanel,
    embeddedChatTarget,
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

  const setLauncherReady = (ready) => {
    shell.embeddedChatLauncher.disabled = !ready;
    shell.embeddedChatLauncher.setAttribute('aria-disabled', ready ? 'false' : 'true');
    shell.embeddedChatLauncher.classList.toggle('is-disabled', !ready);
  };

  setLauncherReady(false);

  let isEmbeddedMessagingReady = false;

  window.addEventListener('onEmbeddedMessagingReady', () => {
    isEmbeddedMessagingReady = true;
  }, { once: true });

  const waitForEmbeddedMessagingReady = (timeoutMs = 12000) => new Promise((resolve, reject) => {
    if (isEmbeddedMessagingReady || window.embeddedservice_bootstrap?.utilAPI) {
      isEmbeddedMessagingReady = true;
      resolve();
      return;
    }

    let timerId;
    const onReady = () => {
      window.removeEventListener('onEmbeddedMessagingReady', onReady);
      clearTimeout(timerId);
      resolve();
    };

    window.addEventListener('onEmbeddedMessagingReady', onReady, { once: true });
    timerId = window.setTimeout(() => {
      window.removeEventListener('onEmbeddedMessagingReady', onReady);
      reject(new Error('Timed out waiting for onEmbeddedMessagingReady.'));
    }, timeoutMs);
  });

  const waitForUtilApiMethod = (methodName, timeoutMs = 12000) => new Promise((resolve, reject) => {
    const hasMethod = () => typeof window.embeddedservice_bootstrap?.utilAPI?.[methodName] === 'function';
    if (hasMethod()) {
      resolve();
      return;
    }

    const start = Date.now();
    const intervalId = window.setInterval(() => {
      if (hasMethod()) {
        window.clearInterval(intervalId);
        resolve();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        window.clearInterval(intervalId);
        reject(new Error(`Timed out waiting for Salesforce utilAPI.${methodName}.`));
      }
    }, 100);
  });

  const chatInitPromise = initInlineEmbeddedMessaging(shell.embeddedChatTarget)
    .then(() => waitForEmbeddedMessagingReady())
    .then(() => waitForUtilApiMethod('launchChat'))
    .then(() => {
      setLauncherReady(true);
    })
    .catch((error) => {
      setLauncherReady(false);
      shell.embeddedChatPanel?.classList.add('is-error');
      if (shell.embeddedChatTarget) {
        shell.embeddedChatTarget.innerHTML = '<p class="search-results-embedded-chat-notice">Enhanced Chat could not be initialized for this page. Please verify Salesforce framing/CSP allowlist settings for this origin.</p>';
      }
      // eslint-disable-next-line no-console
      console.error('Error loading Embedded Messaging: ', error);
      throw error;
    });

  let chatLaunched = false;
  const launchEmbeddedChat = async () => {
    await chatInitPromise;
    await waitForUtilApiMethod('launchChat');
    const utilApi = window.embeddedservice_bootstrap?.utilAPI;
    if (!utilApi?.launchChat) {
      throw new Error('Salesforce utilAPI.launchChat is unavailable.');
    }
    if (!chatLaunched) {
      await utilApi.launchChat();
      chatLaunched = true;
    }
  };

  const openEmbeddedChat = async () => {
    shell.embeddedChatPanel.hidden = false;
    shell.embeddedChatPanel.classList.add('is-open');
    shell.embeddedChatLauncher.classList.add('is-open');
    shell.embeddedChatLauncher.setAttribute('aria-expanded', 'true');
    await launchEmbeddedChat();
  };

  const closeEmbeddedChat = () => {
    shell.embeddedChatPanel.hidden = true;
    shell.embeddedChatPanel.classList.remove('is-open');
    shell.embeddedChatLauncher.classList.remove('is-open');
    shell.embeddedChatLauncher.setAttribute('aria-expanded', 'false');
  };

  shell.embeddedChatLauncher.addEventListener('click', () => {
    if (shell.embeddedChatPanel.hidden) {
      openEmbeddedChat().catch(() => {
        // launch errors are already handled and surfaced in UI
      });
    } else {
      closeEmbeddedChat();
    }
  });

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
        // eslint-disable-next-line no-use-before-define
        searchAssessments(query);
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
        showReset: true,
        showSubmit: true,
        showLoadingIndicator: false,
        templates: {
          reset: '<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 5.58579L12.2929 0.292893C12.6834 -0.0976311 13.3166 -0.0976311 13.7071 0.292893C14.0976 0.683418 14.0976 1.31658 13.7071 1.70711L8.41421 7L13.7071 12.2929C14.0976 12.6834 14.0976 13.3166 13.7071 13.7071C13.3166 14.0976 12.6834 14.0976 12.2929 13.7071L7 8.41421L1.70711 13.7071C1.31658 14.0976 0.683418 14.0976 0.292893 13.7071C-0.0976311 13.3166 -0.0976311 12.6834 0.292893 12.2929L5.58579 7L0.292893 1.70711C-0.0976311 1.31658 -0.0976311 0.683418 0.292893 0.292893C0.683418 -0.0976311 1.31658 -0.0976311 1.70711 0.292893L7 5.58579Z" fill="currentColor"/></svg>',
        },
      }),
    ]);

    const state = {
      shop: { hits: [], nbHits: 0 },
      study: { hits: [], nbHits: 0 },
      discover: { hits: [], nbHits: 0 },
      support: { hits: [], nbHits: 0 },
      content: { hits: [], nbHits: 0 },
      assessments: { hits: [], nbHits: 0 },
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
        { key: 'assessments', label: config.assessmentsLabel },
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

    const searchAssessments = async (query) => {
      if (!config.assessmentsAppId || !config.assessmentsApiKey || !config.assessmentsIndex) return;
      if (!query) {
        state.assessments = { hits: [], nbHits: 0 };
        refresh();
        return;
      }
      try {
        const aClient = window.algoliasearch(config.assessmentsAppId, config.assessmentsApiKey);
        const result = await aClient.initIndex(config.assessmentsIndex).search(query || '', { hitsPerPage: config.hitsPerPage });
        state.assessments = { hits: result.hits || [], nbHits: result.nbHits || 0 };
      } catch (e) {
        state.assessments = { hits: [], nbHits: 0 };
      }
      refresh();
    };

    search.addWidgets(sourceWidgets);
    refresh();
    if (initialQuery) searchAssessments(initialQuery);
    search.start();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Algolia search initialization failed', error);
    block.innerHTML = '<p class="search-results-error">Unable to initialize Algolia search right now.</p>';
  }
}
