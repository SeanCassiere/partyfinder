// Apply before the app renders to avoid a light flash on dark-theme visits.
try {
  var preference = localStorage.getItem('partyfinder.theme');
  document.documentElement.dataset.theme =
    preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
} catch {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
