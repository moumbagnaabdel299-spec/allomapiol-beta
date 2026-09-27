'use strict';
/* Allomapiol — version bêta de test */
const CFG = {
  url: 'https://wsfamgkfpatzablysdkt.supabase.co',
  cle: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZmFtZ2tmcGF0emFibHlzZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MDk4MzIsImV4cCI6MjEwNjA4NTgzMn0.8KDeKB_6mPg97044ljLAerXMjlpkQW4yJYhQdQ5oeMs'
};

/* ---------- Petits outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const e = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = (n) => (Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' F';
const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const dateCourte = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }
};

const MESSAGES = {
  session_invalide: 'Votre session a expiré. Reconnectez-vous.',
  nom_invalide: 'Indiquez votre nom (2 lettres au moins).',
  contact_invalide: 'Indiquez un numéro de téléphone ou un e-mail valide.',
  pin_invalide: 'Le code secret doit contenir 4 chiffres.',
  contact_existe: 'Un compte existe déjà avec ce numéro ou cet e-mail. Connectez-vous.',
  identifiants_invalides: 'Numéro, e-mail ou code secret incorrect.',
  annonce_introuvable: 'Cette annonce n\'est plus disponible.',
  solde_insuffisant: 'Votre solde est insuffisant. Rechargez votre portefeuille.',
  montant_invalide: 'Montant de recharge : entre 500 F et 5 000 F.',
  texte_invalide: 'Écrivez au moins quelques mots.',
  visite_requise: 'Visitez la maison avant de la noter.',
  photos_requises: 'Ajoutez au moins une photo.',
  loyer_invalide: 'Indiquez le loyer mensuel.',
  carte_requise: 'Ajoutez le recto et le verso de la carte.',
  retrait_impossible: 'Retrait possible à partir de 500 F, dans la limite de vos gains.',
  numero_invalide: 'Indiquez le numéro Mobile Money qui recevra l\'argent.',
  reserve_admin: 'Espace réservé à l\'administrateur.',
  code_invalide: 'Code administrateur incorrect.'
};

async function rpc(fn, args = {}) {
  let rep;
  try {
    rep = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: CFG.cle, Authorization: `Bearer ${CFG.cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
  } catch (_) {
    throw new Error('Pas de connexion internet. Réessayez.');
  }
  const txt = await rep.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!rep.ok) {
    const code = (data && data.message) || '';
    if (code === 'session_invalide') { deconnexionLocale(); }
    throw new Error(MESSAGES[code] || 'Une erreur est survenue. Réessayez.');
  }
  return data;
}

async function compresser(fichier, max = 1400) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}

async function televerser(fichier, bucket) {
  const blob = await compresser(fichier);
  const nom = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)) + '.jpg';
  const rep = await fetch(`${CFG.url}/storage/v1/object/${bucket}/${nom}`, {
    method: 'POST',
    headers: { apikey: CFG.cle, Authorization: `Bearer ${CFG.cle}`, 'Content-Type': 'image/jpeg' },
    body: blob
  });
  if (!rep.ok) throw new Error('La photo n\'a pas pu être envoyée. Réessayez.');
  return `${CFG.url}/storage/v1/object/public/${bucket}/${nom}`;
}

function toast(msg, erreur = false) {
  $$('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (erreur ? ' erreur' : '');
  t.setAttribute('role', erreur ? 'alert' : 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

async function action(bouton, fn) {
  if (bouton) { bouton.disabled = true; bouton.dataset.txt = bouton.innerHTML; bouton.innerHTML = 'Patientez…'; }
  try { return await fn(); }
  catch (err) { toast(err.message, true); }
  finally { if (bouton && bouton.isConnected) { bouton.disabled = false; bouton.innerHTML = bouton.dataset.txt; } }
}

/* ---------- Icônes ---------- */
const I = (d, t = 22) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  maison: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  portefeuille: '<path d="M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V6a2 2 0 0 1 2-2h11"/><circle cx="16.5" cy="14" r="1.2"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  agent: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  retour: '<path d="M15 18l-6-6 6-6"/>',
  cadenas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  lieu: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  admin: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};

/* ---------- État ---------- */
const S = {
  token: store.get('am_token'),
  moi: null,
  annonces: null,
  cat: null,
  texte: store.get('am_texte') || '',
  min: '', max: ''
};
const app = () => $('#app');

function deconnexionLocale() { S.token = null; S.moi = null; S.annonces = null; store.set('am_token', null); }
function sauverSession(r) { S.token = r.token; S.moi = r.compte; store.set('am_token', r.token); S.annonces = null; }
async function rafraichirMoi() { if (!S.token) return null; S.moi = await rpc('moi', { p_token: S.token }); return S.moi; }

/* ---------- Mise en page ---------- */
function nav(actif) {
  const m = S.moi || {};
  const agent = m.role === 'agent' || m.est_agent;
  const lien = (h, ico, txt, cle) => `<a href="#/${h}" class="${actif === cle ? 'on' : ''}" ${actif === cle ? 'aria-current="page"' : ''}>${I(ico)}<span>${txt}</span></a>`;
  return `<nav class="nav" aria-label="Navigation principale">
    ${lien('accueil', ICO.maison, 'Accueil', 'accueil')}
    ${lien('portefeuille', ICO.portefeuille, 'Portefeuille', 'portefeuille')}
    ${lien('publier', ICO.plus, 'Publier', 'publier')}
    ${agent ? lien('agent', ICO.agent, 'Espace agent', 'agent') : ''}
    ${lien('compte', ICO.profil, 'Mon compte', 'compte')}
  </nav><button type="button" class="fab-avis" data-avis>Donner mon avis</button>`;
}
const bandeau = '<div class="bandeau-beta">Version bêta de test : paiements fictifs, annonces d\'exemple</div>';
function page(html, actif, plein = false) {
  app().classList.toggle('plein', plein);
  app().innerHTML = html + (plein ? '' : nav(actif));
  window.scrollTo(0, 0);
}
function chargement() { app().innerHTML = '<div class="chargement">Chargement…</div>'; }

function badgeHtml(a) {
  const b = [];
  if (a.gratuit) b.push('<span class="badge b-gratuit">Visite gratuite</span>');
  b.push(`<span class="badge b-${e(a.badge)}">${{ premium: 'Premium', confort: 'Confort', standard: 'Standard' }[a.badge] || ''}</span>`);
  if (a.exemple) b.push('<span class="badge b-exemple">Exemple</span>');
  return `<div class="ligne" style="gap:6px;flex-wrap:wrap">${b.join('')}</div>`;
}

/* ---------- Écran : bienvenue ---------- */
function vueBienvenue() {
  page(`${bandeau}<main style="min-height:calc(100dvh - 33px);background:var(--nuit);color:#fff;display:flex;flex-direction:column;padding:48px 28px 36px;position:relative;overflow:hidden">
    <img src="sym-white.png" alt="" aria-hidden="true" style="pointer-events:none;position:absolute;right:-90px;top:150px;height:420px;opacity:.08">
    <img src="logo-white.png" alt="Allomapiol" style="height:22px;align-self:flex-start">
    <div style="flex-grow:1;display:flex;flex-direction:column;justify-content:center;gap:20px;padding:40px 0">
      <img src="sym-white.png" alt="" style="height:84px;align-self:flex-start">
      <h1 style="font-size:38px;line-height:1.12;font-weight:300">Visitez les maisons sans vous déplacer.</h1>
      <p style="font-size:16px;line-height:1.5;color:#D9C4DF">Chambres, studios, meublés : trouvez votre logement au Cameroun depuis votre téléphone.</p>
    </div>
    <div class="pile-s" style="gap:12px">
      <a class="btn blanc" href="#/inscription/client">Je cherche un logement</a>
      <a class="btn" href="#/inscription/agent">Je suis agent immobilier</a>
      <a class="btn lien" style="align-self:center;color:#C09CC9" href="#/connexion">Déjà inscrit ? Se connecter</a>
    </div></main>`, null, true);
}

/* ---------- Écran : inscription / connexion ---------- */
function vueInscription(role) {
  const agent = role === 'agent';
  page(`${bandeau}<main class="pad pile">
    <a class="retour" href="#/" aria-label="Retour">${I(ICO.retour)}</a>
    <div class="pile-s"><h1 class="titre" style="font-size:28px;font-weight:500">${agent ? 'Compte agent immobilier' : 'Créer mon compte'}</h1>
    <p class="sous">${agent ? 'Créez votre compte, puis envoyez votre carte d\'identité pour être vérifié.' : 'Gratuit. Un numéro ou un e-mail suffit.'} Pendant la bêta, <b>500 F de crédit de test</b> vous sont offerts.</p></div>
    <form id="f" class="pile" novalidate>
      <div class="champ"><label for="nom">Votre nom</label><input id="nom" autocomplete="name" required></div>
      <div class="champ"><label for="contact">Numéro de téléphone ou e-mail</label><input id="contact" autocomplete="username" inputmode="email" placeholder="6XXXXXXXX ou nom@mail.com" required></div>
      <div class="champ"><label for="pin">Code secret (4 chiffres)</label><input id="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" required></div>
      <div class="champ"><label for="pin2">Confirmez le code secret</label><input id="pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" required></div>
      <div class="champ"><label for="parrain">Code de parrainage (facultatif)</label><input id="parrain" autocapitalize="characters" placeholder="Ex. : JEA-1234"></div>
      <p class="petit">Version bêta : pas de code SMS. Retenez bien votre code secret, il sert à vous reconnecter.</p>
      <button class="btn" type="submit">Créer mon compte</button>
    </form>
    <a class="btn lien" style="align-self:center" href="#/connexion">Déjà inscrit ? Se connecter</a></main>`, null, true);
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    if ($('#pin').value !== $('#pin2').value) return toast('Les deux codes secrets ne sont pas identiques.', true);
    action(ev.submitter, async () => {
      const r = await rpc('inscrire', { p_nom: $('#nom').value, p_contact: $('#contact').value, p_pin: $('#pin').value, p_parrain: $('#parrain').value || null });
      sauverSession(r);
      toast('Bienvenue ! 500 F de crédit de test ont été ajoutés à votre solde.');
      location.hash = agent ? '#/devenir-agent' : '#/accueil';
    });
  };
}

function vueConnexion() {
  page(`${bandeau}<main class="pad pile">
    <a class="retour" href="#/" aria-label="Retour">${I(ICO.retour)}</a>
    <h1 class="titre" style="font-size:28px;font-weight:500">Se connecter</h1>
    <form id="f" class="pile" novalidate>
      <div class="champ"><label for="contact">Numéro de téléphone ou e-mail</label><input id="contact" autocomplete="username" inputmode="email" required></div>
      <div class="champ"><label for="pin">Code secret</label><input id="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required></div>
      <button class="btn" type="submit">Se connecter</button>
    </form>
    <a class="btn lien" style="align-self:center" href="#/inscription/client">Pas encore de compte ? S'inscrire</a></main>`, null, true);
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    action(ev.submitter, async () => {
      sauverSession(await rpc('connecter', { p_contact: $('#contact').value, p_pin: $('#pin').value }));
      location.hash = '#/accueil';
    });
  };
}

/* ---------- Recherche « Décrivez votre maison » ---------- */
const TYPES = ['Chambre simple', 'Studio', 'Studio meublé', 'Appartement', 'Appartement meublé', 'Maison'];
const VILLES = ['douala', 'yaounde', 'kribi', 'limbe', 'buea', 'bafoussam', 'garoua', 'bamenda', 'edea', 'ebolowa', 'bertoua', 'maroua', 'ngaoundere', 'dschang', 'nkongsamba'];
function analyser(texte, annonces) {
  const t = sansAccent(texte);
  const c = { types: [], meuble: /meubl/.test(t), ville: null, quartiers: [], max: null, equip: [] };
  if (/chambre/.test(t)) c.types.push('Chambre simple');
  if (/studio/.test(t)) c.types.push(c.meuble ? 'Studio meublé' : 'Studio', ...(c.meuble ? [] : ['Studio meublé']));
  if (/appart/.test(t)) c.types.push(c.meuble ? 'Appartement meublé' : 'Appartement', ...(c.meuble ? [] : ['Appartement meublé']));
  if (/villa|maison/.test(t)) c.types.push('Maison');
  c.ville = VILLES.find((v) => t.includes(v)) || null;
  const qs = new Set((annonces || []).map((a) => a.quartier));
  qs.forEach((q) => { if (q && t.includes(sansAccent(q))) c.quartiers.push(q); });
  const nombres = [...t.matchAll(/(\d[\d\s.]*\d|\d)\s*(k|mille|000)?/g)].map((m) => {
    let n = parseInt(m[1].replace(/[\s.]/g, ''), 10);
    if (m[2] === 'k' || m[2] === 'mille') n *= 1000;
    return n;
  }).filter((n) => n >= 5000);
  if (nombres.length) c.max = Math.max(...nombres);
  const eq = { douche: 'Douche interne', parking: 'Parking', compteur: 'Compteur séparé', forage: 'Forage / eau', eau: 'Forage / eau', groupe: 'Groupe électrogène' };
  Object.keys(eq).forEach((k) => { if (t.includes(k)) c.equip.push(eq[k]); });
  return c;
}
function filtrer(annonces) {
  const c = analyser(S.texte, annonces);
  const min = parseInt(String(S.min).replace(/\D/g, ''), 10) || 0;
  const max = parseInt(String(S.max).replace(/\D/g, ''), 10) || c.max || 0;
  let liste = annonces.map((a) => {
    let score = 0;
    if (c.types.length) { if (c.types.includes(a.type)) score += 3; else return null; }
    if (c.meuble && !/meubl/i.test(a.type)) return null;
    if (c.ville) { if (sansAccent(a.ville) === c.ville) score += 2; else return null; }
    if (c.quartiers.length) { if (c.quartiers.includes(a.quartier)) score += 3; else score -= 1; }
    c.equip.forEach((q) => { if ((a.equipements || []).includes(q)) score += 1; });
    if (S.cat && a.type !== S.cat) return null;
    if (min && a.loyer < min) return null;
    let au_dessus = false;
    if (max) { if (a.loyer > max * 1.1) return null; if (a.loyer > max) au_dessus = true; }
    return { ...a, score, au_dessus };
  }).filter(Boolean);
  liste.sort((x, y) => (x.au_dessus - y.au_dessus) || (y.score - x.score));
  return { liste, criteres: c, max };
}
function carteAnnonce(a) {
  return `<li><a class="annonce carte" href="#/maison/${e(a.id)}">
    <img src="${e(a.photo)}" alt="" loading="lazy">
    <div class="infos">${badgeHtml(a)}
      <span class="t">${e(a.titre)}</span>
      <span class="l">${e(a.quartier)}, ${e(a.ville)}</span>
      <span class="p">${F(a.loyer)} / mois</span>
      ${a.au_dessus ? '<span class="petit" style="color:var(--orange)">Légèrement au-dessus de votre budget</span>' : ''}
      ${a.visitee ? '<span class="petit" style="color:var(--vert)">Déjà visitée</span>' : ''}
    </div></a></li>`;
}

async function vueAccueil() {
  if (!S.annonces) { chargement(); S.annonces = await rpc('annonces_liste', { p_token: S.token }); }
  if (S.moi && S.min === '' && S.max === '') { S.min = S.moi.budget_min || ''; S.max = S.moi.budget_max || ''; }
  page(`<header class="entete"><img src="logo-dark.png" alt="Allomapiol" style="height:17px">
      <a class="solde-pastille" href="#/portefeuille">${I(ICO.portefeuille, 18)}<span>Solde ${F(S.moi.solde)}</span></a></header>
    <main class="pad pile">
      <form class="recherche" id="rech">
        <label for="ideal" style="font-size:17px;font-weight:600">Quel genre de maison cherchez-vous ?</label>
        <div class="ligne" style="align-items:flex-end">
          <textarea id="ideal" rows="3" placeholder="Ex. : un studio meublé à Bonamoussadi avec douche interne, pas plus de 60 000 F">${e(S.texte)}</textarea>
          <button type="button" class="rond" id="micro" aria-label="Dicter ma recherche">${I(ICO.micro)}</button>
        </div>
        <div class="budget"><span style="font-weight:600">Mon budget</span>
          <input id="min" inputmode="numeric" aria-label="Budget minimum" placeholder="min" value="${e(S.min)}"><span>à</span>
          <input id="max" inputmode="numeric" aria-label="Budget maximum" placeholder="max" value="${e(S.max)}"><span>F / mois</span></div>
        <button class="btn blanc" type="submit" style="min-height:46px">Rechercher</button>
      </form>
      <div class="puces" role="group" aria-label="Type de logement">
        <button type="button" class="puce ${!S.cat ? 'on' : ''}" data-cat="">Tout</button>
        ${TYPES.map((t) => `<button type="button" class="puce ${S.cat === t ? 'on' : ''}" data-cat="${e(t)}">${e(t)}</button>`).join('')}
      </div>
      <div id="res"></div>
    </main>`, 'accueil');
  const afficher = () => {
    const { liste, criteres, max } = filtrer(S.annonces);
    const resume = [criteres.types.length ? criteres.types[0] : null, criteres.quartiers[0], criteres.ville && criteres.ville[0].toUpperCase() + criteres.ville.slice(1), max ? `max ${F(max)}` : null].filter(Boolean);
    $('#res').innerHTML = `<div class="entre" style="margin-bottom:12px"><h2 style="font-size:18px;font-weight:600;white-space:nowrap">Maisons pour vous</h2><span class="petit">${liste.length} résultat${liste.length > 1 ? 's' : ''}</span></div>
      ${S.texte && resume.length ? `<p class="petit" style="margin:-4px 0 12px">Compris : ${e(resume.join(' · '))}</p>` : ''}
      ${liste.length ? `<ul class="pile-s" style="list-style:none;margin:0;padding:0;gap:10px">${liste.map(carteAnnonce).join('')}</ul>`
        : `<div class="vide carte">Aucune maison ne correspond pour l'instant.<br>Essayez d'élargir votre budget ou votre recherche.</div>`}`;
  };
  afficher();
  $('#rech').onsubmit = (ev) => {
    ev.preventDefault();
    S.texte = $('#ideal').value.trim(); S.min = $('#min').value; S.max = $('#max').value;
    store.set('am_texte', S.texte); afficher();
  };
  $$('[data-cat]').forEach((b) => b.onclick = () => { S.cat = b.dataset.cat || null; $$('[data-cat]').forEach((x) => x.classList.toggle('on', x === b)); afficher(); });
  const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
  $('#micro').onclick = () => {
    if (!Reco) return toast('La dictée vocale n\'est pas disponible sur ce navigateur. Écrivez votre recherche.', true);
    const r = new Reco(); r.lang = 'fr-FR'; r.interimResults = false;
    $('#micro').classList.add('ecoute'); toast('Parlez maintenant…');
    r.onresult = (ev) => { $('#ideal').value = ev.results[0][0].transcript; $('#rech').requestSubmit(); };
    r.onend = () => $('#micro') && $('#micro').classList.remove('ecoute');
    r.onerror = () => toast('Je n\'ai pas bien entendu. Réessayez ou écrivez.', true);
    r.start();
  };
}

/* ---------- Écran : fiche maison ---------- */
async function vueMaison(id) {
  chargement();
  const a = await rpc('annonce_detail', { p_token: S.token, p_id: id });
  const photos = a.ouvert ? [a.photo, ...(a.photos || [])] : [a.photo];
  const autres = a.ouvert ? (a.photos || []) : [];
  const nbCaches = Math.max(0, a.nb_photos - 1);
  const galerie = a.ouvert
    ? (autres.length ? `<div class="galerie">${autres.map((p, i) => `<div><img src="${e(p)}" alt="Photo ${i + 2}" data-zoom="${e(p)}" style="cursor:zoom-in"></div>`).join('')}</div>` : '')
    : (nbCaches ? `<div class="galerie">${[0, 1, 2].slice(0, Math.min(3, nbCaches)).map((i) => `<div class="flou"><img src="${e(a.photo)}" alt="" style="object-position:${[20, 80, 50][i]}% 50%">${i === Math.min(3, nbCaches) - 1 ? `<div class="voile">${I(ICO.cadenas, 18)}+${nbCaches} photo${nbCaches > 1 ? 's' : ''}</div>` : ''}</div>`).join('')}</div>` : '');
  const tel = a.telephone && /\d{6,}/.test(a.telephone.replace(/\D/g, '')) ? a.telephone.replace(/[^\d+]/g, '') : null;
  const choix = (nom, opts, val) => `<div class="choix" role="group" aria-label="${nom}">${opts.map((o) => `<button type="button" data-note="${nom}" data-val="${o}" class="${val === o ? 'on' : ''}" aria-pressed="${val === o}">${o}</button>`).join('')}</div>`;
  page(`<div class="hero"><img src="${e(a.photo)}" alt="${e(a.titre)}" data-zoom="${e(a.photo)}" style="cursor:zoom-in">
      <button class="retour" type="button" data-retour aria-label="Retour">${I(ICO.retour)}</button>
      <span class="compteur">${a.ouvert ? `${a.nb_photos} photo${a.nb_photos > 1 ? 's' : ''}` : `Photo 1 sur ${a.nb_photos}`}</span></div>
    ${galerie}
    <main class="pad pile">
      ${a.exemple ? '<p class="petit" style="background:var(--orange-fond);color:var(--orange);padding:10px 12px;border-radius:10px">Annonce d\'exemple pour la bêta : ce logement n\'existe pas.</p>' : ''}
      <div class="pile-s" style="gap:6px">${badgeHtml(a)}
        <h1 class="titre">${e(a.titre)}</h1>
        <span class="ligne sous" style="gap:6px">${I(ICO.lieu, 16)}${e(a.quartier)}, ${e(a.ville)}</span>
        <span style="font-size:20px;font-weight:600;color:var(--royal)">${F(a.loyer)} / mois</span></div>
      <div class="etiquettes"><span>${e(a.type)}</span>${(a.equipements || []).map((q) => `<span>${e(q)}</span>`).join('')}${a.caution ? `<span>Caution : ${e(a.caution)}</span>` : ''}</div>
      ${a.description ? `<p style="font-size:14px;line-height:1.6;color:#4A3D5A">${e(a.description)}</p>` : ''}
      ${a.avis && a.avis.n ? `<p class="petit">${a.avis.n} avis de visiteurs : ${a.avis.propre} « propre », ${a.avis.spacieuse} « spacieuse »</p>` : ''}
      ${a.ouvert ? `
        ${a.deja_visitee ? `<div class="ligne" role="status" style="padding:12px 14px;border-radius:12px;background:var(--vert-fond);color:var(--vert);font-size:14px;font-weight:500">${I(ICO.ok, 20)}Visite ouverte · Solde restant : ${F(S.moi.solde)}</div>` : ''}
        <section class="infos-privees">
          <div class="ligne" style="align-items:flex-start">${I(ICO.lieu, 20)}<div><div class="k">Adresse exacte</div><div class="v">${e(a.adresse || 'Non précisée')}</div></div></div>
          <div class="ligne" style="align-items:flex-start">${I(ICO.tel, 20)}<div><div class="k">Téléphone</div><div class="v">${e(a.telephone || 'Non précisé')}</div></div></div>
          ${tel ? `<a class="btn blanc" href="tel:${e(tel)}">${I(ICO.tel, 18)}Appeler</a>` : ''}
        </section>
        ${a.auteur ? `<div class="ligne carte" style="padding:12px"><div style="width:44px;height:44px;border-radius:22px;background:var(--lilas);display:flex;align-items:center;justify-content:center;font-weight:600">${e((a.auteur.nom || '?')[0].toUpperCase())}</div>
          <div class="pile-s" style="gap:2px;flex-grow:1"><b style="font-size:15px">${e(a.auteur.nom)}</b><span class="petit">${a.auteur.agent ? 'Agent vérifié' : 'Particulier'} · ${a.auteur.nb_annonces} annonce${a.auteur.nb_annonces > 1 ? 's' : ''}</span></div>
          ${a.auteur.agent ? `<span style="color:var(--royal)">${I(ICO.agent)}</span>` : ''}</div>` : ''}
        ${a.deja_visitee ? `<section class="pile-s" style="gap:10px"><h2 style="font-size:17px;font-weight:600">Notez cette maison</h2>
          <span class="lbl" style="color:var(--doux)">Propreté</span>${choix('proprete', ['Propre', 'Moyen', 'Sale'], a.ma_note && a.ma_note.proprete)}
          <span class="lbl" style="color:var(--doux)">Espace</span>${choix('espace', ['Spacieuse', 'Normale', 'Petite'], a.ma_note && a.ma_note.espace)}</section>` : ''}
      ` : `
        <section class="boite-visite">
          <span style="font-size:17px;font-weight:600">Visitez cette maison sans vous déplacer</span>
          <div class="pile-s">
            <span class="coche">${I(ICO.ok, 18)}Toutes les photos</span>
            <span class="coche">${I(ICO.ok, 18)}L'adresse exacte</span>
            <span class="coche">${I(ICO.ok, 18)}Le numéro de contact</span></div>
          <button class="btn" type="button" id="visiter" style="font-size:17px">Visiter la maison</button>
          <span class="petit" style="text-align:center">${a.gratuit ? 'Visite gratuite, offerte par Allomapiol.' : `Visite : ${F(a.prix_visite)}, prélevés sur votre solde (${F(S.moi.solde)}).`} Déjà visitée, elle reste gratuite pour vous.</span>
        </section>`}
      <section class="pile-s" style="gap:12px">
        <h2 style="font-size:17px;font-weight:600">Commentaires (${a.commentaires.length})</h2>
        ${a.commentaires.map((c) => `<div class="bulle ${c.auteur_annonce ? 'auteur' : ''}"><span class="n">${e(c.nom)} ${c.auteur_annonce ? '<span class="badge" style="background:var(--royal);color:#fff">Auteur de l\'annonce</span>' : ''}</span><span class="x">${e(c.texte)}</span>
          <button class="btn danger" style="min-height:32px;font-size:12px;align-self:flex-start" data-sig-com="${c.id}">Signaler</button></div>`).join('') || '<p class="petit">Aucun commentaire. Posez la première question !</p>'}
        <form id="com" class="ligne"><label for="txtcom" class="sr" style="position:absolute;left:-9999px">Écrire un commentaire</label>
          <input id="txtcom" placeholder="Écrire un commentaire…" maxlength="600" style="flex-grow:1;min-height:48px;border:1.5px solid var(--trait);border-radius:12px;padding:0 14px;font-size:15px">
          <button class="btn nuit mini" type="submit" style="min-height:48px">Envoyer</button></form>
        <p class="petit">Les numéros, e-mails et liens WhatsApp écrits dans les commentaires sont masqués automatiquement.</p>
        ${!a.est_auteur ? '<button class="btn danger" type="button" id="sig-annonce">Signaler cette annonce</button>' : ''}
      </section>
    </main>`, 'accueil');
  $('[data-retour]').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/accueil');
  $$('[data-zoom]').forEach((img) => img.onclick = () => zoom(img.dataset.zoom));
  const v = $('#visiter');
  if (v) v.onclick = () => action(v, async () => {
    await rpc('visiter', { p_token: S.token, p_id: id });
    await rafraichirMoi(); S.annonces = null;
    toast('Visite ouverte. Bonne visite !');
    vueMaison(id);
  });
  $$('[data-note]').forEach((b) => b.onclick = () => action(null, async () => {
    const autre = b.dataset.note === 'proprete' ? 'espace' : 'proprete';
    const cur = $(`[data-note="${autre}"].on`);
    await rpc('noter', { p_token: S.token, p_id: id, [`p_${b.dataset.note}`]: b.dataset.val, [`p_${autre}`]: cur ? cur.dataset.val : null });
    $$(`[data-note="${b.dataset.note}"]`).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    toast('Merci, votre avis aide les autres clients.');
  }));
  $('#com').onsubmit = (ev) => {
    ev.preventDefault();
    const t = $('#txtcom').value.trim(); if (!t) return;
    action(ev.submitter, async () => { await rpc('commenter', { p_token: S.token, p_id: id, p_texte: t }); vueMaison(id); });
  };
  $$('[data-sig-com]').forEach((b) => b.onclick = () => signaler(id, Number(b.dataset.sigCom)));
  const sa = $('#sig-annonce'); if (sa) sa.onclick = () => signaler(id, null);
}

function zoom(src) {
  const f = document.createElement('div');
  f.className = 'fond-modal'; f.style.alignItems = 'center';
  f.innerHTML = `<img src="${e(src)}" alt="" style="max-width:100%;max-height:90vh;border-radius:12px"><button class="retour" style="position:fixed;top:16px;right:16px" aria-label="Fermer">✕</button>`;
  f.onclick = () => f.remove();
  document.body.appendChild(f);
}

function modal(html, onOpen) {
  const f = document.createElement('div');
  f.className = 'fond-modal';
  f.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  f.onclick = (ev) => { if (ev.target === f) f.remove(); };
  document.body.appendChild(f);
  const fermer = () => f.remove();
  $$('[data-fermer]', f).forEach((b) => b.onclick = fermer);
  onOpen && onOpen(f, fermer);
  const premier = $('input,textarea,button', f); premier && premier.focus();
}

function signaler(id, commentaire) {
  const motifs = commentaire ? ['Insulte ou propos déplacés', 'Arnaque', 'Publicité', 'Autre'] : ['Fausse maison', 'Déjà louée', 'Arnaque', 'Mauvais numéro', 'Photos trompeuses', 'Autre'];
  modal(`<h2 style="font-size:18px;font-weight:600">Signaler ${commentaire ? 'ce commentaire' : 'cette annonce'}</h2>
    <div class="pile-s">${motifs.map((m) => `<button type="button" class="btn contour" data-motif="${e(m)}">${e(m)}</button>`).join('')}</div>
    <button class="btn lien" data-fermer style="align-self:center">Annuler</button>`, (f, fermer) => {
    $$('[data-motif]', f).forEach((b) => b.onclick = () => action(b, async () => {
      await rpc('signaler', { p_token: S.token, p_id: commentaire ? null : id, p_commentaire: commentaire, p_motif: b.dataset.motif });
      fermer(); toast('Merci, l\'équipe Allomapiol va vérifier.');
    }));
  });
}

/* ---------- Écran : portefeuille ---------- */
async function vuePortefeuille() {
  chargement();
  await rafraichirMoi();
  const mvts = await rpc('mouvements_liste', { p_token: S.token });
  const m = S.moi;
  let montant = 500, moyen = 'Orange Money';
  const moyens = [['Orange Money', '#FF7900'], ['MTN Mobile Money', '#FFCB05'], ['Carte bancaire', '#2A193E'], ['PayPal', '#003087']];
  const aGains = m.gains > 0 || m.role === 'agent' || m.est_agent;
  page(`<main class="pad pile">
    <h1 class="titre">Portefeuille</h1>
    <section class="portefeuille"><img src="sym-white.png" alt="" aria-hidden="true" style="pointer-events:none;position:absolute;right:-20px;top:-10px;height:140px;opacity:.1">
      <span class="petit" style="color:#D9C4DF">Solde disponible</span><span class="m">${F(m.solde)}</span>
      <span class="petit" style="color:#D9C4DF">Sans date limite · Standard 20 F · Confort 25 F · Premium 50 F</span></section>
    <section class="pile-s" style="gap:10px"><h2 style="font-size:16px;font-weight:600">Recharger (500 F minimum)</h2>
      <p class="petit" style="background:var(--orange-fond);color:var(--orange);padding:8px 12px;border-radius:10px">Bêta : la recharge est fictive, aucun argent réel n'est prélevé.</p>
      <div class="grille2" style="grid-template-columns:repeat(4,1fr);gap:8px">${[500, 1000, 2000, 5000].map((n) => `<button type="button" class="puce ${n === 500 ? 'on' : ''}" data-m="${n}" style="border-radius:12px;min-height:48px">${F(n)}</button>`).join('')}</div>
      <div class="pile-s">${moyens.map(([n, c], i) => `<button type="button" class="interrupteur carte ${i === 0 ? 'on' : ''}" data-moyen="${e(n)}" style="border-radius:12px;border:1px solid var(--trait)"><span style="width:26px;height:26px;border-radius:8px;background:${c};flex-shrink:0"></span>${e(n)}<span style="margin-left:auto;color:var(--royal)" class="coche-m">${i === 0 ? I(ICO.ok, 20) : ''}</span></button>`).join('')}</div>
      <button class="btn" id="recharger">Recharger ${F(500)}</button></section>
    ${aGains ? `<section class="carte pad pile-s" style="gap:10px"><div class="entre"><h2 style="font-size:16px;font-weight:600">Mes gains</h2><b style="font-size:20px;color:var(--vert)">${F(m.gains)}</b></div>
      <p class="petit">${m.pieces} pièces gagnées · retrait possible dès 500 F de gains.</p>
      <button class="btn contour" id="retrait" ${m.gains < 500 ? 'disabled' : ''}>Retirer sur Mobile Money</button></section>` : ''}
    <section><h2 style="font-size:16px;font-weight:600;margin-bottom:6px">Historique</h2>
      <div class="carte" style="padding:0 16px">${mvts.length ? mvts.map((x) => `<div class="mvt"><span><span style="display:block">${e(x.libelle)}</span><span class="petit">${dateCourte(x.cree_le)}${x.genre === 'gains' ? ' · gains' : ''}</span></span><span class="${x.montant > 0 ? 'plus' : 'moins'}">${x.montant > 0 ? '+' : ''}${x.montant === 0 ? 'Gratuit' : F(x.montant)}</span></div>`).join('') : '<p class="vide">Aucune opération pour l\'instant.</p>'}</div></section>
  </main>`, 'portefeuille');
  const maj = () => { $('#recharger').innerHTML = `Recharger ${F(montant)} par ${e(moyen)}`; };
  $$('[data-m]').forEach((b) => b.onclick = () => { montant = Number(b.dataset.m); $$('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); maj(); });
  $$('[data-moyen]').forEach((b) => b.onclick = () => { moyen = b.dataset.moyen; $$('[data-moyen]').forEach((x) => { x.classList.toggle('on', x === b); $('.coche-m', x).innerHTML = x === b ? I(ICO.ok, 20) : ''; }); maj(); });
  maj();
  $('#recharger').onclick = (ev) => action(ev.currentTarget, async () => {
    S.moi = await rpc('recharger', { p_token: S.token, p_montant: montant, p_moyen: moyen });
    toast(`${F(montant)} ajoutés à votre solde (test).`); vuePortefeuille();
  });
  const r = $('#retrait'); if (r) r.onclick = () => formRetrait();
}

function formRetrait() {
  modal(`<h2 style="font-size:18px;font-weight:600">Retirer mes gains</h2>
    <p class="sous">Gains disponibles : <b>${F(S.moi.gains)}</b>. Pendant la bêta, les retraits sont traités à la main par l'équipe.</p>
    <div class="champ"><label for="rm">Montant (500 F minimum)</label><input id="rm" inputmode="numeric" value="${S.moi.gains}"></div>
    <div class="champ"><label for="rmoy">Recevoir par</label><select id="rmoy"><option>Orange Money</option><option>MTN Mobile Money</option></select></div>
    <div class="champ"><label for="rnum">Numéro Mobile Money</label><input id="rnum" inputmode="tel" placeholder="6XXXXXXXX"></div>
    <button class="btn" id="rok">Demander le retrait</button><button class="btn lien" data-fermer style="align-self:center">Annuler</button>`, (f, fermer) => {
    $('#rok', f).onclick = (ev) => action(ev.currentTarget, async () => {
      S.moi = await rpc('demander_retrait', { p_token: S.token, p_montant: parseInt($('#rm', f).value.replace(/\D/g, ''), 10) || 0, p_numero: $('#rnum', f).value, p_moyen: $('#rmoy', f).value });
      fermer(); toast('Demande de retrait envoyée.'); route();
    });
  });
}

/* ---------- Écran : publier ---------- */
function vuePublier() {
  const photos = [];
  page(`<main class="pad pile">
    <h1 class="titre">Publier une maison</h1>
    <p class="sous">${S.moi.role === 'admin' ? 'Administrateur : votre annonce sera en ligne tout de suite.' : 'Votre annonce sera vérifiée par Allomapiol avant d\'être en ligne.'}</p>
    <form id="f" class="pile" novalidate>
      <div class="pile-s"><span class="lbl">Type de logement</span><div class="puces" style="flex-wrap:wrap">${TYPES.map((t, i) => `<button type="button" class="puce ${i === 2 ? 'on' : ''}" data-type="${e(t)}">${e(t)}</button>`).join('')}</div></div>
      <div class="champ"><label for="titre">Titre de l'annonce</label><input id="titre" maxlength="80" placeholder="Ex. : Studio meublé lumineux"></div>
      <div class="grille2"><div class="champ"><label for="ville">Ville</label><input id="ville" value="${e(S.moi.ville || 'Douala')}"></div>
        <div class="champ"><label for="quartier">Quartier</label><input id="quartier" placeholder="Ex. : Akwa"></div></div>
      <div class="champ"><label for="adresse">Adresse exacte ou repère</label><input id="adresse" placeholder="Visible seulement après la visite"></div>
      <div class="grille2"><div class="champ"><label for="loyer">Loyer (F / mois)</label><input id="loyer" inputmode="numeric" placeholder="45000"></div>
        <div class="champ"><label for="caution">Caution et avance</label><input id="caution" placeholder="Ex. : 2 + 3 mois"></div></div>
      <fieldset style="border:0;margin:0;padding:0"><legend class="lbl" style="margin-bottom:6px">Équipements</legend><div class="cases">
        ${['Douche interne', 'Compteur séparé', 'Forage / eau', 'Parking', 'Groupe électrogène', 'Climatisation'].map((q) => `<label><input type="checkbox" value="${e(q)}">${e(q)}</label>`).join('')}</div></fieldset>
      <div class="champ"><label for="desc">Description</label><textarea id="desc" maxlength="800" placeholder="Ce qui rend ce logement intéressant…"></textarea></div>
      <div class="pile-s"><span class="lbl">Photos (4 conseillées, la première est visible par tous)</span><div class="photos-ajout" id="ph"></div>
        <span class="petit">Photos nettes et lumineuses : elles comptent pour la note qualité.</span></div>
      <div class="champ"><label for="tel">Numéro de contact</label><input id="tel" inputmode="tel" value="${/^\+?\d/.test(S.moi.contact) ? e(S.moi.contact) : ''}" placeholder="Visible seulement après la visite"></div>
      <div class="ligne carte" style="padding:12px 14px;background:var(--teinte);font-size:13px;line-height:1.5"><img src="sym-violet.png" alt="" style="height:22px"><span>Après validation : <b>+10 pièces</b> (20 si Premium). Agents vérifiés : 40 % de chaque visite de cette maison.</span></div>
      <button class="btn" type="submit">Envoyer pour validation</button>
    </form></main>`, 'publier');
  let type = TYPES[2];
  $$('[data-type]').forEach((b) => b.onclick = () => { type = b.dataset.type; $$('[data-type]').forEach((x) => x.classList.toggle('on', x === b)); });
  const dessiner = () => {
    $('#ph').innerHTML = photos.map((p, i) => `<div><img src="${e(p)}" alt="Photo ${i + 1}"><button type="button" class="suppr" data-suppr="${i}" aria-label="Retirer la photo ${i + 1}">×</button></div>`).join('')
      + (photos.length < 8 ? `<label>${I(ICO.photo, 24)}Ajouter<input type="file" accept="image/*" multiple hidden id="fichier"></label>` : '');
    $$('[data-suppr]').forEach((b) => b.onclick = () => { photos.splice(Number(b.dataset.suppr), 1); dessiner(); });
    const inp = $('#fichier');
    if (inp) inp.onchange = async () => {
      const fichiers = [...inp.files].slice(0, 8 - photos.length);
      toast('Envoi des photos…');
      for (const f of fichiers) { try { photos.push(await televerser(f, 'photos')); dessiner(); } catch (err) { toast(err.message, true); } }
      dessiner();
    };
  };
  dessiner();
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    if (!$('#quartier').value.trim()) return toast('Indiquez le quartier.', true);
    action(ev.submitter, async () => {
      await rpc('publier', { p_token: S.token, d: {
        type, titre: $('#titre').value.trim() || type, ville: $('#ville').value.trim() || 'Douala', quartier: $('#quartier').value.trim(),
        adresse: $('#adresse').value.trim(), loyer: parseInt($('#loyer').value.replace(/\D/g, ''), 10) || 0, caution: $('#caution').value.trim(),
        equipements: $$('.cases input:checked').map((c) => c.value), description: $('#desc').value.trim(), photos, telephone: $('#tel').value.trim()
      } });
      S.annonces = null;
      toast(S.moi.role === 'admin' ? 'Annonce publiée.' : 'Annonce envoyée. Elle sera en ligne après validation.');
      location.hash = S.moi.role === 'agent' || S.moi.est_agent ? '#/agent' : '#/compte';
    });
  };
}

/* ---------- Écran : devenir agent ---------- */
async function vueDevenirAgent() {
  await rafraichirMoi();
  const m = S.moi;
  if (m.est_agent) { location.hash = '#/agent'; return; }
  if (m.agent_statut === 'en_attente') {
    page(`<main class="pad pile"><h1 class="titre">Devenir agent Allomapiol</h1>
      <div class="carte pad pile-s"><span class="badge b-attente">Vérification en cours</span><p class="sous">Votre carte d'identité a bien été reçue. L'équipe Allomapiol vérifie votre compte. Vous pouvez déjà publier des maisons : elles seront validées normalement.</p></div>
      <a class="btn" href="#/publier">Publier une maison</a></main>`, 'agent');
    return;
  }
  const cartes = { recto: null, verso: null };
  page(`<main class="pad pile"><h1 class="titre">Devenir agent Allomapiol</h1>
    <p class="sous">Publiez sans limite et touchez 40 % de chaque visite de vos maisons. Abonnement : 2 000 F par mois, <b>offert pendant la bêta</b>.</p>
    ${m.agent_statut === 'refuse' ? '<p class="petit" style="color:var(--rouge)">Votre précédente demande a été refusée. Envoyez des photos plus nettes de votre carte.</p>' : ''}
    <section class="carte pad pile-s" style="gap:12px"><b>Vérification de la carte d'identité</b>
      <div class="grille2">${['recto', 'verso'].map((c) => `<label class="photos-ajout" style="display:block"><span style="display:flex;height:110px;border:1.5px dashed var(--lilas);border-radius:12px;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:var(--royal);font-size:13px;font-weight:600;cursor:pointer;overflow:hidden" id="z-${c}">${I(ICO.photo, 24)}${c === 'recto' ? 'Recto' : 'Verso'}</span><input type="file" accept="image/*" hidden data-carte="${c}"></label>`).join('')}</div>
      <p class="petit">Vos photos ne sont visibles que par l'équipe Allomapiol. Pendant la bêta, vous pouvez envoyer une photo floutée si vous préférez.</p></section>
    <button class="btn" id="env">Envoyer ma demande</button>
    <a class="btn lien" href="#/accueil" style="align-self:center">Plus tard</a></main>`, 'agent');
  $$('[data-carte]').forEach((inp) => inp.onchange = async () => {
    const c = inp.dataset.carte; if (!inp.files[0]) return;
    $(`#z-${c}`).textContent = 'Envoi…';
    try { cartes[c] = await televerser(inp.files[0], 'cartes'); $(`#z-${c}`).innerHTML = `<img src="${e(cartes[c])}" alt="${c}" style="width:100%;height:100%;object-fit:cover">`; }
    catch (err) { toast(err.message, true); $(`#z-${c}`).textContent = c; }
  });
  $('#env').onclick = (ev) => action(ev.currentTarget, async () => {
    S.moi = await rpc('devenir_agent', { p_token: S.token, p_recto: cartes.recto, p_verso: cartes.verso });
    toast('Demande envoyée. Nous vérifions votre carte.'); vueDevenirAgent();
  });
}

/* ---------- Écran : espace agent ---------- */
async function vueAgent() {
  chargement();
  await rafraichirMoi();
  const m = S.moi;
  if (!m.est_agent && m.agent_statut !== 'en_attente') { location.hash = '#/devenir-agent'; return; }
  const ann = await rpc('mes_annonces', { p_token: S.token });
  const visites = ann.reduce((s, a) => s + a.visites, 0);
  const statut = (a) => ({ en_attente: '<span class="badge b-attente">En attente de validation</span>', refuse: '<span class="badge b-refuse">Refusée</span>', loue: '<span class="badge b-standard">Louée</span>' }[a.statut] || '');
  page(`<main class="pad pile">
    <div class="ligne"><div style="width:52px;height:52px;border-radius:26px;background:var(--lilas);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600">${e(m.nom[0].toUpperCase())}</div>
      <div class="pile-s" style="gap:2px"><b style="font-size:18px">${e(m.nom)}</b>${m.est_agent ? '<span class="badge" style="background:var(--royal);color:#fff">Agent vérifié</span>' : '<span class="badge b-attente">Vérification en cours</span>'}</div></div>
    ${m.agent_jusqu ? `<div class="entre carte" style="padding:12px 14px;background:var(--teinte);font-size:13px"><span>Abonnement actif jusqu'au ${new Date(m.agent_jusqu).toLocaleDateString('fr-FR')}</span><span class="petit">Offert (bêta)</span></div>` : ''}
    <section class="portefeuille" style="gap:14px">
      <div><span class="petit" style="color:#D9C4DF">Gains disponibles</span><div class="m">${F(m.gains)}</div></div>
      <div class="grille2"><div class="stat"><b>${visites}</b><span>visites de mes maisons</span></div><div class="stat"><b>${m.pieces} pièces</b><span>annonces validées</span></div></div>
      <a class="btn blanc" href="#/portefeuille">Retirer sur Mobile Money</a>
      <span class="petit" style="color:#D9C4DF;text-align:center">Retrait possible dès 500 F de gains</span></section>
    <div class="entre"><h2 style="font-size:18px;font-weight:600">Mes annonces</h2><a href="#/publier" style="font-weight:600;font-size:14px">+ Publier</a></div>
    ${ann.length ? `<ul class="pile-s" style="list-style:none;margin:0;padding:0;gap:10px">${ann.map((a) => `<li class="carte annonce">
      <img src="${e(a.photo)}" alt="" class="vignette" style="width:76px;height:76px">
      <div class="infos"><span class="t">${e(a.titre)} · ${e(a.quartier)}</span>${statut(a)}
        ${a.statut === 'valide' ? `<span class="petit">${a.gratuit ? 'Visite gratuite · sans commission' : `${{ premium: 'Premium', confort: 'Confort', standard: 'Standard' }[a.badge]} · ${Math.round(a.prix_visite * 0.4)} F par visite`}</span>
        <span style="font-size:13px"><b>${a.visites}</b> visite${a.visites > 1 ? 's' : ''} · <b style="color:var(--vert)">${F(a.gains)}</b></span>
        <button class="btn lien" style="min-height:32px;font-size:13px;align-self:flex-start" data-louee="${a.id}">Marquer comme louée</button>` : ''}
      </div></li>`).join('')}</ul>` : '<div class="vide carte">Vous n\'avez pas encore publié de maison.</div>'}
    <div class="entre carte" style="padding:14px;border:1.5px dashed var(--lilas);box-shadow:none"><div class="pile-s" style="gap:2px"><span class="petit">Code de parrainage (+100 F par inscrit)</span><b style="font-size:16px;letter-spacing:.06em">${e(m.code_parrain)}</b></div>
      <button class="btn mini contour" id="partager">Partager</button></div>
  </main>`, 'agent');
  $$('[data-louee]').forEach((b) => b.onclick = () => action(b, async () => { await rpc('marquer_louee', { p_token: S.token, p_id: b.dataset.louee }); S.annonces = null; vueAgent(); }));
  $('#partager').onclick = async () => {
    const txt = `Trouve ton logement sans te déplacer avec Allomapiol ! Inscris-toi avec mon code ${m.code_parrain} : ${location.origin}${location.pathname}`;
    try { if (navigator.share) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); toast('Message copié. Collez-le dans WhatsApp.'); } } catch (_) {}
  };
}

/* ---------- Écran : mon compte ---------- */
async function vueCompte() {
  await rafraichirMoi();
  const m = S.moi;
  const notifs = JSON.parse(store.get('am_notifs') || '{"a":true,"b":true,"c":false,"d":true}');
  const libN = { a: 'Nouvelles maisons pour moi', b: 'Solde presque épuisé', c: 'Promotions et visites gratuites', d: 'Réponses à mes commentaires' };
  page(`<main class="pad pile">
    <h1 class="titre">Mon compte</h1>
    <section class="carte ligne" style="padding:16px;gap:14px"><div style="width:56px;height:56px;border-radius:28px;background:var(--lilas);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;flex-shrink:0">${e(m.nom[0].toUpperCase())}</div>
      <div class="pile-s" style="gap:2px;flex-grow:1;min-width:0"><b style="font-size:17px">${e(m.nom)}</b><span class="petit" style="overflow-wrap:anywhere">${e(m.contact)}</span>
      <span class="petit">${m.role === 'admin' ? 'Administrateur' : m.est_agent ? 'Agent vérifié' : m.agent_statut === 'en_attente' ? 'Agent : vérification en cours' : 'Client'}</span></div></section>
    <section class="pile-s" style="gap:10px"><h2 class="section-t">Mes préférences</h2>
      <form id="pref" class="carte pad pile-s" style="gap:12px">
        <div class="champ"><label for="pnom">Nom affiché</label><input id="pnom" value="${e(m.nom)}"></div>
        <div class="champ"><label for="pville">Ville de recherche</label><select id="pville">${['Douala', 'Yaoundé', 'Kribi', 'Limbé', 'Buea', 'Bafoussam', 'Garoua'].map((v) => `<option ${m.ville === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="grille2"><div class="champ"><label for="pmin">Budget min (F)</label><input id="pmin" inputmode="numeric" value="${e(m.budget_min || '')}"></div><div class="champ"><label for="pmax">Budget max (F)</label><input id="pmax" inputmode="numeric" value="${e(m.budget_max || '')}"></div></div>
        <button class="btn nuit" type="submit">Enregistrer</button></form></section>
    <section class="pile-s" style="gap:10px"><h2 class="section-t">Notifications</h2>
      <div class="carte" style="overflow:hidden">${Object.keys(libN).map((k) => `<button type="button" role="switch" aria-checked="${!!notifs[k]}" class="interrupteur ${notifs[k] ? 'on' : ''}" data-notif="${k}">${libN[k]}<span class="rail"><i></i></span></button>`).join('')}</div>
      <p class="petit">Bêta : les notifications seront envoyées dans la version officielle.</p></section>
    <section class="pile-s" style="gap:10px"><h2 class="section-t">Modalités et tarifs</h2>
      <div class="carte pad pile-s" style="gap:14px"><b>Prix d'une visite</b>
        <div class="grille2" style="grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div style="padding:10px 4px;border-radius:12px;background:#EEEAF1"><div class="petit" style="color:var(--nuit);font-weight:600">Standard</div><b style="font-size:18px">20 F</b></div>
          <div style="padding:10px 4px;border-radius:12px;background:var(--lilas)"><div class="petit" style="color:var(--nuit);font-weight:600">Confort</div><b style="font-size:18px">25 F</b></div>
          <div style="padding:10px 4px;border-radius:12px;background:var(--nuit);color:#fff"><div class="petit" style="color:#fff;font-weight:600">Premium</div><b style="font-size:18px">50 F</b></div></div>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.5;color:#4A3D5A">
          <li>Recharge minimale : 500 F, par Orange Money, MTN MoMo, carte ou PayPal.</li>
          <li>Votre solde n'a pas de date limite : il diminue à chaque nouvelle visite.</li>
          <li>Une maison déjà visitée reste gratuite pour vous.</li>
          <li>Les maisons marquées « Visite gratuite » ne coûtent rien.</li>
          <li>L'argent rechargé n'est pas remboursable ; seuls les gains se retirent, à partir de 500 F.</li>
          <li>Les numéros et adresses écrits dans les commentaires sont masqués.</li></ul>
        <div class="pile-s" style="padding:12px;border-radius:12px;background:var(--teinte)"><b style="font-size:14px">Pour les agents</b><span style="font-size:13px;line-height:1.5;color:#4A3D5A">Abonnement 2 000 F par mois, carte d'identité vérifiée. 40 % de chaque visite de leurs propres maisons ; +10 pièces par annonce validée (1 000 pièces = 5 000 F).</span></div>
      </div></section>
    <section class="carte" style="overflow:hidden">
      ${m.est_agent || m.role === 'agent' ? `<a class="rangee" href="#/agent" style="color:var(--royal);font-weight:600">Espace agent${I(ICO.chevron, 18)}</a>` : `<a class="rangee" href="#/devenir-agent" style="color:var(--royal);font-weight:600">Devenir agent immobilier${I(ICO.chevron, 18)}</a>`}
      ${m.role === 'admin' ? `<a class="rangee" href="#/admin" style="font-weight:600">Administration${I(ICO.chevron, 18)}</a>` : `<button type="button" class="rangee" id="accesadmin" style="width:100%;border:0;background:#fff;border-bottom:1px solid #F0EAF3;text-align:left">Accès administrateur${I(ICO.chevron, 18)}</button>`}
      <button type="button" class="rangee" data-avis style="width:100%;border:0;background:#fff;border-bottom:1px solid #F0EAF3;text-align:left">Donner mon avis sur la bêta${I(ICO.chevron, 18)}</button>
      <button type="button" class="rangee" id="deco" style="width:100%;border:0;background:#fff;color:var(--rouge);text-align:left">Se déconnecter</button></section>
    <p class="petit" style="text-align:center">Allomapiol · version bêta de test</p>
  </main>`, 'compte');
  $('#pref').onsubmit = (ev) => {
    ev.preventDefault();
    action(ev.submitter, async () => {
      const n = (id) => parseInt($(id).value.replace(/\D/g, ''), 10) || null;
      S.moi = await rpc('maj_profil', { p_token: S.token, p_nom: $('#pnom').value, p_ville: $('#pville').value, p_min: n('#pmin'), p_max: n('#pmax') });
      S.min = S.moi.budget_min || ''; S.max = S.moi.budget_max || '';
      toast('Préférences enregistrées.');
    });
  };
  $$('[data-notif]').forEach((b) => b.onclick = () => { const k = b.dataset.notif; notifs[k] = !notifs[k]; store.set('am_notifs', JSON.stringify(notifs)); b.classList.toggle('on', notifs[k]); b.setAttribute('aria-checked', notifs[k]); });
  $('#deco').onclick = async () => { try { await rpc('deconnecter', { p_token: S.token }); } catch (_) {} deconnexionLocale(); location.hash = '#/'; };
  const aa = $('#accesadmin');
  if (aa) aa.onclick = () => modal(`<h2 style="font-size:18px;font-weight:600">Accès administrateur</h2>
      <div class="champ"><label for="acode">Code administrateur</label><input id="acode" autocapitalize="characters"></div>
      <button class="btn" id="aok">Valider</button><button class="btn lien" data-fermer style="align-self:center">Annuler</button>`, (f, fermer) => {
    $('#aok', f).onclick = (ev) => action(ev.currentTarget, async () => { S.moi = await rpc('admin_activer', { p_token: S.token, p_code: $('#acode', f).value }); fermer(); location.hash = '#/admin'; });
  });
}

/* ---------- Avis sur la bêta ---------- */
function formAvis() {
  let note = null;
  modal(`<h2 style="font-size:18px;font-weight:600">Votre avis sur Allomapiol</h2>
    <p class="sous">Sur 10, quelle chance que vous utilisiez vraiment l'application ?</p>
    <div class="notes10">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-n="${i}">${i}</button>`).join('')}</div>
    <div class="champ"><label for="amsg">Ce qui vous plaît, ce qui vous gêne</label><textarea id="amsg" maxlength="2000" placeholder="Soyez franc, ça nous aide beaucoup."></textarea></div>
    <button class="btn" id="aenv">Envoyer</button><button class="btn lien" data-fermer style="align-self:center">Annuler</button>`, (f, fermer) => {
    $$('[data-n]', f).forEach((b) => b.onclick = () => { note = Number(b.dataset.n); $$('[data-n]', f).forEach((x) => x.classList.toggle('on', x === b)); });
    $('#aenv', f).onclick = (ev) => action(ev.currentTarget, async () => {
      await rpc('donner_avis', { p_token: S.token, p_note: note, p_message: $('#amsg', f).value, p_ecran: location.hash });
      fermer(); toast('Merci pour votre avis !');
    });
  });
}

/* ---------- Écran : administration ---------- */
let ongletAdmin = 'attente';
async function vueAdmin() {
  chargement();
  const d = await rpc('admin_tableau', { p_token: S.token });
  const st = d.stats;
  const onglets = [['attente', `À valider (${d.en_attente.length})`], ['ligne', `En ligne (${d.en_ligne.length})`], ['agents', `Agents (${d.agents.length})`], ['signal', `Signalements (${d.signalements.length})`], ['retraits', `Retraits (${d.retraits.length})`], ['avis', `Avis (${d.retours.length})`]];
  const lien = (u, t) => u ? `<a href="${e(u)}" target="_blank" rel="noopener">${t}</a>` : '—';
  const badgeSel = (id, note) => { const b = note >= 80 ? 'premium' : note >= 60 ? 'confort' : 'standard'; return `<select data-badge="${id}" style="min-height:44px;border:1.5px solid var(--trait);border-radius:10px;padding:0 8px">${['standard', 'confort', 'premium'].map((x) => `<option value="${x}" ${x === b ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select>`; };
  const corps = {
    attente: d.en_attente.map((a) => `<div class="carte admin-carte"><div class="ligne" style="align-items:flex-start"><img src="${e(a.photo)}" alt="" class="vignette" style="width:88px;height:80px">
        <div class="pile-s" style="gap:2px"><b>${e(a.titre)}</b><span class="petit">${e(a.type)} · ${e(a.quartier)}, ${e(a.ville)} · ${F(a.loyer)}/mois</span><span class="petit">Par ${e(a.auteur_nom || '—')} (${e(a.auteur_contact || '')})</span></div></div>
        <span class="petit">Adresse : ${e(a.adresse || '—')} · Tél. : ${e(a.telephone || '—')}</span>
        ${a.description ? `<span class="petit">${e(a.description)}</span>` : ''}
        ${(a.photos || []).length ? `<div class="ligne" style="gap:6px;overflow-x:auto">${a.photos.map((p) => `<img src="${e(p)}" alt="" style="width:64px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">`).join('')}</div>` : ''}
        <div class="ligne"><label class="lbl" for="n-${a.id}">Note /100</label><input id="n-${a.id}" data-noteq="${a.id}" inputmode="numeric" value="65" style="width:70px;min-height:44px;border:1.5px solid var(--trait);border-radius:10px;padding:0 10px">${badgeSel(a.id, 65)}</div>
        <div class="grille2"><button class="btn mini" style="width:100%" data-valider="${a.id}">Valider</button><button class="btn mini contour" style="width:100%" data-refuser="${a.id}">Refuser</button></div></div>`).join('') || '<p class="vide">Aucune annonce à valider.</p>',
    ligne: d.en_ligne.map((a) => `<div class="carte admin-carte"><div class="entre"><div class="pile-s" style="gap:2px"><b>${e(a.titre)}</b><span class="petit">${e(a.quartier)} · ${e(a.badge)} · note ${a.note ?? '—'} · ${a.visites} visites${a.exemple ? ' · exemple' : ''}</span></div></div>
        <div class="grille2"><button class="btn mini ${a.gratuit ? '' : 'contour'}" style="width:100%" data-gratuit="${a.id}" data-val="${!a.gratuit}">${a.gratuit ? 'Gratuite ✓' : 'Rendre gratuite'}</button><button class="btn mini contour" style="width:100%;color:var(--rouge)" data-retirer="${a.id}">Retirer</button></div></div>`).join('') || '<p class="vide">Aucune annonce en ligne.</p>',
    agents: d.agents.map((g) => `<div class="carte admin-carte"><b>${e(g.nom)}</b><span class="petit">${e(g.contact)} · demandé le ${dateCourte(g.cree_le)}</span>
        <span class="petit">Carte : ${lien(g.recto, 'recto')} · ${lien(g.verso, 'verso')}</span>
        <div class="grille2"><button class="btn mini" style="width:100%" data-agent="${g.id}" data-ok="true">Valider l'agent</button><button class="btn mini contour" style="width:100%" data-agent="${g.id}" data-ok="false">Refuser</button></div></div>`).join('') || '<p class="vide">Aucune demande d\'agent.</p>',
    signal: d.signalements.map((s) => `<div class="carte admin-carte"><b>${e(s.motif)}</b><span class="petit">${s.commentaire ? `Commentaire : « ${e(s.texte)} »` : `Annonce : ${e(s.titre)}`} · par ${e(s.par)}</span>
        ${s.annonce ? `<a class="petit" href="#/maison/${e(s.annonce)}">Voir l'annonce</a>` : ''}
        <div class="grille2"><button class="btn mini" style="width:100%" data-sig="${s.id}" data-masquer="true">${s.commentaire ? 'Masquer le commentaire' : 'Retirer l\'annonce'}</button><button class="btn mini contour" style="width:100%" data-sig="${s.id}" data-masquer="false">Ignorer</button></div></div>`).join('') || '<p class="vide">Aucun signalement.</p>',
    retraits: d.retraits.map((r) => `<div class="carte admin-carte"><b>${F(r.montant)} · ${e(r.nom)}</b><span class="petit">${e(r.moyen)} : ${e(r.numero)} · ${dateCourte(r.cree_le)}</span>
        <div class="grille2"><button class="btn mini" style="width:100%" data-retrait="${r.id}" data-paye="true">Marquer payé</button><button class="btn mini contour" style="width:100%" data-retrait="${r.id}" data-paye="false">Refuser</button></div></div>`).join('') || '<p class="vide">Aucune demande de retrait.</p>',
    avis: d.retours.map((r) => `<div class="carte admin-carte"><div class="entre"><b>${e(r.nom || 'Anonyme')}</b><span class="badge b-confort">${r.note ?? '—'}/10</span></div><span style="font-size:14px;line-height:1.5">${e(r.message)}</span><span class="petit">${dateCourte(r.cree_le)} · écran ${e(r.ecran || '')}</span></div>`).join('') || '<p class="vide">Aucun avis pour l\'instant.</p>'
  };
  page(`<main class="pad pile"><h1 class="titre">Administration</h1>
    <section class="portefeuille"><div class="grille2" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><b>${st.comptes}</b><span>comptes</span></div><div class="stat"><b>${st.agents}</b><span>agents</span></div><div class="stat"><b>${st.annonces}</b><span>annonces</span></div>
      <div class="stat"><b>${st.visites}</b><span>visites</span></div><div class="stat"><b>${F(st.recette)}</b><span>recette (test)</span></div><div class="stat"><b>${st.retours}</b><span>avis</span></div></div></section>
    <div class="onglets" role="tablist">${onglets.map(([k, t]) => `<button role="tab" aria-selected="${ongletAdmin === k}" class="${ongletAdmin === k ? 'on' : ''}" data-onglet="${k}">${t}</button>`).join('')}</div>
    <div class="pile-s" style="gap:10px">${corps[ongletAdmin]}</div>
    <a class="btn contour" href="#/publier">Publier une maison (en ligne directement)</a></main>`, 'compte');
  $$('[data-onglet]').forEach((b) => b.onclick = () => { ongletAdmin = b.dataset.onglet; vueAdmin(); });
  $$('[data-noteq]').forEach((inp) => inp.oninput = () => { const n = parseInt(inp.value, 10) || 0; $(`[data-badge="${inp.dataset.noteq}"]`).value = n >= 80 ? 'premium' : n >= 60 ? 'confort' : 'standard'; });
  const faire = (sel, fn) => $$(sel).forEach((b) => b.onclick = () => action(b, async () => { await fn(b); S.annonces = null; vueAdmin(); }));
  faire('[data-valider]', (b) => rpc('admin_valider', { p_token: S.token, p_id: b.dataset.valider, p_badge: $(`[data-badge="${b.dataset.valider}"]`).value, p_note: parseInt($(`#n-${b.dataset.valider}`).value, 10) || null }));
  faire('[data-refuser]', (b) => rpc('admin_refuser', { p_token: S.token, p_id: b.dataset.refuser }));
  faire('[data-gratuit]', (b) => rpc('admin_modifier', { p_token: S.token, p_id: b.dataset.gratuit, p_badge: null, p_note: null, p_gratuit: b.dataset.val === 'true' }));
  faire('[data-retirer]', (b) => rpc('admin_retirer', { p_token: S.token, p_id: b.dataset.retirer }));
  faire('[data-agent]', (b) => rpc('admin_agent', { p_token: S.token, p_compte: b.dataset.agent, p_ok: b.dataset.ok === 'true' }));
  faire('[data-sig]', (b) => rpc('admin_signalement', { p_token: S.token, p_id: Number(b.dataset.sig), p_masquer: b.dataset.masquer === 'true' }));
  faire('[data-retrait]', (b) => rpc('admin_retrait', { p_token: S.token, p_id: Number(b.dataset.retrait), p_paye: b.dataset.paye === 'true' }));
}

/* ---------- Routeur ---------- */
async function route() {
  const [, nom = '', arg] = (location.hash || '#/').split('/');
  const publiques = ['', 'inscription', 'connexion'];
  try {
    if (!S.token && !publiques.includes(nom)) { location.hash = '#/'; return; }
    if (S.token && !S.moi) { chargement(); await rafraichirMoi(); }
    if (S.token && publiques.includes(nom)) { location.hash = '#/accueil'; return; }
    switch (nom) {
      case '': return vueBienvenue();
      case 'inscription': return vueInscription(arg);
      case 'connexion': return vueConnexion();
      case 'accueil': return await vueAccueil();
      case 'maison': return await vueMaison(arg);
      case 'portefeuille': return await vuePortefeuille();
      case 'publier': return vuePublier();
      case 'devenir-agent': return await vueDevenirAgent();
      case 'agent': return await vueAgent();
      case 'compte': return await vueCompte();
      case 'admin': return await vueAdmin();
      default: location.hash = '#/accueil';
    }
  } catch (err) {
    if (!S.token) { location.hash = '#/'; return; }
    app().innerHTML = `<main class="pad pile" style="padding-top:60px;text-align:center"><p class="sous">${e(err.message)}</p><button class="btn" onclick="location.reload()">Réessayer</button><a class="btn lien" href="#/accueil" style="align-self:center">Retour à l'accueil</a></main>`;
  }
}
document.addEventListener('click', (ev) => { if (ev.target.closest('[data-avis]')) formAvis(); });
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
