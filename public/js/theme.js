(function () {
  var STORAGE_KEY = 'kt-theme';

  function getToggle() {
    return document.getElementById('theme-toggle');
  }

  function setLabel(theme) {
    var btn = getToggle();
    if (!btn) return;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', theme === 'dark' ? 'Light mode' : 'Dark mode');
  }

  function apply(theme) {
    if (theme !== 'light' && theme !== 'dark') theme = 'light';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
    setLabel(theme);
  }

  document.addEventListener('DOMContentLoaded', function () {
    setLabel(document.documentElement.dataset.theme || 'light');
    getToggle()?.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
    });
  });
})();
