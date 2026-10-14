/*
 * Fournil Lune · petites interactions (ES5, sans dépendance).
 * La page reste lisible sans JavaScript : ce script ajoute l'état « ouvert / fermé » calculé à l'heure de Paris,
 * la prochaine fournée, le menu mobile, les onglets des douceurs et l'aide au formulaire de commande.
 */
(function () {
  'use strict';

  var racine = document.documentElement;
  racine.classList.add('js');

  var NB = ' ';
  // Minutes depuis minuit. 0 = dimanche … 6 = samedi.
  var HORAIRES = { 0: [420, 810], 1: null, 2: [420, 1200], 3: [420, 1200], 4: [420, 1200], 5: [420, 1200], 6: [420, 1200] };
  var FOURNEES_SEMAINE = [
    { m: 420, texte: 'pour le petit-déjeuner' },
    { m: 690, texte: 'pour le déjeuner' },
    { m: 1020, texte: 'pour le pain du soir' }
  ];
  var FOURNEES_DIMANCHE = [
    { m: 420, texte: 'pour le petit-déjeuner' },
    { m: 570, texte: 'brioches et douceurs' },
    { m: 690, texte: 'pour le déjeuner' }
  ];
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var CODES = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function heure(m) {
    var h = Math.floor(m / 60), mn = m % 60;
    return h + NB + 'h' + (mn ? NB + (mn < 10 ? '0' : '') + mn : '');
  }

  function maintenantParis() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(d);
      var o = {};
      for (var i = 0; i < parts.length; i++) { o[parts[i].type] = parts[i].value; }
      if (CODES.hasOwnProperty(o.weekday)) {
        return { jour: CODES[o.weekday], minutes: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
      }
    } catch (e) { /* navigateur ancien : heure locale */ }
    return { jour: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
  }

  function etat(n) {
    var h = HORAIRES[n.jour];
    if (h && n.minutes >= h[0] && n.minutes < h[1]) {
      var bientot = h[1] - n.minutes <= 30;
      return { ouvert: true, court: (bientot ? 'Ferme bientôt' : 'Ouvert') + ' · jusqu’à ' + heure(h[1]),
        titre: bientot ? 'Ferme bientôt' : 'Ouvert maintenant', detail: 'Jusqu’à ' + heure(h[1]) + ' aujourd’hui' };
    }
    if (h && n.minutes < h[0]) {
      return { ouvert: false, court: 'Fermé · ouvre à ' + heure(h[0]), titre: 'Fermé pour l’instant', detail: 'On ouvre à ' + heure(h[0]) + ', le four chauffe déjà.' };
    }
    for (var i = 1; i <= 7; i++) {
      var j = (n.jour + i) % 7;
      if (HORAIRES[j]) {
        var quand = i === 1 ? 'demain' : JOURS[j];
        return { ouvert: false, court: 'Fermé · ouvre ' + quand + ' à ' + heure(HORAIRES[j][0]),
          titre: 'Fermé pour aujourd’hui', detail: 'On rouvre ' + quand + ' à ' + heure(HORAIRES[j][0]) + '.' };
      }
    }
    return null;
  }

  function fournee(n) {
    if (!HORAIRES[n.jour]) { return { index: -1, texte: 'Pas de fournée le lundi : le fournil se repose.' }; }
    var liste = n.jour === 0 ? FOURNEES_DIMANCHE : FOURNEES_SEMAINE;
    for (var i = 0; i < liste.length; i++) {
      var f = liste[i].m;
      if (n.minutes < f) { return { index: i, texte: 'Prochaine fournée à ' + heure(f) }; }
      if (n.minutes < f + 20) { return { index: i, sortie: true, texte: 'La fournée de ' + heure(f) + ' vient de sortir' }; }
    }
    return { index: liste.length, texte: 'Dernière fournée sortie à ' + heure(liste[liste.length - 1].m) };
  }

  function mettreAJour() {
    var n = maintenantParis();
    var e = etat(n);
    var f = fournee(n);
    if (!e) { return; }
    var i;

    var blocs = document.querySelectorAll('[data-etat]');
    for (i = 0; i < blocs.length; i++) {
      var b = blocs[i];
      b.classList.toggle('est-ouvert', !!e.ouvert);
      b.classList.toggle('est-ferme', !e.ouvert);
      var type = b.getAttribute('data-etat');
      if (type === 'court') {
        var t = b.querySelector('[data-etat-texte]');
        if (t) { t.textContent = e.court; }
      } else if (type === 'long') {
        var ti = b.querySelector('[data-etat-titre]'), de = b.querySelector('[data-etat-detail]'), fo = b.querySelector('[data-fournee-texte]');
        if (ti) { ti.textContent = e.titre; }
        if (de) { de.textContent = e.detail; }
        if (fo) { fo.textContent = f.texte; }
      } else if (type === 'phrase') {
        b.textContent = '';
        var point = document.createElement('span');
        point.className = 'pastille-point';
        point.setAttribute('aria-hidden', 'true');
        b.appendChild(point);
        b.appendChild(document.createTextNode(e.titre + '. ' + e.detail.replace(/\.$/, '') + '.'));
      }
    }

    // Ligne du jour dans le tableau des horaires
    var lignes = document.querySelectorAll('.table-horaires tr[data-jour]');
    for (i = 0; i < lignes.length; i++) {
      var l = lignes[i];
      var estAujourdhui = parseInt(l.getAttribute('data-jour'), 10) === n.jour;
      l.classList.toggle('aujourdhui', estAujourdhui);
      var etiquette = l.querySelector('.aujourdhui-etiquette');
      if (estAujourdhui && !etiquette) {
        etiquette = document.createElement('span');
        etiquette.className = 'aujourdhui-etiquette';
        etiquette.textContent = 'aujourd’hui';
        l.querySelector('th').appendChild(etiquette);
      } else if (!estAujourdhui && etiquette) {
        etiquette.parentNode.removeChild(etiquette);
      }
    }

    // Les trois fournées du hero
    var liste = n.jour === 0 ? FOURNEES_DIMANCHE : FOURNEES_SEMAINE;
    var jour = document.querySelector('[data-fournees-jour]');
    if (jour) { jour.textContent = n.jour === 0 ? 'du dimanche' : 'du mardi au samedi'; }
    var items = document.querySelectorAll('.fournees-liste li');
    for (i = 0; i < items.length && i < liste.length; i++) {
      var span = items[i].querySelector('span');
      if (span) {
        span.textContent = '';
        var gras = document.createElement('b');
        gras.textContent = heure(liste[i].m);
        span.appendChild(gras);
        span.appendChild(document.createTextNode(' ' + liste[i].texte));
      }
      var ouvertAujourdhui = !!HORAIRES[n.jour];
      items[i].classList.toggle('prochaine', !!(ouvertAujourdhui && i === f.index && !f.sortie));
      items[i].classList.toggle('passee', !!(ouvertAujourdhui && (i < f.index || (i === f.index && f.sortie))));
    }
  }

  mettreAJour();
  setInterval(mettreAJour, 60000);

  // ---------- Menu mobile ----------
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  var tete = document.querySelector('.tete');
  if (burger && nav && tete) {
    burger.hidden = false;
    var fermer = function () {
      burger.setAttribute('aria-expanded', 'false');
      tete.classList.remove('menu-ouvert');
    };
    burger.addEventListener('click', function () {
      var ouvert = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
      tete.classList.toggle('menu-ouvert', !ouvert);
    });
    nav.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('a')) { fermer(); }
    });
    document.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && tete.classList.contains('menu-ouvert')) { fermer(); burger.focus(); }
    });
  }

  // ---------- Onglets des douceurs ----------
  var blocOnglets = document.querySelector('[data-onglets]');
  if (blocOnglets) {
    var panneaux = blocOnglets.querySelectorAll('.panneau');
    var tablist = document.createElement('div');
    tablist.className = 'onglets-liste';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Viennoiseries, pâtisseries et douceurs du dimanche');
    var boutons = [];
    var choisir = function (index, focus) {
      for (var k = 0; k < boutons.length; k++) {
        var actif = k === index;
        boutons[k].setAttribute('aria-selected', actif ? 'true' : 'false');
        boutons[k].tabIndex = actif ? 0 : -1;
        panneaux[k].hidden = !actif;
      }
      if (focus) { boutons[index].focus(); }
    };
    for (var p = 0; p < panneaux.length; p++) {
      var panneau = panneaux[p];
      var titre = panneau.querySelector('.panneau-titre');
      var bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.id = 'onglet-' + panneau.id;
      bouton.setAttribute('role', 'tab');
      bouton.setAttribute('aria-controls', panneau.id);
      bouton.textContent = titre ? titre.textContent : 'Onglet ' + (p + 1);
      panneau.setAttribute('role', 'tabpanel');
      panneau.setAttribute('aria-labelledby', bouton.id);
      panneau.tabIndex = 0;
      (function (index) {
        bouton.addEventListener('click', function () { choisir(index, false); });
        bouton.addEventListener('keydown', function (ev) {
          var dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
          if (ev.key === 'Home') { ev.preventDefault(); choisir(0, true); return; }
          if (ev.key === 'End') { ev.preventDefault(); choisir(boutons.length - 1, true); return; }
          if (dir) { ev.preventDefault(); choisir((index + dir + boutons.length) % boutons.length, true); }
        });
      })(p);
      boutons.push(bouton);
      tablist.appendChild(bouton);
    }
    blocOnglets.insertBefore(tablist, blocOnglets.firstChild);
    // Le dimanche, on ouvre directement l'onglet du dimanche.
    choisir(maintenantParis().jour === 0 ? panneaux.length - 1 : 0, false);
  }

  // ---------- Formulaire de commande ----------
  var produit = document.getElementById('cmd-produit');
  var liens = document.querySelectorAll('[data-choix]');
  for (var c = 0; c < liens.length; c++) {
    liens[c].addEventListener('click', function () {
      if (produit) { produit.value = this.getAttribute('data-choix'); }
    });
  }
  var date = document.querySelector('input[type="date"][data-delai]');
  if (date) {
    try {
      var delai = parseInt(date.getAttribute('data-delai'), 10) || 2;
      var jourParis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      var base = new Date(jourParis + 'T12:00:00Z');
      base.setUTCDate(base.getUTCDate() + delai);
      date.min = base.toISOString().slice(0, 10);
    } catch (e) { /* pas de minimum, la boutique vérifie de toute façon */ }
  }
})();
