/**
 * loads and decorates the hero block
 * @param {Element} block The hero block element
 */
export default async function decorate(block) {
  const images = block.querySelectorAll('img');

  images.forEach((img) => {
    const picture = img.closest('picture');
    if (picture) picture.style.display = 'none';
  });
}
