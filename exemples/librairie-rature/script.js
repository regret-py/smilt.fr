/*
 * Librairie Rature · petits comportements du site (ES5, sans dépendance)
 * 1. pastille « Ouvert / Fermé » calculée en heure de Paris (lundi–samedi, 10 h–20 h)
 * 2. jour courant surligné dans le tableau des horaires
 * 3. menu mobile (details/summary) : fermeture avec Échap et au clic sur un lien
 * 4. filtres de l'agenda
 * Sans JavaScript, tout reste lisible : horaires en clair, agenda complet, menu natif.
 */
(function () {
  'use strict';

  var HOURS = { 1: [10, 20], 2: [10, 20], 3: [10, 20], 4: [10, 20], 5: [10, 20], 6: [10, 20] };
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
      var h = parseInt(map.hour, 10) % 24, m = parseInt(map.minute, 10);
      if (wd < 0 || isNaN(h) || isNaN(m)) { throw new Error('format'); }
      return { day: wd, time: h + m / 60 };
    } catch (e) {
      return { day: d.getDay(), time: d.getHours() + d.getMinutes() / 60 };
    }
  }

  function fmt(h) { return h + NBSP + 'h'; }

  function status(now) {
    var today = HOURS[now.day];
    if (today && now.time >= today[0] && now.time < today[1]) {
      return { open: true, text: (today[1] - now.time <= 0.5 ? 'Ouvert · ferme bientôt (' : 'Ouvert · ferme à ') + fmt(today[1]) + (today[1] - now.time <= 0.5 ? ')' : '') };
    }
    if (today && now.time < today[0]) { return { open: false, text: 'Fermé · ouvre à ' + fmt(today[0]) }; }
    for (var i = 1; i <= 7; i++) {
      var d = (now.day + i) % 7;
      if (HOURS[d]) { return { open: false, text: 'Fermé · ouvre ' + (i === 1 ? 'demain' : DAYS[d]) + ' à ' + fmt(HOURS[d][0]) }; }
    }
    return { open: false, text: 'Fermé' };
  }

  var now = parisNow(), st = status(now);
  var badges = document.querySelectorAll('[data-open-status]');
  for (var b = 0; b < badges.length; b++) {
    badges[b].textContent = st.text;
    badges[b].className += st.open ? ' is-open' : ' is-closed';
  }
  var row = document.querySelector('.hours tr[data-day="' + now.day + '"]');
  if (row) {
    row.className += ' is-today';
    var th = row.querySelector('th');
    if (th) { th.appendChild(document.createTextNode(' (aujourd’hui)')); }
  }

  /* menu mobile */
  var menu = document.querySelector('details.menu');
  if (menu) {
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (a) { menu.open = false; }
    });
  }

  /* filtres de l'agenda */
  var bar = document.querySelector('.filters');
  if (bar) {
    var chips = bar.querySelectorAll('[data-filter]');
    var items = document.querySelectorAll('.events .ev');
    var count = document.querySelector('.filter-count');
    bar.hidden = false;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!btn) { return; }
      var f = btn.getAttribute('data-filter'), n = 0;
      for (var i = 0; i < chips.length; i++) { chips[i].setAttribute('aria-pressed', chips[i] === btn ? 'true' : 'false'); }
      for (var j = 0; j < items.length; j++) {
        var show = f === 'tout' || items[j].getAttribute('data-cat') === f;
        items[j].hidden = !show;
        if (show) { n++; }
      }
      if (count) { count.textContent = f === 'tout' ? '' : n + (n > 1 ? ' rendez-vous' : ' rendez-vous'); }
    });
  }
})();
