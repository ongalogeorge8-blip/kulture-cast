/* Tap-to-play YouTube players, real playback signals and existing floating-player controls. */
(function () {
  'use strict';
  const slot = document.getElementById('kc-video-slot');
  const surface = document.getElementById('kc-video-surface');
  const toggle = document.getElementById('kc-pip-toggle');
  const close = document.getElementById('kc-pip-close');
  const pending = new Map(), players = new Map();
  let frame = null, player = null, playing = false, inView = true, manual = false, dismissed = false;

  // Keep YouTube's minimum player height on narrow screens; the notice is outside
  // the iframe, so it never covers its controls. The normal desktop size is unchanged.
  const style = document.createElement('style');
  style.textContent = '.episode-player,#player.player{width:100%;min-height:200px}' +
    '.kc-video-slot{width:100%;aspect-ratio:auto;min-height:200px}' +
    '.kc-video-slot.kc-slot-floating{aspect-ratio:16/9;margin-bottom:50px}' +
    '.kc-video-help{background:#171511;color:#fff;padding:10px 12px;font:14px/1.4 sans-serif}' +
    '.kc-video-help a{color:#fff;text-decoration:underline;font-weight:700}' +
    '.kc-video-help a:focus-visible{outline:3px solid #f4ad3d;outline-offset:3px}' +
    '.kc-video-help[hidden]{display:none}';
  document.head.appendChild(style);

  function floatVideo(on) {
    if (!surface) return;
    surface.classList.toggle('is-floating', on);
    if (slot) slot.classList.toggle('kc-slot-floating', on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? 'Return to page' : 'Picture-in-picture';
    close.hidden = !on;
  }
  function reconcile() { if (!manual) floatVideo(playing && !inView && !dismissed); }
  if (toggle) toggle.addEventListener('click', function () {
    if (!frame) return;
    const on = !surface.classList.contains('is-floating');
    manual = on; dismissed = !on; floatVideo(on);
    if (!on) slot.scrollIntoView({ block: 'center', behavior: 'auto' });
  });
  if (close) close.addEventListener('click', function () {
    manual = false; dismissed = true; playing = false;
    const item = frame && pending.get(frame.id);
    if (item) {
      clearTimeout(item.timer);
      item.help.hidden = true;
      item.suppressHelp = true;
      if (!item.isReady) {
        // Removing the not-yet-ready iframe also stops its own autoplay=1 navigation.
        // Restore the original button for another explicit attempt; ignore late events.
        item.cancelled = true;
        pending.delete(frame.id);
        players.delete(frame.id);
        item.container.replaceChildren(item.placeholder);
        item.help.remove();
        item.button.disabled = false;
        frame = null; player = null; toggle.disabled = true;
      }
    }
    if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
    else if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube-nocookie.com');
    floatVideo(false);
    if (toggle.disabled && item) item.button.focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
  });
  if (slot && 'IntersectionObserver' in window) new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) dismissed = false;
    reconcile();
  }, { threshold: 0 }).observe(slot);

  function showHelp(item, error) {
    if (!item.cancelled && !item.suppressHelp && (error || !item.hasPlayed)) item.help.hidden = false;
  }
  function ready() {
    if (!window.YT || typeof window.YT.Player !== 'function') return;
    pending.forEach(function (item, id) {
      if (players.has(id) || item.cancelled) return;
      const instance = new window.YT.Player(id, { events: { onReady: function (event) {
        if (item.cancelled) {
          if (event.target && typeof event.target.pauseVideo === 'function') event.target.pauseVideo();
          return;
        }
        item.isReady = true;
        // Playback was requested by the visitor's explicit click, never on page load.
        if (event.target && typeof event.target.playVideo === 'function') event.target.playVideo();
      }, onStateChange: function (event) {
        if (item.cancelled) return;
        const isPlaying = event.data === window.YT.PlayerState.PLAYING;
        if (isPlaying) {
          item.hasPlayed = true;
          item.suppressHelp = false;
          clearTimeout(item.timer);
          item.help.hidden = true;
          if (window.kcAnalytics) window.kcAnalytics.videoStart(item.videoId);
        }
        if (id === 'kc-latest-player') {
          playing = isPlaying;
          if (playing) dismissed = false;
          reconcile();
        }
      }, onError: function () { showHelp(item, true); },
      onAutoplayBlocked: function () { showHelp(item); }
      } });
      players.set(id, instance);
      if (id === 'kc-latest-player') player = instance;
    });
  }
  let callbackInstalled = false;
  function connect(f, item) {
    pending.set(f.id, item);
    item.timer = setTimeout(function () { showHelp(item); }, 8000);
    f.addEventListener('load', ready);
    if (!callbackInstalled) {
      callbackInstalled = true;
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previous === 'function') previous();
        ready();
      };
    }
    if (window.YT && typeof window.YT.Player === 'function') ready();
    else if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; s.async = true; document.head.appendChild(s);
    }
  }
  document.querySelectorAll('.kc-load-video, #load-video').forEach(function (button) {
    // Make the action clear: this click now requests playback as well as loading.
    button.textContent = button.id === 'load-video' ? 'Play episode' : button.textContent.replace(/^Load /, 'Play ').replace(/ player$/, '');
    button.addEventListener('click', function () {
      if (button.disabled) return;
      button.disabled = true;
      const u = new URL(button.dataset.src);
      const videoId = u.pathname.split('/').pop();
      u.searchParams.set('enablejsapi', '1');
      u.searchParams.set('autoplay', '1');
      u.searchParams.set('playsinline', '1');
      u.searchParams.set('origin', location.origin);
      const f = document.createElement('iframe');
      // This iframe exists only after a click, so do not defer its navigation.
      f.loading = 'eager';
      f.src = u.href; f.title = button.dataset.title;
      f.id = button.dataset.playerId || 'kc-episode-player-' + videoId;
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.setAttribute('width', '1120'); f.setAttribute('height', '630');
      const container = button.closest('.episode-player') || document.getElementById('player');
      const placeholder = button.parentElement;
      // Use the same existing YouTube watch URL already provided for this video.
      const watch = Array.from(document.querySelectorAll('a[href]')).find(function (link) {
        try { const url = new URL(link.href); return url.hostname === 'www.youtube.com' && url.pathname === '/watch' && url.searchParams.get('v') === videoId; }
        catch (_) { return false; }
      });
      const help = document.createElement('div');
      help.className = 'kc-video-help'; help.setAttribute('role', 'status'); help.setAttribute('aria-live', 'polite'); help.hidden = true;
      help.appendChild(document.createTextNode('Video not playing? Check your connection or tap play in the player. '));
      if (watch) {
        const link = document.createElement('a');
        link.href = watch.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Watch on YouTube';
        help.appendChild(link);
      }
      container.replaceChildren(f);
      container.insertAdjacentElement('afterend', help);
      if (f.id === 'kc-latest-player') { frame = f; toggle.disabled = false; }
      if (window.kcAnalytics) window.kcAnalytics.videoLoad(videoId);
      connect(f, { videoId: videoId, container: container, placeholder: placeholder, button: button, help: help, isReady: false, hasPlayed: false, cancelled: false });
      f.focus();
    });
  });
})();
