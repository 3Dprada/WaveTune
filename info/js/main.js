const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const backToTop = document.querySelector('.back-to-top');
if (backToTop) {
  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  };
  window.addEventListener('scroll', toggleVisibility);
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

const details = document.querySelectorAll('.faq-list details');
details.forEach((d) => {
  d.addEventListener('click', (e) => {
    if (d.open) {
      return;
    }
    details.forEach((other) => {
      if (other !== d) {
        other.removeAttribute('open');
      }
    });
  });
});

const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.style.display === 'flex';
    navLinks.style.display = isOpen ? 'none' : 'flex';
    navLinks.style.flexDirection = isOpen ? '' : 'column';
    navLinks.style.position = isOpen ? '' : 'absolute';
    navLinks.style.top = isOpen ? '' : '64px';
    navLinks.style.right = isOpen ? '' : '1rem';
    navLinks.style.padding = isOpen ? '' : '1rem 1.2rem';
    navLinks.style.borderRadius = isOpen ? '' : '1rem';
    navLinks.style.border = isOpen ? '' : '1px solid rgba(255,255,255,0.14)';
    navLinks.style.background = isOpen ? '' : 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.86) 100%)';
    navLinks.style.backdropFilter = isOpen ? '' : 'blur(18px)';
  });
}
