// Theme toggle with system preference and persistence
(function theme() {
  try {
    const root = document.documentElement;
    const toggle = document.querySelector('[data-theme-toggle]');
    const storageKey = 'pref-theme';

    const apply = (mode) => {
      if (!mode) { root.removeAttribute('data-theme'); return; }
      root.setAttribute('data-theme', mode);
    };

    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') apply(saved);

    toggle && toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : current === 'light' ? '' : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
      apply(next);
      if (next) localStorage.setItem(storageKey, next); else localStorage.removeItem(storageKey);
    });
  } catch { /* no-op */ }
})();

// Subtle parallax for decorative orbs; respects reduced motion
(function parallax() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const nodes = document.querySelectorAll('[data-parallax]');
  if (!nodes.length) return;
  const onScroll = () => {
    const y = window.scrollY || 0;
    nodes.forEach((el, i) => {
      const factor = (i + 1) * 0.02; // mild
      el.style.transform = `translate3d(0, ${y * factor}px, 0)`;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// Footer year
(function year() {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();


