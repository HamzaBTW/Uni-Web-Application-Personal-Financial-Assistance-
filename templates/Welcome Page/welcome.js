// Scroll-reveal: elements with class `.reveal` fade+slide up when they enter the viewport
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const delay = el.style.getPropertyValue('--delay') || '0s';
      el.style.transitionDelay = delay;
      el.classList.add('revealed');
      revealObserver.unobserve(el);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
