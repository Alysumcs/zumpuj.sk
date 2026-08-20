/* ==========================================================================
   legal.js — drobná logika pre právne podstránky
   (rok v pätičke, plynulý skok na kotvy s odsadením pod fixný header,
    zvýraznenie aktívnej položky obsahu pri scrollovaní)
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
    if (a.hasAttribute('data-cc-open')) return;          // to rieši cookies.js
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 92,
        behavior: REDUCED ? 'auto' : 'smooth'
      });
      history.replaceState(null, '', id);
    });
  });
})();

/* --- naznačenie posuvných tabuliek na úzkych displejoch ------------------ */
(function () {
  'use strict';
  var wraps = Array.prototype.slice.call(document.querySelectorAll('.legal .tbl'));
  if (!wraps.length) return;

  wraps.forEach(function (w) {
    if (!w.nextElementSibling || !w.nextElementSibling.classList.contains('tbl__hint')) {
      var h = document.createElement('p');
      h.className = 'tbl__hint';
      h.textContent = '← tabuľku posuniete potiahnutím do strany →';
      w.parentNode.insertBefore(h, w.nextSibling);
    }
    function upd() {
      var over = w.scrollWidth - w.clientWidth;
      w.classList.toggle('is-scrollable', over > 4);
      w.classList.toggle('is-end', over > 4 && w.scrollLeft >= over - 4);
    }
    w.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd, { passive: true });
    upd();
  });
})();
