// Applies the light or dark theme before the page paints, so it never flashes white.
// Kept in sync with src/lib/theme.ts, which changes it later.
;(function () {
  var pick = 'system'
  try {
    pick = localStorage.getItem('fsg-theme') || 'system'
  } catch (e) {}
  var dark = pick === 'dark' || (pick !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#171a1e' : '#ffffff')
})()
