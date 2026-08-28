/* ==========================================================================
   main.js — interakcia svetlej minimalistickej verzie

   Zámerne krátke. Z pôvodnej tmavej verzie vypadol vlastný kurzor, preloader,
   scramble efekty, magnetické tlačidlá, spotlight karty aj scroll storytelling.
   Zostalo len to, čo stránke slúži: navigácia, jemné odhaľovanie obsahu,
   prehrávač videa so súhlasom a formulár.

     01 Hlavička a navigácia      04 Video (načíta sa až po súhlase)
     02 Mobilné menu              05 Formulár
     03 Odhaľovanie pri scrolle   06 Drobnosti
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* --------------------------------------------- 01 HLAVIČKA A NAVIGÁCIA -- */
  var header = $('#header');
  window.addEventListener('scroll', function () {
    if (header) header.classList.toggle('stuck', window.scrollY > 8);
  }, { passive: true });

  (function activeSection() {
    var links = $$('.nav a');
    var map = links.map(function (a) {
      var id = a.getAttribute('href');
      return { a: a, el: id && id.length > 1 ? $(id) : null };
    }).filter(function (m) { return m.el; });
    if (!map.length || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('active'); });
        var hit = map.filter(function (m) { return m.el === e.target; })[0];
        if (hit) hit.a.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach(function (m) { io.observe(m.el); });
  })();

  /* ------------------------------------------------------ 02 MOBILNÉ MENU -- */
  (function () {
    var burger = $('#burger'), menu = $('#menu');
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
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { toggle(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) toggle(false);
    });
  })();

  /* ------------------------------------------- 03 ODHAĽOVANIE PRI SCROLLE -- */
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
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });

    /* Poistka: pri rýchlom scrollovaní alebo skoku na kotvu môže prvok
       preletieť výrezom medzi dvoma snímkami a observer ho preskočí — obsah
       by potom zostal natrvalo neviditeľný. */
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var vh = window.innerHeight;
        for (var i = els.length - 1; i >= 0; i--) {
          if (els[i].classList.contains('in')) { els.splice(i, 1); continue; }
          if (els[i].getBoundingClientRect().top < vh * .94) {
            els[i].classList.add('in'); io.unobserve(els[i]); els.splice(i, 1);
          }
        }
      });
    }, { passive: true });
  })();

  /* ------------------------------------------------------------- 04 VIDEO -- */
  (function () {
    var box = $('#player');
    if (!box) return;
    var id = box.getAttribute('data-yt');

    function allowed() {
      return document.documentElement.classList.contains('cc-marketing');
    }

    /* Kým nie je súhlas, nesťahujeme z YouTube vôbec nič — ani náhľadový
       obrázok, ktorý by tiež odoslal IP adresu návštevníka. */
    function renderGate() {
      box.innerHTML =
        '<div class="player__gate">' +
          '<b>Video je uložené na YouTube</b>' +
          '<p>Prehratím sa načíta obsah zo servera YouTube, ktorý môže spracúvať údaje ' +
             'o vašom zariadení. Potrebujeme na to váš súhlas s marketingovými cookies.</p>' +
          '<button type="button" class="btn btn--solid" data-cc-open>Povoliť a prehrať</button>' +
        '</div>';
    }

    function renderThumb() {
      box.innerHTML =
        '<img class="player__thumb" src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" ' +
             'alt="Video o službe Žumpuj.sk" loading="lazy" width="1280" height="720">' +
        '<button class="player__btn" type="button" aria-label="Prehrať video">' +
          '<svg viewBox="0 0 24 24"><use href="#i-play"></use></svg></button>';
      box.onclick = play;
    }

    function play() {
      if (box.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1';
      f.title = 'Video Žumpuj.sk';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      box.appendChild(f);
      box.classList.add('playing');
    }

    function sync() { if (allowed()) renderThumb(); else { box.onclick = null; renderGate(); } }
    sync();
    document.addEventListener('cc:change', sync);
  })();

  /* --------------------------------------------------------- 05 FORMULÁR -- */
  (function () {
    var form = $('#form');
    if (!form) return;
    var done = $('#formDone');

    function mark(input, bad) {
      var f = input.closest('.field') || input.closest('.gdpr');
      if (f) f.classList.toggle('err', bad);
    }
    $$('input', form).forEach(function (i) {
      i.addEventListener('input', function () { mark(i, false); });
      i.addEventListener('change', function () { mark(i, false); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var name = $('#f-name'), mail = $('#f-mail'), gdpr = $('input[name="gdpr"]', form);

      if (!name.value.trim()) { mark(name, true); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { mark(mail, true); ok = false; }
      if (!gdpr.checked) { mark(gdpr, true); ok = false; }

      if (!ok) {
        var first = $('.err input', form);
        if (first) first.focus();
        return;
      }

      /* TODO: sem doplniť reálne odoslanie (fetch na endpoint / Formspree /
         vlastné API). Nezabudni uložiť aj záznam o súhlase — dátum, čas
         a znenie — GDPR vyžaduje, aby sa dal preukázať. */
      if (done) done.hidden = false;
    });
  })();

  /* -------------------------------------------------------- 06 DROBNOSTI -- */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  $$('a[href^="#"]').forEach(function (a) {
    if (a.hasAttribute('data-cc-open')) return;          // to rieši cookies.js
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 72,
        behavior: REDUCED ? 'auto' : 'smooth'
      });
      history.replaceState(null, '', id);
    });
  });
})();
