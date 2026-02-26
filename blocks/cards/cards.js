import { createOptimizedPicture } from '../../scripts/aem.js';

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
  block.replaceChildren(ul);
}
