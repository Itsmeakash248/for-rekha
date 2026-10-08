/* For Rekha — scroll choreography (GSAP + Lenis, with reduced-motion + no-CDN fallbacks) */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var story = document.getElementById("story");
  var hint = document.getElementById("scrollHint");
  var railFill = document.getElementById("railFill");
  var dots = Array.prototype.slice.call(document.querySelectorAll("#railDots span"));
  var sections = ["ch1","ch2","ch3","ch4","ch5","ch6","ch7"].map(function (id) { return document.getElementById(id); });

  /* ---------- helpers ---------- */
  function splitToChars(el) {
    if (!el || el.dataset.splitDone) return [];
    el.dataset.splitDone = "1";
    // Prefer GSAP SplitText when available
    try {
      if (window.SplitText && window.gsap) {
        var st = null;
        if (typeof SplitText.create === "function") st = SplitText.create(el, { type: "chars,words", charsClass: "char" });
        else st = new SplitText(el, { type: "chars,words", charsClass: "char" });
        return el.querySelectorAll(".char");
      }
    } catch (e) { /* fall through to manual */ }
    var text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    var out = [];
    Array.prototype.forEach.call(text, function (ch) {
      var s = document.createElement("span");
      s.className = "char";
      s.textContent = ch === " " ? "\u00A0" : ch;
      if (ch === " ") s.style.width = ".28em";
      el.appendChild(s);
      out.push(s);
    });
    return out;
  }

  function markDots(i) {
    dots.forEach(function (d, k) { d.classList.toggle("on", k === i); });
  }

  /* ---------- reduced motion / no-GSAP path: content first ---------- */
  function reducedFallback() {
    document.body.classList.add("reduced");
    var els = document.querySelectorAll(".whisper,.opening-line,.opening-sub,.opening-second,.wline,.replay-title,.memory,.peak-word,.peak-side,.peak-base,.bento-title,.bcard,.resolve-title,.resolve-text,.close-name,.close-line,.close-sign");
    els.forEach(function (el) { el.classList.add("fade"); });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
      }, { threshold: 0.15 });
      els.forEach(function (el) { io.observe(el); });
    } else {
      els.forEach(function (el) { el.classList.add("is-visible"); });
    }
    var dawn = document.querySelector(".dawn");
    if (dawn) dawn.style.opacity = ".55";
  }

  if (reduceMotion) { reducedFallback(); return; }
  if (!window.gsap) { reducedFallback(); return; }
  gsap.registerPlugin(ScrollTrigger);
  try { if (window.SplitText) gsap.registerPlugin(SplitText); } catch (e) {}

  /* ---------- smooth scroll (Lenis) ---------- */
  var lenis = null;
  try {
    if (window.Lenis && !reduceMotion) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  } catch (e) { lenis = null; }

  /* ---------- split headlines ---------- */
  var openChars = splitToChars(document.querySelector("#ch1 .opening-line"));
  var replayChars = splitToChars(document.querySelector(".replay-title"));
  var peakChars = splitToChars(document.querySelector(".peak-word"));
  var resolveChars = splitToChars(document.querySelector(".resolve-title"));
  var closeChars = splitToChars(document.querySelector(".close-name"));

  /* ---------- canvases ---------- */
  var isSmall = window.matchMedia("(max-width: 820px)").matches;
  var saveDataS = false;
  try { saveDataS = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  var dustT = 0.35, calmT = 0; // scrub-driven uniforms

  function makeDust() {
    var cv = document.getElementById("dust");
    if (!cv) return null;
    var ctx = cv.getContext("2d");
    var W = 0, H = 0, ps = [], visible = false, t0 = performance.now();
    var N = saveDataS ? 50 : (isSmall ? 110 : 300);
    function resize() {
      var r = cv.parentElement.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.max(320, r.width); H = Math.max(320, r.height);
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function seed() {
      ps = [];
      for (var i = 0; i < N; i++) {
        ps.push({
          sx: Math.random() * W, sy: Math.random() * H,
          ex: Math.random() * W, ey: H * (0.32 + Math.random() * 0.36),
          r: 0.6 + Math.random() * 1.8,
          c: Math.random() < 0.55 ? "200,162,162" : "140,147,173",
          a: 0.25 + Math.random() * 0.55,
          ph: Math.random() * Math.PI * 2,
          sp: 0.4 + Math.random() * 0.8
        });
      }
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      var e = dustT < 0.5 ? 2 * dustT * dustT : 1 - Math.pow(-2 * dustT + 2, 2) / 2;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        var x = p.sx + (p.ex - p.sx) * e + Math.sin(t * p.sp + p.ph) * 10 * (1 - e * 0.6);
        var y = p.sy + (p.ey - p.sy) * e + Math.cos(t * p.sp * 0.8 + p.ph) * 8 * (1 - e * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, 6.283);
        ctx.fillStyle = "rgba(" + p.c + "," + (p.a * (0.5 + e * 0.7)).toFixed(3) + ")";
        ctx.fill();
      }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.02 })
        .observe(document.getElementById("ch3"));
    } else visible = true;
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
    return { resize: resize };
  }

  function makeCalm() {
    var cv = document.getElementById("calm");
    if (!cv) return null;
    var ctx = cv.getContext("2d");
    var S = 0, ps = [], visible = false, t0 = performance.now();
    var N = saveDataS ? 40 : (isSmall ? 80 : 170);
    function resize() {
      var r = cv.parentElement.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      S = Math.max(200, Math.min(r.width, r.height));
      cv.width = S * dpr; cv.height = S * dpr;
      cv.style.width = S + "px"; cv.style.height = S + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function seed() {
      ps = [];
      for (var i = 0; i < N; i++) {
        var a = Math.random() * Math.PI * 2;
        ps.push({ a: a, r0: S * (0.08 + Math.random() * 0.38), j: (Math.random() - 0.5) * 0.12, s: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28 });
      }
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, S, S);
      var cx = S / 2, cy = S / 2, R = S * 0.36;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283);
      ctx.strokeStyle = "rgba(232,220,207," + (0.10 + calmT * 0.30).toFixed(3) + ")";
      ctx.lineWidth = 1; ctx.stroke();
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        var ang = p.a + t * 0.05 * (1 - calmT * 0.6);
        var rad = p.r0 + (R - p.r0) * calmT + Math.sin(t * 0.7 + p.ph) * 4 * (1 - calmT * 0.8);
        var x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
        ctx.beginPath(); ctx.arc(x, y, p.s, 0, 6.283);
        var warm = calmT > 0.5 ? "233,217,195" : "200,162,162";
        ctx.fillStyle = "rgba(" + warm + "," + (0.35 + calmT * 0.5).toFixed(3) + ")";
        ctx.fill();
      }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.05 })
        .observe(document.getElementById("ch6"));
    } else visible = true;
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
    return { resize: resize };
  }
  makeDust();
  makeCalm();

  /* ---------- overall progress + dawn ---------- */
  gsap.to("#railFill", {
    scaleY: 1, ease: "none",
    scrollTrigger: { trigger: "#story", start: "top top", end: "bottom bottom", scrub: 0.6 }
  });
  gsap.to(".dawn", {
    opacity: 1, ease: "none",
    scrollTrigger: { trigger: "#story", start: "52% top", end: "92% bottom", scrub: 1 }
  });
  ScrollTrigger.create({
    trigger: "#ch7", start: "top 60%",
    onEnter: function () { document.body.classList.add("dawn-on"); },
    onLeaveBack: function () { document.body.classList.remove("dawn-on"); }
  });
  sections.forEach(function (sec, i) {
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: "top center", end: "bottom center",
      onToggle: function (self) { if (self.isActive) markDots(i); } });
  });
  markDots(0);
  if (hint) {
    ScrollTrigger.create({ trigger: "#story", start: "4% top",
      onEnter: function () { hint.style.opacity = "0"; },
      onLeaveBack: function () { hint.style.opacity = "1"; } });
  }

  /* ---------- choreography ---------- */
  var mm = gsap.matchMedia();

  // Desktop: full pins
  mm.add("(min-width: 821px)", function () {
    // CH1 — opening wakes with first scroll
    var tl1 = gsap.timeline({ scrollTrigger: { trigger: "#ch1", start: "top top", end: "+=180%", pin: true, scrub: 1 } });
    tl1.from(openChars, { yPercent: 90, opacity: 0, rotate: 2, stagger: 0.05, ease: "power2.out" }, 0)
       .from(".opening-sub", { y: 26, opacity: 0, ease: "power2.out" }, 0.45)
       .to("#openingSecond", { opacity: 1, y: 0, ease: "power2.out" }, 0.7)
       .to("#ch1 .ghost", { yPercent: -40, ease: "none" }, 0);

    // CH2 — lines read at scroll pace
    var tl2 = gsap.timeline({ scrollTrigger: { trigger: "#ch2", start: "top top", end: "+=250%", pin: true, scrub: 1 } });
    tl2.from("#ch2 .whisper", { y: 20, opacity: 0 }, 0)
       .from("[data-wline]", { y: 80, opacity: 0, stagger: 0.35, ease: "power2.out" }, 0.1)
       .to("#ch2 .ghost", { yPercent: -40, ease: "none" }, 0);

    // CH3 — horizontal memories + particle realign
    var track = document.getElementById("hTrack");
    function dist() { return Math.max(0, track.scrollWidth - window.innerWidth); }
    var tl3 = gsap.timeline({ scrollTrigger: { trigger: "#ch3", start: "top top", end: "+=450%", pin: true, scrub: 1,
      onUpdate: function (self) { dustT = 0.15 + self.progress * 0.75; } } });
    tl3.from(replayChars, { yPercent: 80, opacity: 0, stagger: 0.04, ease: "power2.out" }, 0)
       .to(track, { x: function () { return -dist(); }, ease: "none" }, 0.1)
       .from(".memory", { y: 60, opacity: 0.25, stagger: 0.08, ease: "power1.out" }, 0.15)
       .to("#ch3 .replay-note", { opacity: 0.25, ease: "none" }, 0.8);

    // CH4 — peak
    var tl4 = gsap.timeline({ scrollTrigger: { trigger: "#ch4", start: "top top", end: "+=250%", pin: true, scrub: 1 } });
    tl4.from(peakChars, { yPercent: 110, opacity: 0, stagger: 0.06, ease: "expo.out" }, 0)
       .fromTo("#ch4 .whisper", { opacity: 0 }, { opacity: 1 }, 0.1)
       .to(".peak-side.left", { opacity: 1, x: 30, ease: "power2.out" }, 0.55)
       .to(".peak-side.right", { opacity: 1, x: -30, ease: "power2.out" }, 0.62)
       .to(".peak-base", { opacity: 1, y: 0, ease: "power2.out" }, 0.75)
       .to("#ch4 .ghost", { yPercent: -30, ease: "none" }, 0);

    // CH5 — bento
    var tl5 = gsap.timeline({ scrollTrigger: { trigger: "#ch5", start: "top top", end: "+=250%", pin: true, scrub: 1 } });
    tl5.from(".bento-title", { y: 60, opacity: 0, ease: "power2.out" }, 0)
       .from(".bcard", { y: 70, opacity: 0, stagger: 0.12, ease: "power2.out" }, 0.15);

    // CH6 — slow resolve
    var tl6 = gsap.timeline({ scrollTrigger: { trigger: "#ch6", start: "top top", end: "+=320%", pin: true, scrub: 1,
      onUpdate: function (self) { calmT = self.progress; } } });
    tl6.from(resolveChars, { yPercent: 70, opacity: 0, stagger: 0.03, ease: "power2.out" }, 0)
       .from(".resolve-text", { y: 34, opacity: 0, stagger: 0.2, ease: "power2.out" }, 0.35)
       .from(".ring-wrap", { scale: 0.9, opacity: 0.4, ease: "none" }, 0);

    // CH7 — gentle arrival (no pin, scrubbed reveal + idle CSS breath)
    gsap.from(closeChars, { yPercent: 60, opacity: 0, stagger: 0.05, ease: "power2.out",
      scrollTrigger: { trigger: "#ch7", start: "top 75%", end: "top 25%", scrub: 1 } });
    gsap.from(".close-line,.close-sign", { y: 26, opacity: 0, stagger: 0.2, ease: "power2.out",
      scrollTrigger: { trigger: "#ch7", start: "top 55%", end: "center 45%", scrub: 1 } });
  });

  // Mobile: lighter, fewer pins
  mm.add("(max-width: 820px)", function () {
    gsap.from(openChars, { yPercent: 60, opacity: 0, stagger: 0.04, ease: "power2.out",
      scrollTrigger: { trigger: "#ch1", start: "top 80%", end: "top 20%", scrub: 1 } });
    gsap.to("#openingSecond", { opacity: 1, y: 0, ease: "none",
      scrollTrigger: { trigger: "#ch1", start: "top 30%", end: "bottom 60%", scrub: 1 } });
    gsap.utils.toArray("[data-wline]").forEach(function (el) {
      gsap.from(el, { y: 40, opacity: 0, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", end: "top 55%", scrub: 1 } });
    });
    // One special horizontal moment, shorter + fewer particles already capped
    var track = document.getElementById("hTrack");
    var tl3m = gsap.timeline({ scrollTrigger: { trigger: "#ch3", start: "top top", end: "+=220%", pin: true, scrub: 1,
      onUpdate: function (self) { dustT = 0.15 + self.progress * 0.75; } } });
    tl3m.to(track, { x: function () { return -(track.scrollWidth - window.innerWidth); }, ease: "none" }, 0);

    gsap.from(peakChars, { yPercent: 80, opacity: 0, stagger: 0.05, ease: "power2.out",
      scrollTrigger: { trigger: "#ch4", start: "top 80%", end: "top 30%", scrub: 1 } });
    gsap.from(".peak-side,.peak-base", { y: 24, opacity: 0, stagger: 0.1,
      scrollTrigger: { trigger: "#ch4", start: "top 45%", end: "center 30%", scrub: 1 } });
    gsap.from(".bcard", { y: 40, opacity: 0, stagger: 0.08,
      scrollTrigger: { trigger: ".bento", start: "top 85%", end: "bottom 45%", scrub: 1 } });
    var st6 = ScrollTrigger.create({ trigger: "#ch6", start: "top 80%", end: "bottom 40%", scrub: 1,
      onUpdate: function (self) { calmT = self.progress; } });
    gsap.from(".resolve-title,.resolve-text", { y: 30, opacity: 0, stagger: 0.12,
      scrollTrigger: { trigger: "#ch6", start: "top 75%", end: "center 40%", scrub: 1 } });
    gsap.from(".close-name", { y: 40, opacity: 0,
      scrollTrigger: { trigger: "#ch7", start: "top 80%", end: "top 45%", scrub: 1 } });
    return function () { if (st6) st6.kill(); };
  });

  /* ---------- refresh after fonts/layout ---------- */
  function refresh() { try { ScrollTrigger.refresh(); } catch (e) {} }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(refresh, 50); });
  window.addEventListener("load", function () { setTimeout(refresh, 150); });
  var rT = null;
  window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(refresh, 250); });
})();
