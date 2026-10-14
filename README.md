# smilt.fr

Site de **smilt.**, agence web à Paris : « Sites qui font sourire. »
HTML, CSS et JavaScript simples. Pas de framework, pas d'étape de build.
Avec **John**, le petit assistant automatique du site (le « i » du logo).

## Structure

```
index.html              page d'accueil : hero, promesse, offres, quelle formule ?, engagements, méthode, exemples
                        (captures + avant/après), conseils, questions, devis
exemples/               galerie (index.html) et 7 sites de démonstration complets, un dossier chacun :
                        fournil-lune, salon-frange, cave-tanin, bouillon-marelle, atelier-pistil, fromagerie-caille,
                        librairie-rature (+ demo.css / demo.js : bandeau « site de démonstration » et bulles explicatives)
conseils/               6 articles pour les commerçants + flux RSS (feed.xml)
sites-pour/             une page par métier (boulangerie, coiffeur, caviste, restaurant, fleuriste, fromager, librairie)
lexique/                le lexique sans jargon
mentions-legales.html   mentions légales, données personnelles, cookies (à compléter, voir plus bas)
404.html                page introuvable
outils/gabarit-page.html  modèle à copier pour créer une nouvelle page (en-tête, pied de page, CSP déjà en place)
assets/css/site.css     toute la mise en forme (variables de couleur en haut du fichier)
assets/js/site.js       menu, animations, formulaire de devis, John (un seul fichier, commenté par section)
assets/js/devis-pdf.js  devis PDF : coordonnées de l'entreprise, offres, conditions, calcul et fabrication du PDF
assets/js/devis-assets.js  polices et logo pour le PDF (généré par outils/build-pdf-assets.py)
assets/js/devis-load.js charge le moteur de devis pour site.js (qui reste lisible par les navigateurs anciens)
outils/devis.html       outil interne : devis sur mesure (non référencé, voir « Devis PDF »)
assets/fonts/           Space Grotesk (variable) et Space Mono, auto-hébergées, licence SIL OFL 1.1
assets/img/             og.png (aperçu réseaux sociaux, 1200×630), logos SVG (fond clair / fond sombre)
api/chat.js             John avec l'IA : proxy vers Groq (Vercel uniquement)
api/devis.js            envoi du formulaire de devis par e-mail via Resend (Vercel uniquement)
favicon.svg/.ico, apple-touch-icon.png, icon-192/512.png, site.webmanifest
robots.txt, sitemap.xml, CNAME, .nojekyll, vercel.json, package.json
```

## Modifier le contenu

- **Textes** : directement dans `index.html`, section par section (chaque bloc est commenté).
- **Typographie française** : `&nbsp;` avant `:`, `&#8239;` (espace fine) avant `?`, `!`, `;` et à l'intérieur des « guillemets ».
  Le site vouvoie le visiteur.
- **Prix et offres**. Ils apparaissent à plusieurs endroits, à garder alignés :
  1. `index.html` : hero (490€), section « Offres », FAQ « Combien coûte vraiment un site ? », balises `description` et JSON-LD ;
  2. `assets/js/devis-pdf.js` : `CATALOG` (contenu et prix des devis PDF), `ENTRETIEN`, `TERMS` (validité, acompte, délai) ;
  3. `assets/js/site.js` : réponses écrites de John (tableau `KB`) ;
  4. `api/chat.js` : les faits que connaît John en mode IA (constante `SYSTEM`) ;
  5. `assets/img/og.png` : l'image de partage mentionne « À partir de 490 € ».
- **E-mail de contact** (`smilt.fr@proton.me`) : `CONFIG.email` en haut de `assets/js/site.js`, les liens `mailto:` et le JSON-LD de
  `index.html`, `mentions-legales.html` et `api/chat.js`. Une recherche de `smilt.fr@proton.me` les trouve tous.
- **Exemples** : les trois téléphones de la section « Exemples » sont dessinés en HTML/CSS (classes `d-bread`, `d-hair`, `d-wine`).
  Ce sont des commerces fictifs, et c'est écrit sur la page. Quand vous aurez de vrais clients, remplacez-les par des captures
  de leurs sites (avec leur accord).
- Mettre à jour `<lastmod>` dans `sitemap.xml` après un changement important.

## Exemples, conseils, pages métiers

- **Sites de démonstration** (`exemples/<nom>/`) : des commerces **fictifs**, chacun avec sa propre identité (polices libres auto-hébergées,
  illustrations SVG dessinées pour lui). Ils portent un bandeau « Site de démonstration réalisé par smilt. » et la balise `noindex`
  (pour ne pas apparaître dans Google comme de vrais commerces). Les numéros de téléphone sont dans la plage réservée à la fiction
  par l'Arcep (01 99 00…), les e-mails en `.example`. Les boutons qui sortiraient du site (appel, itinéraire, paiement, réservation)
  portent `data-demo="…"` et affichent une bulle explicative.
- **Captures** : `assets/img/exemples/<nom>-desktop.webp/.jpg` (1200×750) et `-mobile` (390×844), plus `fournil-lune-avant`
  pour l'avant/après. À refaire après une modification d'un site de démonstration (script de capture Playwright décrit plus bas).
- **Conseils et pages métiers** : partir de `outils/gabarit-page.html`. Ajouter la page à `sitemap.xml` et, pour un article,
  à `conseils/index.html` et `conseils/feed.xml`.
- **Quelle formule ?** : le questionnaire de l'accueil (section 8 de `assets/js/site.js`) recommande Essentiel, Vitrine ou
  Sur-mesure et coche la formule dans le formulaire de devis. Un lien `/?formule=Vitrine#devis` fait de même depuis une autre page.

## John, l'assistant

John répond de deux façons :

1. **Réponses écrites** (toujours disponibles, même sans serveur) : le tableau `KB` dans `assets/js/site.js`.
   Chaque entrée a des mots-clés `k` (en minuscules, sans accents), un poids `w` et une réponse `a`.
   Une clé de plusieurs mots (`'nom de domaine'`) doit apparaître telle quelle dans la question ; une clé d'au moins 4 lettres
   reconnaît aussi les mots qui commencent par elle (`tarif` → `tarifs`). Pour ajouter une réponse, ajoutez une entrée.
2. **IA** (sur Vercel) : `api/chat.js` envoie la question à Groq avec les faits sur smilt. Si l'IA ne répond pas, n'est pas
   configurée ou si le site est hébergé sans serveur, John repasse automatiquement sur les réponses écrites.

John dit toujours qu'il est un assistant automatique, ne prend aucun engagement à la place de l'équipe et renvoie vers le
formulaire de devis. Pour le retirer du site : `john: false` dans `CONFIG` (haut de `assets/js/site.js`).

## Formulaire de devis

Sur Vercel avec Resend configuré, la demande arrive directement par e-mail (`api/devis.js`), avec l'adresse du visiteur en
« répondre à ». Sinon, le navigateur du visiteur ouvre sa messagerie avec la demande déjà rédigée. Sans JavaScript, le formulaire
fonctionne aussi (envoi via la messagerie). Un champ piège invisible écarte les robots, et le nombre d'envois par visiteur est limité.

## Devis PDF

**Automatiques (formules Essentiel et Vitrine).** Quand le visiteur envoie le formulaire, son navigateur fabrique le devis PDF
(`assets/js/devis-pdf.js`, chargé seulement à ce moment-là) et le télécharge : numéro unique `D-AAAAMMJJ-XXXX`, date, validité,
coordonnées des deux parties, détail de la formule, option Entretien si cochée, total, acompte et solde, conditions,
case « Bon pour accord ». Sur Vercel, `api/devis.js` refait **le même PDF** (même numéro, même date) et le joint à l'e-mail reçu
par l'agence ; les prix viennent toujours du catalogue côté serveur, jamais de ce qu'envoie le navigateur. Sur GitHub Pages,
le visiteur garde son PDF et sa messagerie s'ouvre pour prévenir l'agence. Rien n'est envoyé à un service tiers pour créer le PDF.

**Sur mesure : `https://smilt.fr/outils/devis.html`.** Lignes libres (avec préréglages Essentiel et Vitrine), quantité, prix
(un prix négatif fait une ligne de remise), option Entretien, acompte, validité, délai, nombre de retours, remarques ; le PDF sort
au même format. Le brouillon est gardé dans le navigateur de
l'appareil. Pour une demande Sur-mesure, l'e-mail reçu contient un lien qui ouvre l'outil avec la fiche du client déjà remplie.
Si un brouillon est en cours, l'outil demande avant de le remplacer ; les 5 derniers brouillons remplacés ou effacés restent dans
« Brouillons précédents » et se restaurent d'un clic. Un montant illisible (« 1.490,00 ») est signalé au lieu d'être mal lu.
La page n'est liée nulle part et demande à ne pas être indexée (`noindex`, et en-tête `X-Robots-Tag` sur Vercel), mais elle reste
publique : elle ne contient aucun secret.

**Ce que le devis prévoit.** Validité, délai, retours, ce qui n'est pas compris, **cession écrite des droits d'auteur** après
paiement intégral (une simple phrase « le site appartient au client » ne transfère aucun droit : art. L131-3 du Code de la propriété
intellectuelle), nom de domaine au nom du client, pénalités de retard entre professionnels, et **droit de rétractation** de 14 jours
avec le formulaire type. Ce droit s'applique au client consommateur, et au petit professionnel (5 salariés au plus) qui signe hors de
vos locaux, par exemple dans sa boutique (art. L221-3 du Code de la consommation) : dans ce cas, aucun paiement ne peut être
reçu avant 7 jours (art. L221-10), et chacun garde un exemplaire signé par les deux parties (art. L221-9) : le devis prévoit
une case pour votre signature. La page signée porte toujours les conditions et un rappel du numéro et du montant.
Ces clauses sont un point de départ sérieux, pas une consultation juridique : faites-les relire si vous avez un doute.

**À régler une fois** dans `assets/js/devis-pdf.js` :
- `COMPANY` : nom ou raison sociale (suivi de « EI » pour une entreprise individuelle), statut, adresse, SIRET, TVA, IBAN.
  Tant que ces champs sont entre crochets, ils apparaissent tels quels sur les devis.
- `COMPANY.vatRate` : `0` en franchise de TVA (mention « TVA non applicable, art. 293 B du CGI »), `20` sinon
  (le devis affiche alors HT, TVA et TTC).
- `CATALOG`, `ENTRETIEN`, `TERMS` : contenu des formules, prix, validité (30 jours), acompte (30 %), délai, retours.
- `TERMS.withdrawal` : `true` par défaut (clause et formulaire de rétractation). À ne passer à `false` que si vous ne signez
  qu'à distance et uniquement avec des professionnels.

Polices et logo du PDF : `assets/js/devis-assets.js`, généré par `python3 outils/build-pdf-assets.py`
(à relancer seulement si les polices ou le logo changent ; nécessite `pip install fonttools brotli`).

## Mise en ligne

### Vercel (recommandé : John avec l'IA + formulaire par e-mail)
1. Importer le dépôt sur vercel.com (« Add New… → Project »), sans framework ni commande de build, puis déployer.
2. Project → Settings → Domains : ajouter `smilt.fr` et `www.smilt.fr`, puis recopier chez votre registraire les
   enregistrements DNS indiqués par Vercel.
3. Project → Settings → Environment Variables :
   - `GROQ_API_KEY` : clé gratuite sur https://console.groq.com (active l'IA de John) ;
   - `ALLOWED_ORIGIN` = `https://smilt.fr,https://www.smilt.fr` ;
   - `GROQ_MODEL` (facultatif, défaut `llama-3.3-70b-versatile`) ;
   - `RESEND_API_KEY` : sur https://resend.com, après avoir vérifié le domaine `smilt.fr` ;
   - `DEVIS_TO` : l'adresse qui reçoit les demandes (ex. `smilt.fr@proton.me`) ;
   - `DEVIS_FROM` (facultatif, défaut `smilt. <devis@smilt.fr>`).
4. Redéployer pour que les variables soient prises en compte.

`vercel.json` ajoute les en-têtes de sécurité (CSP, HSTS, anti-iframe) et le cache.

### GitHub Pages (possible, sans IA)
Activer Pages sur la branche principale ; `CNAME` garde le domaine `smilt.fr`. Les dossiers `api/` et `vercel.json` sont
ignorés : John utilise ses réponses écrites et le formulaire ouvre la messagerie du visiteur. Penser alors à remplacer
l'hébergeur dans `mentions-legales.html` (l'adresse de GitHub est en commentaire dans le fichier).

## Avant d'ouvrir au public

- [ ] Compléter `mentions-legales.html` : les passages surlignés (nom ou raison sociale, forme juridique, SIRET, adresse, TVA,
      directeur ou directrice de la publication). Ces mentions sont obligatoires.
- [ ] Compléter `COMPANY` dans `assets/js/devis-pdf.js` (mêmes informations, pour les devis PDF) et choisir le régime de TVA.
- [ ] Vérifier que l'adresse `smilt.fr@proton.me` existe et reçoit bien les e-mails.
- [ ] Valider les offres affichées : Vitrine à 890 €, Entretien à 19 €/mois, acompte de 30 % puis solde, devis valable 30 jours,
      deux séries de retours, appel ou café de 30 minutes. Seuls « 490 € », « 2 semaines », « prix fixe », « sans jargon » et « devis gratuit »
      viennent des visuels de la marque ; le reste est une proposition à ajuster.
- [ ] Tester John et le formulaire une fois en ligne.

## Charte

- **Couleurs** (relevées sur le fichier « Logo & Pub ») : crème `#FAF7F2`, marine `#0E1B2C`, corail `#FF6A4A`, gris de l'arc `#E7E6E2`.
  Variables en haut de `assets/css/site.css`. Le corail des grands titres sur fond crème est légèrement plus soutenu
  (`--coral-display`) et celui des petits textes encore plus (`--coral-text`), pour rester lisible (contrastes WCAG AA).
- **Typographies** : Space Grotesk pour tout le texte, Space Mono pour les petits libellés en capitales.
  La police web ne contient pas la flèche « → » : les flèches des boutons sont dessinées en CSS (classe `arr`).
- **Logo** : redessiné en SVG à partir de Space Grotesk Bold, calé sur le fichier d'origine. Il est intégré dans chaque page
  (`<symbol id="smilt-logo">`) et disponible en fichier : `assets/img/smilt-logo.svg` (fond clair) et
  `assets/img/smilt-logo-light.svg` (fond sombre). L'icône (`favicon.svg`) reprend le « s » et le sourire sur fond corail.

## Sécurité et vie privée

- Aucune clé secrète dans le navigateur : Groq et Resend ne sont appelés que depuis `api/`, avec les clés en variables
  d'environnement Vercel.
- CSP stricte sans script en ligne ni ressource externe : tout est servi depuis le domaine (polices comprises).
- Réponses de l'IA affichées en texte, jamais en HTML. Origine vérifiée, débit limité et entrées validées côté serveur.
- Aucun cookie, aucun traceur, aucune mesure d'audience : pas de bandeau cookies nécessaire.
- Accessibilité : lien d'évitement, focus visible, contrastes AA, navigation au clavier, mouvement réduit respecté.
