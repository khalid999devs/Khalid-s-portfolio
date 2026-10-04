/* eslint no-unused-vars: ["error", { "caughtErrors": "none" }] */
// Inlined into index.html by vite.config.js. Runs before any bundle, so it
// stays ES5 and depends on nothing.
(function () {
  var w = window;
  var d = document;
  var API = '__API_ORIGIN__';
  var started = false;

  w.__build = '__BUILD__';

  // The intro loader belongs to the public pages only.
  if (!new RegExp('__PUBLIC_PATHS__', 'i').test(location.pathname)) {
    d.documentElement.setAttribute('data-boot-off', '');
  }

  function report(kind, message, source) {
    try {
      if (!API || !navigator.sendBeacon) return;
      var body = JSON.stringify({
        kind: kind,
        message: String(message).slice(0, 500),
        source: source,
        path: location.pathname,
        viewport: w.innerWidth + 'x' + w.innerHeight,
        build: w.__build,
      });
      navigator.sendBeacon(
        API + '/api/client-errors',
        new Blob([body], { type: 'application/json' })
      );
    } catch (e) {
      // Reporting is best effort.
    }
  }

  // Same key as src/utils/chunkRecovery.js, so both count as one reload.
  function reloadOnce() {
    try {
      var last = Number(sessionStorage.getItem('reload-at')) || 0;
      if (Date.now() - last < 30000) return false;
      sessionStorage.setItem('reload-at', String(Date.now()));
    } catch (e) {
      return false;
    }
    location.reload();
    return true;
  }

  function showNote() {
    var note = d.getElementById('boot-note');
    if (note) note.style.display = 'block';
  }

  function failed(kind, message, source) {
    if (started) return;
    report(kind, message, source);
    if (!reloadOnce()) showNote();
  }

  // Capture phase: load errors on scripts and stylesheets do not bubble.
  w.addEventListener(
    'error',
    function (event) {
      var el = event.target;
      if (el && el !== w) {
        var critical =
          el.tagName === 'SCRIPT' ||
          (el.tagName === 'LINK' && /stylesheet|modulepreload/.test(el.rel));
        if (critical) failed('chunk', 'Failed to load', el.src || el.href);
        return;
      }
      // Only this site's own bundles; an extension's error is not ours to act on.
      var file = event.filename || '';
      if (file.indexOf(location.origin + '/assets/') === 0) {
        failed('boot', event.message, file);
      }
    },
    true
  );

  var timer = setTimeout(function () {
    if (started) return;
    report('boot', 'Not started after 10s');
    showNote();
  }, 10000);

  // Called by src/main.jsx once the app has rendered.
  w.__appStarted = function () {
    started = true;
    clearTimeout(timer);
  };
})();
