/* Fromagerie Caillé · menu, statut ouvert/fermé, filtre par lait, estimation des plateaux (ES5) */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.className += (doc.className ? ' ' : '') + 'js';

  /* ----- Menu mobile ----- */
  var bouton = document.querySelector('.menu-bouton');
  var nav = document.getElementById('nav');
  if (bouton && nav) {
    bouton.addEventListener('click', function () {
      var ouvert = bouton.getAttribute('aria-expanded') === 'true';
      bouton.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
      nav.classList.toggle('ouvert', !ouvert);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('ouvert')) {
        nav.classList.remove('ouvert');
        bouton.setAttribute('aria-expanded', 'false');
        bouton.focus();
      }
    });
  }

  /* ----- Ouvert / fermé, heure de Paris ----- */
  // minutes depuis minuit ; 0 = dimanche
  var HORAIRES = {
    0: [[540, 780]],
    1: [],
    2: [[540, 780], [930, 1170]],
    3: [[540, 780], [930, 1170]],
    4: [[540, 780], [930, 1170]],
    5: [[540, 780], [930, 1170]],
    6: [[540, 780], [930, 1170]]
  };
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var NBSP = ' ';

  function heure(m) {
    var h = Math.floor(m / 60), mn = m % 60;
    return h + NBSP + 'h' + (mn ? NBSP + (mn < 10 ? '0' : '') + mn : '');
  }

  function maintenantParis() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var o = {};
      for (var i = 0; i < parts.length; i++) { o[parts[i].type] = parts[i].value; }
      var jours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var h = parseInt(o.hour, 10) % 24;
      return { jour: jours[o.weekday], minutes: h * 60 + parseInt(o.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { jour: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function statut() {
    var n = maintenantParis();
    var plages = HORAIRES[n.jour], i;
    for (i = 0; i < plages.length; i++) {
      if (n.minutes >= plages[i][0] && n.minutes < plages[i][1]) {
        return { ouvert: true, texte: 'Ouvert · jusqu’à ' + heure(plages[i][1]) };
      }
    }
    for (i = 0; i < plages.length; i++) {
      if (n.minutes < plages[i][0]) {
        return { ouvert: false, texte: 'Fermé · ouvre à ' + heure(plages[i][0]) };
      }
    }
    for (var k = 1; k <= 7; k++) {
      var j = (n.jour + k) % 7;
      if (HORAIRES[j].length) {
        var quand = k === 1 ? 'demain' : JOURS[j];
        return { ouvert: false, texte: 'Fermé · ouvre ' + quand + ' à ' + heure(HORAIRES[j][0][0]) };
      }
    }
    return null;
  }

  var badges = document.querySelectorAll('[data-statut]');
  function majStatut() {
    var s = statut();
    if (!s) { return; }
    for (var i = 0; i < badges.length; i++) {
      var t = badges[i].querySelector('[data-statut-texte]');
      if (t) { t.textContent = s.texte; }
      badges[i].classList.toggle('est-ouvert', s.ouvert);
      badges[i].classList.toggle('est-ferme', !s.ouvert);
    }
  }
  if (badges.length) { majStatut(); setInterval(majStatut, 60000); }

  /* ----- Filtre par lait ----- */
  var filtres = document.querySelector('[data-filtres]');
  if (filtres) {
    filtres.hidden = false;
    var boutons = filtres.querySelectorAll('button[data-lait]');
    var fromages = document.querySelectorAll('.fromage[data-lait]');
    var familles = document.querySelectorAll('[data-famille]');
    var compte = filtres.querySelector('[data-compte]');
    var aucun = document.querySelector('[data-aucun]');
    var filtrer = function (lait) {
      var n = 0, i;
      for (i = 0; i < boutons.length; i++) {
        boutons[i].setAttribute('aria-pressed', boutons[i].getAttribute('data-lait') === lait ? 'true' : 'false');
      }
      for (i = 0; i < fromages.length; i++) {
        var ok = lait === 'tous' || fromages[i].getAttribute('data-lait') === lait;
        fromages[i].hidden = !ok;
        if (ok) { n++; }
      }
      for (i = 0; i < familles.length; i++) {
        familles[i].hidden = !familles[i].querySelector('.fromage:not([hidden])');
      }
      if (compte) { compte.textContent = n + (n > 1 ? ' fromages' : ' fromage'); }
      if (aucun) { aucun.hidden = n > 0; }
    };
    for (var b = 0; b < boutons.length; b++) {
      boutons[b].addEventListener('click', function () { filtrer(this.getAttribute('data-lait')); });
    }
  }

  /* ----- Plateaux : estimation et date minimale ----- */
  var form = document.querySelector('[data-commande]');
  if (form) {
    var choix = form.querySelector('[data-plateau]');
    var nombre = form.querySelector('[data-personnes]');
    var total = form.querySelector('[data-total]');
    var date = form.querySelector('[data-date]');
    var euros = function (v) {
      return v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + NBSP + '€';
    };
    var calculer = function () {
      var opt = choix.options[choix.selectedIndex];
      var prix = parseFloat(opt.getAttribute('data-prix')) || 0;
      var n = parseInt(nombre.value, 10);
      if (!n || n < 4) { total.textContent = '4 personnes minimum'; return; }
      total.textContent = n + ' × ' + euros(prix).replace(NBSP + '€', '') + ' = ' + euros(prix * n);
    };
    choix.addEventListener('change', calculer);
    nombre.addEventListener('input', calculer);
    calculer();
    if (date) {
      var d = new Date(Date.now() + 48 * 3600 * 1000);
      var iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      date.min = iso;
    }
    var liens = document.querySelectorAll('[data-choix]');
    for (var l = 0; l < liens.length; l++) {
      liens[l].addEventListener('click', function () {
        choix.value = this.getAttribute('data-choix');
        calculer();
      });
    }
  }
})();
