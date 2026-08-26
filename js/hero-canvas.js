/* ==========================================================================
   hero-canvas.js
   1) Pozadie hero sekcie — vrstvené vlny + stúpajúce bubliny + dátové častice,
      ktoré reagujú na pohyb myši (ripple).
   2) Interaktívna nádrž (žumpa) — hladina reaguje na kurzor / dotyk,
      senzor posiela sonar ping, HUD dopočítava odhad vývozu.
   Bez závislostí. Rešpektuje prefers-reduced-motion a Page Visibility API.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ------------------------------------------------------------------ util */
  function fit(canvas) {
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * DPR));
    canvas.height = Math.max(1, Math.round(r.height * DPR));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { w: r.width, h: r.height, ctx: ctx };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ==========================================================================
     1) HERO POZADIE
     ========================================================================== */
  (function heroBackground() {
    var cv = document.getElementById('heroCanvas');
    if (!cv) return;

    var ctx, W, H;
    var particles = [];
    var bubbles = [];
    var ripples = [];
    var mouse = { x: -999, y: -999, tx: -999, ty: -999, active: false };
    var t = 0;
    var running = true;

    function build() {
      var m = fit(cv); W = m.w; H = m.h; ctx = m.ctx;

      var count = Math.round(clamp(W / 16, 40, 130));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: Math.random() * 1.5 + 0.4,
          a: Math.random() * 0.5 + 0.12
        });
      }

      bubbles = [];
      var bc = Math.round(clamp(W / 44, 12, 34));
      for (var j = 0; j < bc; j++) bubbles.push(newBubble(true));
    }

    function newBubble(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : H + 20,
        r: Math.random() * 5 + 1.5,
        v: Math.random() * 0.5 + 0.18,
        w: Math.random() * 0.9 + 0.3,
        p: Math.random() * Math.PI * 2
      };
    }

    /* --- vlny --- */
    var LAYERS = [
      // off = pokoj. hladina ako podiel výšky hero. Držať ≥ .94, inak vlny
      // vylezú do textu (štatistiky a poznámka pod CTA sedia okolo .88–.92).
      { amp: 18, len: 0.0042, sp: 0.00055, off: 0.945, c1: 'rgba(30,84,75,.62)',   c2: 'rgba(30,84,75,0)' },
      { amp: 14, len: 0.0060, sp: 0.00085, off: 0.968, c1: 'rgba(59,136,123,.42)', c2: 'rgba(59,136,123,0)' },
      { amp: 10, len: 0.0090, sp: 0.00130, off: 0.988, c1: 'rgba(89,188,171,.28)', c2: 'rgba(89,188,171,0)' }
    ];

    function waveY(L, x) {
      var base = H * L.off;
      // pozn.: sp je posun fázy v radiánoch NA SNÍMKU – držať pod ~0.02,
      // inak vlna nepláva, ale vibruje (pri 60 fps je 0.02 rad ≈ 0,2 Hz).
      var y = base + Math.sin(x * L.len + t * L.sp * 16) * L.amp
                   + Math.sin(x * L.len * 2.3 + t * L.sp * 26) * (L.amp * 0.35);
      // vplyv kurzora – vlna sa "nadvihne" pri myši
      if (mouse.active) {
        var d = Math.abs(x - mouse.x);
        if (d < 260) {
          var f = (1 - d / 260);
          y -= f * f * 20 * clamp((H - mouse.y) / H, 0, 1);
        }
      }
      return y;
    }

    function drawWaves() {
      for (var i = 0; i < LAYERS.length; i++) {
        var L = LAYERS[i];
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (var x = 0; x <= W; x += 8) ctx.lineTo(x, waveY(L, x));
        ctx.lineTo(W, H);
        ctx.closePath();
        var g = ctx.createLinearGradient(0, H * L.off - L.amp, 0, H);
        g.addColorStop(0, L.c1);
        g.addColorStop(1, L.c2);
        ctx.fillStyle = g;
        ctx.fill();

        // svetlý okraj hladiny
        ctx.beginPath();
        for (var x2 = 0; x2 <= W; x2 += 8) {
          var y2 = waveY(L, x2);
          if (x2 === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
        }
        ctx.strokeStyle = 'rgba(89,188,171,' + (0.10 + i * 0.06) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;

        // odtláčanie od kurzora
        if (mouse.active) {
          var dx = p.x - mouse.x, dy = p.y - mouse.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 26000 && d2 > 1) {
            var d = Math.sqrt(d2);
            p.x += (dx / d) * (1 - d / 161) * 1.6;
            p.y += (dy / d) * (1 - d / 161) * 1.6;
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(175,225,215,' + p.a + ')';
        ctx.fill();
      }
    }

    function drawBubbles() {
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        b.y -= b.v;
        b.p += 0.02;
        var x = b.x + Math.sin(b.p) * (b.w * 8);
        if (b.y < H * 0.55) { bubbles[i] = newBubble(false); continue; }
        ctx.beginPath();
        ctx.arc(x, b.y, b.r, 0, 6.2832);
        ctx.strokeStyle = 'rgba(89,188,171,.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function drawRipples() {
      for (var i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i];
        r.r += r.v;
        r.a *= 0.965;
        if (r.a < 0.01) { ripples.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, 6.2832);
        ctx.strokeStyle = 'rgba(89,188,171,' + r.a + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    function frame() {
      if (!running) return;
      t += 1;
      mouse.x = lerp(mouse.x, mouse.tx, 0.09);
      mouse.y = lerp(mouse.y, mouse.ty, 0.09);
      ctx.clearRect(0, 0, W, H);
      drawParticles();
      drawWaves();
      drawBubbles();
      drawRipples();
      requestAnimationFrame(frame);
    }

    function still() {
      ctx.clearRect(0, 0, W, H);
      drawWaves();
      drawParticles();
    }

    build();
    window.addEventListener('resize', function () { build(); if (REDUCED) still(); }, { passive: true });

    var hero = document.getElementById('hero');
    if (hero && !REDUCED) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        mouse.tx = e.clientX - r.left;
        mouse.ty = e.clientY - r.top;
        if (!mouse.active) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
        mouse.active = true;
      }, { passive: true });
      hero.addEventListener('pointerleave', function () { mouse.active = false; mouse.tx = -999; mouse.ty = -999; });
      hero.addEventListener('pointerdown', function (e) {
        var r = hero.getBoundingClientRect();
        ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 4, v: 2.6, a: 0.55 });
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; }
      else if (!REDUCED) { running = true; requestAnimationFrame(frame); }
    });

    if (REDUCED) still(); else requestAnimationFrame(frame);
  })();

  /* ==========================================================================
     2) INTERAKTÍVNA NÁDRŽ
     ========================================================================== */
  (function tankSim() {
    var wrap = document.getElementById('tank');
    var cv = document.getElementById('tankCanvas');
    if (!wrap || !cv) return;

    var pctEl = document.getElementById('tankPct');
    var etaEl = document.getElementById('tankEta');

    var ctx, W, H;
    var level = 0.42;        // aktuálna hladina 0–1
    var target = 0.42;       // cieľová hladina
    var auto = true;         // bez interakcie pomaly stúpa
    var t = 0;
    var running = true;
    var drops = [];

    function build() { var m = fit(cv); W = m.w; H = m.h; ctx = m.ctx; }

    function surfaceY(x) {
      var base = H * (1 - level);
      return base
        + Math.sin(x * 0.028 + t * 0.016) * 5
        + Math.sin(x * 0.012 - t * 0.009) * 3.4;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      /* stena nádrže / mriežka */
      ctx.strokeStyle = 'rgba(247,247,243,.05)';
      ctx.lineWidth = 1;
      for (var gy = 0; gy < H; gy += 28) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      /* stupnica */
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(247,247,243,.28)';
      for (var p = 0; p <= 100; p += 25) {
        var y = H * (1 - p / 100);
        ctx.fillRect(W - 26, y - 0.5, 12, 1);
        ctx.fillText(p + '', W - 44, y + 3);
      }

      /* kvapalina */
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 6) ctx.lineTo(x, surfaceY(x));
      ctx.lineTo(W, H);
      ctx.closePath();
      var warn = level > 0.85;
      var g = ctx.createLinearGradient(0, H * (1 - level), 0, H);
      g.addColorStop(0, warn ? 'rgba(217,132,60,.85)' : 'rgba(89,188,171,.78)');
      g.addColorStop(1, warn ? 'rgba(150,72,28,.85)' : 'rgba(30,84,75,.92)');
      ctx.fillStyle = g;
      ctx.fill();

      /* lesk hladiny */
      ctx.beginPath();
      for (var x2 = 0; x2 <= W; x2 += 6) {
        var y2 = surfaceY(x2);
        if (x2 === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      /* senzor */
      var sx = W / 2, sy = 62;
      ctx.strokeStyle = 'rgba(101,136,59,.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - 15, sy - 20, 30, 40, 8) : ctx.rect(sx - 15, sy - 20, 30, 40);
      ctx.fillStyle = 'rgba(6,20,12,.85)';
      ctx.fill(); ctx.stroke();

      /* solárny panel */
      ctx.beginPath();
      ctx.moveTo(sx - 22, sy - 26); ctx.lineTo(sx + 22, sy - 26);
      ctx.lineTo(sx + 15, sy - 34); ctx.lineTo(sx - 15, sy - 34); ctx.closePath();
      ctx.fillStyle = 'rgba(101,136,59,.18)';
      ctx.strokeStyle = 'rgba(101,136,59,.8)';
      ctx.fill(); ctx.stroke();

      /* LED */
      var blink = 0.45 + Math.abs(Math.sin(t * 0.035)) * 0.55;
      ctx.beginPath(); ctx.arc(sx, sy - 8, 3.2, 0, 6.2832);
      ctx.fillStyle = 'rgba(101,136,59,' + blink + ')';
      ctx.fill();

      /* sonar lúč */
      var top = surfaceY(sx);
      ctx.save();
      ctx.setLineDash([4, 7]);
      ctx.lineDashOffset = -t * 0.55;
      ctx.strokeStyle = 'rgba(101,136,59,.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx, sy + 20); ctx.lineTo(sx, top - 2); ctx.stroke();
      ctx.restore();

      /* sonar odraz */
      var pingR = (t * 0.65) % 46;
      ctx.beginPath();
      ctx.ellipse(sx, top, pingR, pingR * 0.28, 0, 0, 6.2832);
      ctx.strokeStyle = 'rgba(101,136,59,' + (0.4 * (1 - pingR / 46)) + ')';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      /* padajúce kvapky */
      for (var i = drops.length - 1; i >= 0; i--) {
        var d = drops[i];
        d.y += d.v; d.v += 0.28;
        if (d.y >= surfaceY(d.x)) { drops.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 1.8, 3.4, 0, 0, 6.2832);
        ctx.fillStyle = 'rgba(175,225,215,.85)';
        ctx.fill();
      }

      /* varovný pruh */
      if (warn) {
        ctx.fillStyle = 'rgba(217,132,60,.10)';
        ctx.fillRect(0, 0, W, H);
      }
    }

    function updateHud() {
      var pct = Math.round(level * 100);
      if (pctEl) pctEl.textContent = pct + ' %';
      if (etaEl) {
        var remaining = Math.max(0, 85 - pct);
        var days = Math.round(remaining / 2.1);
        etaEl.textContent = pct >= 85 ? 'vývoz objednaný' : (days <= 1 ? 'zajtra' : 'o ' + days + ' dní');
        etaEl.style.color = pct >= 85 ? 'var(--warn)' : '';
      }
    }

    var hudTick = 0;
    function frame() {
      if (!running) return;
      t += 1;
      if (auto) {
        target += 0.00022;
        if (target > 0.97) target = 0.12;
      }
      level = lerp(level, clamp(target, 0.05, 0.97), 0.06);
      draw();
      if (++hudTick % 6 === 0) updateHud();
      requestAnimationFrame(frame);
    }

    function setFromPointer(e) {
      var r = wrap.getBoundingClientRect();
      var y = clamp((e.clientY - r.top) / r.height, 0, 1);
      target = clamp(1 - y, 0.05, 0.97);
      auto = false;
      // pár kvapiek pri interakcii
      var x = clamp(e.clientX - r.left, 6, r.width - 6);
      if (drops.length < 26) drops.push({ x: x, y: 24, v: 0.6 });
    }

    build();
    updateHud();
    window.addEventListener('resize', function () { build(); draw(); }, { passive: true });

    if (!REDUCED) {
      wrap.addEventListener('pointermove', setFromPointer, { passive: true });
      wrap.addEventListener('pointerdown', setFromPointer, { passive: true });
      wrap.addEventListener('pointerleave', function () {
        auto = true;
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) running = false;
      else if (!REDUCED) { running = true; requestAnimationFrame(frame); }
    });

    if (REDUCED) { draw(); }
    else requestAnimationFrame(frame);
  })();

})();
