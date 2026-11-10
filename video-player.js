/* Tap-to-play YouTube players, real playback signals and existing floating-player controls. */
(function () {
  'use strict';
  const slot = document.getElementById('kc-video-slot');
  const surface = document.getElementById('kc-video-surface');
  const toggle = document.getElementById('kc-pip-toggle');
  const close = document.getElementById('kc-pip-close');
  const pending = new Map(), players = new Map();
  let frame = null, player = null, playing = false, inView = true, manual = false, dismissed = false;
  function floatVideo(on) {
    if (!surface) return;
    surface.classList.toggle('is-floating', on);
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
    if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
    else if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube-nocookie.com');
    floatVideo(false); toggle.focus({ preventScroll: true });
  });
  if (slot && 'IntersectionObserver' in window) new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) dismissed = false;
    reconcile();
  }, { threshold: 0 }).observe(slot);
  function ready() {
    if (!window.YT || typeof window.YT.Player !== 'function') return;
    pending.forEach(function (item, id) {
      if (players.has(id)) return;
      const instance = new window.YT.Player(id, { events: { onReady: function (event) {
        // Playback was requested by the visitor's explicit click, never on page load.
        if (event.target && typeof event.target.playVideo === 'function') event.target.playVideo();
      }, onStateChange: function (event) {
        const isPlaying = event.data === window.YT.PlayerState.PLAYING;
        if (isPlaying && window.kcAnalytics) window.kcAnalytics.videoStart(item.videoId);
        if (id === 'kc-latest-player') {
          playing = isPlaying;
          if (playing) dismissed = false;
          reconcile();
        }
      } } });
      players.set(id, instance);
      if (id === 'kc-latest-player') player = instance;
    });
  }
  let callbackInstalled = false;
  function connect(f, videoId) {
    pending.set(f.id, { videoId: videoId });
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
      container.replaceChildren(f);
      if (f.id === 'kc-latest-player') { frame = f; toggle.disabled = false; }
      if (window.kcAnalytics) window.kcAnalytics.videoLoad(videoId);
      connect(f, videoId); f.focus();
    });
  });
})();
