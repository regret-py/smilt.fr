/*
 * smilt. · devis PDF
 * Module ES sans dépendance : il fabrique le PDF octet par octet (PDF 1.4, A4).
 * Utilisé par le navigateur (formulaire du site, outils/devis.html) et par le serveur (api/devis.js),
 * pour que le visiteur et l'agence reçoivent exactement le même document.
 *
 * 1. à compléter : l'entreprise     4. calcul du devis (makeQuote)    7. mise en page
 * 2. offres et conditions           5. texte : codage et largeurs     8. assemblage du fichier PDF
 * 3. outils (dates, montants)       6. dessin (rectangles, logo)
 */
import { FONTS, LOGO } from './devis-assets.js';

/* ===================== 1. à compléter : l'entreprise ===================== */
// Ces mentions sont obligatoires sur un devis. Tant qu'elles sont entre crochets, le PDF les affiche telles quelles.
export const COMPANY = {
  brand: 'smilt.',
  legalName: '[Prénom Nom ou raison sociale]',  // entreprise individuelle : nom suivi de « EI »
  status: '[EI, micro-entreprise]',             // ou « SAS au capital de … € », etc.
  address: ['[Adresse]', '[Code postal] Paris'],
  siret: '[SIRET à compléter]',
  vatNumber: '',        // numéro de TVA intracommunautaire, si l'entreprise y est assujettie
  vatRate: 0,           // 0 : franchise en base (« TVA non applicable, art. 293 B du CGI »). Sinon : 20
  iban: '',             // facultatif : affiché dans les conditions de paiement
  email: 'smilt.fr@proton.me',
  website: 'smilt.fr',
  tagline: 'Sites qui font sourire.'
};

/* ===================== 2. offres et conditions ===================== */
// Mêmes offres que la section « Offres » de index.html. Prix en euros.
export const CATALOG = {
  Essentiel: {
    title: 'Site Essentiel',
    subtitle: 'Site vitrine d’une page, livré en deux semaines',
    price: 490,
    items: [
      'Une page : accueil, services, horaires, accès, contact',
      'Affichage soigné sur mobile, tablette et ordinateur',
      'Plan Google Maps, boutons « Appeler » et « Itinéraire »',
      'Formulaire de contact',
      'Fiche Google Business Profile remise à neuf',
      'Mentions légales et page RGPD',
      'Deux séries de retours comprises'
    ]
  },
  Vitrine: {
    title: 'Site Vitrine',
    subtitle: 'Site vitrine jusqu’à 5 pages, livré en deux semaines',
    price: 890,
    items: [
      'Tout le contenu de la formule Essentiel',
      'Jusqu’à 5 pages (carte, tarifs, équipe, galerie…)',
      'Carte, menu ou tarifs modifiables par vos soins',
      'Galerie photos de votre boutique',
      'Référencement local renforcé',
      'Lien vers votre outil de réservation (Planity, TheFork…)',
      'Deux séries de retours comprises'
    ]
  }
};
// Formules pour lesquelles le site crée le devis tout seul. Le Sur-mesure se chiffre à la main (outils/devis.html).
export const AUTO_PLANS = Object.keys(CATALOG);

export const ENTRETIEN = {
  title: 'Option Entretien',
  monthly: 19,
  items: ['Hébergement et nom de domaine', 'Sauvegardes et mises à jour', 'Petites modifications sur simple message'],
  note: 'Sans engagement, facturée chaque mois à partir de la mise en ligne. Non comprise dans le total ci-dessus.'
};

export const TERMS = {
  validityDays: 30,   // durée de validité du devis
  depositPct: 30,     // acompte à la signature, en %
  deliveryDays: 14,   // délai de mise en ligne
  revisions: 2,       // séries de retours comprises
  // Droit de rétractation (art. L221-3, L221-18 du Code de la consommation) : obligatoire pour un client consommateur, et pour un
  // petit professionnel (5 salariés au plus) quand le devis est signé hors de vos locaux, par exemple dans sa boutique.
  // Le devis affiche alors la clause et le formulaire type. Ne passer à false qu'en ne signant qu'à distance, avec des professionnels.
  withdrawal: true
};

/* ===================== 3. outils (dates, montants) ===================== */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NBSP = ' ';

// Les dates circulent au format AAAA-MM-JJ et sont calculées en UTC : pas de décalage de fuseau horaire.
function toISODate(d) { return d.toISOString().slice(0, 10); }
function parseISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d) || toISODate(d) !== s ? null : d;
}
function addDays(iso, n) { const d = parseISODate(iso); d.setUTCDate(d.getUTCDate() + n); return toISODate(d); }
export function formatDate(iso) {
  const d = parseISODate(iso);
  return d ? d.getUTCDate() + (d.getUTCDate() === 1 ? 'er' : '') + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : '';
}
export function todayISO(now) {
  const d = now ? new Date(now) : new Date();
  // date du jour à Paris (le devis est émis depuis Paris)
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch (e) { return toISODate(d); }
}

// Montants en centimes (entiers) pour éviter les erreurs d'arrondi. 1290,5 € → « 1 290,50 € ».
function cents(euros) { return Math.round(Number(euros) * 100); }
export function formatMoney(c) {
  const neg = c < 0; c = Math.abs(Math.round(c));
  const e = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return (neg ? '-' : '') + e + ',' + String(c % 100).padStart(2, '0') + NBSP + '€';
}

// Numéro : D-AAAAMMJJ-XXXX (4 caractères sans 0/O/1/I pour éviter les confusions à la lecture).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const NUMBER_RE = /^D-\d{8}-[A-HJ-NP-Z2-9]{4}$/;
export function generateNumber(isoDate) {
  const bytes = new Uint8Array(4);
  const c = typeof globalThis !== 'undefined' && globalThis.crypto;
  if (c && c.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return 'D-' + isoDate.replace(/-/g, '') + '-' + s;
}
export function quoteFileName(q) { return 'devis-smilt-' + q.number + '.pdf'; }

/* ===================== 4. calcul du devis ===================== */
// Une ligne, sans caractère de contrôle. Les champs multilignes (adresse, remarques) passent par lines().
function clean(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
function lines(v, max, maxLines) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [];
  return arr.map(function (l) { return clean(l, max); }).filter(Boolean).slice(0, maxLines);
}

/**
 * Prépare toutes les données du devis. Les prix viennent du CATALOG, sauf si `lines` est fourni (outil interne).
 * input : { client: { business, name, address, email, phone }, plan, entretien (bool ou { monthly }),
 *           lines: [{ title, subtitle, items: [], qty, unit }], number, date (AAAA-MM-JJ),
 *           validityDays, depositPct, deliveryDays, revisions, subject, notes }
 */
export function makeQuote(input) {
  input = input || {};
  const c = input.client || {};
  const client = {
    business: clean(c.business, 120),
    name: clean(c.name, 80),
    address: lines(c.address, 160, 4),
    email: clean(c.email, 120),
    phone: clean(c.phone, 30)
  };

  let rows;
  if (Array.isArray(input.lines) && input.lines.length) {
    if (input.lines.length > 40) throw new Error('40 lignes au maximum par devis.');
    rows = input.lines.map(function (l) {
      return {
        title: clean(l.title, 140) || 'Prestation',
        subtitle: clean(l.subtitle, 160),
        items: lines(l.items, 1000, 30),
        qty: Math.max(0, Math.min(9999, Number(l.qty) || 0)),
        unit: Math.max(-1e9, Math.min(1e9, cents(l.unit) || 0))   // négatif possible : ligne de remise
      };
    }).filter(function (r) { return r.qty > 0; });
  } else {
    const p = CATALOG[input.plan];
    if (!p) throw new Error('Formule inconnue : ' + input.plan);
    rows = [{ title: p.title, subtitle: p.subtitle, items: p.items.slice(), qty: 1, unit: cents(p.price) }];
  }
  if (!rows.length) throw new Error('Le devis ne contient aucune ligne.');
  rows.forEach(function (r) { r.total = Math.round(r.qty * r.unit); });

  const vatRate = Number(COMPANY.vatRate) || 0;
  const ht = rows.reduce(function (s, r) { return s + r.total; }, 0);
  if (ht < 0) throw new Error('Le total du devis ne peut pas être négatif.');
  const vat = Math.round(ht * vatRate / 100);
  const ttc = ht + vat;
  const depositPct = clampInt(input.depositPct, 0, 100, TERMS.depositPct);
  const deposit = Math.round(ttc * depositPct / 100);

  let entretien = null;
  if (input.entretien) {
    const monthly = typeof input.entretien === 'object' && input.entretien.monthly != null ? input.entretien.monthly : ENTRETIEN.monthly;
    entretien = { title: ENTRETIEN.title, monthly: Math.max(0, cents(monthly) || 0), items: ENTRETIEN.items.slice(), note: ENTRETIEN.note };
  }

  const date = parseISODate(input.date) ? input.date : todayISO();
  const validityDays = clampInt(input.validityDays, 1, 365, TERMS.validityDays);
  const number = typeof input.number === 'string' && NUMBER_RE.test(input.number) ? input.number : generateNumber(date);
  const plan = CATALOG[input.plan] ? input.plan : '';
  const who = client.business || client.name || 'votre commerce';
  const subject = clean(input.subject, 200) ||
    ('Création du site internet de ' + who + (plan ? ' (formule ' + plan + ')' : ''));

  return {
    number: number, date: date, validUntil: addDays(date, validityDays), validityDays: validityDays,
    client: client, plan: plan, subject: subject, rows: rows, entretien: entretien,
    vatRate: vatRate, totals: { ht: ht, vat: vat, ttc: ttc },
    depositPct: depositPct, deposit: deposit, balance: ttc - deposit,
    deliveryDays: clampInt(input.deliveryDays, 1, 365, TERMS.deliveryDays),
    revisions: clampInt(input.revisions, 0, 20, TERMS.revisions),
    notes: lines(input.notes, 2000, 40)
  };
}
function clampInt(v, min, max, dflt) {
  const n = Math.round(Number(v));
  return v === undefined || v === null || v === '' || isNaN(n) ? dflt : Math.max(min, Math.min(max, n));
}

/* ===================== 5. texte : codage et largeurs ===================== */
// Les polices sont embarquées avec le codage WinAnsi (cp1252) : 1 caractère = 1 octet.
const CP1252 = {
  0x20AC: 0x80, 0x201A: 0x82, 0x201E: 0x84, 0x2026: 0x85, 0x02C6: 0x88, 0x2039: 0x8B, 0x0152: 0x8C, 0x2018: 0x91,
  0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99,
  0x203A: 0x9B, 0x0153: 0x9C,
  // Ces caractères WinAnsi n'ont pas de glyphe dans Space Grotesk / Space Mono : remplacés par la lettre la plus proche.
  0x0160: 0x53, 0x0161: 0x73, 0x017D: 0x5A, 0x017E: 0x7A, 0x0178: 0x59, 0x0192: 0x66, 0x2030: 0x25, 0x2020: 0x2B, 0x2021: 0x2B,
  // équivalents proches pour les caractères absents du codage
  0x202F: 0xA0, 0x2009: 0xA0, 0x2007: 0xA0, 0x2011: 0x2D, 0x2010: 0x2D, 0x2212: 0x2D, 0x2032: 0x27, 0x2033: 0x22,
  0x0141: 0x4C, 0x0142: 0x6C, 0x0110: 0x44, 0x0111: 0x64
};
// Typographie française : espace insécable dans les guillemets et avant : ; ? ! (évite « » » seul en début de ligne).
function typo(str) {
  return String(str).replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»').replace(/ ([:;?!])/g, '\u00a0$1');
}
function encode(str) {
  let out = '';
  for (const ch of typo(str).normalize('NFC')) {          // NFC : « e + accent combinant » redevient « é »
    const u = ch.codePointAt(0);
    if (u === 0xAD) continue;                                 // trait d'union conditionnel : invisible
    if ((u >= 0x20 && u <= 0x7E) || (u >= 0xA0 && u <= 0xFF)) out += String.fromCharCode(u);
    else if (CP1252[u]) out += String.fromCharCode(CP1252[u]);
    else if (u === 0x09 || u === 0x0A || u === 0x0D) out += ' ';
    else {
      // lettre accentuée hors du codage (ą, ř, ă, ư…) : on garde la lettre de base plutôt qu'un « ? »
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const b = base.codePointAt(0);
      out += base.length === 1 && ((b >= 0x20 && b <= 0x7E) || (b >= 0xA0 && b <= 0xFF)) ? base : '?';
    }
  }
  return out;
}
function widthOf(encoded, font, size, spacing) {
  const w = FONTS[font].widths;
  let units = 0;
  for (let i = 0; i < encoded.length; i++) units += w[encoded.charCodeAt(i) - 32] || 0;
  return units * size / 1000 + (spacing || 0) * encoded.length;
}
function pdfString(encoded) { return '(' + encoded.replace(/[\\()]/g, '\\$&') + ')'; }

// Coupe un texte en lignes qui tiennent dans maxWidth (coupure aux espaces ; les espaces insécables restent soudées).
// firstWidth (facultatif) : largeur de la première ligne, quand elle commence après un intitulé.
function wrap(str, font, size, maxWidth, firstWidth) {
  const words = encode(str).split(' ').filter(function (w) { return w.length; });
  const out = [];
  let line = '';
  function max() { return out.length === 0 && firstWidth ? firstWidth : maxWidth; }
  words.forEach(function (word) {
    const tryLine = line ? line + ' ' + word : word;
    if (widthOf(tryLine, font, size) <= max()) { line = tryLine; return; }
    if (line) out.push(line);
    // mot plus long que la ligne : coupé au caractère
    while (widthOf(word, font, size) > max() && word.length > 1) {
      let i = word.length - 1;
      while (i > 1 && widthOf(word.slice(0, i), font, size) > max()) i--;
      out.push(word.slice(0, i)); word = word.slice(i);
    }
    line = word;
  });
  if (line) out.push(line);
  return out.length ? out : [''];
}

/* ===================== 6. dessin ===================== */
const W = 595.28, H = 841.89, M = 48;         // A4 en points, marges latérales
const TOP = 48, BOTTOM = H - 78;              // zone utile (le pied de page est en dessous)
const C = {
  ink: [0.055, 0.106, 0.173], ink2: [0.29, 0.322, 0.384], coral: [1, 0.416, 0.29], coralText: [0.761, 0.239, 0.133],
  cream: [0.98, 0.969, 0.949], cream2: [0.945, 0.925, 0.89], line: [0.886, 0.859, 0.816], white: [1, 1, 1]
};
const FONT_ID = { regular: 'F1', semibold: 'F2', mono: 'F3' };
function n(v) { return String(Math.round(v * 100) / 100); }
function rgb(c, stroke) { return c.map(n).join(' ') + (stroke ? ' RG' : ' rg'); }

function Canvas() { this.pages = []; this.add(); }
Canvas.prototype.add = function () { this.ops = []; this.pages.push(this.ops); };
Canvas.prototype.op = function (s) { this.ops.push(s); };
// y est compté depuis le HAUT de la page (plus simple pour la mise en page), puis converti.
Canvas.prototype.text = function (str, x, baseline, o) {
  o = o || {};
  const font = o.font || 'regular', size = o.size || 9, sp = o.spacing || 0;
  const enc = o.encoded ? str : encode(str);
  let tx = x;
  if (o.align === 'right') tx = x - widthOf(enc, font, size, sp);
  else if (o.align === 'center') tx = x - widthOf(enc, font, size, sp) / 2;
  this.op('BT /' + FONT_ID[font] + ' ' + n(size) + ' Tf ' + rgb(o.color || C.ink) + (sp ? ' ' + n(sp) + ' Tc' : '') +
    ' ' + n(tx) + ' ' + n(H - baseline) + ' Td ' + pdfString(enc) + ' Tj' + (sp ? ' 0 Tc' : '') + ' ET');
};
Canvas.prototype.rect = function (x, y, w, h, o) {
  o = o || {};
  const r = Math.min(o.radius || 0, w / 2, h / 2), k = 0.5523 * r;
  const x0 = x, x1 = x + w, y0 = H - y - h, y1 = H - y;       // coordonnées PDF (y vers le haut)
  let p;
  if (!r) p = n(x0) + ' ' + n(y0) + ' ' + n(w) + ' ' + n(h) + ' re';
  else p = [
    n(x0 + r) + ' ' + n(y0) + ' m', n(x1 - r) + ' ' + n(y0) + ' l',
    n(x1 - r + k) + ' ' + n(y0) + ' ' + n(x1) + ' ' + n(y0 + r - k) + ' ' + n(x1) + ' ' + n(y0 + r) + ' c',
    n(x1) + ' ' + n(y1 - r) + ' l',
    n(x1) + ' ' + n(y1 - r + k) + ' ' + n(x1 - r + k) + ' ' + n(y1) + ' ' + n(x1 - r) + ' ' + n(y1) + ' c',
    n(x0 + r) + ' ' + n(y1) + ' l',
    n(x0 + r - k) + ' ' + n(y1) + ' ' + n(x0) + ' ' + n(y1 - r + k) + ' ' + n(x0) + ' ' + n(y1 - r) + ' c',
    n(x0) + ' ' + n(y0 + r) + ' l',
    n(x0) + ' ' + n(y0 + r - k) + ' ' + n(x0 + r - k) + ' ' + n(y0) + ' ' + n(x0 + r) + ' ' + n(y0) + ' c', 'h'
  ].join(' ');
  if (o.fill && o.stroke) this.op(rgb(o.fill) + ' ' + rgb(o.stroke, true) + ' ' + n(o.lineWidth || 0.8) + ' w ' + p + ' B');
  else if (o.fill) this.op(rgb(o.fill) + ' ' + p + ' f');
  else this.op(rgb(o.stroke || C.line, true) + ' ' + n(o.lineWidth || 0.8) + ' w ' + p + ' S');
};
Canvas.prototype.line = function (x1, y, x2, o) {
  o = o || {};
  this.op(rgb(o.color || C.line, true) + ' ' + n(o.width || 0.6) + ' w ' + n(x1) + ' ' + n(H - y) + ' m ' + n(x2) + ' ' + n(H - y) + ' l S');
};
// Logo smilt. : hauteur h (points), coin haut-gauche en (x, y). light : lettres claires (fond sombre).
Canvas.prototype.logo = function (x, y, h, light) {
  const s = h / LOGO.height;
  const tx = x - LOGO.x0 * s, ty = H - y - h - LOGO.y0 * s;
  this.op('q ' + n(s) + ' 0 0 ' + n(s) + ' ' + n(tx) + ' ' + n(ty) + ' cm ' +
    rgb(light ? C.cream : C.ink) + ' ' + LOGO.letters + ' f ' +
    rgb(C.coral, true) + ' ' + LOGO.smileWidth + ' w 1 J ' + LOGO.smile + ' S ' +
    rgb(C.coral) + ' ' + LOGO.period + ' f Q');
};

/* ===================== 7. mise en page ===================== */
export function quotePdf(q, opts) {
  opts = opts || {};
  const cv = new Canvas();
  const vat = q.vatRate > 0;
  const colDesc = M + 12, colQty = M + 300, colUnit = W - M - 100, colTotal = W - M - 12;
  let y = TOP;
  let inTable = false;

  function continuationHeader() {
    cv.logo(M, TOP, 18);
    cv.text('Devis n° ' + q.number + ' (suite)', W - M, TOP + 12, { font: 'mono', size: 7.5, color: C.ink2, align: 'right' });
    y = TOP + 40;
    if (inTable) tableHeader();
  }
  function need(h) { if (y + h > BOTTOM) { cv.add(); continuationHeader(); } }
  function label(str, x, baseline, color, align) {
    cv.text(str.toUpperCase(), x, baseline, { font: 'mono', size: 6.8, spacing: 1.1, color: color || C.ink2, align: align });
  }
  function tableHeader() {
    cv.rect(M, y, W - 2 * M, 22, { fill: C.ink, radius: 6 });
    label('Désignation', colDesc, y + 14, C.cream);
    label('Qté', colQty, y + 14, C.cream, 'center');
    label(vat ? 'Prix unit. HT' : 'Prix unitaire', colUnit, y + 14, C.cream, 'right');
    label(vat ? 'Total HT' : 'Montant', colTotal, y + 14, C.cream, 'right');
    y += 22;
  }

  // --- en-tête ---
  cv.logo(M, y, 30);
  cv.text(COMPANY.tagline, M, y + 46, { size: 8.5, color: C.ink2 });
  cv.text('Devis', W - M, y + 26, { font: 'semibold', size: 30, align: 'right' });
  cv.text('N° ' + q.number, W - M, y + 44, { font: 'mono', size: 8.5, color: C.coralText, align: 'right' });
  cv.text('Émis le ' + formatDate(q.date), W - M, y + 57, { size: 8.5, color: C.ink2, align: 'right' });
  cv.text('Valable jusqu’au ' + formatDate(q.validUntil), W - M, y + 69, { size: 8.5, color: C.ink2, align: 'right' });
  y += 78;
  cv.line(M, y, W - M);
  y += 16;

  // --- émetteur / client ---
  const boxW = (W - 2 * M - 14) / 2, pad = 12, lh = 11.6, inner = boxW - 2 * pad;
  function partyLines(main, rest) {
    const out = [];
    wrap(main, 'semibold', 10, inner).forEach(function (l) { out.push({ t: l, f: 'semibold', s: 10 }); });
    rest.filter(Boolean).forEach(function (r) { wrap(r, 'regular', 8.8, inner).forEach(function (l) { out.push({ t: l, f: 'regular', s: 8.8 }); }); });
    return out;
  }
  const emitter = partyLines(COMPANY.legalName, [COMPANY.status, COMPANY.address.join(', '),
    'SIRET : ' + COMPANY.siret + (COMPANY.vatNumber ? ' · TVA : ' + COMPANY.vatNumber : ''), COMPANY.email + ' · ' + COMPANY.website]);
  const cl = q.client;
  const client = partyLines(cl.business || cl.name || 'Client', [cl.business && cl.name ? cl.name : '', cl.address.join(', '),
    [cl.email, cl.phone].filter(Boolean).join(' · ')]);
  const boxH = pad * 2 + 14 + Math.max(emitter.length, client.length) * lh;
  [[emitter, 'Émetteur', M], [client, 'Client', M + boxW + 14]].forEach(function (b) {
    cv.rect(b[2], y, boxW, boxH, { fill: C.cream2, radius: 10 });
    label(b[1], b[2] + pad, y + pad + 6);
    b[0].forEach(function (l, i) { cv.text(l.t, b[2] + pad, y + pad + 22 + i * lh, { font: l.f, size: l.s, encoded: true }); });
  });
  y += boxH + 18;

  // --- objet ---
  label('Objet', M, y);
  y += 4;
  wrap(q.subject, 'semibold', 11.5, W - 2 * M).forEach(function (l) { y += 15; cv.text(l, M, y, { font: 'semibold', size: 11.5, encoded: true }); });
  y += 14;

  // --- prestations ---
  need(22 + 40);
  inTable = true;
  tableHeader();
  const descW = colQty - 30 - colDesc;
  q.rows.forEach(function (r) {
    const titleLines = wrap(r.title, 'semibold', 10.5, descW);
    need(10 + titleLines.length * 13 + 10);
    y += 10;
    titleLines.forEach(function (l, i) {
      y += 13;
      cv.text(l, colDesc, y, { font: 'semibold', size: 10.5, encoded: true });
      if (i === 0) {
        cv.text(String(r.qty).replace('.', ','), colQty, y, { size: 9.5, align: 'center' });
        cv.text(formatMoney(r.unit), colUnit, y, { size: 9.5, align: 'right' });
        cv.text(formatMoney(r.total), colTotal, y, { font: 'semibold', size: 9.5, align: 'right' });
      }
    });
    if (r.subtitle) wrap(r.subtitle, 'regular', 8.8, descW).forEach(function (l) { need(13); y += 12.5; cv.text(l, colDesc, y, { size: 8.8, color: C.ink2, encoded: true }); });
    if (r.items.length) y += 3;
    r.items.forEach(function (it) {
      wrap(it, 'regular', 8.6, descW - 12).forEach(function (l, i) {
        need(11); y += 11;
        if (i === 0) cv.text('•', colDesc + 1, y, { size: 8.6, color: C.coral });
        cv.text(l, colDesc + 12, y, { size: 8.6, color: C.ink2, encoded: true });
      });
    });
    y += 10;
    cv.line(M, y, W - M);
  });
  inTable = false;
  y += 14;

  // --- totaux (à droite) et paiement (à gauche) ---
  const totW = 236, totX = W - M - totW;
  const totRows = vat
    ? [['Total HT', formatMoney(q.totals.ht)], ['TVA ' + String(q.vatRate).replace('.', ',') + ' %', formatMoney(q.totals.vat)]]
    : [['Total', formatMoney(q.totals.ht)]];
  need(totRows.length * 20 + 34 + 30);
  const top = y;
  totRows.forEach(function (r) {
    y += 20;
    cv.text(r[0], totX + 12, y - 6, { size: 9.5, color: C.ink2 });
    cv.text(r[1], W - M - 12, y - 6, { size: 9.5, align: 'right' });
  });
  y += 6;
  cv.rect(totX, y, totW, 32, { fill: C.ink, radius: 8 });
  cv.text(vat ? 'Total TTC' : 'Net à payer', totX + 12, y + 20.5, { font: 'semibold', size: 10.5, color: C.cream });
  cv.text(formatMoney(q.totals.ttc), W - M - 12, y + 21.5, { font: 'semibold', size: 14, color: C.coral, align: 'right' });
  y += 32;
  if (!vat) { y += 13; cv.text('TVA non applicable, art. 293 B du CGI', W - M, y, { size: 7.8, color: C.ink2, align: 'right' }); }
  const payW = totX - M - 24;
  let py = top + 14;
  label('Paiement', M, py);
  const pay = q.depositPct > 0 && q.depositPct < 100
    ? ['Acompte de ' + q.depositPct + ' % à la signature : ' + formatMoney(q.deposit), 'Solde à la mise en ligne : ' + formatMoney(q.balance)]
    : [q.depositPct >= 100 ? 'Paiement intégral à la signature : ' + formatMoney(q.totals.ttc) : 'Paiement à la mise en ligne : ' + formatMoney(q.totals.ttc)];
  pay.push('Par virement bancaire' + (COMPANY.iban ? ' (IBAN ' + COMPANY.iban + ')' : '') + '.');
  pay.forEach(function (p) { wrap(p, 'regular', 9, payW).forEach(function (l) { py += 13; cv.text(l, M, py, { size: 9, encoded: true }); }); });
  y = Math.max(y, py) + 18;

  // --- option Entretien ---
  if (q.entretien) {
    const e = q.entretien;
    const itemsLine = wrap(e.items.join(' · '), 'regular', 8.8, W - 2 * M - 40);
    const noteLines = wrap(e.note, 'regular', 8, W - 2 * M - 40);
    const h = 16 + 14 + itemsLine.length * 12 + noteLines.length * 11 + 14;
    need(h + 10);
    cv.rect(M, y, W - 2 * M, h, { fill: C.cream2, radius: 10 });
    cv.rect(M, y + 12, 4, h - 24, { fill: C.coral, radius: 2 });
    let ey = y + 16 + 8;
    cv.text(e.title, M + 20, ey, { font: 'semibold', size: 10.5 });
    cv.text(formatMoney(e.monthly) + (vat ? ' HT' : '') + ' / mois', W - M - 16, ey, { font: 'semibold', size: 10.5, align: 'right' });
    itemsLine.forEach(function (l) { ey += 12.5; cv.text(l, M + 20, ey, { size: 8.8, color: C.ink, encoded: true }); });
    noteLines.forEach(function (l) { ey += 11; cv.text(l, M + 20, ey, { size: 8, color: C.ink2, encoded: true }); });
    y += h + 18;
  }

  // --- remarques ---
  if (q.notes.length) {
    need(30);
    label('Remarques', M, y + 6); y += 8;
    q.notes.forEach(function (nl) { wrap(nl, 'regular', 9, W - 2 * M).forEach(function (l) { need(13); y += 13; cv.text(l, M, y, { size: 9, encoded: true }); }); });
    y += 18;
  }

  // --- conditions ---
  const delayFrom = q.depositPct >= 100 ? 'réception du paiement' : q.depositPct > 0 ? 'réception de l’acompte' : 'signature du devis';
  const revisionsText = q.revisions === 0
    ? 'aucune série de modifications n’est comprise ; toute modification fait l’objet d’un devis complémentaire.'
    : (q.revisions === 1 ? '1 série de modifications comprise' : q.revisions + ' séries de modifications comprises') + ' ; au-delà, un devis complémentaire est proposé.';
  const conditions = [
    ['Validité', 'ce devis est valable ' + q.validityDays + ' jours, jusqu’au ' + formatDate(q.validUntil) + '.'],
    ['Délai', 'mise en ligne sous ' + q.deliveryDays + ' jours après ' + delayFrom + ', de vos textes et de vos photos.'],
    ['Retours', revisionsText],
    ['Non compris', 'nom de domaine et hébergement, sauf avec l’option Entretien.'],
    // Une cession de droits d'auteur doit nommer les droits cédés et leur étendue (art. L131-3 du Code de la propriété intellectuelle).
    ['Droits d’auteur', 'après paiement intégral, ' + COMPANY.legalName + ' cède au client, à titre exclusif, ses droits patrimoniaux d’auteur sur les créations réalisées pour le site (reproduction, représentation, adaptation et modification), pour une diffusion sur internet et sur tout support de communication de son activité, pour le monde entier et pour la durée légale des droits. Les éléments de tiers (polices, photos, cartes, extensions) restent soumis à leur propre licence. Tous les fichiers sont remis au client sur simple demande.'],
    ['Nom de domaine', 'enregistré au nom du client, qui en reste titulaire.']
  ];
  if (TERMS.withdrawal) conditions.push(['Rétractation', 'si vous êtes un consommateur, ou un professionnel employant 5 salariés au plus pour qui la création d’un site n’entre pas dans l’activité principale et que ce devis est signé hors de nos locaux, vous disposez de 14 jours à compter de la signature pour vous rétracter sans motif, avec le formulaire ci-dessous ou par toute déclaration claire envoyée à ' + COMPANY.email + ' (art. L221-3 et L221-18 du Code de la consommation). En cas de signature hors de nos locaux, aucun paiement n’est exigé avant 7 jours (art. L221-10). Pour que le travail commence pendant ce délai, demandez-le par écrit : en cas de rétractation, seule la part déjà réalisée serait due.']);
  conditions.push(
    ['Retard de paiement', 'entre professionnels, pénalités au taux d’intérêt de la BCE majoré de 10 points et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce). Pas d’escompte pour paiement anticipé.'],
    ['Devis', 'gratuit et sans engagement jusqu’à sa signature.']
  );
  const condBlocks = conditions.map(function (c) {
    const lead = encode(c[0] + ' : ');
    const leadW = widthOf(lead, 'semibold', 7.9);
    return { lead: lead, leadW: leadW, ls: wrap(c[1], 'regular', 7.9, W - 2 * M, W - 2 * M - leadW) };
  });
  // Conditions et signature restent ensemble : la page signée porte toujours les conditions (et un rappel du montant).
  const SIG_H = 16 + 98;
  need(8 + condBlocks.reduce(function (h, b) { return h + b.ls.length * 10.4 + 1.5; }, 0) + SIG_H);
  label('Conditions', M, y + 6); y += 8;
  condBlocks.forEach(function (b) {
    const lead = b.lead, leadW = b.leadW, ls = b.ls;
    ls.forEach(function (l, i) {
      y += 10.4;
      if (i === 0) cv.text(lead, M, y, { font: 'semibold', size: 7.9, encoded: true });
      cv.text(l, i === 0 ? M + leadW : M, y, { size: 7.9, color: C.ink2, encoded: true });
    });
    y += 1.5;
  });
  y += 16;

  // --- bon pour accord ---
  const sigW = 236, sigX = W - M - sigW;
  cv.text('Bon pour accord', M, y + 14, { font: 'semibold', size: 12 });
  let sy = y + 32;
  wrap('Devis n° ' + q.number + ' du ' + formatDate(q.date) + ' · ' + (vat ? 'total TTC ' : 'net à payer ') + formatMoney(q.totals.ttc) +
    (q.entretien ? ' · option Entretien ' + formatMoney(q.entretien.monthly) + (vat ? ' HT' : '') + ' / mois' : '') + '.', 'semibold', 8.6, sigX - M - 24)
    .forEach(function (l) { cv.text(l, M, sy, { font: 'semibold', size: 8.6, encoded: true }); sy += 12; });
  wrap('Pour l’accepter, retournez-le daté et signé, précédé de la mention manuscrite « Bon pour accord », à ' + COMPANY.email + '.', 'regular', 8.6, sigX - M - 24)
    .forEach(function (l) { cv.text(l, M, sy, { size: 8.6, color: C.ink2, encoded: true }); sy += 12; });
  cv.rect(sigX, y, sigW, 98, { stroke: C.line, lineWidth: 1, radius: 10 });
  label('Date, signature et cachet du client', sigX + 12, y + 16);
  cv.text('« Bon pour accord »', sigX + 12, y + 89, { size: 7.8, color: C.ink2 });
  y = Math.max(y + 98, sy);

  // --- formulaire type de rétractation (annexe à l'article R221-1 du Code de la consommation) ---
  if (TERMS.withdrawal) {
    const fw = W - 2 * M - 32;
    const form = [
      ['semibold', 'À l’attention de ' + COMPANY.legalName + ', ' + COMPANY.address.join(', ') + ', ' + COMPANY.email + ' :'],
      ['regular', 'Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la prestation de services ci-dessous : devis n° ' + q.number + '.'],
      ['regular', 'Commandé le (*) : ………………………  Nom du (des) client(s) : ……………………………………………………'],
      ['regular', 'Adresse du (des) client(s) : ……………………………………………………………………………………………'],
      ['regular', 'Signature du (des) client(s) (uniquement en cas de notification du présent formulaire sur papier) :'],
      ['regular', '……………………………………………………  Date : ……………………'],
      ['regular', '(*) Rayez la mention inutile.']
    ];
    const fl = form.map(function (f) { return { font: f[0], ls: wrap(f[1], f[0], 7.8, fw) }; });
    const fh = 34 + fl.reduce(function (h, f) { return h + f.ls.length * 10.6 + 3; }, 0) + 10;
    y += 20;
    need(fh);
    cv.op('[3 3] 0 d');
    cv.rect(M, y, W - 2 * M, fh, { stroke: C.ink2, lineWidth: 0.7, radius: 10 });
    cv.op('[] 0 d');
    cv.text('Formulaire de rétractation', M + 16, y + 20, { font: 'semibold', size: 10 });
    cv.text('à compléter et renvoyer uniquement si vous souhaitez vous rétracter du contrat', W - M - 16, y + 20, { size: 7.4, color: C.ink2, align: 'right' });
    let fy = y + 34;
    fl.forEach(function (f) {
      f.ls.forEach(function (l) { fy += 10.6; cv.text(l, M + 16, fy - 4, { font: f.font, size: 7.8, color: f.font === 'regular' ? C.ink2 : C.ink, encoded: true }); });
      fy += 3;
    });
    y += fh;
  }

  // --- pied de page (sur chaque page, une fois le nombre de pages connu) ---
  const legal = [COMPANY.brand, COMPANY.legalName, COMPANY.status, 'SIRET ' + COMPANY.siret].concat(COMPANY.vatNumber ? ['TVA ' + COMPANY.vatNumber] : []).join(' · ');
  const contact = COMPANY.address.join(', ') + ' · ' + COMPANY.email + ' · ' + COMPANY.website;
  cv.pages.forEach(function (ops, i) {
    cv.ops = ops;
    cv.line(M, H - 50, W - M);
    cv.text(wrap(legal, 'regular', 7, W - 2 * M - 90)[0], M, H - 36, { size: 7, color: C.ink2, encoded: true });
    cv.text(wrap(contact, 'regular', 7, W - 2 * M - 90)[0], M, H - 26, { size: 7, color: C.ink2, encoded: true });
    cv.text('Page ' + (i + 1) + ' / ' + cv.pages.length, W - M, H - 36, { font: 'mono', size: 7, color: C.ink2, align: 'right' });
    cv.text(q.number, W - M, H - 26, { font: 'mono', size: 7, color: C.ink2, align: 'right' });
  });

  return assemble(cv.pages, {
    title: 'Devis ' + q.number + ' · ' + COMPANY.brand,
    subject: q.subject,
    author: COMPANY.brand,
    now: opts.now
  });
}

/* ===================== 8. assemblage du fichier PDF ===================== */
// Chaîne de texte PDF en UTF-16BE (pour les métadonnées, qui peuvent contenir n'importe quel caractère).
function pdfTextString(str) {
  let hex = 'FEFF';
  for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  return '<' + hex + '>';
}
function pdfDate(d) {
  const p = function (v) { return String(v).padStart(2, '0'); };
  return '(D:' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z)';
}
function decodeBase64(b64) {
  if (typeof atob === 'function') return atob(b64);
  return Buffer.from(b64, 'base64').toString('latin1'); // anciens Node
}

// Tout le fichier est construit comme une « chaîne binaire » (1 caractère = 1 octet), puis converti en Uint8Array.
function assemble(pages, info) {
  const objs = [null, null];                         // 1 : catalogue, 2 : arbre des pages
  function add(s) { objs.push(s); return objs.length; }
  const ref = {};
  ['regular', 'semibold', 'mono'].forEach(function (key) {
    const f = FONTS[key];
    const data = decodeBase64(f.data);
    const file = add('<< /Length ' + data.length + ' /Length1 ' + f.length1 + ' /Filter /FlateDecode >>\nstream\n' + data + '\nendstream');
    const desc = add('<< /Type /FontDescriptor /FontName /' + f.name + ' /Flags ' + f.flags + ' /FontBBox [' + f.bbox.join(' ') +
      '] /ItalicAngle 0 /Ascent ' + f.ascent + ' /Descent ' + f.descent + ' /CapHeight ' + f.capHeight + ' /XHeight ' + f.xHeight +
      ' /StemV ' + f.stemV + ' /MissingWidth ' + f.widths[0] + ' /FontFile2 ' + file + ' 0 R >>');
    ref[key] = add('<< /Type /Font /Subtype /TrueType /BaseFont /' + f.name + ' /FirstChar 32 /LastChar 255 /Widths [' +
      f.widths.join(' ') + '] /Encoding /WinAnsiEncoding /FontDescriptor ' + desc + ' 0 R >>');
  });
  const res = add('<< /Font << /F1 ' + ref.regular + ' 0 R /F2 ' + ref.semibold + ' 0 R /F3 ' + ref.mono + ' 0 R >> /ProcSet [/PDF /Text] >>');
  const kids = pages.map(function (ops) {
    const content = ops.join('\n');
    const c = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
    return add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources ' + res + ' 0 R /Contents ' + c + ' 0 R >>');
  });
  objs[0] = '<< /Type /Catalog /Pages 2 0 R /Lang (fr-FR) /ViewerPreferences << /DisplayDocTitle true >> >>';
  objs[1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
  const date = pdfDate(info.now ? new Date(info.now) : new Date());
  const infoRef = add('<< /Title ' + pdfTextString(info.title) + ' /Subject ' + pdfTextString(info.subject) + ' /Author ' + pdfTextString(info.author) +
    ' /Creator (smilt.fr) /Producer (smilt. devis-pdf) /CreationDate ' + date + ' /ModDate ' + date + ' >>');

  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [];
  objs.forEach(function (o, i) { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' +
    offsets.map(function (o) { return String(o).padStart(10, '0') + ' 00000 n \n'; }).join('') +
    'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + infoRef + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
