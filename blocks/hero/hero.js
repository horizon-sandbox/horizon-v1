export default function decorate(block) {
  document.body.style.overflowY = '';
  document.documentElement.style.overflowY = '';
  document.body.classList.add('has-custom-hero');

  const section = block.closest('.section');
  if (section) {
    section.classList.add('hero-section');
  }

  const values = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean);

  const [title = '', subtitle = '', placeholder = 'What can I help you find?'] = values;
  const backgroundVideoSrc = 'https://content.da.live/horizon-sandbox/horizon-v1/content/dam/global/shared/brand/horizon/waves-fucsia-3-pearsonpurple-slow-16x9-l2r-hires-v01.mp4';
  const heroDropdowns = [
    {
      label: 'By Customer',
      items: ['Institution', 'Enterprise', 'Consumer'],
    },
    {
      label: 'For Education',
      items: ['Learn', 'Progress', 'Career Readiness', 'Whole Learner', 'Educator Excellence'],
    },
    {
      label: 'For Work',
      items: ['Talent Solutions', 'Professional Assessments', 'Clinical'],
    },
  ];
  const dropdownMarkup = heroDropdowns
    .map((dropdown) => {
      const menuItems = dropdown.items
        .map((item) => `<li><a href="#">${item}</a></li>`)
        .join('');
      return `<div class="hero-nav-item has-dropdown">
        <a class="hero-nav-trigger" href="#" aria-haspopup="true">
          ${dropdown.label}
        </a>
        <ul class="hero-nav-menu">
          ${menuItems}
        </ul>
      </div>`;
    })
    .join('');

  block.innerHTML = `
    <div class="hero-media" aria-hidden="true">
      <video autoplay muted loop playsinline preload="metadata">
        <source src="${backgroundVideoSrc}" type="video/mp4" />
      </video>
      <div class="hero-overlay"></div>
    </div>
    <div class="hero-shell">
      <div class="hero-topbar">
        <div class="hero-brand-links">
          <a class="hero-logo" href="/" aria-label="Pearson home">
            <img src="/icons/logo-full-white.svg" alt="Pearson" width="164" height="31" loading="eager" />
          </a>
          ${dropdownMarkup}
        </div>
        <div class="hero-tools-links">
          <a class="hero-tool hero-tool-sales" href="/">Contact Sales</a>
          <a class="hero-tool" href="/">Get Support</a>
          <a class="hero-tool" href="/">Sign In</a>
          <a class="hero-tool hero-tool-icon" href="/" aria-label="Cart">🛒</a>
          <a class="hero-tool hero-tool-icon" href="/" aria-label="Locale">🌐</a>
        </div>
      </div>
      <div class="hero-content">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <div class="hero-search">
          <input type="text" placeholder="${placeholder}" aria-label="Search" />
          <button type="button" aria-label="Submit search">
            <img src="/icons/search.svg" alt="" width="18" height="18" loading="lazy" />
          </button>
        </div>
      </div>
    </div>
  `;
}
