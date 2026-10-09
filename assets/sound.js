/* Shared synth-only score for Rekha's worlds. Zero audio files. WebAudio only. Off by default. */
(function () {
  'use strict';
  var ctx = null, master = null, padNodes = [], enabled = false, motifTimer = null;
  var WORLD = null;
  try {
    var m = window.location.pathname.match(/\/([AFMRS])(?:\/index\.html|\/)?$/i);
    if (m) WORLD = m[1].toUpperCase();
  } catch (e) {}
  if (!WORLD) WORLD = 'HUB';

  var SCALES = {
    HUB: [220.0, 261.63, 329.63, 392.0, 440.0],
    S:   [196.0, 246.94, 293.66, 349.23, 392.0],
    R:   [207.65, 261.63, 311.13, 392.0, 466.16],
    F:   [261.63, 329.63, 392.0, 523.25, 587.33],
    A:   [174.61, 220.0, 261.63, 349.23, 392.0],
    M:   [220.0, 277.18, 329.63, 440.0, 554.37]
  };

  function ensureCtx() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0;
      // gentle lowpass so everything feels warm, never harsh
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.4;
      master.connect(lp); lp.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function fadeTo(v, t) {
    if (!ctx || !master) return;
    t = t || 2.0;
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(v, ctx.currentTime + t);
    } catch (e) {}
  }
  function startPad() {
    if (!ctx) return;
    stopPad();
    var scale = SCALES[WORLD] || SCALES.HUB;
    // two detuned warm sines + fifth, very quiet
    [scale[0] / 2, scale[2] / 2, scale[3] / 2].forEach(function (f, i) {
      try {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i === 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = (i - 1) * 4;
        g.gain.value = i === 2 ? 0.05 : 0.09;
        o.connect(g); g.connect(master); o.start();
        padNodes.push(o);
      } catch (e) {}
    });
    scheduleMotif();
  }
  function stopPad() {
    padNodes.forEach(function (o) { try { o.stop(); } catch (e) {} });
    padNodes = [];
    if (motifTimer) { clearTimeout(motifTimer); motifTimer = null; }
  }
  function pluck(freq, when, dur, vol) {
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      var t = ctx.currentTime + (when || 0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 2.2));
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + (dur || 2.2) + 0.1);
    } catch (e) {}
  }
  function scheduleMotif() {
    if (!enabled) return;
    var scale = SCALES[WORLD] || SCALES.HUB;
    // sparse pentatonic motif, never rushed: one note every 5-9s
    var seq = WORLD === 'M' ? [3, 4, 2, 4, 3] : WORLD === 'F' ? [4, 2, 3, 1, 2] : [0, 2, 1, 3, 2];
    var step = Math.floor(Math.random() * seq.length);
    pluck(scale[seq[step] % scale.length] * (WORLD === 'F' ? 2 : 1), 0.1, 3.0, 0.10);
    if (WORLD === 'M') setTimeout(function () { pluck(scale[4], 1.4, 4.0, 0.07); }, 1400);
    var saveData = false;
    try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
    motifTimer = setTimeout(scheduleMotif, saveData ? 12000 : 6000 + Math.random() * 4000);
  }

  function chime() { // chapter change shimmer
    if (!enabled || !ctx) return;
    var scale = SCALES[WORLD] || SCALES.HUB;
    pluck(scale[3], 0, 2.4, 0.08);
  }
  function heartbeat() { // M finale thump: two low sines
    if (!enabled || !ctx) return;
    [0, 0.32].forEach(function (off, i) {
      try {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = i === 0 ? 58 : 52;
        var t = ctx.currentTime + off;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.7);
      } catch (e) {}
    });
  }
  function petPurr() { // F: Miri purr — quick filtered blips
    if (!enabled || !ctx) return;
    for (var i = 0; i < 3; i++) pluck(523.25 + i * 40, i * 0.12, 0.5, 0.06);
  }

  function setEnabled(on, btn) {
    enabled = !!on;
    try { localStorage.setItem('rekha-sound', enabled ? 'on' : 'off'); } catch (e) {}
    if (enabled) {
      if (!ensureCtx()) return false;
      startPad(); fadeTo(0.5, 2.5);
    } else {
      fadeTo(0.0001, 0.8);
      setTimeout(stopPad, 900);
    }
    document.body.classList.toggle('sound-on', enabled);
    if (btn) {
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      var label = btn.querySelector('span');
      if (label) label.textContent = enabled ? 'sound on' : 'sound off';
      btn.classList.toggle('on', enabled);
    }
    document.dispatchEvent(new CustomEvent('rekha:sound', { detail: { on: enabled } }));
    return true;
  }
  function isOn() { return enabled; }

  // Restore preference (still off by default on first visit)
  var pref = null;
  try { pref = localStorage.getItem('rekha-sound'); } catch (e) {}
  // Don't autoplay — wait for user gesture. Just style toggle if pref==on.
  window.RekhaSound = { enable: function (b) { return setEnabled(true, b); }, disable: function (b) { return setEnabled(false, b); }, toggle: function (b) { return setEnabled(!enabled, b); }, chime: chime, heartbeat: heartbeat, purr: petPurr, isOn: isOn, world: WORLD };
  window.addEventListener('DOMContentLoaded', function () {
    if (pref === 'on') document.body.classList.add('sound-was-on');
  });
})();
