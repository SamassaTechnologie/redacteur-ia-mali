// api/_acces.js : codes d'accès prépayés (sans base de données).
// Un code = SAM-<jour d'expiration>-<repère>-<signature>. La signature est calculée avec ACCESS_SECRET :
// personne ne peut fabriquer un code sans ce secret, et chaque code expire tout seul.
const crypto = require('crypto');
const JOUR = 86400e3;

const signer = (exp, tag) => crypto.createHmac('sha256', process.env.ACCESS_SECRET || '').update(exp + '.' + tag).digest('hex').slice(0, 10).toUpperCase();

function creerCode(jours) {
  const exp = Math.floor(Date.now() / JOUR) + jours;           // dernier jour de validité (jours depuis 1970)
  const e = exp.toString(36).toUpperCase();
  const tag = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return { code: `SAM-${e}-${tag}-${signer(e, tag)}`, expire: new Date(exp * JOUR).toISOString().slice(0, 10) };
}

// Retourne { ok:true, expire } ou { ok:false, raison:'invalide'|'expire' }
function verifierCode(brut) {
  if (!process.env.ACCESS_SECRET) return { ok: false, raison: 'invalide' };
  const c = String(brut || '').toUpperCase().replace(/\s+/g, '');
  const m = /^SAM-([0-9A-Z]{1,6})-([0-9A-F]{4})-([0-9A-F]{10})$/.exec(c);
  if (!m) return { ok: false, raison: 'invalide' };
  const bon = signer(m[1], m[2]);
  const a = Buffer.from(bon), b = Buffer.from(m[3]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, raison: 'invalide' };
  const exp = parseInt(m[1], 36);
  if (Math.floor(Date.now() / JOUR) > exp) return { ok: false, raison: 'expire' };
  return { ok: true, expire: new Date(exp * JOUR).toISOString().slice(0, 10) };
}

// Limiteur en mémoire (par instance) : freine les abus sans base de données
function limiteur() {
  const m = new Map();
  return (cle, max, fenetreMs) => {
    const t = Date.now(), c = m.get(cle);
    if (m.size > 5000) for (const [k, v] of m) if (t > v.fin) m.delete(k);
    if (!c || t > c.fin) { m.set(cle, { n: 1, fin: t + fenetreMs }); return false; }
    return ++c.n > max;
  };
}

module.exports = { creerCode, verifierCode, limiteur };
