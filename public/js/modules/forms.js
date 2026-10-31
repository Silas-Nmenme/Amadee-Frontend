export function initPublicForms() {
  for (const form of document.querySelectorAll('form[name="contact"], form[name="newsletter"]')) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled || !form.reportValidity()) return;
      const status = form.querySelector('.form-status');
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending…';
      try {
        const response = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
        if (!response.ok) throw new Error();
        form.reset();
        status.textContent = form.name === 'newsletter' ? 'Thank you. Your request for collection updates has been received.' : 'Thank you. Your message has been received.';
      } catch {
        status.textContent = 'We couldn’t send this. Please try again or contact us on WhatsApp.';
      } finally {
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }
}
