import { getMetadata, decorateIcons } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { login, logout, getUser } from '../../scripts/ies-auth.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  // If the brand section contains a plain link to an image URL (e.g. SVG authored
  // as a text hyperlink because da.live has no insert-image option), convert it
  // into a proper <img> wrapped in an <a>.
  const brandImgLink = navBrand.querySelector('a:not(.button)');
  if (brandImgLink && !navBrand.querySelector('img')) {
    const href = brandImgLink.getAttribute('href') || '';
    if (/\.(svg|png|jpg|jpeg|webp)(\?|$)/i.test(href)) {
      const linkText = brandImgLink.textContent.trim();
      // Use link text as alt/aria-label unless it's just the raw URL
      const label = linkText && linkText !== href ? linkText : 'Home';
      const img = document.createElement('img');
      img.src = href;
      img.alt = label;
      img.loading = 'eager';
      const wrapper = document.createElement('a');
      wrapper.href = '/';
      wrapper.setAttribute('aria-label', label);
      wrapper.append(img);
      brandImgLink.replaceWith(wrapper);
    }
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) {
        navSection.classList.add('nav-drop');
        // inject chevron icon
        const chevron = document.createElement('span');
        chevron.className = 'icon icon-chevron-down nav-drop-icon';
        navSection.append(chevron);
      }
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
      navSection.addEventListener('mouseenter', () => {
        if (isDesktop.matches) {
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', 'true');
        }
      });
      let closeTimer;
      navSection.addEventListener('mouseleave', () => {
        if (isDesktop.matches) {
          closeTimer = setTimeout(() => navSection.setAttribute('aria-expanded', 'false'), 100);
        }
      });
      const panel = navSection.querySelector('ul');
      if (panel) {
        panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
        panel.addEventListener('mouseleave', () => {
          if (isDesktop.matches) navSection.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  // Decorate tools section – strip button classes, inject icons, add cart
  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    navTools.querySelectorAll('a').forEach((a) => {
      const text = a.textContent.trim().toLowerCase();
      // Strip button decoration applied by decorateMain
      a.classList.remove('button', 'primary', 'secondary');
      if (a.parentElement?.classList.contains('button-container')) {
        a.parentElement.classList.remove('button-container');
      }
      // "Get Support" / "help" → icon-only help icon
      if (text.includes('support') || text.includes('help')) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon icon-help';
        const label = a.textContent.trim();
        a.setAttribute('aria-label', label);
        a.textContent = '';
        a.classList.add('nav-tool-icon');
        a.append(iconSpan);
      }
      // "Sign In" → primary CTA pill button
      if (text.includes('sign') || text.includes('log in')) {
        a.classList.add('nav-cta');
      }
    });
    // Reorder: move Sign In (nav-cta) before the first icon-only tool link
    const toolsWrapper = navTools.querySelector('.default-content-wrapper');
    if (toolsWrapper) {
      const ctaLink = toolsWrapper.querySelector('a.nav-cta');
      const firstIconLink = toolsWrapper.querySelector('a.nav-tool-icon');
      if (ctaLink && firstIconLink) {
        // Walk up to the <li> so insertBefore operates on siblings in the <ul>
        const ctaNode = ctaLink.closest('li') ?? ctaLink.parentElement ?? ctaLink;
        const anchorNode = firstIconLink.closest('li') ?? firstIconLink.parentElement ?? firstIconLink;
        if (ctaNode.parentElement === anchorNode.parentElement) {
          anchorNode.parentElement.insertBefore(ctaNode, anchorNode);
        }
      }
    }
    // Replace Sign In anchor with auth-aware element
    const signInAnchor = toolsWrapper ? toolsWrapper.querySelector('a.nav-cta') : null;
    if (signInAnchor) {
      const user = getUser();
      const liEl = signInAnchor.closest('li') ?? signInAnchor.parentElement;
      if (user) {
        const firstInitial = (user.firstName || '')[0] || '';
        const lastInitial = (user.lastName || '')[0] || '';
        const initials = (firstInitial + lastInitial).toUpperCase() || '?';
        const displayName = user.firstName || user.email || 'User';

        const userMenu = document.createElement('div');
        userMenu.className = 'nav-user-menu';
        userMenu.innerHTML = `
          <button class="nav-user-avatar" type="button" aria-haspopup="true" aria-expanded="false">
            <span class="nav-user-avatar-circle">${initials}</span>
            <span class="nav-user-chevron"></span>
          </button>
          <div class="nav-user-dropdown">
            <div class="nav-user-dropdown-header">Hi, ${displayName}</div>
            <ul class="nav-user-dropdown-list">
              <li><a href="#">Account details</a></li>
              <li><a href="#">Order history</a></li>
              <li><a href="#">Address book</a></li>
              <li><a href="#">Wallet</a></li>
              <li><a href="#">Preferences</a></li>
              <li><a href="#">Change password</a></li>
              <li><a href="#">My learning</a></li>
              <li><a href="#">Track order</a></li>
            </ul>
            <div class="nav-user-dropdown-footer">
              <button class="nav-user-signout" type="button">Sign out</button>
            </div>
          </div>`;
        liEl.replaceWith(userMenu);

        const avatarBtn = userMenu.querySelector('.nav-user-avatar');
        const dropdown = userMenu.querySelector('.nav-user-dropdown');
        avatarBtn.addEventListener('click', () => {
          const open = avatarBtn.getAttribute('aria-expanded') === 'true';
          avatarBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
          dropdown.classList.toggle('is-open', !open);
        });
        document.addEventListener('click', (e) => {
          if (!userMenu.contains(e.target)) {
            avatarBtn.setAttribute('aria-expanded', 'false');
            dropdown.classList.remove('is-open');
          }
        });
        userMenu.querySelector('.nav-user-signout').addEventListener('click', (e) => {
          e.preventDefault();
          logout();
        });
      } else {
        const signinEl = document.createElement('button');
        signinEl.className = 'nav-cta nav-tool-signin';
        signinEl.type = 'button';
        signinEl.textContent = 'Sign In';
        liEl.replaceWith(signinEl);
      }
    }

    // Auth button handlers
    const signinBtn = navTools.querySelector('.nav-tool-signin');
    if (signinBtn) {
      signinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        login();
      });
    }

    // Inject cart icon link after existing tools
    const cartLink = document.createElement('a');
    cartLink.href = '/cart';
    cartLink.setAttribute('aria-label', 'Cart');
    cartLink.className = 'nav-tool-icon';
    cartLink.innerHTML = '<span class="icon icon-cart"></span>';
    if (toolsWrapper) toolsWrapper.append(cartLink);
    await decorateIcons(nav);
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  // Add solid background once user scrolls away from the top
  const headerEl = block.closest('header');
  const onScroll = () => {
    headerEl.classList.toggle('is-scrolled', window.scrollY > 10);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
