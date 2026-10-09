/* Shared journey glue for Rekha's five worlds. No backend. localStorage only. */
(function () {
  'use strict';
  var KEY = 'rekha-progress-v1';
  var ORDER = ['R', 'S', 'F', 'A', 'M'];
  var TITLES = { S: 'The Quiet Letter', R: 'The Bloom Film', F: 'A Small World', A: 'The Quiet Walk', M: 'Heart of Light' };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { visited: {}, visits: {}, firstSeen: Date.now() };
      var d = JSON.parse(raw);
      d.visited = d.visited || {}; d.visits = d.visits || {};
      return d;
    } catch (e) { return { visited: {}, visits: {}, firstSeen: Date.now() }; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }
  function currentId() {
    try {
      var m = window.location.pathname.match(/\/([AFMRS])(?:\/index\.html|\/)?$/i);
      if (m) return m[1].toUpperCase();
    } catch (e) {}
    return null;
  }

  var state = load();
  var cur = currentId();

  // Mark current world visited (M counts only after 8s — must actually watch the heart)
  function mark(id) {
    if (!id || ORDER.indexOf(id) < 0) return;
    state.visited[id] = Date.now();
    state.visits[id] = (state.visits[id] || 0) + 1;
    state.last = id;
    save(state);
    document.dispatchEvent(new CustomEvent('rekha:progress', { detail: { visited: state.visited } }));
  }
  if (cur === 'M') {
    setTimeout(function () { mark('M'); paint(); }, 8000);
  } else if (cur) {
    // mark after a real read, not instant bounce
    setTimeout(function () { mark(cur); paint(); }, 4000);
  }

  function count() { return ORDER.filter(function (id) { return !!state.visited[id]; }).length; }
  function leastVisited() {
    var un = ORDER.filter(function (id) { return !state.visited[id]; });
    if (un.length) return un;
    // all visited — return least-frequent first
    return ORDER.slice().sort(function (a, b) { return (state.visits[a] || 0) - (state.visits[b] || 0); });
  }
  function smartPick() {
    var pool = leastVisited();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Paint visited hearts on hub cards + route checkmarks
  function paint() {
    var n = count();
    try {
      document.querySelectorAll('[data-key]').forEach(function (card) {
        var k = card.getAttribute('data-key'); // 1-5 on hub
        var id = ORDER[Number(k) - 1];
        if (id && state.visited[id] && !card.querySelector('.visited-heart')) {
          var s = document.createElement('span');
          s.className = 'visited-heart';
          s.textContent = ' ♥ visited';
          s.setAttribute('aria-label', 'Already visited');
          var no = card.querySelector('.card-no');
          if (no) no.appendChild(s);
        }
      });
      // route buttons: append checkmarks
      document.querySelectorAll('[data-route]').forEach(function (btn) {
        var seq = (btn.getAttribute('data-route') || '').split(',');
        var done = seq.filter(function (id) { return state.visited[id.trim().toUpperCase()]; }).length;
        if (done > 0 && !btn.querySelector('.route-done')) {
          var em = document.createElement('span');
          em.className = 'route-done';
          em.textContent = ' · ' + done + '/' + seq.length + ' wandered';
          btn.appendChild(em);
        }
      });
      // finale ring intensify after >=2 paths
      var ring = document.querySelector('.finale-ring');
      if (ring && n >= 2) ring.textContent = '♥ ready when you are';
      // completion ceremony hook
      if (n >= 5) document.body.classList.add('all-wandered');
    } catch (e) {}
  }

  // Smart shuffle hookup (hub #shuffle)
  function hookShuffle() {
    var b = document.getElementById('shuffle');
    if (!b || b.dataset.smart) return;
    b.dataset.smart = '1';
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      var pick = smartPick();
      window.location.href = pick + '/index.html';
    });
  }

  // Expose
  window.RekhaProgress = { state: state, count: count, leastVisited: leastVisited, smartPick: smartPick, mark: mark, paint: paint, ORDER: ORDER, TITLES: TITLES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paint(); hookShuffle(); });
  else { paint(); hookShuffle(); }
})();
