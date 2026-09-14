// Login page: posts to /api/login, then redirects to the dashboard.
const MOCK = new URLSearchParams(location.search).has('mock');
const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

function showError(msg) {
  if (!msg) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  } else {
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');

  if (MOCK) {
    location.href = 'index.html?mock=1';
    return;
  }

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showError(body.error || "That didn't work. Check the details and try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
      return;
    }
    location.href = 'index.html';
  } catch {
    showError('Could not reach the server. Try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }
});
