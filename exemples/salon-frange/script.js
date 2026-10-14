/*
 * Salon Frange · petits comportements du site (ES5, sans dépendance)
 * 1. pastille « Ouvert / Fermé » calculée en heure de Paris
 * 2. jour courant mis en avant dans les tableaux d'horaires
 * 3. menu mobile (details/summary) : fermeture avec Échap et au clic sur un lien
 * 4. filtres de la galerie
 * Sans JavaScript, tout reste lisible : horaires en clair, galerie complète, menu natif.
 */
(function () {
  'use strict';

  /* ---------- 1. horaires ---------- */
  // 0 = dimanche … 6 = samedi ; heures en décimal
  var HOURS = { 2: [10, 19], 3: [10, 19], 4: [10, 19], 5: [10, 19], 6: [9, 18] };
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var NBSP = ' ';

  function parisNow() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(d);
      var map = {};
      for (var i = 0; i < parts.length; i++) { map[parts[i].type] = parts[i].value; }
      var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
      var h = parseInt(map.hour, 10) % 24;
      var m = parseInt(map.minute, 10);
      if (wd < 0 || isNaN(h) || isNaN(m)) { throw new Error('format'); }
      return { day: wd, time: h + m / 60 };
    } catch (e) {
      return { day: d.getDay(), time: d.getHours() + d.getMinutes() / 60 };
    }
  }

  function fmt(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return hh + NBSP + 'h' + (mm ? NBSP + (mm < 10 ? '0' : '') + mm : '');
  }

  function status(now) {
    var today = HOURS[now.day];
    if (today && now.time >= today[0] && now.time < today[1]) {
      var left = today[1] - now.time;
      var txt = left <= 0.5 ? 'Ouvert · ferme bientôt (' + fmt(today[1]) + ')' : 'Ouvert · ferme à ' + fmt(today[1]);
      return { open: true, text: now.day === 6 ? txt + ', sans rendez-vous' : txt };
    }
    if (today && now.time < today[0]) {
      return { open: false, text: 'Fermé · ouvre à ' + fmt(today[0]) };
    }
    for (var i = 1; i <= 7; i++) {
      var d = (now.day + i) % 7;
      if (HOURS[d]) {
        var when = i === 1 ? 'demain' : DAYS[d];
        return { open: false, text: 'Fermé · ouvre ' + when + ' à ' + fmt(HOURS[d][0]) };
      }
    }
    return { open: false, text: 'Fermé' };
  }

  var now = parisNow();
  var st = status(now);
  var badges = document.querySelectorAll('[data-open-status]');
  for (var b = 0; b < badges.length; b++) {
    badges[b].textContent = st.text;
    badges[b].classList.add(st.open ? 'is-open' : 'is-closed');
  }

  /* ---------- 2. jour courant ---------- */
  var rows = document.querySelectorAll('[data-hours] tr[data-days]');
  for (var r = 0; r < rows.length; r++) {
    var days = rows[r].getAttribute('data-days').split(' ');
    if (days.indexOf(String(now.day)) !== -1) {
      rows[r].classList.add('is-today');
      var th = rows[r].querySelector('th');
      if (th) {
        var sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = ' (aujourd’hui)';
        th.appendChild(sr);
      }
    }
  }

  /* ---------- 3. menu mobile ---------- */
  var menu = document.querySelector('.menu');
  if (menu) {
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && menu.hasAttribute('open')) {
        menu.removeAttribute('open');
        var s = menu.querySelector('summary');
        if (s) { s.focus(); }
      }
    });
    menu.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a) { menu.removeAttribute('open'); }
    });
    document.addEventListener('click', function (e) {
      if (menu.hasAttribute('open') && !menu.contains(e.target)) { menu.removeAttribute('open'); }
    });
  }

  /* ---------- 4. galerie ---------- */
  var filters = document.querySelector('[data-filters]');
  if (filters) {
    var looks = document.querySelectorAll('[data-look]');
    var count = document.querySelector('[data-count]');
    var buttons = filters.querySelectorAll('button[data-filter]');
    filters.hidden = false;

    var apply = function (f) {
      var shown = 0;
      for (var i = 0; i < looks.length; i++) {
        var tags = looks[i].getAttribute('data-look').split(' ');
        var ok = f === 'tout' || tags.indexOf(f) !== -1;
        looks[i].hidden = !ok;
        if (ok) { shown++; }
      }
      for (var j = 0; j < buttons.length; j++) {
        buttons[j].setAttribute('aria-pressed', buttons[j].getAttribute('data-filter') === f ? 'true' : 'false');
      }
      if (count) {
        count.textContent = shown + (shown > 1 ? ' looks affichés' : ' look affiché') + (f === 'tout' ? '' : ' sur ' + looks.length);
      }
    };

    filters.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button[data-filter]') : null;
      if (btn) { apply(btn.getAttribute('data-filter')); }
    });
    apply('tout');
  }
})();
