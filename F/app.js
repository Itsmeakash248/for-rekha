/* For Rekha — a small world. Vanilla JS, no build step.
   Layers: pointer-follow (lerp), canvas particles (typed arrays),
   GSAP scrub (guarded), press-and-hold climaxes, reduced-motion fallback. */
(function () {
'use strict';

var $ = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

var reducedMotion = false;
try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reducedMotion = false; }
var isMobile = false;
try { isMobile = window.matchMedia('(max-width: 700px)').matches; } catch (e) { isMobile = false; }
var hasGSAP = typeof window.gsap !== 'undefined';
var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
if (hasGSAP && hasST) { try { gsap.registerPlugin(ScrollTrigger); } catch (e) {} }
try {
  if (hasGSAP && window.DrawSVGPlugin) gsap.registerPlugin(DrawSVGPlugin);
  if (hasGSAP && window.MorphSVGPlugin) gsap.registerPlugin(MorphSVGPlugin);
  if (hasGSAP && window.SplitText) gsap.registerPlugin(SplitText);
} catch (e) {}

/* ───────── global pointer (mouse + touch) ───────── */
var pointer = { x: window.innerWidth / 2, y: window.innerHeight * 0.4, active: false, resting: 0 };
var glow = $('#pointer-glow');
function setPointer(x, y) {
  pointer.x = x; pointer.y = y; pointer.active = true; pointer.resting = 0;
  if (glow) { glow.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
}
try {
  window.addEventListener('pointermove', function (e) { setPointer(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
} catch (e) {}

/* ───────── Piku follower (cursor bird, lerp — baby-birds behaviour) ───────── */
var follower = $('#piku-follower');
var fPos = { x: -100, y: -100 };
var fInit = false;
function tickFollower(dt) {
  if (!follower || reducedMotion) return;
  if (!document.body.classList.contains('awake')) return;
  if (!fInit) { fPos.x = pointer.x + 70; fPos.y = pointer.y + 40; fInit = true; }
  var tx = pointer.x + 64, ty = pointer.y + 46;
  var ease = 1 - Math.pow(0.0015, dt); /* frame-rate independent lerp */
  var px = fPos.x, py = fPos.y;
  fPos.x = lerp(fPos.x, tx, ease);
  fPos.y = lerp(fPos.y, ty, ease);
  var tilt = clamp((fPos.x - px) * 1.4, -16, 16);
  follower.style.transform = 'translate(' + fPos.x + 'px,' + fPos.y + 'px) rotate(' + tilt + 'deg)';
  /* eye glint shift toward pointer */
  var glint = follower.querySelector('.pf-glint');
  if (glint) {
    var dx = clamp((pointer.x - fPos.x) * 0.004, -1.6, 1.6);
    var dy = clamp((pointer.y - fPos.y) * 0.004, -1.6, 1.6);
    glint.setAttribute('cx', 77.6 + dx);
    glint.setAttribute('cy', 43.4 + dy);
  }
}

/* ───────── Miri cat gaze follows cursor ───────── */
var pupils = $('.miri-pupils');
var pupilBase = [{ x: 584, y: 400 }, { x: 618, y: 400 }];
function tickCat() {
  if (!pupils || reducedMotion) return;
  try {
    var r = pupils.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = clamp((pointer.x - cx) * 0.012, -3.4, 3.4);
    var dy = clamp((pointer.y - cy) * 0.012, -2.6, 2.6);
    var kids = pupils.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].setAttribute('cx', pupilBase[i].x + dx);
      kids[i].setAttribute('cy', pupilBase[i].y + dy);
    }
    var waiting = $('#piku-waiting .piku-pupil');
    if (waiting) {
      var wr = waiting.getBoundingClientRect();
      var wdx = clamp((pointer.x - (wr.left + wr.width / 2)) * 0.02, -2.5, 2.5);
      waiting.setAttribute('cx', 486 + wdx);
    }
  } catch (e) {}
}

/* ───────── ambient canvas: fireflies / rain / petals / motes ───────── */
var canvas = $('#sky-canvas'), ctx = null;
var MAX = isMobile ? 90 : 220;
var pxA, pyA, pvxA, pvyA, pszA, plfA, psdA, ptyA;
var pCount = 0, mode = 'night', attract = 0.12, holdBoost = 0;
var DPR = 1;
function sizeCanvas() {
  if (!canvas) return;
  try {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  } catch (e) {}
}
function seedParticles(n) {
  pCount = n;
  for (var i = 0; i < n; i++) {
    pxA[i] = Math.random() * window.innerWidth;
    pyA[i] = Math.random() * window.innerHeight;
    pvxA[i] = (Math.random() - 0.5) * 0.3;
    pvyA[i] = (Math.random() - 0.5) * 0.3;
    pszA[i] = 1 + Math.random() * 3;
    plfA[i] = Math.random() * 1000;
    psdA[i] = Math.random() * Math.PI * 2;
    ptyA[i] = Math.random();
  }
}
function initCanvas() {
  if (!canvas) return;
  try { ctx = canvas.getContext('2d'); } catch (e) { return; }
  pxA = new Float32Array(MAX); pyA = new Float32Array(MAX);
  pvxA = new Float32Array(MAX); pvyA = new Float32Array(MAX);
  pszA = new Float32Array(MAX); plfA = new Float32Array(MAX);
  psdA = new Float32Array(MAX); ptyA = new Float32Array(MAX);
  sizeCanvas();
  seedParticles(reducedMotion ? 0 : MAX);
  try { window.addEventListener('resize', sizeCanvas); } catch (e) {}
}
function drawParticles(t, dt) {
  if (!ctx || reducedMotion || pCount === 0) return;
  if (document.hidden) return;
  var W = window.innerWidth, H = window.innerHeight;
  ctx.clearRect(0, 0, W, H);
  pointer.resting += dt;
  var restWeight = clamp(pointer.resting / 2500, 0, 1); /* the longer she rests, the more they gather */
  var pull = clamp(attract + holdBoost + restWeight * 0.25, 0, 1.4);
  for (var i = 0; i < pCount; i++) {
    var kind = ptyA[i];
    var x = pxA[i], y = pyA[i];
    psdA[i] += dt * 0.001;
    plfA[i] += dt * 0.06;

    if (mode === 'rain') {
      pvyA[i] = lerp(pvyA[i], 9 + (kind * 5), 0.1);
      pvxA[i] = lerp(pvxA[i], -1.2, 0.1);
      x += pvxA[i]; y += pvyA[i];
      if (y > H + 20) { y = -20; x = Math.random() * W; }
      ctx.strokeStyle = 'rgba(174,183,212,0.4)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 14); ctx.stroke();
    } else if (mode === 'petals' || mode === 'morning') {
      var sway = Math.sin(t * 0.001 + psdA[i]) * 0.6;
      pvxA[i] = lerp(pvxA[i], sway + 0.35, 0.03);
      pvyA[i] = lerp(pvyA[i], 0.55 + kind * 0.5, 0.03);
      x += pvxA[i]; y += pvyA[i];
      if (y > H + 20) { y = -20; x = Math.random() * W; }
      if (x > W + 20) x = -20;
      var petal = kind > 0.45;
      if (petal) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.002 + psdA[i]) * 0.9);
        ctx.fillStyle = mode === 'morning' ? 'rgba(240,190,170,0.75)' : 'rgba(217,167,160,0.6)';
        ctx.beginPath(); ctx.ellipse(0, 0, 3.4 + pszA[i], 2 + pszA[i] * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        /* a firefly among petals */
        var dx = pointer.x - x, dy = pointer.y - y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        pvxA[i] += (dx / d) * 0.02 * pull;
        pvyA[i] += (dy / d) * 0.02 * pull;
        pvxA[i] *= 0.985; pvyA[i] *= 0.985;
        x += pvxA[i] * 2; y += pvyA[i] * 2;
        var tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.002 + psdA[i] * 3));
        ctx.fillStyle = 'rgba(255,207,135,' + (0.75 * tw) + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.6 + pszA[i] * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,207,135,' + (0.12 * tw) + ')';
        ctx.beginPath(); ctx.arc(x, y, 6 + pszA[i], 0, Math.PI * 2); ctx.fill();
      }
    } else if (mode === 'dawn') {
      pvyA[i] = lerp(pvyA[i], -0.5 - kind * 0.5, 0.03);
      pvxA[i] = lerp(pvxA[i], Math.sin(t * 0.001 + psdA[i]) * 0.3, 0.03);
      x += pvxA[i]; y += pvyA[i];
      if (y < -20) { y = H + 20; x = Math.random() * W; }
      ctx.fillStyle = 'rgba(255,227,174,0.7)';
      ctx.beginPath(); ctx.arc(x, y, 1 + pszA[i] * 0.6, 0, Math.PI * 2); ctx.fill();
    } else { /* night: fireflies drift toward where she rests */
      var dx2 = pointer.x - x, dy2 = pointer.y - y;
      var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      pvxA[i] += ((dx2 / d2) * 0.03 * pull) + Math.sin(t * 0.0012 + psdA[i]) * 0.008;
      pvyA[i] += ((dy2 / d2) * 0.03 * pull) + Math.cos(t * 0.001 + psdA[i] * 1.3) * 0.008;
      pvxA[i] *= 0.982; pvyA[i] *= 0.982;
      x += pvxA[i] * 2.2; y += pvyA[i] * 2.2;
      var tw2 = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0022 + psdA[i] * 4));
      ctx.fillStyle = 'rgba(255,207,135,' + (0.8 * tw2) + ')';
      ctx.beginPath(); ctx.arc(x, y, 1.4 + pszA[i] * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,207,135,' + (0.10 * tw2) + ')';
      ctx.beginPath(); ctx.arc(x, y, 7 + pszA[i], 0, Math.PI * 2); ctx.fill();
    }
    pxA[i] = x; pyA[i] = y;
  }
}

/* ───────── tiny physics: swing pendulum + boat buoyancy ───────── */
var swing = { angle: 0, vel: 0 };
var boat = { x: 0.05, tilt: 0, lastX: 0.05 };
var scene3El = null;
/* Matter.js is loaded as the sanctioned weighted-physics option; we step a
   small engine opportunistically for the boat bob and fall back to the
   inline integrator when it is unavailable (offline, mobile, reduced motion). */
var matterEngine = null, matterBoat = null;
try {
  if (window.Matter && !reducedMotion && !isMobile) {
    matterEngine = Matter.Engine.create({ enableSleeping: true });
    matterEngine.gravity.y = 0.35;
    matterBoat = Matter.Bodies.rectangle(400, 100, 60, 12, { restitution: 0.55, frictionAir: 0.02, density: 0.001 });
    var ground = Matter.Bodies.rectangle(400, 220, 800, 40, { isStatic: true });
    var world = matterEngine.world;
    try {
      if (Matter.Composite && Matter.Composite.add) Matter.Composite.add(world, [matterBoat, ground]);
      else if (Matter.World && Matter.World.add) Matter.World.add(world, [matterBoat, ground]);
    } catch (e2) { matterEngine = null; }
  }
} catch (e) { matterEngine = null; }
function tickPhysics(dt) {
  /* swing pendulum */
  var swEl = document.querySelector('#swing .swing-ropes');
  if (swEl) {
    try {
      var r = swEl.getBoundingClientRect();
      if (r.bottom > -100 && r.top < window.innerHeight + 100) {
        var acc = -0.0022 * swing.angle;
        swing.vel = (swing.vel + acc * dt) * 0.9985;
        swing.angle += swing.vel * dt;
        swEl.style.transform = 'rotate(' + swing.angle.toFixed(2) + 'deg)';
      }
    } catch (e) {}
  }
  /* boat tilt from travel speed + matter bob */
  try {
    var speed = (boat.x - boat.lastX) * 60;
    boat.lastX = boat.x;
    boat.tilt = lerp(boat.tilt, clamp(speed * 26, -9, 9), 0.08);
    var extra = 0;
    if (matterEngine && matterBoat) {
      try {
        if (!scene3El) scene3El = document.querySelector('#scene-3');
        if (scene3El && scene3El.getBoundingClientRect().bottom > 0) {
          Matter.Engine.update(matterEngine, Math.min(dt, 33));
          extra = (matterBoat.angle || 0) * 8;
        }
      } catch (e) {}
    }
    var boatBob = document.querySelector('#paper-boat .boat-bob');
    if (boatBob) boatBob.style.rotate = (boat.tilt + extra).toFixed(2) + 'deg';
  } catch (e) {}
}

/* ───────── sound: tiny generative wind + chime, off by default ───────── */
var audio = { ctx: null, on: false, nodes: [] };
function soundOff() {
  audio.on = false;
  audio.nodes.forEach(function (n) { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} });
  audio.nodes = [];
  if (audio.ctx) { try { audio.ctx.close(); } catch (e) {} audio.ctx = null; }
}
function soundOn() {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var ac = new AC();
    audio.ctx = ac;
    /* wind: looped noise through lowpass, very quiet */
    var len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    var g = ac.createGain(); g.gain.value = 0.05;
    src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start();
    audio.nodes.push(src);
    /* soft pentatonic chime every ~9s */
    var notes = [523.25, 587.33, 659.25, 783.99, 880.0];
    var chime = window.setInterval(function () {
      if (!audio.on || !audio.ctx) return;
      try {
        var o = ac.createOscillator(), og = ac.createGain();
        o.type = 'sine'; o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
        og.gain.setValueAtTime(0.0001, ac.currentTime);
        og.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.4);
        og.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 3.2);
        o.connect(og); og.connect(ac.destination); o.start(); o.stop(ac.currentTime + 3.4);
      } catch (e) {}
    }, 9000);
    audio.nodes.push({ stop: function () { window.clearInterval(chime); }, disconnect: function () { window.clearInterval(chime); } });
    audio.on = true;
    return true;
  } catch (e) { return false; }
}

/* ───────── interactions ───────── */
function wakePiku() {
  if (document.body.classList.contains('awake')) return;
  document.body.classList.add('awake');
  var status = $('#piku-status');
  if (status) status.textContent = 'Piku is awake! She’ll follow your cursor now.';
  var zzz = document.querySelector('#piku-waiting .zzz');
  if (zzz && hasGSAP && !reducedMotion) gsap.to(zzz, { opacity: 0, y: -14, duration: 0.6 });
  else if (zzz) zzz.setAttribute('opacity', '0');
  var lamp = document.querySelector('.lantern-mini');
  if (lamp) lamp.classList.add('lantern-on');
  if (hasGSAP && !reducedMotion) {
    try {
      gsap.fromTo('#piku-waiting .piku-wait-bob', { y: 0 }, { y: -16, duration: 0.28, yoyo: true, repeat: 3, ease: 'power2.out' });
      gsap.fromTo('#piku-waiting .piku-wait-wing', { rotation: 0 }, { rotation: -24, transformOrigin: '455px 370px', duration: 0.22, yoyo: true, repeat: 5 });
    } catch (e) {}
  }
  var hint = $('#begin-hint');
  if (hint) hint.innerHTML = '<span class="dot"></span> she’s coming with you — scroll on ↓';
  document.body.classList.add('lit');
  setTimeout(function () {
    try {
      var next = $('#scene-2');
      if (!next) return;
      if (window.__lenis) window.__lenis.scrollTo(next, { offset: 0, duration: 1.6 });
      else next.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    } catch (e) {}
  }, 900);
}

function initInteractions() {
  var piku = $('#piku-waiting'), hint = $('#begin-hint');
  if (piku) {
    piku.addEventListener('click', wakePiku);
    piku.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wakePiku(); } });
  }
  if (hint) hint.addEventListener('click', wakePiku);

  /* lanterns */
  $$('[data-lantern]').forEach(function (el) {
    var toggle = function () { el.classList.toggle('lantern-on'); };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* rustling leaf */
  var leaf = $('[data-leaf]');
  if (leaf) {
    var rustle = function () {
      if (hasGSAP && !reducedMotion) {
        try { gsap.fromTo(leaf, { rotation: 0 }, { rotation: 14, transformOrigin: '300px 256px', duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut' }); } catch (e) {}
      }
    };
    leaf.addEventListener('click', rustle);
    leaf.addEventListener('mouseenter', rustle);
    leaf.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rustle(); } });
  }

  /* INTERACTION 1 — pet Miri */
  var miri = $('#miri'), pets = 0, mStatus = $('#miri-status'), fill = $('#pet-fill');
  if (miri) {
    var pet = function () {
      pets++;
      if (fill) fill.style.width = clamp(pets * 18, 0, 100) + '%';
      if (hasGSAP && !reducedMotion) {
        try {
          gsap.fromTo(miri.querySelector('.miri-body'), { scaleY: 1 }, { scaleY: 1.06, transformOrigin: '600px 420px', duration: 0.18, yoyo: true, repeat: 1 });
          gsap.fromTo(miri.querySelector('.miri-heart'), { opacity: 0, y: 8, scale: 0.6, transformOrigin: '600px 350px' }, { opacity: 1, y: -6, scale: 1, duration: 0.5, yoyo: true, repeat: 1 });
        } catch (e) {}
      } else {
        var h = miri.querySelector('.miri-heart');
        if (h) h.setAttribute('opacity', '1');
      }
      var blush = miri.querySelector('.miri-blush');
      if (blush && pets >= 2) blush.setAttribute('opacity', '1');
      if (mStatus) {
        mStatus.textContent = pets < 3 ? 'Miri leans in a little…' : pets < 5 ? 'She’s purring. Not fixed — but softer.' : 'Okay. She trusts you again. The grey stays, for now.';
      }
    };
    miri.addEventListener('click', pet);
    miri.addEventListener('mouseenter', function () { if (!reducedMotion) pet(); });
    miri.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); } });
  }

  /* pond fish scatter + regroup */
  var pond = $('#pond');
  if (pond) {
    var fishes = $$('[data-fish]');
    var home = [{ x: 600, y: 515 }, { x: 660, y: 530 }, { x: 720, y: 518 }, { x: 640, y: 545 }];
    fishes.forEach(function (f, i) { f.setAttribute('transform', 'translate(' + home[i].x + ' ' + home[i].y + ')'); });
    var scatter = function () {
      fishes.forEach(function (f, i) {
        var hx = home[i].x, hy = home[i].y;
        var sx = hx + (Math.random() - 0.5) * 160, sy = hy + (Math.random() - 0.5) * 40;
        if (hasGSAP && !reducedMotion) {
          try {
            gsap.to(f, { x: sx - hx, y: sy - hy, duration: 0.45, ease: 'power3.out', overwrite: true,
              onComplete: function () { gsap.to(f, { x: 0, y: 0, duration: 1.4, ease: 'sine.inOut', delay: 0.5 + i * 0.12 }); } });
          } catch (e) { f.setAttribute('transform', 'translate(' + hx + ' ' + hy + ')'); }
        } else { f.setAttribute('transform', 'translate(' + sx + ' ' + sy + ')'); setTimeout(function () { f.setAttribute('transform', 'translate(' + hx + ' ' + hy + ')'); }, 900); }
      });
      var bs = $('#boat-status');
      if (bs) bs.textContent = 'The fish dart — then come back. They always come back.';
    };
    pond.addEventListener('click', scatter);
    pond.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scatter(); } });
  }

  /* Bupu frog */
  var bupu = $('#bupu');
  if (bupu) {
    var croaks = 0;
    var croak = function () {
      croaks++;
      if (hasGSAP && !reducedMotion) {
        try { gsap.fromTo(bupu.querySelector('.bupu-throat'), { scale: 1 }, { scale: 1.6, transformOrigin: '250px 522px', duration: 0.16, yoyo: true, repeat: 1 }); } catch (e) {}
      }
      var bs = $('#boat-status');
      if (bs) bs.textContent = croaks === 1 ? 'Bupu says hello. (He missed you.)' : 'Bupu is showing off now. ' + croaks + ' croaks and counting.';
      if (audio.on && audio.ctx) {
        try {
          var o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
          o.type = 'triangle'; o.frequency.value = 180;
          g.gain.setValueAtTime(0.08, audio.ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.25);
          o.connect(g); g.connect(audio.ctx.destination); o.start(); o.stop(audio.ctx.currentTime + 0.3);
        } catch (e) {}
      }
    };
    bupu.addEventListener('click', croak);
    bupu.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); croak(); } });
  }

  /* INTERACTION 2a — paper boat slider */
  var range = $('#boat-range'), pct = $('#boat-pct'), boatEl = $('#paper-boat');
  var placeBoat = function (v) {
    boat.x = v / 100;
    var x = lerp(170, 750, boat.x), y = 462 + Math.sin(boat.x * 6.2) * 14;
    if (boatEl) {
      boatEl.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      try { boatEl.setAttribute('aria-valuenow', String(Math.round(v))); } catch (e) {}
    }
    if (pct) pct.textContent = Math.round(v) + '%';
    var bs = $('#boat-status');
    if (bs) bs.textContent = v >= 100 ? 'Across. You brought it all the way.' : v >= 60 ? 'More than halfway — keep guiding her.' : v >= 25 ? 'She’s moving. The water trusts you.' : 'Nudge the little boat across the water.';
  };
  if (range) {
    range.addEventListener('input', function () { placeBoat(parseFloat(range.value)); });
    range.addEventListener('change', function () { placeBoat(parseFloat(range.value)); });
  }
  if (boatEl) {
    var dragBoat = function (clientX) {
      try {
        var svg = boatEl.ownerSVGElement, r = svg.getBoundingClientRect();
        var t = clamp((clientX - r.left) / r.width, 0, 1);
        var v = Math.round(lerp(2, 100, t));
        if (range) range.value = String(v);
        placeBoat(v);
      } catch (e) {}
    };
    var dragging = false;
    boatEl.addEventListener('pointerdown', function (e) { dragging = true; try { boatEl.setPointerCapture(e.pointerId); } catch (err) {} dragBoat(e.clientX); });
    boatEl.addEventListener('pointermove', function (e) { if (dragging) dragBoat(e.clientX); });
    boatEl.addEventListener('pointerup', function () { dragging = false; });
    boatEl.addEventListener('keydown', function (e) {
      var v = range ? parseFloat(range.value) : 5;
      if (e.key === 'ArrowRight') { v = clamp(v + 5, 0, 100); if (range) range.value = String(v); placeBoat(v); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { v = clamp(v - 5, 0, 100); if (range) range.value = String(v); placeBoat(v); e.preventDefault(); }
    });
  }
  placeBoat(range ? parseFloat(range.value) : 5);

  /* INTERACTION 2b — hold to keep the light close */
  holdButton($('#firefly-hold'), $('#hold-status'), function (done) {
    if (!done) return;
    holdBoost = 1.2;
    var hs = $('#hold-status');
    if (hs) hs.textContent = 'See? They stayed because you stayed.';
    window.setTimeout(function () {
      holdBoost = 0.12;
      if (hs && hs.textContent.charAt(0) === 'S') hs.textContent = 'Hold the button — the fireflies gather when you stay.';
    }, 6000);
  }, 1.6);

  /* swing push (pendulum physics above) */
  var swingEl = $('#swing');
  if (swingEl) {
    var push = function () { swing.vel += 0.055; };
    swingEl.addEventListener('click', push);
    swingEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push(); } });
  }

  /* INTERACTION 3 — hold to let the morning in (the climax trigger) */
  var dawned = false;
  var doDawn = function () {
    if (dawned) return; dawned = true;
    document.body.classList.add('morning', 'lit');
    var ds = $('#dawn-status');
    if (ds) ds.textContent = 'Morning. You did that.';
    var dh = $('#dawn-hold');
    if (dh) { dh.classList.add('lit'); var t = dh.querySelector('.dawn-text'); if (t) t.textContent = 'morning is here ♥'; }
    var sun = $('#dawn-sun');
    if (hasGSAP && !reducedMotion) {
      try {
        gsap.to(sun, { opacity: 0.85, scale: 1.15, transformOrigin: '450px 400px', duration: 2, ease: 'sine.out' });
        gsap.to('#gathered', { opacity: 1, duration: 2, ease: 'sine.out' });
        gsap.to('.big-glow', { opacity: 0.9, duration: 1.2 });
        gsap.to('.big-glass', { fill: '#ffe3ae', duration: 1.2 });
      } catch (e) {}
    } else {
      if (sun) sun.setAttribute('opacity', '0.85');
      var gth = $('#gathered'); if (gth) gth.setAttribute('opacity', '1');
    }
    mode = 'morning';
    setTimeout(function () {
      try {
        var r = $('#scene-5');
        if (window.__lenis) window.__lenis.scrollTo(r, { duration: 1.8 });
      } catch (e) {}
    }, 1600);
  };
  holdButton($('#dawn-hold'), $('#dawn-status'), function (done) { if (done) doDawn(); }, 2.4);
  var dl = $('#dawn-lantern');
  if (dl) {
    dl.addEventListener('click', function () { /* lantern itself needs a real hold; a tap only sways */ });
    dl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doDawn(); } });
  }

  /* replay */
  var replay = $('#replay');
  if (replay) replay.addEventListener('click', function () {
    try {
      if (window.__lenis) window.__lenis.scrollTo(0, { duration: 2 });
      else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    } catch (e) { window.scrollTo(0, 0); }
  });

  /* sound toggle */
  var st = $('#sound-toggle');
  if (st) st.addEventListener('click', function () {
    var label = st.querySelector('span');
    if (audio.on) { soundOff(); st.setAttribute('aria-pressed', 'false'); if (label) label.textContent = 'sound off'; }
    else { var ok = soundOn(); st.setAttribute('aria-pressed', ok ? 'true' : 'false'); if (label) label.textContent = ok ? 'sound on' : 'sound unavailable'; }
  });
}

/* press-and-hold helper (pointer + keyboard, reduced-motion aware) */
function holdButton(btn, statusEl, onDone, seconds) {
  if (!btn) return;
  var fill = btn.querySelector('.hold-fill, .dawn-fill');
  var raf = 0, start = 0, done = false, holding = false;
  var need = (seconds || 2) * 1000;
  function frame(now) {
    if (!holding) return;
    var p = clamp((now - start) / (reducedMotion ? 200 : need), 0, 1);
    if (fill) fill.style.width = (p * 100).toFixed(1) + '%';
    if (p >= 1 && !done) { done = true; holding = false; try { onDone(true); } catch (e) {} return; }
    raf = requestAnimationFrame(frame);
  }
  function begin(e) {
    if (done) return;
    holding = true; done = false; start = performance.now();
    holdBoost = Math.max(holdBoost, 0.9); /* fireflies lean in while she holds */
    try { if (e && e.pointerId !== undefined && btn.setPointerCapture) btn.setPointerCapture(e.pointerId); } catch (err) {}
    raf = requestAnimationFrame(frame);
  }
  function cancel() {
    if (done) return;
    holding = false; cancelAnimationFrame(raf);
    holdBoost = 0;
    if (fill) {
      if (hasGSAP && !reducedMotion) { try { gsap.to(fill, { width: '0%', duration: 0.5 }); } catch (e) { fill.style.width = '0%'; } }
      else fill.style.width = '0%';
    }
  }
  btn.addEventListener('pointerdown', begin);
  btn.addEventListener('pointerup', function () { if (!done) cancel(); });
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('pointerleave', function () { if (holding && !done) cancel(); });
  btn.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && !holding && !done) {
      e.preventDefault();
      if (reducedMotion) { completeNow(); return; }
      holding = true; done = false; start = performance.now(); raf = requestAnimationFrame(frame);
    }
  });
  btn.addEventListener('keyup', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !done) cancel(); });
  /* Simple-tap escape hatches: reduced-motion completes on first tap
     (spec: interaction points become simple taps); everywhere else three
     quick taps complete a hold for anyone who can't press-and-hold. */
  var taps = 0, timer = 0;
  function completeNow() {
    done = true; holding = false;
    cancelAnimationFrame(raf);
    if (fill) fill.style.width = '100%';
    try { onDone(true); } catch (e) {}
  }
  btn.addEventListener('click', function () {
    if (done) return;
    if (reducedMotion) { completeNow(); return; }
    taps++; window.clearTimeout(timer);
    timer = window.setTimeout(function () { taps = 0; }, 1200);
    if (taps >= 3) completeNow();
  });
}

/* ───────── scroll choreography ───────── */
function splitFallback() {
  $$('.split-lines').forEach(function (el) {
    if (el.dataset.split === '1') return;
    el.dataset.split = '1';
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    text.split('\n').forEach(function (line, li, arr) {
      var l = document.createElement('span'); l.className = 'line';
      line.split(' ').forEach(function (w) {
        if (!w) return;
        var s = document.createElement('span'); s.className = 'word'; s.textContent = w;
        l.appendChild(s); l.appendChild(document.createTextNode(' '));
      });
      el.appendChild(l);
      if (li < arr.length - 1) el.appendChild(document.createElement('br'));
    });
  });
}

function initScroll() {
  var progress = $('#progress span');
  var scenes = $$('.scene');

  /* mood switching drives the canvas weather per scene */
  var moodFor = function (id) {
    if (id === 'scene-1') return 'night';
    if (id === 'scene-2') return 'rain';
    if (id === 'scene-3') return 'petals';
    if (id === 'scene-4') return document.body.classList.contains('morning') ? 'morning' : 'dawn';
    return 'morning';
  };
  try {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          mode = moodFor(en.target.id);
          if (en.target.id === 'scene-4' && !document.body.classList.contains('morning')) mode = 'dawn';
          if (en.target.id === 'scene-5') document.body.classList.add('lit');
        }
        if (!hasST || reducedMotion) {
          if (en.isIntersecting) {
            $$('.reveal', en.target).forEach(function (el) {
              el.style.opacity = '1'; el.style.transform = 'none';
              el.style.transition = 'opacity .8s ease, transform .8s ease';
            });
          }
        }
      });
    }, { threshold: 0.25 });
    scenes.forEach(function (s) { io.observe(s); });
  } catch (e) {
    $$('.reveal').forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
  }

  if (!hasST || reducedMotion) {
    document.body.classList.add('no-gsap');
    if (progress) progress.style.transform = 'scaleX(1)';
    splitFallback();
    return;
  }

  /* smooth scroll */
  try {
    if (window.Lenis && !reducedMotion) {
      var lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      window.__lenis = lenis;
      lenis.on('scroll', function () { try { ScrollTrigger.update(); } catch (e) {} });
      gsap.ticker.add(function (time) { try { lenis.raf(time * 1000); } catch (e) {} });
      gsap.ticker.lagSmoothing(0);
    }
  } catch (e) {}

  /* headline splitting */
  try {
    if (window.SplitText) {
      $$('.split-lines').forEach(function (el) {
        var st = new SplitText(el, { type: 'lines,words', linesClass: 'line', wordsClass: 'word' });
        gsap.from(st.words, { yPercent: 110, opacity: 0, stagger: 0.06, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%' } });
      });
    } else splitFallback();
  } catch (e) { splitFallback(); }

  /* gentle reveals */
  try {
    $$('.reveal').forEach(function (el) {
      if (el.closest('.split-lines')) return;
      gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 86%' } });
    });
  } catch (e) {}

  /* global progress + slow world-warming scrub */
  try {
    gsap.to(progress, { scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: 0.4 } });
    /* bridge draws itself as she arrives (DrawSVG if present, dash fallback) */
    var arc = $('#bridge-arc');
    if (arc) {
      try {
        if (window.DrawSVGPlugin) {
          gsap.from(arc, { drawSVG: '0%', duration: 1.6, ease: 'power2.inOut',
            scrollTrigger: { trigger: '#scene-3', start: 'top 65%' } });
        } else {
          var len = arc.getTotalLength();
          arc.style.strokeDasharray = String(len);
          arc.style.strokeDashoffset = String(len);
          gsap.to(arc, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut',
            scrollTrigger: { trigger: '#scene-3', start: 'top 65%' } });
        }
      } catch (e) {}
    }
    /* walkers cross the bridge, scrubbed */
    gsap.to('.walker-a', { x: 300, duration: 2, ease: 'none',
      scrollTrigger: { trigger: '#scene-3', start: 'top 70%', end: 'center 30%', scrub: 1 } });
    gsap.to('.walker-b', { x: 240, duration: 2, ease: 'none',
      scrollTrigger: { trigger: '#scene-3', start: 'top 70%', end: 'center 30%', scrub: 1 } });
    /* parallax on illustrated worlds (wraps carry captions along) */
    $$('.svg-wrap').forEach(function (w) {
      gsap.fromTo(w, { y: 40 }, { y: -40, ease: 'none',
        scrollTrigger: { trigger: w, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    });
    /* pinned breath on the journey stage (desktop only — mobile keeps native flow) */
    var mm = gsap.matchMedia();
    mm.add('(min-width: 701px)', function () {
      gsap.to('.stage-journey', { scale: 1.015, ease: 'none',
        scrollTrigger: { trigger: '#scene-3', start: 'top top+=80', end: '+=55%', pin: '.stage-journey', scrub: 0.6 } });
    });
    mm.add('(max-width: 700px)', function () {
      /* fewer simultaneous tweens on phones: nothing pinned */
    });
  } catch (e) {}

  try {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { try { ScrollTrigger.refresh(); } catch (e) {} });
    window.addEventListener('load', function () { try { ScrollTrigger.refresh(); } catch (e) {} });
  } catch (e) {}
}

/* idle micro-behaviours: blink loops for Piku + Bupu (CSS handles most) */
function initIdle() {
  if (reducedMotion || !hasGSAP) return;
  try {
    /* Piku waiting blink */
    gsap.to('#piku-waiting .piku-wait-eye', { scaleY: 0.08, transformOrigin: 'center', duration: 0.09, yoyo: true, repeat: 1, repeatDelay: 3.4,
      onRepeat: function () { try { this.repeatDelay(2.4 + Math.random() * 2.5); } catch (e) {} } });
    /* follower blink */
    gsap.to('#piku-follower .pf-eye', { scaleY: 0.1, transformOrigin: 'center', duration: 0.09, yoyo: true, repeat: -1, repeatDelay: 3.8 });
    /* circling Piku in resolution */
    var c = $('#piku-circle');
    if (c) {
      var t = 0;
      gsap.ticker.add(function (_, dt) {
        try {
          var r = c.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight + 200) return;
          t += (dt || 16) * 0.001;
          var cx = 450 + Math.cos(t * 0.7) * 260, cy = 210 + Math.sin(t * 0.7) * 60;
          c.setAttribute('transform', 'translate(' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ') rotate(' + (Math.sin(t) * 8).toFixed(1) + ')');
        } catch (e) {}
      });
    }
  } catch (e) {}
}

/* ───────── main loop ───────── */
var lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (document.hidden) { lastT = t; return; }
  var dt = Math.min((t - lastT) || 16, 50);
  lastT = t;
  try { tickFollower(dt / 1000); } catch (e) {}
  try { tickCat(); } catch (e) {}
  try { tickPhysics(dt); } catch (e) {}
  try { drawParticles(t, dt); } catch (e) {}
}

function boot() {
  initCanvas();
  initInteractions();
  initScroll();
  initIdle();
  try { sizeCanvas(); } catch (e) {}
  requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(loop); });
  /* if she never taps Piku, still let the follower appear after first scroll */
  try {
    window.addEventListener('scroll', function wake() {
      if (window.scrollY > window.innerHeight * 0.4 && !document.body.classList.contains('awake')) {
        document.body.classList.add('awake');
      }
    }, { passive: true, once: false });
  } catch (e) {}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
