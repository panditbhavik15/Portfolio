(() => {
  const nav = document.querySelector('nav');
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelectorAll('nav a');
  const sections = document.querySelectorAll('main section[id]');

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });

  navLinks.forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  }));

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.removeAttribute('aria-current'));
      const activeLink = document.querySelector(`nav a[href="#${entry.target.id}"]`);
      if (activeLink) activeLink.setAttribute('aria-current', 'page');
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  sections.forEach(section => sectionObserver.observe(section));

  document.getElementById('footer-year').textContent = new Date().getFullYear();

  const form = document.querySelector('.contact-form');
  const status = document.getElementById('form-status');
  const fallback = document.querySelector('.form-fallback');
  const fallbackLink = document.getElementById('email-fallback');
  const recipient = 'kking92451@gmail.com';

  form.addEventListener('submit', event => {
    event.preventDefault();

    if (form.elements._gotcha.value) {
      status.textContent = 'Thanks for your message.';
      return;
    }

    let valid = true;
    form.querySelectorAll('[required]').forEach(field => {
      const error = document.getElementById(`${field.id}-error`);
      const invalid = !field.value.trim() || !field.checkValidity() || field.value.length > field.maxLength;
      field.setAttribute('aria-invalid', String(invalid));
      if (error) error.classList.toggle('is-visible', invalid);
      valid = valid && !invalid;
    });

    if (!valid) {
      status.textContent = 'Please correct the highlighted fields before continuing.';
      fallback.hidden = true;
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const name = form.elements.name.value.trim().replace(/\s+/g, ' ');
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    const subject = `Portfolio message from ${name}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      '',
      message
    ].join('\n');

    const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    fallbackLink.href = mailto;
    fallbackLink.textContent = `Open a new email to ${recipient}`;
    fallback.hidden = false;
    status.textContent = 'Opening your email app. Review the message there and press Send to deliver it.';

    window.location.assign(mailto);
  });
})();
