// Login page logic

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const alertError = document.getElementById('alert-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    alertError.style.display = 'none';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      alertError.textContent = 'Please enter username and password.';
      alertError.style.display = 'block';
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      window.location.href = '/admin';
    } catch (err) {
      alertError.textContent = 'Invalid username or password.';
      alertError.style.display = 'block';
    }
  });
});
