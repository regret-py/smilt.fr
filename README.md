# smilt.fr

Site de **smilt.**, agence web à Paris : « Sites qui font sourire. »
HTML, CSS et JavaScript simples. Pas de framework, pas d'étape de build.
Avec **John**, le petit assistant automatique du site (le « i » du logo).

## Structure

```
index.html              page d'accueil : hero, promesse, offres, méthode, exemples, questions, devis
mentions-legales.html   mentions légales, données personnelles, cookies (à compléter, voir plus bas)
404.html                page introuvable
assets/css/site.css     toute la mise en forme (variables de couleur en haut du fichier)
assets/js/site.js       menu, animations, formulaire de devis, John (un seul fichier, commenté par section)
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
  2. `assets/js/site.js` : réponses écrites de John (tableau `KB`) ;
  3. `api/chat.js` : les faits que connaît John en mode IA (constante `SYSTEM`) ;
  4. `assets/img/og.png` : l'image de partage mentionne « À partir de 490 € ».
- **E-mail de contact** (`smilt.fr@proton.me`) : `CONFIG.email` en haut de `assets/js/site.js`, les liens `mailto:` et le JSON-LD de
  `index.html`, `mentions-legales.html` et `api/chat.js`. Une recherche de `smilt.fr@proton.me` les trouve tous.
- **Exemples** : les trois téléphones de la section « Exemples » sont dessinés en HTML/CSS (classes `d-bread`, `d-hair`, `d-wine`).
  Ce sont des commerces fictifs, et c'est écrit sur la page. Quand vous aurez de vrais clients, remplacez-les par des captures
  de leurs sites (avec leur accord).
- Mettre à jour `<lastmod>` dans `sitemap.xml` après un changement important.

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
- [ ] Vérifier que l'adresse `smilt.fr@proton.me` existe et reçoit bien les e-mails.
- [ ] Valider les offres affichées : Vitrine à 890 €, Entretien à 19 €/mois, acompte puis solde, deux séries de retours,
      appel ou café de 30 minutes. Seuls « 490 € », « 2 semaines », « prix fixe », « sans jargon » et « devis gratuit »
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
