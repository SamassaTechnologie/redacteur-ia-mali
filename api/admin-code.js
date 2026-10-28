// api/admin-code.js : le propriétaire génère un code d'accès (protégé par ADMIN_PASSWORD)
const crypto = require('crypto');
const { creerCode, limiteur } = require('./_acces');
const trop = limiteur();

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const fin = (s, o) => res.status(s).send(JSON.stringify(o));
  if (req.method !== 'POST') return fin(405, { error: 'Méthode non autorisée' });
  if (!process.env.ADMIN_PASSWORD || !process.env.ACCESS_SECRET) return fin(503, { error: 'Non configuré sur le serveur' });
  const ip = String(req.headers['x-forwarded-for'] || '?').split(',')[0].trim();
  if (trop(ip, 8, 3600e3)) return fin(429, { error: 'Trop d\'essais. Réessayez dans une heure.' });
  try {
    let b = req.body; if (typeof b === 'string') b = JSON.parse(b); b = b || {};
    const h = x => crypto.createHash('sha256').update(String(x)).digest();
    if (!crypto.timingSafeEqual(h(b.motdepasse), h(process.env.ADMIN_PASSWORD))) return fin(401, { error: 'Mot de passe incorrect' });
    const jours = [1, 7, 30].includes(+b.jours) ? +b.jours : 1;
    return fin(200, Object.assign({ success: true, jours }, creerCode(jours)));
  } catch (e) { return fin(400, { error: 'Requête invalide' }); }
};
