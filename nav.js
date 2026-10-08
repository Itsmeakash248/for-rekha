/* Shared navigator for Rekha's five worlds. Auto-injected pill: prev · dots · home · next.
   Supports ?next=A,F chain from the main page routes, plus keys H / arrows / 1-5. */
(function () {
  'use strict';
  if (window.__rekhaNav) return; window.__rekhaNav = true;

  var PATHS = [
    { id: 'S', no: '01', title: 'The Quiet Letter', sub: 'words first' },
    { id: 'R', no: '02', title: 'The Bloom Film', sub: 'frame by frame' },
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

  var nav = document.createElement('nav');
  nav.id = 'rekha-nav';
  nav.setAttribute('aria-label', 'Wander between worlds');
  var dots = PATHS.map(function (p) {
    return '<a href="' + withChain('../' + p.id + '/index.html') + '" data-p="' + p.id + '" class="' + (p.id === cur ? 'on' : '') + '" title="' + p.title + ' — ' + p.sub + '">' + p.no.slice(1) + '</a>';
  }).join('');
  var menuItems = PATHS.map(function (p) {
    return '<a href="' + withChain('../' + p.id + '/index.html') + '"><small>' + p.no + '</small><span>' + p.title + ' <em style="opacity:.6">— ' + p.sub + '</em></span></a>';
  }).join('');
  var routeNote = chain.length ? '<div class="rn-route">route continues → ' + chain.join(' → ') + '</div>' : '';
  nav.innerHTML =
    (prev ? '<a class="rn-prev" href="../' + prev.id + '/index.html" title="Previous: ' + prev.title + '">←</a>' : '') +
    '<button class="rn-home" data-act="menu" aria-expanded="false" aria-haspopup="true" title="All five paths">⌂ paths</button>' +
    '<span class="rn-dots">' + dots + '</span>' +
    (cur ? '<span class="rn-label">' + PATHS[idx].title + '</span>' : '') +
    (next ? '<a class="rn-next" href="../' + next.id + '/index.html' + consumeChainForNext() + '" title="Next: ' + next.title + '">→</a>'
          : '<a class="rn-next" href="../index.html" title="Back to the map">⌂</a>') +
    '<div class="rn-menu" role="menu">' + routeNote + menuItems +
    '<a href="../index.html"><small>⌂</small><span>Back to the map <em style="opacity:.6">— all five worlds</em></span></a></div>';

  function mount() { document.body.appendChild(nav); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act="menu"]') : null;
    if (b && nav.contains(b)) {
      e.preventDefault();
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
