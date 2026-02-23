export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-card-image';
      } else {
        div.className = 'cards-card-body';
        const firstP = div.querySelector('p:first-child');
        if (firstP && !firstP.querySelector('a')) {
          firstP.classList.add('eyebrow');
        }
      }
    });
    ul.append(li);
  });
  block.replaceChildren(ul);
}
