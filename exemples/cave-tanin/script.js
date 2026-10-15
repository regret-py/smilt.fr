/* Cave Tanin · interactions (ES5, sans dépendance)
   Menu mobile, badge « ouvert / fermé » à l’heure de Paris, horaires du jour,
   filtres et panier click & collect de la boutique, préremplissage des réservations. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.className += ' js';

  var NBSP = ' ';
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  /* horaires en heures décimales, index 0 = dimanche */
  var HORAIRES = { 0: [10.5, 13.5], 1: null, 2: [16, 21], 3: [16, 21], 4: [16, 21], 5: [16, 21], 6: [11, 21] };

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function heure(x) {
    var h = Math.floor(x), m = Math.round((x - h) * 60);
    return h + NBSP + 'h' + (m ? NBSP + (m < 10 ? '0' : '') + m : '');
  }
  function euros(n) { return n.toFixed(2).replace('.', ',') + NBSP + '€'; }

  /* heure de Paris : { jour (0-6), h (décimal), y, m, d } */
  function maintenantParis() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(d);
      var o = {};
      for (var i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
      var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
      return { jour: wd, h: (+o.hour % 24) + (+o.minute) / 60, y: +o.year, m: +o.month, d: +o.day };
    } catch (e) {
      return { jour: d.getDay(), h: d.getHours() + d.getMinutes() / 60, y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    }
  }
  var now = maintenantParis();

  /* ---------- menu mobile ---------- */
  var burger = $('.burger'), nav = $('#nav');
  if (burger && nav) {
    burger.hidden = false;
    burger.addEventListener('click', function () {
      var ouvert = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
      nav.classList.toggle('ouverte', !ouvert);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { burger.setAttribute('aria-expanded', 'false'); nav.classList.remove('ouverte'); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && nav.classList.contains('ouverte')) {
        burger.setAttribute('aria-expanded', 'false'); nav.classList.remove('ouverte'); burger.focus();
      }
    });
  }

  /* ---------- ouvert / fermé ---------- */
  var statut = $('[data-statut]');
  if (statut) {
    var auj = HORAIRES[now.jour], txt, etat;
    if (auj && now.h >= auj[0] && now.h < auj[1]) {
      etat = 'ouvert'; txt = 'Ouvert · jusqu’à ' + heure(auj[1]);
    } else {
      etat = 'ferme';
      if (auj && now.h < auj[0]) {
        txt = 'Fermé · ouvre à ' + heure(auj[0]);
      } else {
        for (var k = 1; k <= 7; k++) {
          var j = (now.jour + k) % 7;
          if (HORAIRES[j]) { txt = 'Fermé · ouvre ' + (k === 1 ? 'demain' : JOURS[j]) + ' à ' + heure(HORAIRES[j][0]); break; }
        }
      }
    }
    statut.setAttribute('data-etat', etat);
    $('[data-statut-texte]', statut).textContent = txt;
  }
  var ligneJour = $('[data-horaires] tr[data-jour="' + now.jour + '"]');
  if (ligneJour) ligneJour.className = 'aujourdhui';

  /* ---------- boutique : filtres ---------- */
  var catalogue = $('#catalogue');
  if (catalogue) {
    var vins = $$('.vin', catalogue);
    var resultat = $('#resultat');
    var videFiltre = $('#vide-filtre');
    var filtrer = function () {
      var c = ($('input[name="couleur"]:checked') || {}).value || 'tous';
      var p = ($('input[name="prix"]:checked') || {}).value || 'tous';
      var n = 0;
      vins.forEach(function (v) {
        var prix = +v.getAttribute('data-prix');
        var okC = c === 'tous' || v.getAttribute('data-couleur') === c;
        var okP = p === 'tous' || (p === 'bas' && prix < 15) || (p === 'moyen' && prix >= 15 && prix <= 25) || (p === 'haut' && prix > 25);
        v.hidden = !(okC && okP);
        if (okC && okP) n++;
      });
      resultat.textContent = n === 0 ? 'Aucun vin ne correspond' : n + (n > 1 ? ' vins affichés' : ' vin affiché') + ' sur ' + vins.length;
      videFiltre.hidden = n !== 0;
    };
    $$('.filtres input').forEach(function (i) { i.addEventListener('change', filtrer); });
    var reinit = $('#reinitialiser');
    if (reinit) reinit.addEventListener('click', function () {
      $('input[name="couleur"][value="tous"]').checked = true;
      $('input[name="prix"][value="tous"]').checked = true;
      filtrer();
    });
    filtrer();

    /* ---------- panier ---------- */
    var CLE = 'cave-tanin-panier';
    var panier = {};
    try { panier = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { panier = {}; }
    var infos = {};
    vins.forEach(function (v) {
      infos[v.getAttribute('data-id')] = { nom: v.getAttribute('data-nom'), prix: +v.getAttribute('data-prix'), btn: $('.ajouter', v) };
    });
    var lignes = $('#lignes'), vide = $('#panier-vide'), totalEl = $('#total'), compteEl = $('#panier-compte');
    var payer = $('#payer'), flottant = $('#panier-flottant'), flottantTexte = $('#panier-flottant-texte');
    var enteteCompte = $('[data-compte-entete]'), message = $('#message-panier');

    var sauver = function () { try { localStorage.setItem(CLE, JSON.stringify(panier)); } catch (e) { /* stockage indisponible */ } };
    var bouton = function (txt, cls, label) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.textContent = txt;
      if (label) b.setAttribute('aria-label', label);
      return b;
    };
    var rendre = function () {
      lignes.innerHTML = '';
      var total = 0, nb = 0;
      Object.keys(panier).forEach(function (id) {
        var info = infos[id], q = panier[id];
        if (!info || !(q > 0)) { delete panier[id]; return; }
        total += info.prix * q; nb += q;
        var li = document.createElement('li'); li.className = 'ligne';
        var nom = document.createElement('span'); nom.className = 'ligne-nom'; nom.textContent = info.nom;
        var px = document.createElement('span'); px.className = 'ligne-prix'; px.textContent = euros(info.prix * q);
        var act = document.createElement('div'); act.className = 'ligne-actions';
        var qte = document.createElement('div'); qte.className = 'quantite';
        var moins = bouton('−', '', 'Retirer une bouteille de ' + info.nom);
        var out = document.createElement('output'); out.textContent = q; out.setAttribute('aria-label', 'Quantité');
        var plus = bouton('+', '', 'Ajouter une bouteille de ' + info.nom);
        var ret = bouton('Retirer', 'retirer', 'Retirer ' + info.nom + ' du panier');
        moins.addEventListener('click', function () { panier[id]--; maj(id, 'moins'); });
        plus.addEventListener('click', function () { panier[id] = Math.min(36, panier[id] + 1); maj(id, 'plus'); });
        ret.addEventListener('click', function () { delete panier[id]; maj(id, null); });
        qte.appendChild(moins); qte.appendChild(out); qte.appendChild(plus);
        act.appendChild(qte); act.appendChild(ret);
        li.appendChild(nom); li.appendChild(px); li.appendChild(act);
        li.setAttribute('data-ligne', id);
        lignes.appendChild(li);
      });
      Object.keys(infos).forEach(function (id) {
        var b = infos[id].btn, q = panier[id] || 0;
        b.classList.toggle('dans-panier', q > 0);
        b.textContent = q > 0 ? 'Encore une (' + q + ')' : 'Ajouter';
        b.setAttribute('aria-label', q > 0 ? 'Ajouter une autre bouteille de ' + infos[id].nom + ', ' + q + ' déjà dans le panier' : 'Ajouter ' + infos[id].nom + ' au panier');
      });
      vide.hidden = nb > 0;
      totalEl.textContent = euros(total);
      var libelle = nb + (nb > 1 ? ' bouteilles' : ' bouteille');
      compteEl.textContent = nb ? libelle : 'vide';
      payer.textContent = nb ? 'Payer ' + euros(total) + ' et réserver' : 'Payer et réserver';
      if (enteteCompte) enteteCompte.textContent = nb;
      if (flottant) {
        flottant.classList.toggle('visible', nb > 0);
        flottantTexte.textContent = 'Voir le panier · ' + libelle + ' · ' + euros(total);
      }
      sauver();
    };
    var maj = function (id, quoi) {
      rendre();
      if (quoi) {
        var l = $('[data-ligne="' + id + '"] .quantite button:' + (quoi === 'moins' ? 'first-child' : 'last-child'));
        if (l) l.focus(); else payer.focus();
      } else {
        var premier = $('.ligne .quantite button'); (premier || payer).focus();
      }
    };
    vins.forEach(function (v) {
      var id = v.getAttribute('data-id');
      infos[id].btn.addEventListener('click', function () {
        panier[id] = Math.min(36, (panier[id] || 0) + 1);
        message.textContent = infos[id].nom + ' ajouté au panier.';
        rendre();
      });
    });

    /* créneaux de retrait : fenêtres de 2 h, au moins 2 h après maintenant */
    var select = $('#creneau');
    if (select) {
      var options = [];
      for (var i = 0; i < 8 && options.length < 8; i++) {
        var dt = new Date(Date.UTC(now.y, now.m - 1, now.d + i));
        var j = dt.getUTCDay(), h = HORAIRES[j];
        if (!h) continue;
        var nomJour = i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : JOURS[j].charAt(0).toUpperCase() + JOURS[j].slice(1) + ' ' + dt.getUTCDate() + ' ' + MOIS[dt.getUTCMonth()];
        for (var s = h[0]; s + 2 <= h[1] && options.length < 8; s += 1) {
          if (i === 0 && s < now.h + 2) continue;
          options.push(nomJour + ', ' + heure(s) + ' – ' + heure(s + 2));
          if (i > 1) s += 2;
        }
      }
      if (options.length) {
        select.innerHTML = '';
        options.forEach(function (o) { var op = document.createElement('option'); op.textContent = o; select.appendChild(op); });
      }
    }

    var form = $('#commande');
    if (form) form.addEventListener('submit', function (e) {
      var nb = 0; Object.keys(panier).forEach(function (id) { nb += panier[id]; });
      if (!nb) {
        e.preventDefault(); e.stopPropagation();
        message.textContent = 'Votre panier est vide' + NBSP + ': ajoutez au moins une bouteille.';
      } else {
        message.textContent = '';
      }
    });
    rendre();
  }

  /* ---------- dégustations : préremplir la séance ---------- */
  var choix = $('#seance');
  if (choix) {
    $$('[data-seance]').forEach(function (a) {
      a.addEventListener('click', function () {
        choix.value = a.getAttribute('data-seance');
        setTimeout(function () { choix.focus(); }, 350);
      });
    });
  }
})();
