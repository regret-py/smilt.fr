// Formulaire de devis → e-mail via Resend (fonction serverless Vercel)
// Le site appelle /api/devis (CONFIG.quoteApi dans assets/js/site.js). Sans configuration, la fonction
// renvoie { sent: false } et le navigateur ouvre la messagerie du visiteur avec la demande pré-remplie.
//
// Variables obligatoires :  RESEND_API_KEY  (https://resend.com, le domaine smilt.fr doit y être vérifié)
//                           DEVIS_TO        (adresse qui reçoit les demandes, ex. bonjour@smilt.fr)
// Variables facultatives :  DEVIS_FROM      (expéditeur, défaut : "smilt. <devis@smilt.fr>")
//                           ALLOWED_ORIGIN  (comme pour api/chat.js)
//
// Les e-mails partent toujours vers DEVIS_TO (jamais vers une adresse saisie par le visiteur) :
// la fonction ne peut pas servir de relais à spam. L'adresse du visiteur sert seulement de "répondre à".

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
    plan: PLANS.includes(body.plan) ? body.plan : "Je ne sais pas encore",
    message: text(body.message, 2000),
  };
  if (!d.name || !d.business || !MAILRE.test(d.email)) return res.status(400).json({ error: "invalid" });

  const key = process.env.RESEND_API_KEY, to = process.env.DEVIS_TO;
  if (!key || !to) return res.status(200).json({ sent: false }); // le client ouvre la messagerie à la place

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        from: process.env.DEVIS_FROM || "smilt. <devis@smilt.fr>",
        to: [to],
        reply_to: d.email,
        subject: `Demande de devis · ${d.business}`,
        text: [
          `Nom : ${d.name}`,
          `Commerce : ${d.business}`,
          `E-mail : ${d.email}`,
          `Téléphone : ${d.phone || "-"}`,
          `Formule : ${d.plan}`,
          "",
          d.message || "(pas de message)",
          "",
          "Envoyé depuis le formulaire de smilt.fr",
        ].join("\n"),
      }),
    });
    return res.status(200).json({ sent: r.ok });
  } catch {
    return res.status(200).json({ sent: false });
  } finally {
    clearTimeout(timer);
  }
}
