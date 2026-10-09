/* Shared navigator for Rekha's five worlds. Auto-injected pill: prev · dots · home · next.
   Supports ?next=A,F chain from the main page routes, plus keys H / arrows / 1-5. */
(function () {
  'use strict';
  if (window.__rekhaNav) return; window.__rekhaNav = true;

  var PATHS = [
    { id: 'R', no: '01', title: 'The Bloom Film', sub: 'frame by frame' },
    { id: 'S', no: '02', title: 'The Quiet Letter', sub: 'words first' },
    { id: 'F', no: '03', title: 'A Small World', sub: 'come play' },
    { id: 'A', no: '04', title: 'The Quiet Walk', sub: 'two minutes' },
    { id: 'M', no: '05', title: 'Heart of Light', sub: 'one breath' }
  ];
  function currentId() {
    try {
      var m = window.location.pathname.match(/\/([AFMRS])(?:\/index\.html|\/)?$/i);
      if (m) return m[1].toUpperCase();
      var q = (window.location.search || '').toUpperCase();
      var qm = q.match(/PATH=([AFMRS])/); if (qm) return qm[1];
    } catch (e) {}
    return null;
  }
  var cur = currentId();
  var idx = -1;
  for (var i = 0; i < PATHS.length; i++) if (PATHS[i].id === cur) idx = i;

  // ?next= chain (from main-page routes)
  var chain = [];
  try {
    var p = new URLSearchParams(window.location.search);
    var nx = p.get('next');
    if (nx) chain = nx.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(function (s) { return /[AFMRS]/.test(s); });
  } catch (e) {}
  function withChain(href) {
    if (!chain.length) return href;
    var sep = href.indexOf('?') >= 0 ? '&' : '?';
    return href + sep + 'next=' + encodeURIComponent(chain.join(','));
  }
  function nextInChain() {
    if (!chain.length) return null;
    return chain[0];
  }
  function consumeChainForNext() {
    // next page gets the remainder of the chain
    if (chain.length <= 1) return '';
    return '?next=' + encodeURIComponent(chain.slice(1).join(','));
  }

  var prev = idx > 0 ? PATHS[idx - 1] : null;
  var next = nextInChain() ? PATHS.filter(function (x) { return x.id === nextInChain(); })[0]
                           : (idx >= 0 && idx < PATHS.length - 1 ? PATHS[idx + 1] : null);

  function visitedMap() {
    try {
      var raw = localStorage.getItem('rekha-progress-v1');
      if (!raw) return {};
      return JSON.parse(raw).visited || {};
    } catch (e) { return {}; }
  }
  function soundWasOn() {
    try { return localStorage.getItem('rekha-sound') === 'on'; } catch (e) { return false; }
  }
  var visited = visitedMap();
  var totalVisited = PATHS.filter(function (p) { return !!visited[p.id]; }).length;

  var nav = document.createElement('nav');
  nav.id = 'rekha-nav';
  nav.setAttribute('aria-label', 'Wander between worlds');
  var dots = PATHS.map(function (p) {
    var v = visited[p.id] ? ' ✓' : '';
    return '<a href="' + withChain('../' + p.id + '/index.html') + '" data-p="' + p.id + '" class="' + (p.id === cur ? 'on' : '') + '" title="' + p.title + ' — ' + p.sub + v + '">' + p.no.slice(1) + '</a>';
  }).join('');
  var menuItems = PATHS.map(function (p) {
    var v = visited[p.id] ? ' <em style="opacity:.7">· ♥ wandered</em>' : '';
    return '<a href="' + withChain('../' + p.id + '/index.html') + '"><small>' + p.no + '</small><span>' + p.title + ' <em style="opacity:.6">— ' + p.sub + '</em>' + v + '</span></a>';
  }).join('');
  var routeNote = '';
  if (chain.length) {
    var doneCount = chain.filter(function (id) { return !!visited[id]; }).length;
    var curPos = chain.indexOf(cur) >= 0 ? chain.indexOf(cur) + 1 : 0;
    routeNote = '<div class="rn-route">route ' + (curPos ? curPos + ' of ' + chain.length + ' · ' : '') + doneCount + '/' + chain.length + ' wandered → ' + chain.join(' → ') + '</div>';
  } else if (totalVisited > 0) {
    routeNote = '<div class="rn-route">' + totalVisited + '/5 worlds wandered ♥</div>';
  }
  // FIX: Prev preserves ?next= chain (was dropping it and breaking guided routes)
  var prevHref = prev ? withChain('../' + prev.id + '/index.html') : null;
  nav.innerHTML =
    (prev ? '<a class="rn-prev" href="' + prevHref + '" title="Previous: ' + prev.title + '">←</a>' : '') +
    '<button class="rn-home" data-act="menu" aria-expanded="false" aria-haspopup="true" title="All five paths">⌂<span class="rn-t"> paths</span></button>' +
    '<span class="rn-dots">' + dots + '</span>' +
    (cur ? '<span class="rn-label">' + PATHS[idx].title + '</span>' : '') +
    '<button class="rn-sound" data-act="sound" aria-pressed="' + (soundWasOn() ? 'true' : 'false') + '" title="Gentle ambient sound (synth, off by default)">♫</button>' +
    (next ? '<a class="rn-next" href="../' + next.id + '/index.html' + consumeChainForNext() + '" title="Next: ' + next.title + '">→</a>'
          : '<a class="rn-next" href="../index.html" title="Back to the map">⌂</a>') +
    '<div class="rn-menu" role="menu">' + routeNote + menuItems +
    '<a href="../index.html"><small>⌂</small><span>Back to the map <em style="opacity:.6">— all five worlds</em></span></a></div>';

  function mount() { document.body.appendChild(nav); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  // Secret: 5 quick taps on ⌂ reveals a hidden illustrated note (no personal media)
  var homeTaps = 0, homeTimer = null;
  function homeTapSecret() {
    homeTaps++;
    clearTimeout(homeTimer);
    homeTimer = setTimeout(function () { homeTaps = 0; }, 1600);
    if (homeTaps >= 5) {
      homeTaps = 0;
      try {
        var s = document.createElement('div');
        s.setAttribute('role', 'status');
        s.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;background:rgba(20,16,28,.94);border:1px solid rgba(232,200,122,.5);color:#f4ede3;font:italic 15px Georgia,serif;padding:14px 20px;border-radius:16px;max-width:min(90vw,420px);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)';
        s.textContent = 'psst — sixth world: close your eyes, count to three, and I’m already on my way back to you. ♥';
        document.body.appendChild(s);
        setTimeout(function () { s.style.transition = 'opacity 1s'; s.style.opacity = '0'; setTimeout(function () { s.remove(); }, 1100); }, 4200);
        if (window.RekhaSound) window.RekhaSound.chime();
      } catch (e) {}
    }
  }

  document.addEventListener('click', function (e) {
    var sb = e.target.closest ? e.target.closest('[data-act="sound"]') : null;
    if (sb && nav.contains(sb)) {
      e.preventDefault();
      try {
        // Worlds F/A have tailored local engines — forward to them so one button
        // always controls the world's own sound instead of layering two pads.
        var local = document.getElementById('sound-toggle');
        if (local) {
          local.click();
          var localOn = local.getAttribute('aria-pressed') === 'true';
          sb.classList.toggle('on', localOn);
          sb.setAttribute('aria-pressed', localOn ? 'true' : 'false');
          try { localStorage.setItem('rekha-sound', localOn ? 'on' : 'off'); } catch (e2) {}
          return;
        }
        var on = false;
        if (window.RekhaSound) on = window.RekhaSound.toggle(sb);
        else {
          on = sb.getAttribute('aria-pressed') !== 'true';
          sb.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        sb.classList.toggle('on', !!on);
        sb.setAttribute('aria-pressed', on ? 'true' : 'false');
      } catch (err) {}
      return;
    }
    var b = e.target.closest ? e.target.closest('[data-act="menu"]') : null;
    if (b && nav.contains(b)) {
      e.preventDefault();
      homeTapSecret();
      var open = nav.classList.toggle('open');
      try { b.setAttribute('aria-expanded', open ? 'true' : 'false'); } catch (err) {}
      return;
    }
    if (!e.target.closest || !e.target.closest('#rekha-nav')) {
      nav.classList.remove('open');
      try { var hb = nav.querySelector('[data-act="menu"]'); if (hb) hb.setAttribute('aria-expanded', 'false'); } catch (err2) {}
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      nav.classList.remove('open');
      try { var hb2 = nav.querySelector('[data-act="menu"]'); if (hb2) hb2.setAttribute('aria-expanded', 'false'); } catch (err3) {}
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    var k = e.key;
    if (k === 'h' || k === 'H' || k === 'Home') { window.location.href = '../index.html'; }
    else if (k === 'ArrowRight' && next) { window.location.href = '../' + next.id + '/index.html' + consumeChainForNext(); }
    else if (k === 'ArrowLeft' && prev) { window.location.href = '../' + prev.id + '/index.html'; }
    else if (k >= '1' && k <= '5') { window.location.href = '../' + PATHS[Number(k) - 1].id + '/index.html'; }
  });
})();
