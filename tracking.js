/* Kulture Cast: consent-gated, data-minimising Analytics. */
(function () {
  'use strict';
  if (window.kcAnalytics) return;
  const ID = 'G-3C1TYCSFW4';
  const KEY = 'kc_analytics_consent_v2';
  const disable = 'ga-disable-' + ID;
  const notice = document.getElementById('kc-consent');
  const details = document.getElementById('kc-privacy');
  const videos = {
    B8n3CETZu_Y: 'Leadership beyond politics',
    GE6H7DMoaIY: 'Finding your voice in journalism',
    xw13rSLrHWo: 'Beyond a hobby: a creative path'
  };
  let loaded = false, saved = null;
  const started = new Set();
  window[disable] = true;
  function read() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function save(value) { try { localStorage.setItem(KEY, value); } catch (_) {} }
  function campaign() {
    // Fixed, non-personal campaign vocabulary; never forward arbitrary query values.
    const q = new URLSearchParams(location.search);
    const source = q.get('utm_source'), medium = q.get('utm_medium'), name = q.get('utm_campaign');
    if (!['whatsapp', 'youtube', 'instagram', 'tiktok', 'x', 'facebook', 'email'].includes(source) ||
        !['social', 'email', 'referral'].includes(medium) ||
        !['website_growth', 'episode_share', 'services', 'profile'].includes(name)) return {};
    return { campaign_source: source, campaign_medium: medium, campaign_name: name };
  }
  function enable() {
    window[disable] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    let referrer = '';
    try { if (document.referrer) referrer = new URL(document.referrer).origin; } catch (_) {}
    window.gtag('config', ID, Object.assign({
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_expires: 33696000, cookie_path: '/kulture-cast/',
      page_location: location.origin + location.pathname, page_referrer: referrer
    }, campaign()));
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(script);
  }
  function removeCookies() {
    const names = document.cookie.split(';').map(s => s.trim().split('=')[0]).filter(n => /^_ga(?:_|$)/.test(n));
    const domains = ['', location.hostname, '.' + location.hostname];
    names.forEach(n => ['/', '/kulture-cast', '/kulture-cast/'].forEach(path => domains.forEach(domain => {
      document.cookie = n + '=; Max-Age=0; path=' + path + (domain ? '; domain=' + domain : '') + '; SameSite=Lax; Secure';
    })));
  }
  function apply(value) {
    saved = value;
    notice.hidden = value === 'granted' || value === 'denied';
    if (value === 'granted') enable();
    else { window[disable] = true; removeCookies(); }
  }
  function choose(value) { save(value); apply(value); }
  function emit(name, values) {
    if (saved !== 'granted' || window[disable] || typeof window.gtag !== 'function') return false;
    window.gtag('event', name, Object.assign({
      send_to: ID, transport_type: 'beacon',
      page_location: location.origin + location.pathname
    }, values));
    return true;
  }
  function placement(a) {
    if (a.closest('header')) return 'header';
    if (a.closest('footer')) return 'footer';
    if (a.closest('#contact')) return 'contact';
    if (a.closest('#social-work')) return 'social';
    return 'content';
  }
  window.kcAnalytics = Object.freeze({
    videoLoad(id) {
      if (Object.prototype.hasOwnProperty.call(videos, id))
        emit('video_load', { video_provider: 'youtube', video_title: videos[id] });
    },
    videoStart(id) {
      if (!Object.prototype.hasOwnProperty.call(videos, id) || started.has(id)) return;
      if (emit('video_start', { video_provider: 'youtube', video_title: videos[id] })) started.add(id);
    }
  });
  // Only fixed labels are sent. Never send link URLs, contact details, link text or message contents.
  document.addEventListener('click', function (event) {
    const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!a) return;
    let u;
    try { u = new URL(a.href, location.href); } catch (_) { return; }
    let method = '';
    if (u.protocol === 'mailto:') method = 'email';
    else if (u.protocol === 'tel:') method = 'phone';
    else if (['wa.me', 'api.whatsapp.com'].includes(u.hostname)) method = 'whatsapp';
    if (method) {
      emit('contact_click', { contact_method: method, link_placement: placement(a) });
      return;
    }
    const host = u.hostname.replace(/^www\./, '');
    const platform = ({ 'youtube.com': 'youtube', 'youtu.be': 'youtube', 'instagram.com': 'instagram',
      'tiktok.com': 'tiktok', 'x.com': 'x', 'twitter.com': 'x', 'facebook.com': 'facebook' })[host];
    if (platform) emit('social_click', { social_platform: platform, link_placement: placement(a) });
  }, true);
  const controls = document.createElement('div');
  controls.className = 'kc-privacy-footer';
  controls.innerHTML = '<button type="button" class="kc-consent-button" id="kc-preferences">Analytics preferences</button><button type="button" class="kc-consent-button" data-kc-privacy>Privacy details</button>';
  (document.querySelector('footer') || document.body).appendChild(controls);
  function privacy() {
    if (typeof details.showModal === 'function') details.showModal(); else details.setAttribute('open', '');
    document.getElementById('kc-privacy-close').focus();
  }
  document.querySelectorAll('[data-kc-privacy]').forEach(b => b.addEventListener('click', privacy));
  document.getElementById('kc-privacy-close').addEventListener('click', () => {
    if (typeof details.close === 'function') details.close(); else details.removeAttribute('open');
  });
  document.getElementById('kc-accept').addEventListener('click', () => choose('granted'));
  document.getElementById('kc-reject').addEventListener('click', () => choose('denied'));
  document.getElementById('kc-preferences').addEventListener('click', () => {
    notice.hidden = false; document.getElementById('kc-accept').focus();
  });
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) apply(read());
  });
  apply(read());
})();
