/* ==========================================================================
   dashboard.js
   Živá ukážka mobilnej aplikácie Žumpuj.sk.
   Scenár (spustí sa keď je telefón viditeľný, dá sa prehrať znova):
     1. senzor meria a posiela dáta        → hladina stúpa, graf sa dokresľuje
     2. AI predikuje dátum naplnenia       → záznam vo feede
     3. prekročený limit 85 %              → varovanie
     4. systém sám objedná vývoz           → toast + CTA + jazdiace auto
     5. vyvezené, doklad o spracovaní      → hladina klesne, eko potvrdenie
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var phone     = document.getElementById('phone');
  if (!phone) return;

  var gaugeFill = document.getElementById('gaugeFill');
  var gaugeVal  = document.getElementById('gaugeVal');
  var feed      = document.getElementById('uiFeed');
  var toasts    = document.getElementById('toasts');
  var cta       = document.getElementById('uiCta');
  var ctaSub    = document.getElementById('uiCtaSub');
  var trend     = document.getElementById('chartTrend');
  var truck     = document.getElementById('roadTruck');
  var replay    = document.getElementById('replayApp');

  var lineEl = document.getElementById('chartLine');
  var areaEl = document.getElementById('chartArea');
  var dotEl  = document.getElementById('chartDot');

  var timers = [];
  var rafId = null;
  var playing = false;

  function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearAll() {
    timers.forEach(clearTimeout); timers = [];
    if (rafId) cancelAnimationFrame(rafId), rafId = null;
  }

  /* ------------------------------------------------------------- GRAF ---- */
  var W = 260, H = 80;
  function buildData(n, endVal) {
    var d = [], v = 6;
    for (var i = 0; i < n; i++) {
      v += (endVal - 6) / (n - 1) * (0.75 + Math.random() * 0.5);
      d.push(Math.min(100, Math.max(2, v)));
    }
    d[n - 1] = endVal;
    return d;
  }
  var DATA = buildData(30, 38);

  function pathFrom(data, upto) {
    var pts = [];
    for (var i = 0; i < upto; i++) {
      var x = (i / (data.length - 1)) * W;
      var y = H - (data[i] / 100) * H;
      pts.push([x, y]);
    }
    if (!pts.length) return { line: '', area: '', last: [0, H] };
    var line = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    var area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    return { line: line, area: area, last: pts[pts.length - 1] };
  }

  function drawChart(upto) {
    var p = pathFrom(DATA, upto);
    lineEl.setAttribute('d', p.line);
    areaEl.setAttribute('d', p.area);
    dotEl.setAttribute('cx', p.last[0]);
    dotEl.setAttribute('cy', p.last[1]);
  }

  function animateChart(done) {
    if (REDUCED) { drawChart(DATA.length); done && done(); return; }
    var i = 1;
    (function step() {
      drawChart(i);
      if (i++ < DATA.length) rafId = requestAnimationFrame(step);
      else { rafId = null; done && done(); }
    })();
  }

  /* ------------------------------------------------------------ HLADINA -- */
  var level = 38;
  function setLevel(v) {
    level = v;
    gaugeFill.style.height = v + '%';
    gaugeVal.textContent = Math.round(v);
    gaugeFill.classList.toggle('warn', v >= 85);
  }

  function rampLevel(from, to, ms, done) {
    if (REDUCED) { setLevel(to); done && done(); return; }
    var t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      setLevel(from + (to - from) * e);
      if (k < 1) rafId = requestAnimationFrame(step);
      else { rafId = null; done && done(); }
    })(t0);
  }

  /* --------------------------------------------------------------- FEED -- */
  function addFeed(text, meta, kind) {
    var el = document.createElement('div');
    el.className = 'ui__feed-item' + (kind ? ' ' + kind : '');
    el.innerHTML = '<span class="ui__feed-dot"></span><span>' + text + '</span><i>' + meta + '</i>';
    feed.appendChild(el);
    while (feed.children.length > 3) feed.removeChild(feed.firstChild);
  }

  /* ------------------------------------------------------------- TOASTY -- */
  var ICONS = {
    signal: '#i-signal', bolt: '#i-bolt', truck: '#i-truck', leaf: '#i-leaf', shield: '#i-shield'
  };
  function toast(title, sub, kind, icon, life) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML =
      '<span class="toast__ico"><svg viewBox="0 0 24 24"><use href="' + (ICONS[icon] || ICONS.signal) + '"></use></svg></span>' +
      '<span><b>' + title + '</b><span>' + sub + '</span></span>';
    toasts.appendChild(el);
    after(life || 3200, function () {
      el.classList.add('out');
      after(500, function () { el.remove(); });
    });
  }

  /* ------------------------------------------------------------ SCENÁR --- */
  function reset() {
    clearAll();
    toasts.innerHTML = '';
    feed.innerHTML = '';
    cta.classList.remove('on');
    truck.classList.remove('go');
    trend.textContent = '+2,1 % / deň';
    setLevel(38);
    drawChart(1);
  }

  function play() {
    if (playing) return;
    playing = true;
    reset();

    // 1) meranie
    after(300, function () {
      animateChart();
      addFeed('<b>Senzor</b> odoslal meranie', 'teraz');
      toast('Senzor online', 'Solárne napájanie · 100 %', 'ok', 'bolt', 2600);
    });

    // 2) hladina stúpa + AI predikcia
    after(1900, function () {
      rampLevel(38, 86, 5200);
      trend.textContent = '+2,4 % / deň';
    });
    after(3400, function () {
      addFeed('<b>AI predikcia:</b> plno o 6 dní', 'dnes');
      toast('Predikcia aktualizovaná', 'Vývoz odporúčaný do 6 dní', '', 'signal', 3000);
    });

    // 3) limit
    after(7100, function () {
      addFeed('Prekročený limit <b>85 %</b>', 'teraz', 'warn');
      toast('Hladina 85 %', 'Spúšťam automatické objednanie', 'warn', 'shield', 3000);
    });

    // 4) objednanie + auto
    after(8600, function () {
      cta.classList.add('on');
      ctaSub.textContent = 'zajtra 09:00 – 11:00 · bez vášho zásahu';
      addFeed('<b>Vývoz objednaný</b> automaticky', 'zajtra', 'ok');
      toast('Vývoz objednaný', 'Nemusíte byť doma — máte výpusť', 'ok', 'truck', 3600);
      if (!REDUCED) { truck.classList.add('go'); }
    });

    // 5) vyvezené + eko doklad
    after(12800, function () {
      rampLevel(86, 7, 2200);
      trend.textContent = '−79 % / dnes';
      ctaSub.textContent = 'hotovo · doklad v aplikácii';
      addFeed('<b>Vyvezené</b> · 6 400 l', 'dnes', 'ok');
      toast('Ekologicky spracované', 'Potvrdenie z čistiarne uložené', 'ok', 'leaf', 4000);
    });

    after(17600, function () {
      playing = false;
      truck.classList.remove('go');
    });
  }

  /* ------------------------------------------- spustenie pri scrollovaní -- */
  drawChart(1);
  setLevel(38);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { play(); }
      });
    }, { threshold: 0.35 });
    io.observe(phone);
  } else {
    play();
  }

  if (replay) replay.addEventListener('click', function () { playing = false; play(); });

  /* ------------------------------------------------- 3D náklon telefónu -- */
  var frame = phone.querySelector('.phone__frame');
  if (frame && window.matchMedia('(pointer:fine)').matches && !REDUCED) {
    phone.addEventListener('pointermove', function (e) {
      var r = phone.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      frame.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
      frame.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
    }, { passive: true });
    phone.addEventListener('pointerleave', function () {
      frame.style.setProperty('--ry', '0deg');
      frame.style.setProperty('--rx', '0deg');
    });
  }
})();
