/* ==========================================================================
   cookies.js — správa súhlasu s cookies (SK legislatíva)

   Právny rámec:
   · § 109 ods. 8 zákona č. 452/2021 Z. z. o elektronických komunikáciách
     → súhlas MUSÍ byť získaný VOPRED, pred uložením/čítaním údajov v zariadení.
     Výnimka: cookies nevyhnutné na poskytnutie služby vyžiadanej používateľom.
   · Nariadenie (EÚ) 2016/679 (GDPR) + zákon č. 18/2018 Z. z.
     → súhlas musí byť slobodný, konkrétny, informovaný a jednoznačný,
       odvolateľný rovnako ľahko, ako bol udelený.

   Z toho vyplývajú pravidlá, ktoré tento skript dodržiava:
   1. Do udelenia súhlasu sa nespúšťajú žiadne skripty okrem nevyhnutných.
   2. „Odmietnuť všetko" je na prvej vrstve rovnako viditeľné ako „Prijať všetko".
   3. Žiadne predzaškrtnuté súhlasy — analytika aj marketing sú default OFF.
   4. Súhlas sa dáva na ÚČEL (kategóriu), nie na jednotlivé súbory.
   5. Odvolanie súhlasu je kedykoľvek dostupné (odkaz „Nastavenia cookies").
   6. Zavretie lišty krížikom = odmietnutie (nie súhlas).
   7. Ukladá sa dátum a verzia súhlasu; po 12 mesiacoch sa pýtame znova.
   8. Žiadny „cookie wall" — obsah je prístupný aj bez súhlasu.

   Použitie pre skripty tretích strán — namiesto type="text/javascript" daj
   type="text/plain" a pridaj atribút data-cc s kategóriou:
     externý:  <script type="text/plain" data-cc="analytics" data-src="https://..."><\/script>
     inline:   <script type="text/plain" data-cc="marketing">  ...kód...  <\/script>
   Skript sa aktivuje až po udelení súhlasu pre danú kategóriu.

   Programové API:
     ZumpujConsent.has('analytics')  → true/false
     ZumpujConsent.open()            → otvorí nastavenia
     document.addEventListener('cc:change', e => e.detail) → {analytics, marketing}
   ========================================================================== */
(function (w, d) {
  'use strict';

  var KEY = 'zumpuj_cookie_consent';
  var VERSION = 1;                 // pri zmene účelov zvýš → vyžiada nový súhlas
  var MAX_AGE_DAYS = 365;          // po roku sa pýtame znova
  var CATS = ['analytics', 'marketing'];

  /* ------------------------------------------------------------- ÚLOŽISKO -- */
  function read() {
    try {
      var raw = w.localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== VERSION) return null;
      if (Date.now() - o.ts > MAX_AGE_DAYS * 864e5) return null;
      return o;
    } catch (e) { return null; }
  }

  function write(prefs) {
    var o = { v: VERSION, ts: Date.now(), analytics: !!prefs.analytics, marketing: !!prefs.marketing };
    try { w.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    return o;
  }

  var state = read();

  /* -------------------------------------------------- AKTIVÁCIA SKRIPTOV -- */
  function unlock(prefs) {
    var nodes = d.querySelectorAll('script[type="text/plain"][data-cc]');
    Array.prototype.forEach.call(nodes, function (old) {
      var cat = old.getAttribute('data-cc');
      if (!prefs[cat]) return;
      var s = d.createElement('script');
      if (old.dataset.src) s.src = old.dataset.src;
      else s.textContent = old.textContent;
      Array.prototype.forEach.call(old.attributes, function (a) {
        if (['type', 'data-cc', 'data-src'].indexOf(a.name) === -1) s.setAttribute(a.name, a.value);
      });
      old.parentNode.replaceChild(s, old);
    });

    /* --- Google Consent Mode v2 ---------------------------------------
       Odkomentuj, keď nasadíš GA4 / Google Ads. Musí byť spolu s default
       stavom 'denied' v <head> ešte pred načítaním gtag.js.
    if (typeof w.gtag === 'function') {
      w.gtag('consent', 'update', {
        analytics_storage:        prefs.analytics ? 'granted' : 'denied',
        ad_storage:               prefs.marketing ? 'granted' : 'denied',
        ad_user_data:             prefs.marketing ? 'granted' : 'denied',
        ad_personalization:       prefs.marketing ? 'granted' : 'denied',
        functionality_storage:    'granted',
        security_storage:         'granted'
      });
    }
    ------------------------------------------------------------------- */

    d.dispatchEvent(new CustomEvent('cc:change', { detail: prefs }));
  }

  function apply(prefs, persist) {
    if (persist !== false) state = write(prefs);
    d.documentElement.classList.toggle('cc-analytics', !!prefs.analytics);
    d.documentElement.classList.toggle('cc-marketing', !!prefs.marketing);
    unlock(prefs);
  }

  /* ------------------------------------------------------------- MARKUP -- */
  var banner, modal;

  function buildBanner() {
    banner = d.createElement('div');
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Súhlas s používaním cookies');
    banner.innerHTML =
      '<button class="cc-banner__x" type="button" aria-label="Zavrieť a odmietnuť voliteľné cookies">&times;</button>' +
      '<div class="cc-banner__body">' +
        '<h2 class="cc-banner__title">Vážime si vaše súkromie</h2>' +
        '<p class="cc-banner__txt">Nevyhnutné cookies potrebujeme na fungovanie stránky — tie sa používajú vždy. ' +
        'Voliteľné cookies na štatistiky a marketing použijeme len s vaším súhlasom. ' +
        'Súhlas môžete kedykoľvek odvolať. Viac v <a href="cookies.html">zásadách používania cookies</a> ' +
        'a v <a href="ochrana-osobnych-udajov.html">ochrane osobných údajov</a>.</p>' +
      '</div>' +
      '<div class="cc-banner__actions">' +
        '<button class="cc-btn cc-btn--ghost" type="button" data-cc-action="settings">Nastaviť</button>' +
        '<button class="cc-btn cc-btn--plain" type="button" data-cc-action="reject">Odmietnuť všetko</button>' +
        '<button class="cc-btn cc-btn--solid" type="button" data-cc-action="accept">Prijať všetko</button>' +
      '</div>';
    d.body.appendChild(banner);

    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cc-action]');
      if (e.target.classList.contains('cc-banner__x')) return decide({ analytics: false, marketing: false });
      if (!b) return;
      var a = b.getAttribute('data-cc-action');
      if (a === 'accept') decide({ analytics: true, marketing: true });
      else if (a === 'reject') decide({ analytics: false, marketing: false });
      else openModal();
    });
  }

  function buildModal() {
    modal = d.createElement('div');
    modal.className = 'cc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Nastavenia cookies');
    modal.innerHTML =
      '<div class="cc-modal__backdrop" data-cc-close></div>' +
      '<div class="cc-modal__panel">' +
        '<div class="cc-modal__head">' +
          '<h2>Nastavenia cookies</h2>' +
          '<button class="cc-modal__x" type="button" data-cc-close aria-label="Zavrieť">&times;</button>' +
        '</div>' +
        '<div class="cc-modal__scroll">' +
          '<p class="cc-modal__intro">Vyberte si, ktoré účely spracúvania povolíte. ' +
          'Rozhodnutie platí 12 mesiacov a môžete ho kedykoľvek zmeniť cez odkaz ' +
          '<em>Nastavenia cookies</em> v pätičke stránky.</p>' +

          group('necessary', 'Nevyhnutné', true, true,
            'Zabezpečujú základné fungovanie stránky — zapamätanie vášho rozhodnutia o cookies, ' +
            'bezpečnosť a odoslanie formulára. Bez nich stránka nefunguje, preto sa podľa ' +
            '§ 109 ods. 8 zákona č. 452/2021 Z. z. používajú aj bez súhlasu.') +

          group('analytics', 'Štatistické', false, false,
            'Pomáhajú nám pochopiť, ako návštevníci stránku používajú — ktoré sekcie čítajú a kde odchádzajú. ' +
            'Údaje spracúvame v súhrnnej podobe, aby sme web zlepšovali.') +

          group('marketing', 'Marketingové a vložený obsah', false, false,
            'Umožňujú prehrať video vložené zo služby YouTube a merať účinnosť našej reklamy. ' +
            'Pri ich povolení môže dôjsť k prenosu údajov (vrátane IP adresy) spoločnosti Google.') +

        '</div>' +
        '<div class="cc-modal__foot">' +
          '<button class="cc-btn cc-btn--plain" type="button" data-cc-action="reject">Odmietnuť všetko</button>' +
          '<button class="cc-btn cc-btn--ghost" type="button" data-cc-action="save">Uložiť výber</button>' +
          '<button class="cc-btn cc-btn--solid" type="button" data-cc-action="accept">Prijať všetko</button>' +
        '</div>' +
      '</div>';
    d.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-cc-close')) return closeModal();
      var b = e.target.closest('[data-cc-action]');
      if (!b) return;
      var a = b.getAttribute('data-cc-action');
      if (a === 'accept') { setToggles({ analytics: true, marketing: true }); decide({ analytics: true, marketing: true }); }
      else if (a === 'reject') { setToggles({ analytics: false, marketing: false }); decide({ analytics: false, marketing: false }); }
      else decide(getToggles());
    });

    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
  }

  function group(id, name, on, locked, desc) {
    return '<div class="cc-group">' +
      '<label class="cc-group__head">' +
        '<span class="cc-group__name">' + name + '</span>' +
        '<span class="cc-switch' + (locked ? ' cc-switch--locked' : '') + '">' +
          '<input type="checkbox" data-cc-cat="' + id + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
          '<span class="cc-switch__track"><span class="cc-switch__knob"></span></span>' +
        '</span>' +
      '</label>' +
      '<p class="cc-group__desc">' + desc + '</p>' +
      (locked ? '<span class="cc-group__tag">vždy aktívne</span>' : '') +
    '</div>';
  }

  function getToggles() {
    var o = {};
    CATS.forEach(function (c) {
      var el = modal.querySelector('[data-cc-cat="' + c + '"]');
      o[c] = !!(el && el.checked);
    });
    return o;
  }
  function setToggles(prefs) {
    CATS.forEach(function (c) {
      var el = modal.querySelector('[data-cc-cat="' + c + '"]');
      if (el) el.checked = !!prefs[c];
    });
  }

  /* ------------------------------------------------------------- AKCIE -- */
  function decide(prefs) {
    apply(prefs);
    hideBanner();
    closeModal();
  }

  function showBanner() { if (banner) requestAnimationFrame(function () { banner.classList.add('open'); }); }
  function hideBanner() { if (banner) banner.classList.remove('open'); }

  function openModal() {
    if (!modal) buildModal();
    setToggles(state || { analytics: false, marketing: false });
    modal.classList.add('open');
    d.body.classList.add('cc-lock');
    var first = modal.querySelector('.cc-modal__x');
    first && first.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    d.body.classList.remove('cc-lock');
  }

  /* ---------------------------------------------------------------- API -- */
  w.ZumpujConsent = {
    has: function (cat) { return !!(state && state[cat]); },
    all: function () { return state ? { analytics: state.analytics, marketing: state.marketing } : null; },
    open: function () { if (!banner) init(); openModal(); },
    reset: function () { try { w.localStorage.removeItem(KEY); } catch (e) {} location.reload(); }
  };

  /* ---------------------------------------------------------------- INIT -- */
  function init() {
    if (!banner) buildBanner();
    if (state) apply(state, false);
    else showBanner();

    // odkazy typu <a data-cc-open> alebo href="#cookie-nastavenia" otvoria nastavenia
    d.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cc-open], a[href="#cookie-nastavenia"]');
      if (!t) return;
      e.preventDefault();
      openModal();
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();

})(window, document);
