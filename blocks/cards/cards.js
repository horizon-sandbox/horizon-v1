import { createOptimizedPicture } from '../../scripts/aem.js';

const CHEV_ARROW_NEXT_SVG = '<svg class="chevarrow-next" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 18 18" width="18" height="18"><path class="chevron" fill="currentColor" d="M12.68,8.38L6.56,2.26c-.34-.34-.9-.34-1.24,0-.34.34-.34.9,0,1.24l5.5,5.5-5.5,5.5c-.34.34-.34.9,0,1.24.34.34.9.34,1.24,0l6.12-6.12c.34-.34.34-.9,0-1.24Z"/><path class="bar" d="M3.02,10c-.55,0-1-.45-1-1s.45-1,1-1h10.63c.55,0,1,.44,1,1s-.45,1-1,1H3.02Z"/></svg>';

export default function decorate(block) {
  const section = block.closest('.section');
  if (section) {
    section.classList.add('cards-section');

    // Collapse the empty trailing section AEM generates after the cards section
    const nextSection = section.nextElementSibling;
    if (nextSection?.classList.contains('section') && !nextSection.querySelector('[class]')) {
      nextSection.style.margin = '0';
      nextSection.style.padding = '0';
    }

    // Dynamically collapse the section's leftover flow height so nothing
    // appears below the hero. Formula: the CSS margin-top is already negative
    // (e.g. -260px mobile / -385px desktop), so the leftover = height + margin-top.
    const collapseSection = () => {
      const mt = parseInt(getComputedStyle(section).marginTop, 10); // negative value
      section.style.marginBottom = `${-(section.offsetHeight + mt)}px`;
    };
    const ro = new ResizeObserver(collapseSection);
    ro.observe(section);
  }

  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  ul.querySelectorAll('.cards-card-body > p:last-child a:any-link, .cards-card-body .button').forEach((link) => {
    if (!link.querySelector('.chevarrow-next')) {
      link.insertAdjacentHTML('beforeend', CHEV_ARROW_NEXT_SVG);
    }
  });
  block.replaceChildren(ul);
}
