/* Browser-facing adapter for the reviewed excerpt response contract. No secrets. */
(function () {
  'use strict';
  const launch=document.getElementById('kcai-launch'), panel=document.getElementById('kcai-panel');
  if (!launch || !panel) return;
  let endpoint;
  const sitekey=window.KC_ARCHIVE_AI_TURNSTILE_SITEKEY;
  try {
    const raw=window.KC_ARCHIVE_AI_ENDPOINT;
    if (typeof raw!=='string' || !raw.trim() || typeof sitekey!=='string' || !/^[A-Za-z0-9_-]{10,100}$/.test(sitekey)) return;
    endpoint=new URL(raw);
    if (endpoint.protocol!=='https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return;
  } catch (_) { return; }
  const close=document.getElementById('kcai-close'), form=document.getElementById('kcai-form');
  const input=document.getElementById('kcai-question'), submit=document.getElementById('kcai-submit');
  const retry=document.getElementById('kcai-retry'), fallback=document.getElementById('kcai-fallback');
  const status=document.getElementById('kcai-status'), results=document.getElementById('kcai-results');
  const widget=document.getElementById('kcai-turnstile'), verifyStatus=document.getElementById('kcai-verify-status'), verifyRetry=document.getElementById('kcai-verify-retry');
  if (!widget || !verifyStatus || !verifyRetry) return;
  const allowedPaths=new Set([
    '/kulture-cast/okot-boniface-henry-leadership-beyond-politics.html',
    '/kulture-cast/journalism-persistence-and-public-responsibility.html',
    '/kulture-cast/amapiano-creative-purpose-and-discipline.html'
  ]);
  let active=null, serial=0, lastQuestion='', token='', widgetId=null, widgetGeneration=0, loadPromise=null, verifyTimer=null;
  function sourceURL(value) {
    if (typeof value!=='string' || value.length>2048) return null;
    try {
      const u=new URL(value);
      if (u.protocol!=='https:' || u.origin!=='https://ongalogeorge8-blip.github.io' || u.username || u.password || u.search || !allowedPaths.has(u.pathname)) return null;
      return u.href;
    } catch (_) { return null; }
  }
  function unpack(data) {
    if (!data || typeof data!=='object' || Array.isArray(data) || data.limited!==true || !Array.isArray(data.excerpts) || data.excerpts.length>3) throw Error('response');
    return data.excerpts.map(function(x){
      if (!x || typeof x!=='object' || typeof x.title!=='string' || !x.title.trim() || x.title.length>500 || typeof x.text!=='string' || !x.text.trim() || x.text.length>3000 || typeof x.kind!=='string' || x.kind.length>100) throw Error('response');
      const url=sourceURL(x.url); if (!url) throw Error('response');
      return {title:x.title, text:x.text, kind:x.kind, url:url};
    });
  }
  function addExcerpt(x) {
    const li=document.createElement('li'), a=document.createElement('a');
    a.href=x.url; a.textContent=x.title; // never render API data as HTML
    const meta=document.createElement('p'); meta.textContent=x.kind+' · Reviewed written excerpt:';
    const text=document.createElement('p'); text.textContent=x.text;
    li.append(a,meta,text); results.append(li);
  }
  function updateControls() {
    submit.disabled=!!active || !token;
    retry.disabled=!!active || !token;
    panel.setAttribute('aria-busy',active?'true':'false');
  }
  function removeWidget() {
    widgetGeneration++; token=''; clearTimeout(verifyTimer); verifyTimer=null;
    if (widgetId!==null && window.turnstile) { try { window.turnstile.remove(widgetId); } catch (_) {} }
    widgetId=null; widget.replaceChildren(); updateControls();
  }
  function loadTurnstile() {
    if (window.turnstile && typeof window.turnstile.render==='function') return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise=new Promise(function(resolve,reject){
      const s=document.createElement('script'); s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async=true;
      let done=false;
      const timer=setTimeout(function(){ finish(false); },15000);
      function finish(ok){ if(done) return; done=true; clearTimeout(timer); s.onload=null; s.onerror=null; if(!ok){s.remove(); reject(Error('verification load'));} else resolve(); }
      s.onload=function(){finish(!!window.turnstile && typeof window.turnstile.render==='function');};
      s.onerror=function(){finish(false);};
      document.head.append(s);
    }).catch(function(e){loadPromise=null;throw e;});
    return loadPromise;
  }
  async function startVerification() {
    removeWidget();
    const generation=widgetGeneration;
    if (panel.hidden) return;
    verifyRetry.hidden=true; verifyStatus.textContent='Loading Cloudflare security verification…';
    try {
      await loadTurnstile();
      if (generation!==widgetGeneration || panel.hidden) return;
      verifyStatus.textContent='Complete the security check if prompted.';
      verifyTimer=setTimeout(function(){ if(generation!==widgetGeneration || panel.hidden || token) return; verifyStatus.textContent='Security check is taking longer than expected. Complete it, retry verification, or use keyword search.'; verifyRetry.hidden=false; updateControls(); },30000);
      widgetId=window.turnstile.render(widget,{
        sitekey:sitekey, action:'kc_archive_question', size:'compact', theme:'auto',
        retry:'never', 'refresh-expired':'never', 'refresh-timeout':'never',
        callback:function(value){
          if (generation!==widgetGeneration || panel.hidden || active) return;
          clearTimeout(verifyTimer); verifyTimer=null;
          if (typeof value!=='string' || !value || value.length>2048) { widgetGeneration++; token=''; verifyStatus.textContent='Verification failed. Please retry or use keyword search.'; verifyRetry.hidden=false; updateControls(); return; }
          token=value; verifyRetry.hidden=true; verifyStatus.textContent='Security check complete.'; updateControls();
        },
        'expired-callback':function(){ if(generation!==widgetGeneration || panel.hidden) return; clearTimeout(verifyTimer); verifyTimer=null; widgetGeneration++; token=''; verifyStatus.textContent='Security check expired. Please retry verification.'; verifyRetry.hidden=false; updateControls(); },
        'timeout-callback':function(){ if(generation!==widgetGeneration || panel.hidden) return; clearTimeout(verifyTimer); verifyTimer=null; widgetGeneration++; token=''; verifyStatus.textContent='Security check timed out. Please retry verification.'; verifyRetry.hidden=false; updateControls(); },
        'error-callback':function(){ if(generation!==widgetGeneration || panel.hidden) return true; clearTimeout(verifyTimer); verifyTimer=null; widgetGeneration++; token=''; verifyStatus.textContent='Security check unavailable. Please retry verification or use keyword search.'; verifyRetry.hidden=false; updateControls(); return true; }
      });
      if (widgetId===null || widgetId===undefined) throw Error('widget');
    } catch (_) {
      if (generation!==widgetGeneration || panel.hidden) return;
      clearTimeout(verifyTimer); verifyTimer=null; token=''; verifyStatus.textContent='Security check unavailable. Please retry verification or use keyword search.'; verifyRetry.hidden=false; updateControls();
    }
  }
  async function ask(question) {
    if (active || panel.hidden) return;
    const q=question.trim();
    results.replaceChildren(); retry.hidden=true;
    if (q.length<3 || q.length>300 || /[\u0000-\u001f\u007f]/.test(q)) {
      status.textContent='Enter a question of 3–300 characters on one line.'; input.focus(); return;
    }
    if (!token) { status.textContent='Complete the security check before submitting, or use keyword search.'; return; }
    lastQuestion=q;
    const requestToken=token, controller=new AbortController(), requestId=++serial;
    active=controller; removeWidget(); updateControls();
    verifyStatus.textContent='Security check used for this request.';
    status.textContent='Looking for reviewed excerpts…';
    let timedOut=false;
    const timer=setTimeout(function(){timedOut=true;controller.abort();},20000);
    try {
      const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,token:requestToken}),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',signal:controller.signal});
      if (!response.ok) { const e=Error('http'); e.status=response.status; throw e; }
      if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')||'')) throw Error('response');
      const raw=await response.text(); if (raw.length>20000) throw Error('response');
      const excerpts=unpack(JSON.parse(raw));
      if (requestId!==serial) return;
      if (!excerpts.length) status.textContent='No confident match in the reviewed articles. Try another question or use keyword search.';
      else { excerpts.forEach(addExcerpt); status.textContent='AI-selected written excerpts. Check the linked articles for context; selection can be wrong.'; }
    } catch (e) {
      if (requestId!==serial) return;
      status.textContent=e.status===429 ? 'The assistant has reached its usage limit. Please try again later or use keyword search.' : timedOut ? 'The assistant took too long to respond. Please retry or use keyword search.' : 'The assistant is unavailable or returned an unexpected response. Please retry or use keyword search.';
      retry.hidden=false;
    } finally {
      clearTimeout(timer);
      if (requestId===serial) {active=null;updateControls(); if(!panel.hidden) startVerification();}
    }
  }
  const preloadNotice=document.getElementById('kcai-preload');
  if (preloadNotice) preloadNotice.hidden=false;
  launch.hidden=false; updateControls();
  launch.addEventListener('click',function(){panel.hidden=false;launch.setAttribute('aria-expanded','true');input.focus();startVerification();});
  function dismiss(){
    serial++; if(active){active.abort();active=null;} removeWidget(); panel.hidden=true; updateControls();
    input.value=''; lastQuestion=''; retry.hidden=true; verifyRetry.hidden=true; verifyStatus.textContent=''; status.textContent=''; results.replaceChildren();
    launch.setAttribute('aria-expanded','false'); launch.focus();
  }
  close.addEventListener('click',dismiss);
  panel.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}});
  form.addEventListener('submit',function(e){e.preventDefault();ask(input.value);});
  retry.addEventListener('click',function(){ask(lastQuestion);});
  verifyRetry.addEventListener('click',startVerification);
  fallback.addEventListener('click',function(){
    dismiss(); const button=document.getElementById('kca-launch');
    if (button) { if (document.getElementById('kca-panel').hidden) button.click(); else document.getElementById('kca-query').focus(); }
  });
})();
