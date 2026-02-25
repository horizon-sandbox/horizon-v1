function getText(cell) {
  return cell ? cell.textContent.trim() : '';
}

function parseOptions(text) {
  const options = {
    showDots: true,
  };

  const normalized = (text || '').toLowerCase().replace('options:', '').trim();
  if (!normalized) return options;

  normalized.split(/[;,]/).forEach((part) => {
    const [rawKey, rawValue] = part.split('=').map((item) => item.trim());
    if (!rawKey) return;
    if (rawKey === 'showdots' && rawValue) {
      options.showDots = rawValue !== 'false';
    }
  });

  return options;
}

function isOptionsRow(row) {
  if (!row || row.children.length !== 1) return false;
  const text = row.textContent.trim().toLowerCase();
  return text.startsWith('options:') || text.startsWith('showdots');
}

function cardsPerPage() {
  return 3;
}

function buildDots(dots, pageCount, onSelect) {
  dots.textContent = '';
  for (let index = 0; index < pageCount; index += 1) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'promo-cards-dot';
    button.setAttribute('aria-label', `Go to slide ${index + 1}`);
    button.addEventListener('click', () => onSelect(index));
    li.append(button);
    dots.append(li);
  }
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  let options = { showDots: true };
  let dataRows = rows;

  if (isOptionsRow(rows[0])) {
    options = parseOptions(rows[0].textContent);
    dataRows = rows.slice(1);
  }

  const cards = dataRows
    .map((row) => {
      const cells = [...row.children];
      const label = getText(cells[0]);
      const title = cells[1]?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || getText(cells[1]);
      const description = cells[2]?.querySelector('p')?.textContent.trim() || getText(cells[2]);
      const link = cells[3]?.querySelector('a') || row.querySelector('a');

      if (!title && !description) return null;

      return {
        label,
        title,
        description,
        link,
      };
    })
    .filter(Boolean);

  block.textContent = '';

  const viewport = document.createElement('div');
  viewport.className = 'promo-cards-viewport';

  const list = document.createElement('ul');
  list.className = 'promo-cards-list';

  cards.forEach((card) => {
    const item = document.createElement('li');
    item.className = 'promo-cards-item';

    const article = document.createElement('article');
    article.className = 'promo-card';

    if (card.label) {
      const label = document.createElement('p');
      label.className = 'promo-card-label';
      label.textContent = card.label;
      article.append(label);
    }

    if (card.title) {
      const title = document.createElement('h3');
      title.className = 'promo-card-title';
      title.textContent = card.title;
      article.append(title);
    }

    if (card.description) {
      const description = document.createElement('p');
      description.className = 'promo-card-description';
      description.textContent = card.description;
      article.append(description);
    }

    if (card.link) {
      const linkWrap = document.createElement('p');
      linkWrap.className = 'promo-card-cta';
      card.link.classList.add('promo-card-link');
      linkWrap.append(card.link);
      article.append(linkWrap);
    }

    item.append(article);
    list.append(item);
  });

  viewport.append(list);
  block.append(viewport);

  if (options.showDots && cards.length > 1) {
    const dots = document.createElement('ol');
    dots.className = 'promo-cards-dots';

    let currentPage = 0;
    let pageCount = Math.ceil(cards.length / cardsPerPage());

    const updateDots = () => {
      [...dots.querySelectorAll('.promo-cards-dot')].forEach((dot, index) => {
        const active = index === currentPage;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    };

    const pageOffset = (pageIndex) => {
      const step = cardsPerPage();
      const cardIndex = Math.min(pageIndex * step, list.children.length - 1);
      const card = list.children[cardIndex];
      return card ? card.offsetLeft : 0;
    };

    const goToPage = (pageIndex, behavior = 'smooth') => {
      const boundedPage = Math.max(0, Math.min(pageIndex, pageCount - 1));
      currentPage = boundedPage;
      viewport.scrollTo({ left: pageOffset(boundedPage), behavior });
      updateDots();
    };

    const refreshCarousel = () => {
      pageCount = Math.ceil(cards.length / cardsPerPage());
      buildDots(dots, pageCount, (index) => goToPage(index));
      goToPage(Math.min(currentPage, pageCount - 1), 'auto');
    };

    let scheduled = false;
    viewport.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        const offsets = Array.from({ length: pageCount }, (_, index) => pageOffset(index));
        const left = viewport.scrollLeft;
        const nearestPage = offsets.reduce((closest, offset, index, arr) => (
          Math.abs(offset - left) < Math.abs(arr[closest] - left) ? index : closest
        ), 0);

        if (nearestPage !== currentPage) {
          currentPage = nearestPage;
          updateDots();
        }
      });
    });

    window.addEventListener('resize', refreshCarousel);
    refreshCarousel();

    block.append(dots);
  }
}
