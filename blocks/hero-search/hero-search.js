function textFromCell(cell) {
  return cell ? cell.textContent.trim() : '';
}

function parseMode(text) {
  const value = (text || '').toLowerCase();
  return value.includes('prefilled') ? 'prefilled' : 'default';
}

function parseSearchPath(text) {
  const value = (text || '').trim();
  return value || '/drafts/search.html';
}

function applySharedSectionBackground(block, picture) {
  if (!picture) return false;

  const image = picture.querySelector('img');
  const imageSrc = image?.currentSrc || image?.src;
  if (!imageSrc) return false;

  const section = block.closest('.section');
  if (!section || !section.querySelector('.promo-cards')) return false;

  section.classList.add('hero-search-has-shared-background');
  section.style.setProperty('--hero-search-shared-bg-image', `url('${imageSrc}')`);
  section.querySelector(':scope > .hero-search-shared-background')?.remove();
  return true;
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const row1Cells = rows[0] ? [...rows[0].children] : [];
  const row2Cells = rows[1] ? [...rows[1].children] : [];
  const row4Cells = rows[3] ? [...rows[3].children] : [];
  const row5Cells = rows[4] ? [...rows[4].children] : [];

  const eyebrow = textFromCell(row1Cells[0]);
  const heading = row1Cells[1]?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim()
    || textFromCell(row1Cells[1])
    || rows[0].querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim()
    || '';
  const subheading = row1Cells[2]?.querySelector('p')?.textContent.trim()
    || textFromCell(row1Cells[2])
    || row1Cells[1]?.querySelector('p')?.textContent.trim()
    || '';

  const queryText = textFromCell(row2Cells[0]);
  const mode = parseMode(textFromCell(row4Cells[0]));
  const searchPath = parseSearchPath(textFromCell(row5Cells[0]));

  const picture = block.querySelector('picture');

  block.textContent = '';

  const hasSharedBackground = applySharedSectionBackground(block, picture);

  const bg = document.createElement('div');
  bg.className = 'hero-search-background';
  if (picture && !hasSharedBackground) {
    bg.append(picture);
  }

  const content = document.createElement('div');
  content.className = 'hero-search-content';

  if (eyebrow) {
    const eyebrowEl = document.createElement('p');
    eyebrowEl.className = 'hero-search-eyebrow';
    eyebrowEl.textContent = eyebrow;
    content.append(eyebrowEl);
  }

  if (heading) {
    const titleEl = document.createElement('h1');
    titleEl.className = 'hero-search-title';
    titleEl.textContent = heading;
    content.append(titleEl);
  }

  if (subheading) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'hero-search-subtitle';
    subtitleEl.textContent = subheading;
    content.append(subtitleEl);
  }

  const search = document.createElement('form');
  search.className = 'hero-search-form';
  search.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.className = 'hero-search-input';
  input.type = 'text';
  input.setAttribute('aria-label', 'Search');
  if (mode === 'prefilled') {
    input.value = queryText;
  } else {
    input.placeholder = queryText || 'Search products, orders, or ask a question...';
  }

  const button = document.createElement('button');
  button.className = 'hero-search-submit';
  button.type = 'submit';
  button.setAttribute('aria-label', 'Open assistant');
  button.innerHTML = '<img src="/icons/ai-home/ai-search-group.svg" alt="" aria-hidden="true" />';

  search.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = new URL(searchPath, window.location.href);
    const query = input.value.trim() || queryText;
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.location.assign(url.toString());
  });

  search.append(input, button);
  content.append(search);

  if (hasSharedBackground) {
    block.append(content);
  } else {
    block.append(bg, content);
  }
}
