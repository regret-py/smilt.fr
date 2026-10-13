/*
 * smilt. · outil interne de devis (outils/devis.html)
 * Même moteur que le formulaire du site : assets/js/devis-pdf.js. Rien ne part sur Internet :
 * le PDF est fabriqué dans le navigateur, le brouillon reste dans le stockage local de cet appareil.
 * On peut pré-remplir le client par l'adresse : devis.html#commerce=…&nom=…&email=…&tel=…&adresse=…&formule=…&entretien=1&message=…
 * (c'est le lien que contient l'e-mail d'une demande Sur-mesure).
 */
import { CATALOG, ENTRETIEN, TERMS, makeQuote, quotePdf, quoteFileName, formatMoney, generateNumber, todayISO, NUMBER_RE } from '../assets/js/devis-pdf.js';

const $ = (id) => document.getElementById(id);
const form = $('tool'), linesBox = $('lines'), tpl = $('lineTpl'), sum = $('sum'), statusEl = $('toolStatus');
const KEY = 'smilt-devis-brouillon';
let lineSeq = 0, lastUrl = null;

function store(v) { try { if (v == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function say(msg, kind) { statusEl.textContent = msg; statusEl.className = 'form-status' + (kind ? ' ' + kind : ''); }
// Accepte « 149,50 », « 149.50 » et « 1 490,00 » (espaces ignorés).
function num(v) { const n = parseFloat(String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }

/* --- lignes de prestations --- */
function addLine(data) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  const id = 'l' + (++lineSeq);
  node.querySelectorAll('[data-k]').forEach((input) => {
    input.id = id + '-' + input.dataset.k;
    input.previousElementSibling.htmlFor = input.id;           // chaque champ garde son intitulé
    const v = data && data[input.dataset.k];
    input.value = v == null ? '' : Array.isArray(v) ? v.join('\n') : v;
  });
  if (!data || data.qty == null) node.querySelector('[data-k="qty"]').value = '1';
  node.querySelector('[data-del]').addEventListener('click', () => { node.remove(); refresh(); });
  linesBox.appendChild(node);
  return node;
}
function addPreset(plan) {
  const p = CATALOG[plan];
  const node = p ? addLine({ title: p.title, subtitle: p.subtitle, items: p.items, qty: 1, unit: p.price }) : addLine(null);
  node.querySelector('[data-k="title"]').focus();
  refresh();
}
function readLines() {
  return Array.from(linesBox.children).map((node) => {
    const get = (k) => node.querySelector('[data-k="' + k + '"]').value;
    return { title: get('title'), subtitle: get('subtitle'), items: get('items'), qty: num(get('qty')), unit: num(get('unit')) };
  });
}

/* --- état du formulaire --- */
function readForm() {
  const f = form.elements;
  return {
    client: { business: f.business.value, name: f.name.value, address: f.address.value, email: f.email.value, phone: f.phone.value },
    number: f.number.value.trim().toUpperCase(), date: f.date.value,
    validityDays: f.validityDays.value, depositPct: f.depositPct.value, subject: f.subject.value,
    deliveryDays: f.deliveryDays.value, revisions: f.revisions.value,
    lines: readLines(),
    entretien: f.entretien.checked ? { monthly: num(f.monthly.value) } : false,
    notes: f.notes.value
  };
}
function fillForm(s) {
  const f = form.elements;
  const c = s.client || {};
  f.business.value = c.business || ''; f.name.value = c.name || ''; f.address.value = c.address || '';
  f.email.value = c.email || ''; f.phone.value = c.phone || '';
  f.number.value = s.number || ''; f.date.value = s.date || todayISO();
  f.validityDays.value = s.validityDays || TERMS.validityDays; f.depositPct.value = s.depositPct != null && s.depositPct !== '' ? s.depositPct : TERMS.depositPct;
  f.subject.value = s.subject || '';
  f.deliveryDays.value = s.deliveryDays || TERMS.deliveryDays;
  f.revisions.value = s.revisions != null && s.revisions !== '' ? s.revisions : TERMS.revisions;
  linesBox.textContent = '';
  (s.lines || []).forEach(addLine);
  f.entretien.checked = !!s.entretien;
  f.monthly.value = s.entretien && s.entretien.monthly != null ? s.entretien.monthly : ENTRETIEN.monthly;
  f.notes.value = s.notes || '';
}
function blank() {
  const date = todayISO();
  return { number: generateNumber(date), date, validityDays: TERMS.validityDays, depositPct: TERMS.depositPct,
    deliveryDays: TERMS.deliveryDays, revisions: TERMS.revisions, lines: [], entretien: false };
}

/* --- récapitulatif --- */
function quote() {
  const s = readForm();
  if (!NUMBER_RE.test(s.number)) s.number = undefined;          // numéro invalide : makeQuote en crée un
  return makeQuote(s);
}
function row(label, value, strong) {
  const dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = label; dd.textContent = value;
  if (strong) { dt.className = dd.className = 'strong'; }
  sum.append(dt, dd);
}
function refresh() {
  Array.from(linesBox.children).forEach((node) => {
    const qty = num(node.querySelector('[data-k="qty"]').value), unit = num(node.querySelector('[data-k="unit"]').value);
    node.querySelector('[data-total]').textContent = formatMoney(Math.round(qty * unit * 100));
  });
  sum.textContent = '';
  let q = null;
  try { q = quote(); } catch (e) { if (linesBox.children.length) say(e.message, 'err'); }
  if (q && statusEl.classList.contains('err')) say('');
  const n = form.elements.number;
  n.setAttribute('aria-invalid', NUMBER_RE.test(n.value.trim().toUpperCase()) ? 'false' : 'true');
  if (!q) { row('Total', '—'); $('download').disabled = true; store(readForm()); return; }
  $('download').disabled = false;
  if (q.vatRate > 0) { row('Total HT', formatMoney(q.totals.ht)); row('TVA ' + q.vatRate + ' %', formatMoney(q.totals.vat)); }
  row(q.vatRate > 0 ? 'Total TTC' : 'Net à payer', formatMoney(q.totals.ttc), true);
  if (q.depositPct > 0 && q.depositPct < 100) { row('Acompte ' + q.depositPct + ' %', formatMoney(q.deposit)); row('Solde', formatMoney(q.balance)); }
  if (q.entretien) row('Entretien', formatMoney(q.entretien.monthly) + ' / mois');
  row('Valable jusqu’au', q.validUntil.split('-').reverse().join('/'));
  store(readForm());
}

/* --- PDF --- */
function build() {
  const q = quote();
  if (form.elements.number.value.trim().toUpperCase() !== q.number) form.elements.number.value = q.number;
  const url = URL.createObjectURL(new Blob([quotePdf(q)], { type: 'application/pdf' }));
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = url;
  return { q, url };
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const { q, url } = build();
    const a = document.createElement('a');
    a.href = url; a.download = quoteFileName(q);
    document.body.appendChild(a); a.click(); a.remove();
    say('Devis ' + q.number + ' téléchargé (' + formatMoney(q.totals.ttc) + ').', 'ok');
  } catch (err) { say(err.message || 'Impossible de créer le PDF.', 'err'); }
});

/* --- actions --- */
document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addPreset(b.dataset.add)));
$('newNumber').addEventListener('click', () => { form.elements.number.value = generateNumber(form.elements.date.value || todayISO()); refresh(); });
form.elements.date.addEventListener('change', () => {
  // le numéro reprend la date du devis
  const d = form.elements.date.value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) form.elements.number.value = generateNumber(d);
});
$('reset').addEventListener('click', () => {
  if (!window.confirm('Effacer ce devis et repartir de zéro ?')) return;
  store(null); fillForm(blank()); refresh(); say('');
});
form.addEventListener('input', refresh);
form.addEventListener('change', refresh);

/* --- démarrage : lien pré-rempli, sinon brouillon, sinon devis vierge --- */
function fromHash() {
  if (!location.hash || location.hash.length < 2) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.get('commerce') && !p.get('nom')) return null;
  const s = blank();
  s.client = { business: p.get('commerce') || '', name: p.get('nom') || '', address: p.get('adresse') || '', email: p.get('email') || '', phone: p.get('tel') || '' };
  if (CATALOG[p.get('formule')]) {
    const c = CATALOG[p.get('formule')];
    s.lines = [{ title: c.title, subtitle: c.subtitle, items: c.items, qty: 1, unit: c.price }];
  }
  s.entretien = p.get('entretien') === '1' ? { monthly: ENTRETIEN.monthly } : false;
  const msg = (p.get('message') || '').slice(0, 2000);
  const parts = [p.get('formule') ? 'Formule demandée : ' + p.get('formule') + '.' : '', msg].filter(Boolean);
  if (parts.length) { $('requestText').textContent = parts.join(' '); $('request').hidden = false; }
  history.replaceState(null, '', location.pathname);           // les données ne restent pas dans l'adresse
  return s;
}
// Un lien pré-rempli ne remplace pas un brouillon en cours sans demander.
function hasWork(s) { return !!s && (!!(s.client && (s.client.business || s.client.name)) || (s.lines || []).some((l) => l.title || num(l.unit))); }
const linked = fromHash(), saved = load();
let start = saved || blank();
if (linked) {
  if (!hasWork(saved)) start = linked;
  else if (window.confirm('Remplacer le brouillon en cours (' + ((saved.client && saved.client.business) || saved.number || 'sans nom') + ') par la demande reçue ?')) {
    try { localStorage.setItem(KEY + ':precedent', JSON.stringify(saved)); } catch (e) { /* stockage indisponible */ }
    start = linked;
  }
}
fillForm(start);
if (!linesBox.children.length) addLine(null);
refresh();
