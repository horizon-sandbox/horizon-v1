/**
 * loads and decorates the search block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const searchForm = document.createElement('form');
  searchForm.className = 'search-form';
  searchForm.setAttribute('role', 'search');

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'search-wrapper';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'What can I help you find?';
  searchInput.setAttribute('aria-label', 'Search');

  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.className = 'search-button';
  searchButton.setAttribute('aria-label', 'Search');
  searchButton.innerHTML = '<span class="icon icon-search"></span>';

  searchWrapper.append(searchInput, searchButton);
  searchForm.append(searchWrapper);

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  });

  block.textContent = '';
  block.append(searchForm);
}
