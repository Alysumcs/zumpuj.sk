/* ==========================================================================
   main.js — interakcie, scroll animácie a mikrointerakcie
   Obsah:
     01 Preloader            06 Scroll story (sticky kroky)
     02 Custom cursor        07 Počítadlá + scramble text
     03 Scroll progress      08 Spotlight karty + magnetické tlačidlá
     04 Header + navigácia   09 YouTube facade
     05 Reveal on scroll     10 Formulár
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(pointer:fine)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ------------------------------------------------------- 01 PRELOADER -- */
  (function () {
    var pre = $('#preloader');
    var bar = pre && $('.preloader__bar i', pre);
    var p = 0;
    var iv = setInterval(function () {
      p = Math.min(100, p + Math.random() * 22 + 8);
      if (bar) bar.style.width = p + '%';
      if (p >= 100) clearInterval(iv);
    }, 130);

    function finish() {
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        pre && pre.classList.add('done');
        document.body.classList.remove('is-loading');
        document.body.classList.add('ready');
        if (FINE && !REDUCED) document.body.classList.add('cursor-on');
      }, REDUCED ? 0 : 420);
    }

    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish);
    // poistka, keby sa nejaký asset nenačítal
    setTimeout(finish, 3500);
  })();

  /* --------------------------------------------------------- 02 CURSOR --- */
  (function () {
    if (!FINE || REDUCED) return;
    var cur = $('#cursor');
    if (!cur) return;
    var dot = $('.cursor__dot', cur);
    var ring = $('.cursor__ring', cur);
    var label = $('.cursor__label', cur);

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;

    document.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    }, { passive: true });

    (function loop() {
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();

    var HOT = 'a, button, [data-cursor], .card, .player, .tank';
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest(HOT) : null;
      if (!t) return;
      cur.classList.add('hot');
      label.textContent = t.getAttribute('data-cursor') || '';
    });
    document.addEventListener('pointerout', function (e) {
      var t = e.target.closest ? e.target.closest(HOT) : null;
      if (!t) return;
      cur.classList.remove('hot');
      label.textContent = '';
    });
  })();

  /* ------------------------------------------------ 03 SCROLL PROGRESS -- */
  var scrollBar = $('#scrollBar');

  /* ------------------------------------------ 04 HEADER + NAVIGÁCIA ----- */
  var header = $('#header');
  var lastY = 0;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollBar) scrollBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    if (header) {
      header.classList.toggle('stuck', y > 24);
      if (y > lastY && y > 320 && !document.body.classList.contains('menu-open')) header.classList.add('hide');
      else header.classList.remove('hide');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- pilulka pod aktívnym odkazom --- */
  (function () {
    var nav = $('.nav');
    if (!nav) return;
    var pill = $('.nav__pill', nav);
    var links = $$('a', nav);

    function move(el) {
      if (!el) { nav.classList.remove('has-pill'); return; }
      pill.style.width = el.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + el.offsetLeft + 'px)';
      nav.classList.add('has-pill');
    }
    links.forEach(function (a) {
      a.addEventListener('pointerenter', function () { move(a); });
    });
    nav.addEventListener('pointerleave', function () { move($('a.active', nav)); });

    // aktívna sekcia
    var map = links.map(function (a) {
      var id = a.getAttribute('href');
      return { a: a, el: id && id.length > 1 ? $(id) : null };
    }).filter(function (m) { return m.el; });

    if ('IntersectionObserver' in window && map.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { l.classList.remove('active'); });
          var hit = map.filter(function (m) { return m.el === e.target; })[0];
          if (hit) { hit.a.classList.add('active'); move(hit.a); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach(function (m) { io.observe(m.el); });
    }
  })();

  /* --- fullscreen menu --- */
  (function () {
    var burger = $('#burger');
    var menu = $('#menu');
    if (!burger || !menu) return;

    function toggle(open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Zavrieť menu' : 'Otvoriť menu');
      menu.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
    }
    burger.addEventListener('click', function () {
      toggle(burger.getAttribute('aria-expanded') !== 'true');
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) toggle(false);
    });
  })();

  /* -------------------------------------------------- 05 REVEAL ON SCROLL */
  (function () {
    var els = $$('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || REDUCED) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });

    /* Poistka: pri veľmi rýchlom scrollovaní alebo skoku na kotvu môže prvok
       preletieť celým výrezom medzi dvoma snímkami a IntersectionObserver ho
       preskočí — obsah by potom zostal natrvalo neviditeľný. Preto po každom
       scrolle ešte odhalíme všetko, čo je už nad spodkom obrazovky. */
    var ticking = false;
    function sweep() {
      var vh = window.innerHeight;
      for (var i = els.length - 1; i >= 0; i--) {
        var el = els[i];
        if (el.classList.contains('in')) { els.splice(i, 1); continue; }
        if (el.getBoundingClientRect().top < vh * 0.92) {
          el.classList.add('in');
          io.unobserve(el);
          els.splice(i, 1);
        }
      }
      if (!els.length) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; sweep(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  })();

  /* ---------------------------------------------------- 06 SCROLL STORY -- */
  (function () {
    var steps    = $$('.step');
    var scenes   = $$('.scene');
    var stage    = $('.story__stage');
    var track    = $('#storySteps');
    var viewport = $('#storyViewport');
    var dotsEl   = $('#storyDots');
    if (!steps.length) return;

    var N = steps.length;

    /* --- bodky (viditeľné len v pripnutom vodorovnom režime) --- */
    var dots = [];
    if (dotsEl) {
      steps.forEach(function (s, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', 'Krok ' + (i + 1));
        b.addEventListener('click', function () { goTo(i); });
        dotsEl.appendChild(b);
        dots.push(b);
      });
    }

    var current = -1;
    function activate(i) {
      if (i === current) return;
      current = i;
      steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      scenes.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }

    /* Pripnutý režim spoznáme podľa toho, či je stage naozaj vyšší než okno —
       teda podľa reálneho stavu layoutu, nie podľa čísla breakpointu. */
    function isPinned() {
      return !!(stage && viewport && stage.offsetHeight > window.innerHeight * 1.4);
    }

    /* stred i-teho kroku v rámci posúvanej lišty */
    function centerOf(i) {
      var s = steps[i];
      return s.offsetLeft + s.offsetWidth / 2;
    }

    /* koľko stránky treba prerolovať, aby sme boli na kroku i */
    function scrollForIndex(i) {
      var top = stage.getBoundingClientRect().top + window.scrollY;
      var dist = stage.offsetHeight - window.innerHeight;
      return top + dist * (i / (N - 1));
    }

    function goTo(i) {
      if (isPinned()) {
        window.scrollTo({ top: scrollForIndex(i), behavior: REDUCED ? 'auto' : 'smooth' });
      } else {
        steps[i].scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      }
    }

    function pick() {
      if (isPinned()) {
        /* postup v pripnutej sekcii 0…1 → plynulý posun lišty + aktívny krok */
        var top  = stage.getBoundingClientRect().top;
        var dist = stage.offsetHeight - window.innerHeight;
        var p = dist > 0 ? Math.min(1, Math.max(0, -top / dist)) : 0;

        var f = p * (N - 1);
        var i = Math.min(N - 2, Math.floor(f));
        var frac = N > 1 ? f - i : 0;
        var c = N > 1 ? centerOf(i) + (centerOf(i + 1) - centerOf(i)) * frac : centerOf(0);
        track.style.setProperty('--x', (viewport.clientWidth / 2 - c).toFixed(1) + 'px');

        activate(Math.round(f));
        return;
      }

      /* stĺpcový režim — aktívny je krok najbližšie k stredu obrazovky */
      if (track) track.style.removeProperty('--x');
      var mid = window.innerHeight * 0.5, best = 0, bestD = Infinity;
      for (var k = 0; k < N; k++) {
        var r = steps[k].getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = k; }
      }
      activate(best);
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; pick(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { current = -1; onScroll(); }, { passive: true });
    pick();
  })();

  /* ------------------------------------- 07 POČÍTADLÁ + SCRAMBLE TEXT ---- */
  (function counters() {
    var els = $$('[data-count]');
    if (!els.length) return;

    function run(el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0;
      var suf = el.getAttribute('data-suffix') || '';
      if (REDUCED) { el.textContent = to + suf; return; }
      var t0 = performance.now(), dur = 1400;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(to * e) + suf;
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  })();

  (function scramble() {
    if (REDUCED) return;
    var CHARS = '!<>-_\\/[]{}—=+*^?#ŽUMP';
    function play(el) {
      var text = el.getAttribute('data-scramble') || el.textContent;
      var q = text.split('').map(function (ch, i) { return { ch: ch, at: i * 2 + Math.random() * 8 }; });
      var frame = 0;
      (function tick() {
        el.textContent = q.map(function (o) {
          return frame >= o.at ? o.ch : CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join('');
        if (frame++ < q.length * 2 + 10) setTimeout(tick, 38);
        else el.textContent = text;
      })();
    }
    var els = $$('[data-scramble]');
    els.forEach(function (el) {
      if (el.closest('#preloader')) { play(el); return; }
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          en.forEach(function (e) { if (e.isIntersecting) { play(el); io.disconnect(); } });
        }, { threshold: 0.9 });
        io.observe(el);
      }
      el.addEventListener('pointerenter', function () { play(el); });
    });
  })();

  /* ------------------------ 08 SPOTLIGHT KARTY + MAGNETICKÉ TLAČIDLÁ ---- */
  (function spotlight() {
    if (!FINE) return;
    $$('[data-spotlight]').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  })();

  (function magnetic() {
    if (!FINE || REDUCED) return;
    $$('.btn--magnetic').forEach(function (btn) {
      var raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
      function loop() {
        cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
        btn.style.transform = 'translate(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px)';
        if (Math.abs(cx - tx) > 0.1 || Math.abs(cy - ty) > 0.1) raf = requestAnimationFrame(loop);
        else raf = null;
      }
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.32;
        ty = (e.clientY - (r.top + r.height / 2)) * 0.42;
        if (!raf) raf = requestAnimationFrame(loop);
      }, { passive: true });
      btn.addEventListener('pointerleave', function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  })();

  /* --------------------------------------------------- 09 YOUTUBE FACADE */
  /* Náhľad ani iframe sa nedotknú YouTube, kým používateľ nepovolí
     marketingové cookies. Bez súhlasu vidí len lokálny zámok s vysvetlením. */
  (function () {
    var player = $('#player');
    if (!player) return;
    var thumb = $('.player__thumb', player);
    var wantsPlay = false;

    function unlock() {
      if (player.classList.contains('unlocked')) return;
      player.classList.add('unlocked');
      if (thumb && thumb.dataset.thumb && !thumb.getAttribute('src')) {
        thumb.src = thumb.dataset.thumb;
        thumb.hidden = false;
      }
      if (wantsPlay) embed();
    }
    function sync() {
      if (window.ZumpujConsent && window.ZumpujConsent.has('marketing')) unlock();
    }
    document.addEventListener('cc:change', sync);
    sync();

    $$('[data-cc-open]', player).forEach(function (b) {
      b.addEventListener('click', function () { wantsPlay = true; });
    });

    function embed() {
      var id = player.getAttribute('data-yt');
      if (!id || player.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1';
      f.title = 'Video Žumpuj.sk';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      f.setAttribute('loading', 'lazy');
      player.appendChild(f);
      player.classList.add('playing');
    }

    player.addEventListener('click', function (e) {
      if (e.target.closest('[data-cc-open]')) return;   // to rieši lišta so súhlasom
      if (!player.classList.contains('unlocked')) return;
      embed();
    });
  })();

  /* -------------------------------------------------------- 10 FORMULÁR */
  (function () {
    var form = $('#form');
    if (!form) return;
    var done = $('#formDone');

    function markField(input, bad) {
      var f = input.closest('.field') || input.closest('.gdpr');
      if (f) f.classList.toggle('err', bad);
    }

    $$('input', form).forEach(function (i) {
      i.addEventListener('input', function () { markField(i, false); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var name = $('#f-name'), mail = $('#f-mail'), gdpr = $('input[name="gdpr"]', form);

      if (!name.value.trim()) { markField(name, true); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { markField(mail, true); ok = false; }
      if (!gdpr.checked) { markField(gdpr, true); ok = false; }

      if (!ok) {
        form.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
          { duration: 320, easing: 'ease-in-out' }
        );
        var firstErr = $('.err input', form);
        firstErr && firstErr.focus();
        return;
      }

      /* TODO: sem doplniť reálne odoslanie (fetch na endpoint / Formspree / vlastné API). */
      if (done) { done.hidden = false; }
    });
  })();

  /* --------------------------------------------------------------- misc */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // plynulý skok s ohľadom na fixný header
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      var top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });
})();
