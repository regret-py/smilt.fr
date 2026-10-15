// Formulaire de devis → e-mail via Resend (fonction serverless Vercel)
// Le site appelle /api/devis (CONFIG.quoteApi dans assets/js/site.js). Sans configuration, la fonction
// renvoie { sent: false } et le navigateur ouvre la messagerie du visiteur avec la demande pré-remplie.
// Formules Essentiel et Vitrine : le devis PDF est refait ici, avec le même numéro et la même date que celui
// téléchargé par le visiteur, et joint à l'e-mail. Les prix viennent toujours du catalogue (assets/js/devis-pdf.js),
// jamais du navigateur.
//
// Variables obligatoires :  RESEND_API_KEY  (https://resend.com, le domaine smilt.fr doit y être vérifié)
//                           DEVIS_TO        (adresse qui reçoit les demandes, ex. contact@smilt.fr)
// Variables facultatives :  DEVIS_FROM      (expéditeur, défaut : "smilt. <devis@smilt.fr>")
//                           ALLOWED_ORIGIN  (comme pour api/chat.js)
//
// Les e-mails partent toujours vers DEVIS_TO (jamais vers une adresse saisie par le visiteur) :
// la fonction ne peut pas servir de relais à spam. L'adresse du visiteur sert seulement de "répondre à".

import { AUTO_PLANS, NUMBER_RE, makeQuote, quotePdf, quoteFileName, formatMoney, todayISO } from "../assets/js/devis-pdf.js";

const HITS = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 4;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) {
    for (const [k, v] of HITS) if (now - v[v.length - 1] >= WINDOW_MS) HITS.delete(k);
    for (const k of HITS.keys()) { if (HITS.size <= 4000) break; HITS.delete(k); }
  }
  return arr.length > MAX_PER_WINDOW;
}

function originOf(value) {
  try { return new URL(value).origin; } catch { return null; }
}

function originAllowed(req) {
  const src = originOf(req.headers.origin || "") || originOf(req.headers.referer || "");
  const list = (process.env.ALLOWED_ORIGIN || "")
    .split(",").map((s) => originOf(s.trim())).filter(Boolean);
  if (list.length) return !!src && list.includes(src);
  if (!src) return false;
  return new URL(src).host === req.headers.host;
}

function clientIp(req) {
  const h = req.headers;
  return (
    h["x-real-ip"] ||
    (h["x-vercel-forwarded-for"] || "").split(",")[0].trim() ||
    (h["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// Une ligne : pas de retour à la ligne ni de caractère de contrôle.
function line(v, max) {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) : "";
}
function text(v, max) {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim().slice(0, max) : "";
}

const MAILRE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const PLANS = ["Essentiel", "Vitrine", "Sur-mesure", "Je ne sais pas encore"];

// Date du devis : celle du navigateur si elle est à un jour près de la nôtre (fuseaux horaires), sinon la nôtre.
function quoteDate(v) {
  const today = todayISO();
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return today;
  const t = Date.parse(v + "T00:00:00Z");
  if (isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v) return today; // date impossible (31 septembre…)
  return Math.abs(t - Date.parse(today + "T00:00:00Z")) <= 86400000 ? v : today;
}

// Devis PDF en pièce jointe (base64), ou null pour les demandes sans prix fixe (Sur-mesure…).
function attachment(d, body) {
  if (!AUTO_PLANS.includes(d.plan)) return null;
  try {
    const date = quoteDate(body.date);
    // le numéro doit correspondre à la date, sinon on en crée un nouveau
    const number = typeof body.number === "string" && NUMBER_RE.test(body.number) && body.number.slice(2, 10) === date.replace(/-/g, "")
      ? body.number : undefined;
    const q = makeQuote({
      plan: d.plan, entretien: d.entretien, number, date,
      client: { business: d.business, name: d.name, address: d.address, email: d.email, phone: d.phone },
    });
    return {
      number: q.number, date: q.date, total: formatMoney(q.totals.ttc).replace(/\u00a0/g, " "),
      clientHasIt: typeof body.number === "string" && body.number !== "",   // le navigateur a fabriqué (et téléchargé) un PDF
      filename: quoteFileName(q), content: Buffer.from(quotePdf(q)).toString("base64"),
    };
  } catch {
    return null; // l'e-mail part quand même, sans pièce jointe
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!originAllowed(req)) return res.status(403).json({ error: "forbidden" });
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return res.status(415).json({ error: "unsupported_media_type" });
  }
  if (rateLimited(clientIp(req))) return res.status(429).json({ error: "rate_limited" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Champ piège rempli : c'est un robot. On fait comme si tout allait bien.
  if (line(body.website, 200)) return res.status(200).json({ sent: true });

  const d = {
    name: line(body.name, 80),
    business: line(body.business, 120),
    email: line(body.email, 120),
    phone: line(body.phone, 30),
    address: line(body.address, 160),
    plan: PLANS.includes(body.plan) ? body.plan : "Je ne sais pas encore",
    entretien: body.entretien === true,
    message: text(body.message, 2000),
  };
  if (!d.name || !d.business || !MAILRE.test(d.email)) return res.status(400).json({ error: "invalid" });

  const key = process.env.RESEND_API_KEY, to = process.env.DEVIS_TO;
  if (!key || !to) return res.status(200).json({ sent: false }); // le client ouvre la messagerie à la place
  const pdf = attachment(d, body);
  // Sans devis automatique : lien vers l'outil interne, pré-rempli avec la demande (dans le #, jamais envoyé à un serveur).
  const toolLink = pdf ? "" : (originOf(req.headers.origin || "") || "https://smilt.fr") + "/outils/devis.html#" + new URLSearchParams({
    commerce: d.business, nom: d.name, adresse: d.address, email: d.email, tel: d.phone, formule: d.plan,
    entretien: d.entretien ? "1" : "0", message: d.message.slice(0, 800),
  }).toString();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        from: process.env.DEVIS_FROM || "smilt. <devis@smilt.fr>",
        to: [to],
        reply_to: d.email,
        subject: `Demande de devis · ${d.business}` + (pdf ? ` · ${pdf.number}` : ""),
        text: [
          `Nom : ${d.name}`,
          `Commerce : ${d.business}`,
          `Adresse : ${d.address || "-"}`,
          `E-mail : ${d.email}`,
          `Téléphone : ${d.phone || "-"}`,
          `Formule : ${d.plan}`,
          `Option Entretien : ${d.entretien ? "oui" : "non"}`,
          pdf ? `Devis : n° ${pdf.number}, ${pdf.total} (PDF en pièce jointe, ` + (pdf.clientHasIt ? "déjà téléchargé par le client)" : "PAS reçu par le client : à lui envoyer)")
            : `Devis à préparer : ${toolLink}`,
          "",
          d.message || "(pas de message)",
          "",
          "Envoyé depuis le formulaire de smilt.fr",
        ].join("\n"),
        ...(pdf ? { attachments: [{ filename: pdf.filename, content: pdf.content }] } : {}),
      }),
    });
    // Le navigateur compare ce numéro au sien : s'il diffère, il retélécharge la version reçue par l'agence.
    return res.status(200).json(r.ok && pdf ? { sent: true, number: pdf.number, date: pdf.date } : { sent: r.ok });
  } catch {
    return res.status(200).json({ sent: false });
  } finally {
    clearTimeout(timer);
  }
}
