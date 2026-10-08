/* For Rekha — interaction + motion engine. Vanilla JS, no build. */
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasST = typeof window.ScrollTrigger !== 'undefined';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- loader ---------- */
  function hideLoader() { var l = $('#loader'); if (l) l.classList.add('done'); }
  window.addEventListener('load', function () { setTimeout(hideLoader, 500); });
  setTimeout(hideLoader, 3500);

  /* ---------- quiet generative sound (no files, starts only on toggle) ---------- */
  var audio = { ctx: null, master: null, on: false, chimeTimer: null };
  function buildAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      var ctx = new AC();
      var master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      // soft pad: two detuned triangles through lowpass
      var filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 620; filt.Q.value = 0.4;
      filt.connect(master);
      [174.6, 261.6, 349.2].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f;
        o.detune.value = (i - 1) * 4;
        var g = ctx.createGain(); g.gain.value = i === 2 ? 0.05 : 0.08;
        o.connect(g); g.connect(filt); o.start();
      });
      // airy noise (wind) — looped buffer, very low
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
      var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 480; nf.Q.value = 0.6;
      var ng = ctx.createGain(); ng.gain.value = 0.028;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      var lg = ctx.createGain(); lg.gain.value = 0.014;
      lfo.connect(lg); lg.connect(ng.gain);
      noise.connect(nf); nf.connect(ng); ng.connect(master); noise.start(); lfo.start();
      audio.ctx = ctx; audio.master = master;
      return true;
    } catch (e) { return false; }
  }
  function chime() {
    if (!audio.ctx || !audio.on) return;
    try {
      var ctx = audio.ctx, t = ctx.currentTime;
      var notes = [523.25, 587.33, 659.25, 783.99];
      var f = notes[Math.floor(Math.random() * notes.length)];
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + 3.4);
    } catch (e) {}
  }
  var soundBtn = $('#sound-toggle'), soundLabel = $('#sound-label');
  if (soundBtn) soundBtn.addEventListener('click', function () {
    if (!audio.ctx) { if (!buildAudio()) { soundLabel.textContent = 'sound unavailable'; return; } }
    try {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      audio.on = !audio.on;
      soundBtn.setAttribute('aria-pressed', audio.on ? 'true' : 'false');
      soundLabel.textContent = audio.on ? 'quiet sound on' : 'quiet sound off';
      var t = audio.ctx.currentTime;
      audio.master.gain.cancelScheduledValues(t);
      audio.master.gain.linearRampToValueAtTime(audio.on ? 0.5 : 0.0001, t + 1.2);
      if (audio.on) { chime(); audio.chimeTimer = setInterval(chime, 9000); }
      else if (audio.chimeTimer) { clearInterval(audio.chimeTimer); audio.chimeTimer = null; }
    } catch (e) {}
  });

  /* ---------- canvas particle world (typed arrays) ---------- */
  var canvas = $('#cosmos'), ctx2d = canvas ? canvas.getContext('2d') : null;
  var saveDataA = false;
  try { saveDataA = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  var DPR = Math.min(window.devicePixelRatio || 1, (isMobile || saveDataA) ? 1.5 : 2);
  var W = 0, H = 0;
  function sizeCanvas() {
    if (!canvas) return;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    if (ctx2d) ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  sizeCanvas(); window.addEventListener('resize', sizeCanvas);
  try { window.addEventListener('orientationchange', function () { setTimeout(sizeCanvas, 120); }); } catch (e2) {}

  var DENSITY = saveDataA ? 50 : (isMobile ? 90 : 210);
  var px = new Float32Array(DENSITY), py = new Float32Array(DENSITY),
      vx = new Float32Array(DENSITY), vy = new Float32Array(DENSITY),
      sz = new Float32Array(DENSITY), al = new Float32Array(DENSITY),
      ph = new Float32Array(DENSITY), tp = new Uint8Array(DENSITY);
  function seedParticles() {
    for (var i = 0; i < DENSITY; i++) {
      px[i] = Math.random() * W; py[i] = Math.random() * H;
      ph[i] = Math.random() * Math.PI * 2;
      if (i < DENSITY * 0.35) { tp[i] = 0; sz[i] = 0.6 + Math.random() * 1.4; al[i] = 0.25 + Math.random() * 0.6; vx[i] = 0; vy[i] = 0; }
      else if (i < DENSITY * 0.7) { tp[i] = 1; sz[i] = 1.5 + Math.random() * 3; al[i] = 0.15 + Math.random() * 0.5; vx[i] = (Math.random() - 0.5) * 0.25; vy[i] = -0.08 - Math.random() * 0.22; }
      else if (i < DENSITY * 0.85) { tp[i] = 2; sz[i] = 8 + Math.random() * 14; al[i] = 0; vx[i] = -1.4 - Math.random(); vy[i] = 3 + Math.random() * 3; }
      else { tp[i] = 3; sz[i] = 3 + Math.random() * 5; al[i] = 0; vx[i] = (Math.random() - 0.5) * 0.5; vy[i] = 0.3 + Math.random() * 0.6; }
    }
  }
  seedParticles();
  var sceneIdx = 1, bloomOn = false, rainAmt = 0, petalAmt = 0, moteGlow = 1;
  var petalBodies = []; // Matter-driven petals drawn on canvas

  function drawCosmos(t) {
    if (!ctx2d || document.hidden) return;
    ctx2d.clearRect(0, 0, W, H);
    // rain only in journey
    var targetRain = (sceneIdx === 3 && !reduced) ? 0.5 : 0;
    rainAmt += (targetRain - rainAmt) * 0.03;
    var targetPetal = (bloomOn || sceneIdx >= 5) ? 0.85 : (sceneIdx === 4 ? 0.3 : 0);
    petalAmt += (targetPetal - petalAmt) * 0.02;
    var i, x, y;
    for (i = 0; i < DENSITY; i++) {
      var k = tp[i];
      if (k === 0) { // stars
        var tw = 0.55 + 0.45 * Math.sin(t * 0.001 + ph[i]);
        ctx2d.globalAlpha = al[i] * tw * (sceneIdx >= 4 ? 0.5 : 1);
        ctx2d.fillStyle = '#EDE8DC';
        ctx2d.beginPath(); ctx2d.arc(px[i], py[i], sz[i], 0, 6.283); ctx2d.fill();
      } else if (k === 1) { // motes / fireflies
        px[i] += vx[i] + Math.sin(t * 0.0004 + ph[i]) * 0.2;
        py[i] += vy[i] + Math.cos(t * 0.0005 + ph[i]) * 0.15;
        if (py[i] < -10) { py[i] = H + 10; px[i] = Math.random() * W; }
        if (px[i] < -10) px[i] = W + 10; if (px[i] > W + 10) px[i] = -10;
        var pulse = 0.5 + 0.5 * Math.sin(t * 0.0012 + ph[i] * 3);
        ctx2d.globalAlpha = al[i] * (0.35 + pulse * 0.65) * moteGlow;
        var g = ctx2d.createRadialGradient(px[i], py[i], 0, px[i], py[i], sz[i] * 4);
        var warm = bloomOn || sceneIdx >= 4;
        g.addColorStop(0, warm ? 'rgba(255,233,184,.9)' : 'rgba(200,215,230,.75)');
        g.addColorStop(1, 'rgba(240,199,120,0)');
        ctx2d.fillStyle = g;
        ctx2d.beginPath(); ctx2d.arc(px[i], py[i], sz[i] * 4, 0, 6.283); ctx2d.fill();
      } else if (k === 2) { // rain streaks
        ctx2d.globalAlpha = rainAmt * 0.5;
        if (ctx2d.globalAlpha > 0.02) {
          px[i] += vx[i]; py[i] += vy[i];
          if (py[i] > H + 20) { py[i] = -20; px[i] = Math.random() * (W + 100); }
          ctx2d.strokeStyle = '#8EA2B8'; ctx2d.lineWidth = 1;
          ctx2d.beginPath(); ctx2d.moveTo(px[i], py[i]); ctx2d.lineTo(px[i] - 4, py[i] - sz[i]); ctx2d.stroke();
        }
      } else { // ambient drifting petals
        ctx2d.globalAlpha = petalAmt * 0.8;
        if (ctx2d.globalAlpha > 0.02) {
          px[i] += vx[i] + Math.sin(t * 0.001 + ph[i]) * 0.4;
          py[i] += vy[i];
          if (py[i] > H + 12) { py[i] = -12; px[i] = Math.random() * W; }
          ctx2d.fillStyle = (i % 2) ? '#D9A6A0' : '#F0C778';
          ctx2d.save(); ctx2d.translate(px[i], py[i]); ctx2d.rotate(ph[i] + t * 0.0004);
          ctx2d.beginPath(); ctx2d.ellipse(0, 0, sz[i], sz[i] * 0.55, 0, 0, 6.283); ctx2d.fill(); ctx2d.restore();
        } else { ctx2d.globalAlpha = 0; }
      }
    }
    // Matter pile-up petals (climax burst) drawn with real rotation
    if (petalBodies.length) {
      for (var j = 0; j < petalBodies.length; j++) {
        var b = petalBodies[j]; if (!b || !b.position) continue;
        var sx = b.position.x / 100 * W, sy = b.position.y / 100 * H;
        if (sy < -30 || sy > H + 30) continue;
        ctx2d.globalAlpha = 0.92;
        ctx2d.save(); ctx2d.translate(sx, sy); ctx2d.rotate(b.angle || 0);
        ctx2d.fillStyle = b.plugin && b.plugin.color ? b.plugin.color : '#E8A7A0';
        var s = b.circleRadius ? b.circleRadius / 100 * W * 0.5 : 5;
        ctx2d.beginPath(); ctx2d.ellipse(0, 0, Math.max(3, s), Math.max(2, s * 0.6), 0, 0, 6.283); ctx2d.fill();
        ctx2d.restore();
      }
      ctx2d.globalAlpha = 1;
    }
    ctx2d.globalAlpha = 1;
  }

  // main rAF (canvas + leaf sync + petal engine step)
  var leafSync = null, petalEngine = null;
  function loop(t) {
    drawCosmos(t || 0);
    if (leafSync) { try { leafSync(); } catch (e) {} }
    if (petalEngine && bloomOn && !document.hidden) {
      try { window.Matter.Engine.update(petalEngine, 1000 / 60); } catch (e) {}
    }
    requestAnimationFrame(loop);
  }
  if (!reduced) requestAnimationFrame(loop);
  else if (ctx2d) { drawCosmos(0); }

  document.addEventListener('visibilitychange', function () { sizeCanvas(); });

  /* ---------- reduced-motion fallback: readable, no pins ---------- */
  if (reduced || !hasGSAP || !hasST) {
    document.body.classList.add('reduced');
    try {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('in'); });
      }, { threshold: 0.15 });
      $$('.scene .copy, .panel, .interact-card').forEach(function (el) {
        el.style.opacity = '0'; el.style.transition = 'opacity .8s ease'; io.observe(el);
      });
      var style = document.createElement('style');
      style.textContent = '.in{opacity:1!important}';
      document.head.appendChild(style);
    } catch (e) {}
    // interactions degrade to instant taps
    var hb = $('#hold-button');
    if (hb) hb.addEventListener('click', function () {
      $('#hold-feedback').textContent = 'thank you for staying. walk on —';
      document.body.dataset.scene = '4';
    });
    var bb = $('#bloom-button');
    if (bb) bb.addEventListener('click', function () {
      document.body.dataset.bloom = '1'; bloomOn = true;
      $$('.bud-open').forEach(function (g) { g.setAttribute('opacity', '1'); });
      $$('.bud-closed').forEach(function (g) { g.setAttribute('opacity', '0'); });
      var bl = $('.bloom-leaves'); if (bl) bl.setAttribute('opacity', '1');
      var br = $('#bird-return'); if (br) br.setAttribute('opacity', '1');
      $('#bloom-feedback').textContent = 'see? you did that. the garden is awake.';
      $('#bloom-bar').style.width = '100%';
    });
    var nt = $('#note-toggle');
    if (nt) nt.addEventListener('click', function () {
      nt.setAttribute('aria-expanded', nt.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
    hideLoader();
    return; // skip all scrubbed machinery
  }

  /* ---------- full-motion path ---------- */
  gsap.registerPlugin(ScrollTrigger);
  try { if (window.DrawSVGPlugin) gsap.registerPlugin(window.DrawSVGPlugin); } catch (e) {}
  try { if (window.MorphSVGPlugin) gsap.registerPlugin(window.MorphSVGPlugin); } catch (e) {}
  try { if (window.SplitText) gsap.registerPlugin(window.SplitText); } catch (e) {}
  // NOTE: ScrollSmoother is loaded per stack but intentionally not initialised:
  // Lenis owns smoothing here; running both double-smooths and breaks pin math.

  var lenis = null;
  try {
    if (typeof window.Lenis !== 'undefined') {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  } catch (e) { lenis = null; }

  function scrollToEl(sel) {
    var el = $(sel); if (!el) return;
    if (lenis) { try { lenis.scrollTo(el, { offset: 0, duration: 1.4 }); return; } catch (e) {} }
    el.scrollIntoView({ behavior: 'smooth' });
  }
  $$('#rail a').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); scrollToEl('#scene-' + a.dataset.to); });
  });
  var rp = $('#replay'); if (rp) rp.addEventListener('click', function () { scrollToEl('#scene-1'); });

  window.addEventListener('scroll', function () {
    document.body.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  /* ---------- split text reveals ---------- */
  function splitReveal(sel) {
    $$(sel).forEach(function (el) {
      var chars = null;
      try {
        if (window.SplitText) {
          var st = new window.SplitText(el, { type: 'chars,words', charsClass: 'char', wordsClass: 'word' });
          chars = st.chars || st;
        }
      } catch (e) { chars = null; }
      if (!chars) { // word fallback
        var words = el.textContent.trim().split(/\s+/);
        el.innerHTML = words.map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
        chars = $$('.word', el);
      }
      gsap.set(chars, { opacity: 0, y: 26, rotate: 1.5 });
      gsap.to(chars, {
        opacity: 1, y: 0, rotate: 0, stagger: 0.028, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
      });
    });
  }
  splitReveal('.split');

  /* ---------- scroll identity: scene tracking + rail ---------- */
  $$('.scene').forEach(function (sec, i) {
    ScrollTrigger.create({
      trigger: sec, start: 'top center', end: 'bottom center',
      onToggle: function (self) {
        if (self.isActive) {
          sceneIdx = i + 1;
          document.body.dataset.scene = String(sceneIdx);
          $$('#rail a').forEach(function (a) {
            a.classList.toggle('on', Number(a.dataset.to) === sceneIdx);
          });
        }
      }
    });
  });
  // strip progress within journey
  var film = $('#filmstrip'), stripBar = $('#strip-bar');
  if (film && stripBar) {
    film.addEventListener('scroll', function () {
      var max = film.scrollWidth - film.clientWidth;
      stripBar.style.width = (max > 0 ? (film.scrollLeft / max) * 100 : 0) + '%';
    }, { passive: true });
  }

  /* ---------- SCENE 1: first scroll must hit hard ---------- */
  try {
    var hookTl = gsap.timeline({
      scrollTrigger: { trigger: '#scene-1', start: 'top top', end: '+=120%', scrub: 1, pin: true }
    });
    hookTl.to('#branch-svg', { rotate: -2.2, x: -16, transformOrigin: '10% 90%', duration: 1 }, 0);
    hookTl.to('.hl', { rotate: 8, y: -6, stagger: 0.05, transformOrigin: 'center', duration: 1 }, 0);
    // one bird takes off — this is why scene 2 feels emptier
    hookTl.to('#bird-a', { x: 420, y: -260, rotate: 12, duration: 1.6, ease: 'power2.in' }, 0.1);
    hookTl.to('#bird-a .wing-a', { scaleY: 0.4, transformOrigin: 'left center', duration: 0.2, repeat: 5, yoyo: true }, 0.1);
    hookTl.to('#bird-b', { x: -14, y: 6, duration: 1 }, 0);
    hookTl.to('#moon-shadow', { opacity: 0.18, attr: { opacity: 0.18 }, duration: 1 }, 0);
    hookTl.to('.moon-halo', { opacity: 1.4, scale: 1.12, transformOrigin: 'center', duration: 1 }, 0);
    hookTl.to('#hook-react-line', { opacity: 0, y: -10, duration: 0.4 }, 0.15);
    hookTl.fromTo('.hook-copy h1', { scale: 1 }, { scale: 1.03, transformOrigin: 'left center', duration: 1 }, 0);
    // gentle idle for perched wings when not scrubbing
    gsap.to('.wing-b', { scaleY: 0.85, transformOrigin: 'left center', duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  } catch (e) {}

  /* ---------- vine DrawSVG tied to scroll (scene 2) ---------- */
  try {
    var vine = $('#vine-grow');
    if (vine) {
      var L = vine.getTotalLength();
      if (window.DrawSVGPlugin) {
        gsap.set(vine, { drawSVG: '0% 6%' });
        gsap.to(vine, {
          drawSVG: '0% 100%', ease: 'none',
          scrollTrigger: { trigger: '#scene-2', start: 'top 80%', end: 'bottom 40%', scrub: 1 }
        });
      } else {
        vine.style.strokeDasharray = String(L);
        vine.style.strokeDashoffset = String(L * 0.94);
        gsap.to(vine, {
          strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: '#scene-2', start: 'top 80%', end: 'bottom 40%', scrub: 1 }
        });
      }
    }
  } catch (e) {}

  /* ---------- SCENE 3: one horizontal journey, used once ---------- */
  try {
    var track = $('#filmstrip');
    if (track) {
      var getX = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 60); };
      gsap.to(track, {
        x: function () { return -getX(); }, ease: 'none',
        scrollTrigger: {
          trigger: '#scene-3', start: 'top top', end: function () { return '+=' + (getX() + window.innerHeight * 0.6); },
          scrub: 1, pin: '.journey-pin', invalidateOnRefresh: true
        }
      });
    }
  } catch (e) {}

  /* ---------- INTERACTION 1: Matter.js hanging leaf (weight you can feel) ---------- */
  (function leafPhysics() {
    if (typeof window.Matter === 'undefined') return;
    var zone = $('#leaf-physics-zone'), leaf = $('#wilt-leaf'), str = $('#leaf-string'), touch = $('#leaf-touch'), fb = $('#leaf-feedback');
    if (!zone || !leaf || !str) return;
    var Wv = 260, Hv = 300, anchor = { x: 130, y: 8 };
    var engine = window.Matter.Engine.create({ enableSleeping: false });
    engine.gravity.y = 1;
    var M = window.Matter;
    var body = M.Bodies.rectangle(130, 170, 92, 44, { density: 0.0012, frictionAir: 0.035, restitution: 0.2 });
    var cons = M.Constraint.create({ pointA: anchor, bodyB: body, pointB: { x: 0, y: -60 }, stiffness: 0.02, damping: 0.08, length: 120 });
    M.Composite.add(engine.world, [body, cons]);
    var dragging = false, pointer = { x: 130, y: 170 }, nudged = false, visible = true;
    try {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(zone);
    } catch (e) {}
    function toWorld(e) {
      var r = zone.getBoundingClientRect();
      var cx = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
      var cy = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
      return { x: (cx - r.left) / r.width * Wv, y: (cy - r.top) / r.height * Hv };
    }
    function down(e) { dragging = true; pointer = toWorld(e); leaf.style.cursor = 'grabbing'; if (touch && touch.setPointerCapture && e.pointerId !== undefined) { try { touch.setPointerCapture(e.pointerId); } catch (err) {} } e.preventDefault(); }
    function move(e) { if (dragging) pointer = toWorld(e); }
    function up() {
      if (!dragging) return; dragging = false; leaf.style.cursor = 'grab';
      // little flick on release so it feels alive
      try {
        M.Body.setVelocity(body, { x: (Math.random() - 0.5) * 4, y: -1 - Math.random() * 2 });
      } catch (e) {}
      if (!nudged) { nudged = true; if (fb) fb.textContent = 'see? it swings, then settles. it doesn\u2019t fall.'; }
    }
    if (touch) {
      touch.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerup', up);
      touch.addEventListener('touchstart', down, { passive: false });
      touch.addEventListener('touchmove', move, { passive: true });
      touch.addEventListener('touchend', up);
    }
    var last = performance.now();
    leafSync = function () {
      if (!visible || document.hidden) return;
      var now = performance.now(), dt = Math.min(32, now - last); last = now;
      try {
        if (dragging) {
          var dx = pointer.x - body.position.x, dy = pointer.y - body.position.y;
          M.Body.setVelocity(body, { x: dx * 0.12, y: dy * 0.12 });
          M.Body.setAngularVelocity(body, body.angularVelocity * 0.9 + dx * 0.0004);
          M.Engine.update(engine, dt);
        } else {
          M.Engine.update(engine, dt);
        }
        var bx = body.position.x, by = body.position.y, an = body.angle;
        leaf.setAttribute('transform', 'translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ') rotate(' + (an * 57.3 + 24).toFixed(1) + ')');
        str.setAttribute('x2', bx.toFixed(1)); str.setAttribute('y2', (by - 46).toFixed(1));
      } catch (e) {}
    };
    // idle breeze nudge so first-time visitors see it can move
    setTimeout(function () { try { M.Body.applyForce(body, body.position, { x: 0.004, y: 0 }); } catch (e) {} }, 2500);
  })();

  /* ---------- INTERACTION 2: hold-to-advance (a gesture that costs something) ---------- */
  (function holdAdvance() {
    var btn = $('#hold-button'), ring = $('#hold-ring'), label = $('#hold-label'), fb = $('#hold-feedback'), sprout = $('#hold-sprout');
    if (!btn || !ring) return;
    var NEED = 1900, start = 0, raf = 0, done = false;
    try { ring.style.strokeDasharray = '390'; ring.style.strokeDashoffset = '390'; } catch (e) {}
    function setP(p) {
      try { ring.style.strokeDashoffset = String(390 - 390 * p); } catch (e) {}
      if (sprout) { try { sprout.style.transform = 'scale(' + (0.7 + p * 0.5) + ')'; sprout.style.transformOrigin = '80px 104px'; } catch (err) {} }
    }
    function tick() {
      var p = Math.min(1, (performance.now() - start) / NEED);
      setP(p);
      if (label) label.textContent = p < 1 ? 'keep holding…' : 'grown';
      if (fb) fb.textContent = p < 0.4 ? 'hold — don\u2019t rush it.' : p < 0.8 ? 'the stem is listening. stay.' : p < 1 ? 'almost — stay with it.' : 'thank you. walk on —';
      if (p >= 1) { finish(); return; }
      raf = requestAnimationFrame(tick);
    }
    function finish() {
      cancelAnimationFrame(raf); done = true; setP(1);
      if (fb) fb.textContent = 'thank you for staying. that is the whole point.';
      try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
      try { gsap.fromTo(btn, { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1 }); } catch (e) {}
      setTimeout(function () { scrollToEl('#scene-4'); }, 650);
    }
    function cancel(msg) {
      if (done) return;
      cancelAnimationFrame(raf);
      try {
        gsap.to({ v: Number((ring.style.strokeDashoffset || '390').replace('390 -', '')) }, { duration: 0.01 });
      } catch (e) {}
      setP(0);
      if (fb) fb.textContent = msg || 'it slipped back — the vine only grows while you stay.';
      if (label) label.textContent = 'hold me';
    }
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); if (done) return; start = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () { if (!done && start) cancel(); start = 0; });
    });
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !done) { finish(); } });
  })();

  /* ---------- SCENE 4: pinned climax, bloom gated on HER action ---------- */
  var bloomDone = false;
  try {
    gsap.timeline({
      scrollTrigger: { trigger: '#scene-4', start: 'top top', end: '+=140%', scrub: 1, pin: true }
    })
    .fromTo('#bloom-svg', { scale: 0.94, y: 30 }, { scale: 1, y: 0, ease: 'none', duration: 1 }, 0)
    .fromTo('.climax-copy .giant', { scale: 0.98 }, { scale: 1.015, transformOrigin: 'center', ease: 'none', duration: 1 }, 0);
  } catch (e) {}

  function burstPetals() {
    if (typeof window.Matter === 'undefined' || petalBodies.length) return;
    try {
      var M = window.Matter;
      petalEngine = M.Engine.create(); petalEngine.gravity.y = 0.55;
      var ground = M.Bodies.rectangle(50, 104, 110, 8, { isStatic: true, friction: 0.9 });
      var wallL = M.Bodies.rectangle(-4, 60, 8, 130, { isStatic: true });
      var wallR = M.Bodies.rectangle(104, 60, 8, 130, { isStatic: true });
      M.Composite.add(petalEngine.world, [ground, wallL, wallR]);
      var colors = ['#E8A7A0', '#F0C778', '#EFD9D2', '#D97F76'];
      var n = isMobile ? 14 : 26;
      for (var i = 0; i < n; i++) {
        var b = M.Bodies.circle(10 + Math.random() * 80, -10 - Math.random() * 40, 1.6 + Math.random() * 2.4, {
          restitution: 0.35, friction: 0.6, frictionAir: 0.02 + Math.random() * 0.02, density: 0.0009
        });
        b.plugin = b.plugin || {}; b.plugin.color = colors[i % colors.length];
        M.Body.setVelocity(b, { x: (Math.random() - 0.5) * 3, y: 1 + Math.random() * 2 });
        M.Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.3);
        petalBodies.push(b);
        M.Composite.add(petalEngine.world, b);
      }
    } catch (e) {}
  }

  function playBloom() {
    if (bloomDone) return; bloomDone = true; bloomOn = true;
    document.body.dataset.bloom = '1';
    try { document.documentElement.style.setProperty('--warm', '1'); } catch (e) {}
    var fb = $('#bloom-feedback');
    if (fb) fb.textContent = 'see? you did that. the garden is breathing now.';
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) {}
    burstPetals();
    try {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      $$('.bud').forEach(function (bud, i) {
        var open = $('.bud-open', bud), closed = $('.bud-closed', bud);
        tl.to(closed, { scale: 0.2, opacity: 0, transformOrigin: 'center bottom', duration: 0.7 }, i * 0.18);
        tl.fromTo(open, { opacity: 0, scale: 0.3, transformOrigin: 'center bottom' },
          { opacity: 1, scale: 1, duration: 1.1, ease: 'elastic.out(1,.55)' }, i * 0.18 + 0.15);
      });
      tl.to('.bloom-leaves', { opacity: 1, duration: 1 }, 0.3);
      tl.fromTo('#bird-return', { opacity: 0, x: 120, y: -40 }, { opacity: 1, x: 0, y: 0, duration: 1.4, ease: 'power2.out' }, 0.5);
      tl.to('#bird-return .wing-r', { scaleY: 0.45, transformOrigin: 'left center', duration: 0.18, repeat: 7, yoyo: true }, 0.5);
      // warm the whole page light
      tl.to('.bloom-sky', { filter: 'saturate(1.25)', duration: 1 }, 0);
      chime();
    } catch (e) {
      $$('.bud-open').forEach(function (g) { g.setAttribute('opacity', '1'); });
      $$('.bud-closed').forEach(function (g) { g.setAttribute('opacity', '0'); });
      var bl = $('.bloom-leaves'); if (bl) bl.setAttribute('opacity', '1');
      var br = $('#bird-return'); if (br) br.setAttribute('opacity', '1');
    }
  }

  (function bloomHold() {
    var btn = $('#bloom-button'), bar = $('#bloom-bar'), label = $('#bloom-label'), fb = $('#bloom-feedback');
    if (!btn) return;
    var NEED = 1500, start = 0, raf = 0;
    function setP(p) { if (bar) bar.style.width = (p * 100) + '%'; }
    function tick() {
      var p = Math.min(1, (performance.now() - start) / NEED);
      setP(p);
      if (label) label.textContent = p < 1 ? 'keep holding — it is opening…' : 'it bloomed';
      if (p >= 1) { playBloom(); return; }
      raf = requestAnimationFrame(tick);
    }
    // also allow a plain tap to count on touch-only impatience: two quick taps = bloom
    var taps = 0;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault(); start = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () {
        if (bloomDone) return;
        cancelAnimationFrame(raf);
        taps++;
        if (taps >= 4) { playBloom(); return; }
        if (start && performance.now() - start < NEED && fb) fb.textContent = 'a little longer — hold it like you mean it.';
        setP(0); start = 0;
        if (label) label.textContent = 'touch and hold — you open it';
      });
    });
    btn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') playBloom(); });
  })();

  /* ---------- SCENE 5: settled idle, gift + note ---------- */
  try {
    gsap.to('.settle-blooms', { y: -8, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('#gift-bow', { rotate: 3, transformOrigin: 'center', duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.firefly-field', { y: 6, duration: 3.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  } catch (e) {}
  (function noteGift() {
    var nt = $('#note-toggle');
    if (nt) nt.addEventListener('click', function () {
      var open = nt.getAttribute('aria-expanded') === 'true';
      nt.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (!open) {
        try {
          gsap.fromTo('#gift-lid', { y: 0, rotate: 0 }, { y: -14, rotate: -8, transformOrigin: 'left center', duration: 0.6, yoyo: true, repeat: 1, ease: 'power2.out' });
          if (navigator.vibrate) navigator.vibrate(15);
        } catch (e) {}
      }
    });
  })();

  /* ---------- gyro parallax (mobile camera feel) ---------- */
  try {
    var px = 0, py = 0, tx = 0, ty = 0;
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 30));
      ty = Math.max(-1, Math.min(1, (e.beta - 40) / 30));
    });
    gsap.ticker.add(function () {
      px += (tx - px) * 0.04; py += (ty - py) * 0.04;
      if (Math.abs(px) < 0.01 && Math.abs(py) < 0.01) return;
      gsap.set('.moon-wrap', { x: px * 18, y: py * 12 });
      gsap.set('.branch-stage', { x: px * -12 });
    });
  } catch (e) {}

  /* ---------- housekeeping ---------- */
  function refresh() { try { ScrollTrigger.refresh(); } catch (e) {} }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { refresh(); }); }
  window.addEventListener('load', refresh);
  setTimeout(refresh, 1200);

  // desktop idle sway for hook leaves (cheap, runs under rAF budget)
  try {
    gsap.to('.hl', { rotate: '+=4', y: '-=3', duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.3 });
  } catch (e) {}
})();
