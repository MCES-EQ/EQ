const menuButton = document.querySelector('#menu-button');
const menu = document.querySelector('#main-menu');

if (menuButton && menu) {
  const closeMenu = () => menuButton.setAttribute('aria-expanded', 'false');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
}

if ('IntersectionObserver' in window && matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const entranceObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-entering');
      entranceObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -28px 0px' });

  document.querySelectorAll('main:not(.partners) .section').forEach(section => entranceObserver.observe(section));
}
