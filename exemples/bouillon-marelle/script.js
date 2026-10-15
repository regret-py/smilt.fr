/* Bouillon Marelle · interactions (ES5, sans dépendance) */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.className = doc.className.replace(/\bno-js\b/, '') + ' js-menu';

  /* ----- Menu mobile ----- */
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav-principale');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var ouvert = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
      nav.classList.toggle('ouvert', !ouvert);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && nav.classList.contains('ouvert')) {
        nav.classList.remove('ouvert');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  }

  /* ----- Heure de Paris ----- */
  function maintenantParis() {
    try {
      var parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false
      }).formatToParts(new Date());
      var o = {};
      for (var i = 0; i < parts.length; i++) { o[parts[i].type] = parts[i].value; }
      var jours = { 'dim.': 0, 'lun.': 1, 'mar.': 2, 'mer.': 3, 'jeu.': 4, 'ven.': 5, 'sam.': 6 };
      var j = jours[(o.weekday || '').toLowerCase()];
      if (j === undefined) { return null; }
      return { jour: j, h: parseInt(o.hour, 10) % 24, m: parseInt(o.minute, 10), jj: parseInt(o.day, 10), mm: parseInt(o.month, 10) };
    } catch (err) { return null; }
  }
  var t = maintenantParis();
  if (!t) { return; }

  /* ----- Ouvert / fermé : tous les jours 12 h – minuit, fermé le 25 décembre et le 1er mai ----- */
  var ferieFerme = (t.jj === 25 && t.mm === 12) || (t.jj === 1 && t.mm === 5);
  var ouvert = !ferieFerme && t.h >= 12;
  var texte;
  if (ouvert) {
    var reste = (24 - t.h) * 60 - t.m;
    if (reste <= 30) { texte = 'Ouvert · la cuisine a pris ses dernières commandes'; }
    else if (reste <= 60) { texte = 'Ouvert jusqu’à minuit · dernières commandes à 23 h 30'; }
    else { texte = 'Ouvert maintenant · jusqu’à minuit'; }
  } else if (ferieFerme) {
    texte = 'Fermé aujourd’hui · réouverture demain à midi';
  } else {
    texte = 'Fermé · ouvre à midi';
  }
  var statuts = document.querySelectorAll('[data-statut]');
  for (var s = 0; s < statuts.length; s++) {
    statuts[s].setAttribute('data-etat', ouvert ? 'ouvert' : 'ferme');
    var tx = statuts[s].querySelector('.statut-txt');
    if (tx) { tx.textContent = texte; }
  }

  /* ----- Jour courant : plat du jour et tableau des horaires ----- */
  var lignes = document.querySelectorAll('[data-semaine] li, [data-horaires] tr');
  var platDuJour = null;
  for (var k = 0; k < lignes.length; k++) {
    if (parseInt(lignes[k].getAttribute('data-jour'), 10) === t.jour) {
      lignes[k].className += ' aujourdhui';
      if (lignes[k].tagName === 'LI') { platDuJour = lignes[k]; }
    }
  }
  var ardoise = document.querySelector('[data-ardoise]');
  if (ardoise && platDuJour) {
    var nom = platDuJour.querySelector('.sj-plat'), prix = platDuJour.querySelector('.sj-prix');
    var jourNom = platDuJour.querySelector('.sj-jour');
    ardoise.querySelector('.ardoise-sur').textContent = 'Ce ' + jourNom.textContent.toLowerCase() + ' à l’ardoise';
    ardoise.querySelector('[data-plat-nom]').textContent = nom.textContent;
    ardoise.querySelector('[data-plat-prix]').textContent = prix.textContent;
  }
})();

/* ----- Filtres de la carte ----- */
(function () {
  'use strict';
  var bloc = document.querySelector('[data-filtres]');
  if (!bloc) { return; }
  bloc.hidden = false;
  var boutons = bloc.querySelectorAll('[data-filtre]');
  var etat = bloc.querySelector('[data-filtres-etat]');
  var mets = document.querySelectorAll('.rubrique .mets:not(.mets-simples) li');
  function appliquer(f) {
    var n = 0;
    for (var i = 0; i < mets.length; i++) {
      var ok = f === 'tout' || mets[i].hasAttribute('data-' + f);
      mets[i].hidden = !ok;
      if (ok) { n++; }
    }
    for (var b = 0; b < boutons.length; b++) {
      boutons[b].setAttribute('aria-pressed', boutons[b].getAttribute('data-filtre') === f ? 'true' : 'false');
    }
    if (etat) {
      etat.textContent = f === 'tout' ? '' : n + (f === 'vg' ? ' plats végétariens affichés' : ' plats sans gluten affichés');
    }
  }
  for (var b = 0; b < boutons.length; b++) {
    boutons[b].addEventListener('click', function () { appliquer(this.getAttribute('data-filtre')); });
  }
})();
