/* Atelier Pistil · menu, statut d’ouverture (heure de Paris), formulaire. ES5. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.className += (doc.className ? ' ' : '') + 'js';

  var NB = ' ';
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  // minutes depuis minuit : [ouverture, fermeture] ; null = fermé
  var HORAIRES = [[570, 780], null, [570, 1170], [570, 1170], [570, 1170], [570, 1170], [570, 1170]];

  function heure(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + NB + 'h' + (m ? NB + (m < 10 ? '0' : '') + m : '');
  }

  function maintenantParis() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
      var o = {};
      for (var i = 0; i < parts.length; i++) { o[parts[i].type] = parts[i].value; }
      var jours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { jour: jours[o.weekday], min: parseInt(o.hour, 10) % 24 * 60 + parseInt(o.minute, 10) };
    } catch (e) {
      return { jour: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function statut() {
    var t = maintenantParis(), h = HORAIRES[t.jour];
    if (h && t.min >= h[0] && t.min < h[1]) {
      return { ouvert: true, texte: 'Ouvert maintenant · jusqu’à ' + heure(h[1]) };
    }
    if (h && t.min < h[0]) {
      return { ouvert: false, texte: 'Fermé · ouvre à ' + heure(h[0]) };
    }
    for (var k = 1; k <= 7; k++) {
      var j = (t.jour + k) % 7;
      if (HORAIRES[j]) {
        return { ouvert: false, texte: 'Fermé · ouvre ' + (k === 1 ? 'demain' : JOURS[j]) + ' à ' + heure(HORAIRES[j][0]) };
      }
    }
    return { ouvert: false, texte: 'Fermé' };
  }

  function majStatut() {
    var s = statut(), els = document.querySelectorAll('[data-statut]');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.remove('ouvert', 'ferme');
      els[i].classList.add(s.ouvert ? 'ouvert' : 'ferme');
      var txt = els[i].querySelector('[data-statut-texte]');
      if (txt) { txt.textContent = s.texte; }
    }
    var lignes = document.querySelectorAll('.horaires tr[data-jour]'), jour = String(maintenantParis().jour);
    for (var l = 0; l < lignes.length; l++) {
      lignes[l].classList.toggle('aujourdhui', lignes[l].getAttribute('data-jour') === jour);
    }
  }

  function init() {
    majStatut();
    setInterval(majStatut, 60000);

    // menu mobile
    var bouton = document.querySelector('.menu-bouton'), nav = document.getElementById('navigation');
    if (bouton && nav) {
      bouton.addEventListener('click', function () {
        var ouvert = nav.classList.toggle('ouvert');
        bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      });
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') { nav.classList.remove('ouvert'); bouton.setAttribute('aria-expanded', 'false'); }
      });
    }

    // saison en cours
    var mois = new Date().getMonth(), saison = mois < 2 || mois === 11 ? 'hiver' : mois < 5 ? 'printemps' : mois < 8 ? 'ete' : 'automne';
    var cases = document.querySelectorAll('.calendrier li'), badge = document.querySelector('.badge-saison');
    for (var c = 0; c < cases.length; c++) {
      var actif = cases[c].getAttribute('data-saison') === saison;
      cases[c].classList.toggle('maintenant', actif);
      if (actif && badge) { cases[c].querySelector('h3').appendChild(badge); }
    }

    // date : pas avant aujourd’hui
    var date = document.getElementById('date');
    if (date) {
      var a = new Date(), m = a.getMonth() + 1, j = a.getDate();
      date.min = a.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
    }

    // « Choisir ce bouquet » préremplit le formulaire
    var choix = document.querySelectorAll('[data-bouquet]'), select = document.getElementById('bouquet');
    for (var b = 0; b < choix.length; b++) {
      choix[b].addEventListener('click', function () {
        if (select) { select.value = this.getAttribute('data-bouquet'); }
      });
    }

    // adresse seulement pour la livraison
    var adresse = document.querySelector('[data-adresse]'), recep = document.querySelectorAll('input[name="reception"]');
    function majAdresse() {
      var liv = document.querySelector('input[name="reception"]:checked');
      if (adresse) { adresse.classList.toggle('cache', !!liv && liv.value === 'retrait'); }
    }
    for (var r = 0; r < recep.length; r++) { recep[r].addEventListener('change', majAdresse); }
    majAdresse();

    // compteur du message de la carte
    var carte = document.getElementById('carte'), compteur = document.querySelector('[data-compteur]');
    if (carte && compteur) {
      carte.addEventListener('input', function () {
        var reste = 220 - carte.value.length;
        compteur.textContent = reste + ' caractère' + (reste > 1 ? 's' : '') + ' restant' + (reste > 1 ? 's' : '') + '.';
      });
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
