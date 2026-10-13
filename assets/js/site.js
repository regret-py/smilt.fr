/*
 * smilt. · script du site
 * JavaScript simple, sans build ni dépendance. Chargé avec `defer`.
 *
 * 1. configuration & outils    4. offres → formulaire     7. pied de page
 * 2. en-tête & menu            5. formulaire de devis
 * 3. apparition au défilement  6. John (assistant)
 */
(function () {
  'use strict';

  /* ===================== 1. configuration & outils ===================== */
  var CONFIG = {
    email: 'smilt.fr@proton.me',
    john: true,             // false retire John du site
    chatApi: '/api/chat',   // proxy Groq (Vercel, voir api/chat.js). Sans serveur, John utilise ses réponses écrites.
    quoteApi: '/api/devis', // envoi du devis par e-mail (Vercel + Resend, voir api/devis.js). Sinon : l'e-mail s'ouvre pré-rempli.
    autoQuotes: ['Essentiel', 'Vitrine'] // formules dont le devis PDF est créé tout seul (= AUTO_PLANS de assets/js/devis-pdf.js)
  };
  // Adresse de ce script, pour charger devis-pdf.js à côté de lui (document.currentScript n'existe que maintenant).
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL('assets/js/site.js', location.href).href;

  var root = document.documentElement;
  root.classList.add('js');
  var hasIO = 'IntersectionObserver' in window;
  var isFile = location.protocol === 'file:';
  function $(id) { return document.getElementById(id); }
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function narrow(s) { return s.replace(/ ([?!;])/g, ' $1').replace(/ :/g, ' :'); } // typographie française

  // Envoi JSON avec délai maximal. Résout { status, data } ; rejette en cas d'échec réseau.
  function postJSON(url, body, ms) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 12000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl && ctrl.signal
    }).then(function (r) {
      clearTimeout(to);
      return r.json().then(function (d) { return { status: r.status, data: d }; }, function () { return { status: r.status, data: null }; });
    }, function (e) { clearTimeout(to); throw e; });
  }

  /* ===================== 2. en-tête & menu ===================== */
  (function () {
    var top = $('top'), nav = $('nav'), burger = $('burger');
    if (!top) return;
    function onScroll() { top.classList.toggle('scrolled', window.scrollY > 8); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (burger && nav) {
      var setOpen = function (open) {
        nav.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      burger.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); }
      });
      document.addEventListener('click', function (e) {
        if (nav.classList.contains('open') && !nav.contains(e.target) && !burger.contains(e.target)) setOpen(false);
      });
      window.addEventListener('resize', function () { if (window.innerWidth > 860) setOpen(false); });
    }

    // Souligne la section en cours dans le menu.
    if (!hasIO || !nav) return;
    var links = {};
    all('a[href^="#"]', nav).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var seen = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var cur = null;
      Object.keys(links).forEach(function (id) { if (seen[id] && !cur) cur = id; });
      Object.keys(links).forEach(function (id) { links[id].classList.toggle('on', id === cur); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = $(id); if (s) io.observe(s); });
  })();

  /* ===================== 3. apparition au défilement ===================== */
  (function () {
    var els = all('.reveal, .steps');
    if (!hasIO) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ===================== 4. offres → formulaire ===================== */
  // « Choisir Vitrine » coche la bonne formule dans le formulaire de devis.
  all('[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () {
      var r = document.querySelector('input[name="formule"][value="' + a.getAttribute('data-plan') + '"]');
      if (r) r.checked = true;
    });
  });

  /* ===================== 5. formulaire de devis ===================== */
  // Essentiel et Vitrine : le devis PDF est fabriqué ici, dans le navigateur (assets/js/devis-pdf.js, chargé à la demande),
  // puis téléchargé. La demande part ensuite à l'agence : par api/devis.js (avec le même PDF en pièce jointe),
  // ou, sans serveur, par la messagerie du visiteur.
  (function () {
    var form = $('quoteForm');
    if (!form) return;
    var status = $('quoteStatus'), send = $('quoteSend'), file = $('quoteFile');
    var apiDown = isFile || !CONFIG.quoteApi;
    var MAILRE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
    var lastUrl = null;

    function val(name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
    function say(msg, kind) { status.textContent = msg; status.className = 'form-status' + (kind ? ' ' + kind : ''); }

    // Fabrique le devis PDF. Résout { number, date, name, url, total } ou null si impossible (navigateur trop ancien…).
    function makePdf(d) {
      if (CONFIG.autoQuotes.indexOf(d.plan) === -1 || !window.Blob || !window.URL || !URL.createObjectURL) return Promise.resolve(null);
      return import(new URL('devis-pdf.js', SCRIPT_SRC).href).then(function (m) {
        var q = m.makeQuote({
          plan: d.plan, entretien: d.entretien,
          client: { business: d.business, name: d.name, address: d.address, email: d.email, phone: d.phone }
        });
        var blob = new Blob([m.quotePdf(q)], { type: 'application/pdf' });
        return { number: q.number, date: q.date, name: m.quoteFileName(q), url: URL.createObjectURL(blob), total: m.formatMoney(q.totals.ttc) };
      }).catch(function () { return null; });
    }
    // Télécharge le PDF et laisse un lien pour le récupérer à nouveau.
    function offer(pdf) {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = pdf.url;
      file.textContent = '';
      var a = document.createElement('a');
      a.className = 'btn btn-ghost btn-sm';
      a.href = pdf.url; a.download = pdf.name;
      a.textContent = narrow('Télécharger le devis n° ' + pdf.number + ' (PDF)');
      file.appendChild(a);
      file.hidden = false;
      a.click();
    }

    function mailtoHref(d) {
      var body = [
        'Nom : ' + d.name,
        'Commerce : ' + d.business,
        'Adresse : ' + (d.address || '-'),
        'E-mail : ' + d.email,
        'Téléphone : ' + (d.phone || '-'),
        'Formule : ' + d.plan,
        'Option Entretien : ' + (d.entretien ? 'oui' : 'non'),
        d.number ? 'Devis : n° ' + d.number + ' (PDF téléchargé, à joindre si vous le souhaitez)' : '',
        '',
        d.message || ''
      ].join('\n').slice(0, 1400);
      // Sans devis automatique : lien vers l'outil interne de l'agence, pré-rempli avec la demande.
      if (!d.number) body += '\n\n---\nPour smilt. : ' + location.origin + '/outils/devis.html#' + new URLSearchParams({
        commerce: d.business, nom: d.name, adresse: d.address, email: d.email, tel: d.phone, formule: d.plan, entretien: d.entretien ? '1' : '0'
      }).toString();
      return 'mailto:' + CONFIG.email +
        '?subject=' + encodeURIComponent('Demande de devis · ' + d.business + (d.number ? ' · ' + d.number : '')) +
        '&body=' + encodeURIComponent(body);
    }
    function fallback(d, pdf) {
      // laisse le téléchargement démarrer avant d'ouvrir la messagerie
      setTimeout(function () { window.location.href = mailtoHref(d); }, pdf ? 700 : 0);
      say(narrow(pdf
        ? 'Votre devis n° ' + pdf.number + ' (' + pdf.total + ') est téléchargé. Votre messagerie s’ouvre pour nous prévenir : il ne reste qu’à envoyer le message. Rien ne s’ouvre ? Écrivez-nous à ' + CONFIG.email + '.'
        : 'Votre messagerie s’ouvre avec la demande pré-remplie : il ne reste qu’à l’envoyer. Rien ne s’ouvre ? Écrivez-nous à ' + CONFIG.email + '.'), 'ok');
    }
    function done(d, pdf) {
      form.reset();
      say(narrow(pdf
        ? 'C’est fait ! Votre devis n° ' + pdf.number + ' (' + pdf.total + ') est téléchargé, et une copie nous est parvenue. Pour l’accepter, renvoyez-le signé avec la mention « Bon pour accord ». On vous recontacte très vite.'
        : 'Merci ! Votre demande est bien partie. On vous prépare un devis personnalisé et on vous recontacte très vite.'), 'ok');
    }

    // Retire l'erreur dès que le champ est corrigé.
    form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (send.disabled) return;
      var care = form.elements.entretien;
      var d = {
        name: val('nom'), business: val('commerce'), email: val('email'), phone: val('telephone'), address: val('adresse'),
        plan: (form.querySelector('input[name="formule"]:checked') || {}).value || 'Je ne sais pas encore',
        entretien: !!(care && care.checked),
        message: val('message'), website: val('site')
      };
      var bad = [];
      [['nom', d.name, 'votre nom'], ['commerce', d.business, 'votre commerce'], ['email', MAILRE.test(d.email) ? d.email : '', 'un e-mail valide']]
        .forEach(function (f) {
          var el = form.elements[f[0]];
          if (!f[1]) { el.setAttribute('aria-invalid', 'true'); bad.push(f); } else el.removeAttribute('aria-invalid');
        });
      if (bad.length) {
        say(narrow('Il manque ' + bad.map(function (f) { return f[2]; }).join(', ') + '.'), 'err');
        form.elements[bad[0][0]].focus();
        return;
      }
      if (d.website) { say('Merci, votre demande est bien partie.', 'ok'); form.reset(); return; } // robot : on ne fait rien

      send.disabled = true;
      say(CONFIG.autoQuotes.indexOf(d.plan) !== -1 ? 'Préparation de votre devis…' : 'Envoi en cours…');
      makePdf(d).then(function (pdf) {
        if (pdf) { d.number = pdf.number; d.date = pdf.date; offer(pdf); }
        if (apiDown) { send.disabled = false; fallback(d, pdf); return; }
        if (pdf) say('Envoi en cours…');
        return postJSON(CONFIG.quoteApi, d, 15000).then(function (res) {
          send.disabled = false;
          if (res.status === 404 || res.status === 405 || res.status === 501) { apiDown = true; fallback(d, pdf); return; } // hébergement statique
          if (res.status === 429) { say(narrow('Trop de demandes en peu de temps. Réessayez dans quelques minutes, ou écrivez-nous à ' + CONFIG.email + '.'), 'err'); return; }
          if (res.data && res.data.sent) { done(d, pdf); return; }
          fallback(d, pdf);
        }, function () { send.disabled = false; fallback(d, pdf); });
      });
    });
  })();

  /* ===================== 6. John (assistant) ===================== */
  // Utilise CONFIG.chatApi (proxy Groq, voir api/chat.js) quand il répond ; sinon, ou en cas d'échec, les réponses écrites ci-dessous.
  (function () {
    var fab = $('johnOpen'), panel = $('johnPanel');
    if (!fab || !panel) return;
    if (!CONFIG.john) { fab.remove(); panel.remove(); all('[data-john]').forEach(function (b) { b.remove(); }); return; }
    var msgs = $('johnMsgs'), chips = $('johnChips'), form = $('johnForm'), text = $('johnText'), send = $('johnSend'), xbtn = $('johnClose');

    var MAIL = '<a href="mailto:' + CONFIG.email + '">' + CONFIG.email + '</a>';
    var FORM = '<a href="#devis">formulaire de devis</a>';

    // Base de réponses. k : mots-clés (sans accents) ; une clé de plusieurs mots doit apparaître telle quelle.
    // w : poids. Les entrées génériques (merci, bonjour) sont à la fin : en cas d'égalité, la réponse la plus précise gagne.
    var KB = [
      { w: 3, k: ['combien de temps', 'en combien', 'quel delai', 'quels delais'],
        a: 'Deux semaines entre notre premier rendez-vous et la mise en ligne, dès qu’on a vos textes et vos photos. Les étapes sont détaillées dans <a href="#methode">notre méthode</a>.' },
      { w: 3, k: ['comment ca marche', 'comment ca se passe', 'ca se passe comment', 'comment vous travaillez', 'comment travaillez'],
        a: 'Quatre étapes en deux semaines : J1, on se rencontre (30 minutes, gratuit) et on vous annonce un prix fixe. J3, on vous montre une première version. J10, vous ajustez (deux séries de retours comprises). J14, votre site est en ligne.' },
      { w: 5, k: ['essentiel'],
        a: 'La formule Essentiel, c’est 490 € prix fixe : un site d’une page avec vos services, horaires, accès et contact. Parfait sur mobile, avec plan Google Maps, boutons « Appeler » et « Itinéraire », formulaire et fiche Google remise à neuf.' },
      { w: 5, k: ['vitrine'],
        a: 'La formule Vitrine, c’est 890 € prix fixe : tout l’Essentiel, plus jusqu’à 5 pages (carte, tarifs, équipe, galerie…), un contenu que vous pouvez modifier, un référencement local renforcé et un lien vers votre outil de réservation.' },
      { w: 3, k: ['sur mesure', 'surmesure', 'specifique', 'personnalise'],
        a: 'Le Sur-mesure, c’est pour aller plus loin : click & collect, petite boutique en ligne, réservation intégrée, site en plusieurs langues ou refonte. Le prix dépend du projet, et le devis est gratuit : décrivez-le dans le ' + FORM + '.' },
      { w: 2, k: ['prix', 'tarif', 'tarifs', 'cout', 'coute', 'coutent', 'combien', 'cher', 'budget', 'euro', 'euros', 'quel prix'],
        a: 'Nos prix sont fixes et écrits dans le devis avant de commencer : Essentiel 490 € (site d’une page), Vitrine 890 € (jusqu’à 5 pages), Sur-mesure sur devis. Tout est détaillé dans <a href="#offres">nos offres</a>.' },
      { w: 2, k: ['delai', 'delais', 'temps', 'semaine', 'semaines', 'rapide', 'rapidement', 'quand', 'livraison', 'livre', 'duree', 'vite', 'urgent'],
        a: 'Deux semaines entre notre premier rendez-vous et la mise en ligne, dès qu’on a vos textes et vos photos. Les étapes sont détaillées dans <a href="#methode">notre méthode</a>.' },
      { k: ['methode', 'etape', 'etapes', 'processus', 'deroule', 'deroulement', 'fonctionne', 'comment', 'demarche'],
        a: 'Quatre étapes en deux semaines : J1, on se rencontre (30 minutes, gratuit) et on vous annonce un prix fixe. J3, on vous montre une première version. J10, vous ajustez (deux séries de retours comprises). J14, votre site est en ligne.' },
      { w: 2, k: ['inclus', 'inclut', 'comprend', 'compris', 'contient', 'dedans', 'fonctionnalite', 'fonctionnalites'],
        a: 'Chaque site comprend : affichage parfait sur mobile, plan Google Maps avec boutons « Appeler » et « Itinéraire », formulaire de contact, fiche Google Business Profile remise à neuf, mentions légales et page RGPD. La formule Vitrine ajoute jusqu’à 5 pages, une galerie et un référencement local renforcé.' },
      { w: 5, k: ['entretien', 'maintenance', 'abonnement'],
        a: 'L’option Entretien coûte 19 € par mois, sans engagement : hébergement, nom de domaine, sauvegardes et vos petites modifications (horaires, prix, fermetures) faites pour vous. Vous arrêtez quand vous voulez.' },
      { w: 2, k: ['mensuel', 'mensualite', 'par mois', 'hebergement', 'heberger', 'heberge', 'nom de domaine', 'domaine', 'serveur', 'sauvegarde', 'sauvegardes', 'engagement'],
        a: 'En option, l’Entretien à 19 € par mois couvre l’hébergement, le nom de domaine, les sauvegardes et vos petites modifications (horaires, prix, fermetures). Sans engagement. Sans cette option, il ne reste que le nom de domaine et l’hébergement à payer, et le site reste à vous.' },
      { w: 2, k: ['modifier', 'modification', 'modifications', 'changer', 'mise a jour', 'mettre a jour', 'moi meme', 'autonome', 'fermeture', 'fermetures'],
        a: 'Oui : horaires, fermetures exceptionnelles, prix ou carte, on vous montre comment les changer vous-même à la mise en ligne. Avec l’option Entretien, un simple message suffit et on s’en occupe.' },
      { w: 2, k: ['google', 'seo', 'referencement', 'referencer', 'trouve', 'trouver', 'visible', 'visibilite', 'recherche', 'classement', 'premiere page', 'premiere place'],
        a: 'On soigne votre fiche Google Business Profile et le référencement local de votre site, pour que les gens du quartier vous trouvent. Personne ne peut honnêtement garantir la première place sur Google ; on met tout en place pour vous en rapprocher.' },
      { w: 2, k: ['proprietaire', 'appartient', 'propriete', 'fichiers', 'quitter', 'recuperer', 'otage'],
        a: 'Votre site vous appartient. Le nom de domaine est à votre nom et, si un jour vous voulez partir, on vous remet tous les fichiers.' },
      { w: 2, k: ['ecommerce', 'e commerce', 'click', 'collect', 'commande', 'commandes', 'panier', 'vendre en ligne', 'vente en ligne', 'paiement en ligne', 'boutique en ligne'],
        a: 'C’est possible avec la formule Sur-mesure : click & collect, commandes ou petite boutique en ligne. Le prix dépend de votre projet ; le devis est gratuit, via le ' + FORM + '.' },
      { w: 2, k: ['reservation', 'reservations', 'reserver', 'planity', 'thefork', 'creneau', 'creneaux', 'agenda', 'booking'],
        a: 'Si vous utilisez déjà un outil (Planity, TheFork…), la formule Vitrine ajoute un lien bien visible vers votre page de réservation. Une réservation intégrée au site, c’est du Sur-mesure.' },
      { k: ['photo', 'photos', 'texte', 'textes', 'contenu', 'contenus', 'redaction', 'rediger', 'images', 'visuel', 'visuels'],
        a: 'Pas de textes ? On les écrit avec vous pendant le premier rendez-vous. Pour les photos, vous pouvez utiliser les vôtres ; s’il en manque, on en parle ensemble au moment du devis.' },
      { w: 2, k: ['paiement', 'payer', 'acompte', 'solde', 'regler', 'reglement', 'facture', 'facturation', 'virement'],
        a: 'Un acompte au démarrage, le solde à la mise en ligne. Tout est écrit noir sur blanc dans le devis, avant de commencer.' },
      { k: ['exemple', 'exemples', 'realisation', 'realisations', 'portfolio', 'references', 'client', 'clients', 'travaux', 'demo', 'demos', 'maquette', 'maquettes', 'voir vos sites', 'vos sites'],
        a: 'smilt. ouvre ses portes en 2026 : plutôt que d’aligner des logos, on vous montre <a href="#exemples">trois maquettes</a> de commerces imaginaires, telles qu’on les livrerait.' },
      { k: ['refonte', 'refaire', 'existant', 'ancien', 'moderniser', 'renover', 'site actuel'],
        a: 'Vous avez déjà un site ? On peut le refaire : selon l’ampleur, ça rentre dans Essentiel, Vitrine ou Sur-mesure. On regarde ensemble lors du <a href="#devis">devis gratuit</a>.' },
      { k: ['satisfait', 'plait', 'plaira', 'rembourse', 'remboursement', 'garanti', 'garantie', 'retour', 'retours', 'corriger', 'correction'],
        a: 'On vous montre une première version dès le troisième jour, justement pour corriger le tir tôt. Deux séries de retours sont comprises dans le prix.' },
      { k: ['wordpress', 'wix', 'shopify', 'squarespace', 'technologie', 'techno', 'cms', 'framework', 'html', 'code'],
        a: 'On choisit la technique pour vous, pas l’inverse : des sites légers et rapides, faciles à héberger, et qui vous appartiennent. Vous n’avez pas à vous en soucier, c’est notre métier.' },
      { id: 'ai', w: 3, k: ['john', 'ia', 'ai', 'robot', 'bot', 'assistant', 'humain', 'humaine', 'automatique', 'chatgpt', 'gpt', 'intelligence artificielle'],
        a: 'Je suis John, l’assistant automatique de smilt. Mes réponses sont produites automatiquement et peuvent être incomplètes : pour une réponse précise, l’équipe vous répond via le ' + FORM + ' ou à ' + MAIL + '. Et si vous cherchez ma tête, regardez le « i » du logo.' },
      { w: 2, k: ['devis', 'estimation', 'chiffrage', 'chiffrer', 'commencer', 'demarrer', 'lancer', 'interesse', 'interessee', 'partant', 'partante'],
        a: 'Avec plaisir ! Le devis est gratuit et sans engagement : remplissez le ' + FORM + ' en bas de page. Pour les formules Essentiel et Vitrine, votre devis PDF est créé tout de suite ; pour le Sur-mesure, on vous envoie un devis personnalisé.' },
      { w: 3, k: ['pdf', 'telecharger', 'telechargement', 'signer', 'signature', 'accord', 'accepter', 'valider', 'validite', 'acompte'],
        a: 'Pour Essentiel et Vitrine, le formulaire crée votre devis PDF dès l’envoi : prix fixe, détail des prestations et conditions. Il est valable 30 jours. Pour l’accepter, renvoyez-le daté et signé avec la mention « Bon pour accord » ; un acompte de 30 % lance le projet.' },
      { k: ['contact', 'contacter', 'joindre', 'email', 'mail', 'telephone', 'tel', 'appeler', 'numero', 'ecrire', 'parler', 'rappeler', 'rencontrer', 'rendez vous', 'rdv'],
        a: 'Le plus simple : le ' + FORM + ', en bas de page. Vous pouvez aussi écrire à ' + MAIL + '. On vous recontacte pour en parler, gratuitement et sans engagement.' },
      { k: ['smilt', 'agence', 'equipe', 'presentation', 'propos', 'histoire', 'fondateur', 'fondateurs', 'qui etes vous', 'vous etes qui', 'qui est derriere'],
        a: 'smilt. est une agence web parisienne, née en 2026. On crée des sites vitrine rapides, honnêtes et beaux pour les commerces de quartier : boulangeries, coiffeurs, cavistes, fleuristes, restaurants… Livrés en deux semaines, à prix fixe, sans jargon.' },
      { k: ['paris', 'zone', 'arrondissement', 'banlieue', 'province', 'france', 'ville', 'region', 'distance', 'deplacer', 'deplacez', 'idf'],
        a: 'On est à Paris et on aime passer en boutique, mais on travaille aussi à distance, partout en France.' },
      { k: ['boulangerie', 'boulanger', 'patisserie', 'coiffeur', 'coiffeuse', 'coiffure', 'caviste', 'cave', 'fleuriste', 'restaurant', 'resto', 'cafe', 'bar', 'fromager', 'fromagerie', 'librairie', 'barbier', 'institut', 'beaute', 'epicerie', 'artisan', 'commerce', 'commerces', 'commercant', 'commercante', 'magasin', 'traiteur', 'boucherie', 'boucher', 'pressing', 'opticien', 'salon', 'esthetique', 'onglerie', 'tatoueur'],
        a: 'Oui, c’est exactement pour vous ! On fait des sites pour les commerces de quartier : boulangeries, coiffeurs, cavistes, fleuristes, restaurants, artisans… Envie d’un prix ? Le <a href="#devis">devis</a> est gratuit.' },
      { k: ['merci', 'super', 'parfait', 'genial', 'cool', 'nickel', 'top'],
        a: 'Avec plaisir ! Belle journée à vous et à votre commerce.' },
      { g: 1, k: ['bonjour', 'salut', 'hello', 'hey', 'coucou', 'bonsoir', 'yo', 'hi', 'slt', 'bjr', 'cc'],
        a: 'Bonjour ! Posez-moi vos questions sur nos prix, nos délais, notre méthode ou ce qui est inclus dans votre site.' }
    ];
    var FB = 'Je n’ai pas la réponse à cette question. Je peux vous parler de nos prix, de nos délais, de notre méthode et de ce qui est inclus. Pour le reste, l’équipe vous répond via le ' + FORM + ' ou à ' + MAIL + '.';
    var GREET = 'Bonjour, je suis John, l’assistant automatique de smilt. Une question sur nos prix, nos délais ou notre façon de travailler ? Je vous réponds tout de suite.';
    var CHIPS = ['Vos prix ?', 'En combien de temps ?', 'Comment ça marche ?', 'Demander un devis'];
    var BUSY = 'Beaucoup de questions en peu de temps. Merci de patienter quelques secondes.';

    function norm(q) { return q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
    // Mots courts : mot entier. Mots de 4 lettres et plus : préfixe accepté (tarif → tarifs). Plusieurs mots : expression exacte.
    function scripted(q) {
      var n = norm(q), words = n.split(' '), padded = ' ' + n + ' ', best = null, bestScore = 0, greet = null;
      // « tu es un bot ? » parle de John, pas d'autre chose
      if (/\b(bot|robot|ia|humain|humaine)\b/.test(n) && /\b(tu|es|vous|etes|t)\b/.test(n)) return KB.filter(function (e) { return e.id === 'ai'; })[0].a;
      KB.forEach(function (e) {
        var score = 0;
        e.k.forEach(function (k) { if (k.indexOf(' ') !== -1 && padded.indexOf(' ' + k + ' ') !== -1) score += (e.w || 1) * 2; });
        // Chaque mot de la question compte une fois par entrée (« coute » ne doit pas compter pour « cout » et « coute »).
        words.forEach(function (w) {
          for (var i = 0; i < e.k.length; i++) {
            var k = e.k[i];
            if (k.indexOf(' ') === -1 && (w === k || (k.length >= 4 && w.indexOf(k) === 0))) { score += (e.w || 1); break; }
          }
        });
        if (!score) return;
        if (e.g) { greet = e; return; }
        if (score > bestScore) { best = e; bestScore = score; }
      });
      var e = best || greet;
      return e ? e.a : FB;
    }

    var started = false, busy = false, hist = [], opener = null;
    var apiDown = isFile || !CONFIG.chatApi;

    function push(who, fill) {
      var m = document.createElement('div');
      m.className = 'john-msg ' + who; fill(m);
      msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight;
      return m;
    }
    // innerHTML uniquement pour les réponses écrites ci-dessus (contenu de confiance).
    function addHTML(who, html) { return push(who, function (m) { m.innerHTML = narrow(html); }); }
    function addText(who, txt) { return push(who, function (m) { m.textContent = txt; }); }
    // Réponses de l'IA : texte brut, seuls les liens et e-mails deviennent cliquables.
    var LINK = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]|[\w.+-]+@[\w-]+\.[\w.-]*\w)/g;
    function addLinked(who, txt) {
      return push(who, function (m) {
        var last = 0;
        txt.replace(LINK, function (hit, _g, at) {
          if (at > last) m.appendChild(document.createTextNode(txt.slice(last, at)));
          var a = document.createElement('a'), mail = hit.indexOf('@') > 0 && hit.indexOf('://') < 0;
          a.href = mail ? 'mailto:' + hit : hit; a.textContent = hit;
          if (!mail) { a.target = '_blank'; a.rel = 'noopener nofollow'; }
          m.appendChild(a); last = at + hit.length;
          return hit;
        });
        if (last < txt.length) m.appendChild(document.createTextNode(txt.slice(last)));
      });
    }
    function typing() {
      var m = push('bot john-typing', function (el) { el.innerHTML = '<span></span><span></span><span></span>'; });
      m.setAttribute('aria-hidden', 'true');
      return m;
    }
    function apiReply(q) {
      if (apiDown) return Promise.resolve(null);
      return postJSON(CONFIG.chatApi, { message: q.slice(0, 500), lang: 'fr', history: hist.slice(-6) }, 12000).then(function (res) {
        if (res.status === 404 || res.status === 405 || res.status === 501) { apiDown = true; return null; } // hébergement statique
        if (res.status === 429) return { rl: true };
        var d = res.data;
        return res.status === 200 && d && typeof d.reply === 'string' && d.reply.trim() ? d.reply.trim().slice(0, 1500) : null;
      }, function () { return null; });
    }
    function ask(q) {
      if (busy) return;
      busy = true; send.disabled = true;
      addText('me', q);
      var t = typing(), t0 = Date.now();
      function finish(res) {
        setTimeout(function () {
          t.remove();
          if (res && res.rl) addText('bot', BUSY);
          else if (typeof res === 'string') { addLinked('bot', res); hist.push({ role: 'user', content: q }, { role: 'assistant', content: res }); }
          else {
            var html = scripted(q);
            addHTML('bot', html);
            hist.push({ role: 'user', content: q }, { role: 'assistant', content: html.replace(/<[^>]+>/g, '') });
          }
          if (hist.length > 12) hist = hist.slice(-12);
          busy = false; send.disabled = false;
        }, Math.max(0, 500 - (Date.now() - t0)));
      }
      apiReply(q).then(finish, function () { finish(null); });
    }
    function renderChips() {
      chips.innerHTML = '';
      CHIPS.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'john-chip'; b.type = 'button'; b.textContent = narrow(c);
        b.addEventListener('click', function () { ask(b.textContent); });
        chips.appendChild(b);
      });
    }
    function openPanel(from, question) {
      opener = from || fab;
      panel.hidden = false; fab.classList.add('hide'); fab.setAttribute('aria-expanded', 'true');
      if (!started) { started = true; addText('bot', narrow(GREET)); renderChips(); }
      if (question) ask(question);
      setTimeout(function () { text.focus(); }, 50);
    }
    function closePanel(restoreFocus) {
      panel.hidden = true; fab.classList.remove('hide'); fab.setAttribute('aria-expanded', 'false');
      if (restoreFocus !== false && opener && document.contains(opener) && opener.offsetParent !== null) opener.focus();
    }

    fab.hidden = false;
    fab.addEventListener('click', function () { openPanel(fab); });
    all('[data-john]').forEach(function (b) {
      b.addEventListener('click', function () { openPanel(b, b.getAttribute('data-john') || ''); });
    });
    xbtn.addEventListener('click', function () { closePanel(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
    // Un lien vers une section de la page ferme John pour laisser voir la section.
    msgs.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (a) closePanel(false);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = text.value.trim();
      if (!v || busy) return;
      text.value = '';
      ask(v);
    });

    // Le bouton apparaît une fois l'introduction dépassée, et s'efface devant le formulaire de devis.
    var pastHero = !hasIO, onForm = false;
    function sync() { fab.classList.toggle('show', pastHero && !onForm); }
    if (hasIO) {
      var heroFoot = document.querySelector('.hero-foot'), quote = $('quoteForm');
      if (heroFoot) new IntersectionObserver(function (es) {
        pastHero = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; sync();
      }).observe(heroFoot); else pastHero = true;
      if (quote) new IntersectionObserver(function (es) { onForm = es[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(quote);
    }
    sync();
  })();

  /* ===================== 7. pied de page ===================== */
  var y = $('year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
