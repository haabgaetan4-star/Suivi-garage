"use strict";

const CLE = "suivi-garage-v1";                       // ne pas changer : données de l'utilisateur
const CLE_AVANT_MIGRATION = "suivi-garage-v1-avant-migration";
const SEUIL_KM = 1000;   // « Bientôt » à moins de 1 000 km de l'échéance
const SEUIL_JOURS = 30;  // ou à moins de 30 jours

const PLAN_DEFAUT = [
  { type: "Vidange + filtre à huile", km: 15000, mois: 12 },
  { type: "Filtre à air", km: 30000, mois: 24 },
  { type: "Filtre d'habitacle", km: 15000, mois: 12 },
  { type: "Filtre à carburant", km: 60000, mois: null },
  { type: "Liquide de frein", km: null, mois: 24 },
  { type: "Plaquettes de frein", km: 40000, mois: null },
  { type: "Pneus", km: 40000, mois: null },
  { type: "Courroie de distribution", km: 120000, mois: 72 },
  { type: "Contrôle technique", km: null, mois: 24 },
];

// Plans types appliqués automatiquement (une seule fois) au véhicule reconnu par sa marque et son modèle.
// Les opérations ajoutées à la main par l'utilisateur sont conservées.
const PLANS_TYPES = [
  {
    id: "bmw-320d-n47",
    nom: "BMW 320d E90 (moteur N47)",
    source: "Consensus de forums et blogs (pas de document BMW officiel trouvé) ; contrôle technique : Service-Public. Moteur à chaîne de distribution : pas de courroie.",
    detecte: v => /bmw/i.test(v.infos.marque) && /320\s*d/i.test(v.infos.modele),
    plan: [
      { type: "Vidange + filtre à huile", km: 15000, mois: 12 },
      { type: "Filtre d'habitacle", km: 30000, mois: 24 },
      { type: "Filtre à air", km: 60000, mois: null },
      { type: "Filtre à carburant", km: 60000, mois: null },
      { type: "Liquide de frein", km: null, mois: 24 },
      { type: "Plaquettes de frein", km: 40000, mois: null },
      { type: "Pneus", km: 40000, mois: null },
      { type: "Contrôle technique", km: null, mois: 24 },
    ],
    retirer: ["Courroie de distribution"],
  },
  {
    id: "yamaha-mt09",
    nom: "Yamaha MT-09",
    source: "Intervalles européens d'après MotoVault (non vérifiés sur le manuel Yamaha) ; contrôle technique moto : Service-Public.",
    detecte: v => /mt[\s-]?0?9\b/i.test(`${v.infos.marque} ${v.infos.modele}`),
    plan: [
      { type: "Vidange huile moteur", km: 10000, mois: 12 },
      { type: "Filtre à huile", km: 20000, mois: 24 },
      { type: "Chaîne : nettoyage, graissage, tension", km: 1000, mois: null },
      { type: "Bougies", km: 20000, mois: null },
      { type: "Filtre à air", km: 40000, mois: null },
      { type: "Jeu aux soupapes", km: 40000, mois: null },
      { type: "Liquide de frein", km: null, mois: 24 },
      { type: "Liquide de refroidissement", km: null, mois: 36 },
      { type: "Durites de frein", km: null, mois: 48 },
      { type: "Contrôle technique", km: null, mois: 36 },
    ],
    retirer: PLAN_DEFAUT.map(p => p.type), // opérations « voiture » du plan par défaut
  },
];

const ICONES = {
  crayon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  poubelle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

// ---------- Utilitaires ----------
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const eur = n => (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const nb = n => Math.round(n).toLocaleString("fr-FR");
const kmFmt = n => n == null ? "–" : nb(n) + " km";
const dateFmt = d => d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR") : "–";
const dateLongue = d => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const aujourdhui = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const norm = s => (s || "").trim().toLowerCase();
function ajouterMois(iso, mois) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + mois);
  return d;
}
function duree(jours) {
  if (jours < 60) return `${jours} j`;
  const mois = Math.round(jours / 30.44);
  return mois < 24 ? `${mois} mois` : `${Math.floor(mois / 12)} ans${mois % 12 ? " " + (mois % 12) + " mois" : ""}`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- Données ----------
// Format : { format: 2, actif: id, vehicules: [{ id, infos, km, interventions, plan }] }
const nouveauPlan = () => PLAN_DEFAUT.map(p => ({ id: uid(), ...p }));
function vehiculeVide() {
  return { id: uid(), infos: { marque: "", modele: "", immat: "", mec: "" }, km: { valeur: null, date: null }, interventions: [], plan: nouveauPlan(), plansAppliques: [] };
}
function normaliserVehicule(v) {
  return {
    id: v.id || uid(),
    infos: { marque: "", modele: "", immat: "", mec: "", ...(v.infos || {}) },
    km: { valeur: null, date: null, ...(v.km || {}) },
    interventions: Array.isArray(v.interventions) ? v.interventions : [],
    plan: Array.isArray(v.plan) ? v.plan : nouveauPlan(),
    plansAppliques: Array.isArray(v.plansAppliques) ? v.plansAppliques : [],
  };
}

// Met à jour le plan avec un plan type : les opérations de même nom gardent leur identifiant,
// celles listées dans « retirer » disparaissent, les opérations personnalisées restent.
function appliquerPlanType(v, pt) {
  const memeType = (a, b) => norm(a) === norm(b);
  const nouveaux = pt.plan.map(x => {
    const existant = v.plan.find(p => memeType(p.type, x.type));
    return { id: existant ? existant.id : uid(), type: x.type, km: x.km, mois: x.mois };
  });
  const gardes = v.plan.filter(p =>
    !pt.plan.some(x => memeType(x.type, p.type)) && !pt.retirer.some(t => memeType(t, p.type)));
  v.plan = [...nouveaux, ...gardes];
  if (!v.plansAppliques.includes(pt.id)) v.plansAppliques.push(pt.id);
}
const planTypeDe = v => PLANS_TYPES.find(pt => pt.detecte(v));
// Applique une seule fois le plan type d'un véhicule reconnu ; renvoie les noms des plans appliqués
function appliquerPlansAuto() {
  const appliques = [];
  data.vehicules.forEach(v => {
    const pt = planTypeDe(v);
    if (pt && !v.plansAppliques.includes(pt.id)) { appliquerPlanType(v, pt); appliques.push(pt.nom); }
  });
  if (appliques.length) sauver();
  return appliques;
}
// Accepte le format multi-véhicules et l'ancien format à un seul véhicule (exports compris)
function migrer(obj) {
  if (!obj || typeof obj !== "object") return null;
  let vehicules;
  if (Array.isArray(obj.vehicules)) vehicules = obj.vehicules.map(normaliserVehicule);
  else if (Array.isArray(obj.interventions)) {
    vehicules = [normaliserVehicule({ infos: obj.vehicule, km: obj.km, interventions: obj.interventions, plan: obj.plan })];
  } else return null;
  if (!vehicules.length) vehicules = [vehiculeVide()];
  const actif = vehicules.some(v => v.id === obj.actif) ? obj.actif : vehicules[0].id;
  return { format: 2, actif, vehicules };
}
function etatVide() { const v = vehiculeVide(); return { format: 2, actif: v.id, vehicules: [v] }; }
function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const obj = JSON.parse(brut);
      const d = migrer(obj);
      if (d) {
        if (!Array.isArray(obj.vehicules)) {
          // ancien format : copie de sécurité avant conversion
          try { localStorage.setItem(CLE_AVANT_MIGRATION, brut); localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { /* ignoré */ }
        }
        return d;
      }
    }
  } catch (e) { /* stockage indisponible ou illisible */ }
  return etatVide();
}
function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(data)); }
  catch (e) { toast("⚠️ Impossible d'enregistrer dans ce navigateur"); }
}

let data = charger();
const V = () => data.vehicules.find(v => v.id === data.actif) || data.vehicules[0];
const nomVehicule = (v, i) => [v.infos.marque, v.infos.modele].filter(Boolean).join(" ") || `Véhicule ${i + 1}`;

// Kilométrage de référence : le plus élevé entre le dernier relevé et les interventions
function kmCourant(v = V()) {
  const kms = v.interventions.map(i => i.km);
  if (v.km.valeur != null) kms.push(v.km.valeur);
  return kms.length ? Math.max(...kms) : null;
}

// ---------- Rappels ----------
function calculerRappels(v = V()) {
  const km = kmCourant(v);
  const today = new Date(aujourdhui() + "T00:00:00");
  return v.plan.map(p => {
    const der = v.interventions
      .filter(i => norm(i.type) === norm(p.type))
      .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)[0];
    const r = { plan: p, derniere: der, statut: "none", lignes: [], score: Infinity };
    if (!der) return r;

    const echKm = p.km ? der.km + p.km : null;
    const echDate = p.mois ? ajouterMois(der.date, p.mois) : null;
    const resteKm = echKm != null && km != null ? echKm - km : null;
    const resteJ = echDate ? Math.round((echDate - today) / 86400000) : null;

    if (echKm != null) r.lignes.push(`À ${kmFmt(echKm)}` + (resteKm == null ? "" : resteKm >= 0
      ? ` · <strong>encore ${kmFmt(resteKm)}</strong>` : ` · <strong>dépassé de ${kmFmt(-resteKm)}</strong>`));
    if (echDate) r.lignes.push(`Le ${echDate.toLocaleDateString("fr-FR")}` + (resteJ >= 0
      ? ` · <strong>dans ${duree(resteJ)}</strong>` : ` · <strong>en retard de ${duree(-resteJ)}</strong>`));
    r.lignes.push(`Dernière fois : ${dateFmt(der.date)} à ${kmFmt(der.km)}`);

    // seuil « Bientôt » : 1 000 km / 30 jours, ramené à 20 % de l'intervalle pour les intervalles courts
    const seuilKm = p.km ? Math.min(SEUIL_KM, p.km * 0.2) : SEUIL_KM;
    const seuilJ = p.mois ? Math.min(SEUIL_JOURS, p.mois * 30.44 * 0.2) : SEUIL_JOURS;
    const enRetard = (resteKm != null && resteKm <= 0) || (resteJ != null && resteJ <= 0);
    const bientot = (resteKm != null && resteKm <= seuilKm) || (resteJ != null && resteJ <= seuilJ);
    r.statut = enRetard ? "late" : bientot ? "soon" : "ok";
    // tri : ce qui arrive le plus tôt d'abord (50 km ≈ 1 jour)
    r.score = Math.min(resteKm != null ? resteKm / 50 : Infinity, resteJ != null ? resteJ : Infinity);
    return r;
  });
}
const LIB_STATUT = { late: "En retard", soon: "Bientôt", ok: "À jour", none: "Jamais fait" };

function htmlRappel(r) {
  const lignes = r.lignes.length ? r.lignes : ["Pas encore enregistré"];
  return `<div class="rappel ${r.statut}">
    <div class="rappel-texte">
      <div class="rappel-nom">${esc(r.plan.type)}${r.statut === "late" || r.statut === "soon" ? `<span class="rappel-statut">${LIB_STATUT[r.statut]}</span>` : ""}</div>
      ${lignes.map(l => `<div class="rappel-detail">${l}</div>`).join("")}
    </div>
    <button type="button" class="fait" data-ajout="${r.plan.id}">${r.derniere ? "Fait" : "Saisir"}</button>
  </div>`;
}

// ---------- Rendu ----------
function rendre() {
  rendreEntete();
  rendreAccueil();
  rendreChoix();
  rendreHistorique();
  rendreVehicules();
}

function rendreEntete() {
  const v = V();
  $("#sel-vehicule").innerHTML = data.vehicules.map((x, i) =>
    `<option value="${x.id}" ${x.id === v.id ? "selected" : ""}>${esc(nomVehicule(x, i))}</option>`).join("")
    + `<option value="__nouveau">＋ Ajouter un véhicule…</option>`;
  const km = kmCourant();
  const morceaux = [v.infos.immat, km != null ? kmFmt(km) : null].filter(Boolean);
  $("#resume-vehicule").textContent = morceaux.length ? morceaux.join(" · ") : "Renseigne ce véhicule dans l'onglet Véhicules";
}

function rendreAccueil() {
  const v = V();
  const km = kmCourant();
  $("#km-affiche").textContent = kmFmt(km);
  $("#km-date").textContent = v.km.date ? `Relevé du ${dateFmt(v.km.date)}` : "Aucun relevé saisi";

  const rappels = calculerRappels().sort((a, b) => a.score - b.score);
  const aPrevoir = rappels.filter(r => r.statut === "late" || r.statut === "soon")
    .sort((a, b) => (a.statut === "late" ? 0 : 1) - (b.statut === "late" ? 0 : 1) || a.score - b.score);
  const aJour = rappels.filter(r => r.statut === "ok");
  const jamais = rappels.filter(r => r.statut === "none");

  $("#liste-aprevoir").innerHTML = aPrevoir.length ? aPrevoir.map(htmlRappel).join("")
    : `<div class="vide-rappels">✓ Rien à prévoir pour l'instant</div>`;
  $("#liste-ajour").innerHTML = aJour.map(htmlRappel).join("");
  $("#nb-ajour").textContent = aJour.length;
  $("#bloc-ajour").hidden = !aJour.length;
  $("#liste-arenseigner").innerHTML = jamais.map(htmlRappel).join("");
  $("#nb-arenseigner").textContent = jamais.length;
  $("#bloc-arenseigner").hidden = !jamais.length;

  // Coûts
  const ints = v.interventions;
  const total = ints.reduce((s, i) => s + (i.cout || 0), 0);
  const an = aujourdhui().slice(0, 4);
  $("#kpi-total").textContent = eur(total);
  $("#kpi-annee").textContent = eur(ints.filter(i => i.date.startsWith(an)).reduce((s, i) => s + (i.cout || 0), 0));
  const parcourus = ints.length ? km - Math.min(...ints.map(i => i.km)) : 0;
  $("#kpi-km").textContent = parcourus > 0 ? eur(total / parcourus * 1000) : "–";

  const parType = {};
  ints.forEach(i => { parType[i.type] = (parType[i.type] || 0) + (i.cout || 0); });
  const lignes = Object.entries(parType).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  $("#couts-type").innerHTML = lignes.map(([t, m]) => {
    const pct = m / total * 100;
    return `<div class="cout-ligne"><span>${esc(t)}</span><span>${eur(m)}</span>
      <div class="cout-barre"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
  }).join("");
}

function rendreHistorique() {
  const v = V();
  const f = norm($("#filtre").value);
  const liste = [...v.interventions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)
    .filter(i => !f || [i.type, i.description, i.garage].some(x => norm(x).includes(f)));

  // regroupement par visite (même date, même km, même garage)
  const visites = new Map();
  liste.forEach(i => {
    const cle = `${i.date}|${i.km}|${i.garage || ""}`;
    if (!visites.has(cle)) visites.set(cle, []);
    visites.get(cle).push(i);
  });

  $("#liste-visites").innerHTML = [...visites.values()].map(ops => {
    const p = ops[0];
    const total = ops.reduce((s, i) => s + (i.cout || 0), 0);
    const descs = [...new Set(ops.map(i => i.description).filter(Boolean))];
    return `<div class="carte visite">
      <div class="visite-tete">
        <div><div class="visite-date">${dateLongue(p.date)}</div>
          <div class="petit muted">${kmFmt(p.km)}${p.garage ? " · " + esc(p.garage) : ""}</div></div>
        <div class="visite-total">${eur(total)}</div>
      </div>
      <ul class="visite-ops">${ops.map(i => `<li>
        <span class="op-nom">${esc(i.type)}</span><span class="op-cout">${eur(i.cout)}</span>
        <button type="button" class="icone-btn" data-edit="${i.id}" aria-label="Modifier">${ICONES.crayon}</button>
        <button type="button" class="icone-btn suppr" data-del="${i.id}" aria-label="Supprimer">${ICONES.poubelle}</button>
      </li>`).join("")}</ul>
      ${descs.length ? `<p class="visite-desc">${esc(descs.join("\n"))}</p>` : ""}
    </div>`;
  }).join("");
  $("#vide-interv").hidden = liste.length > 0;
  $("#vide-interv").textContent = v.interventions.length ? "Aucun résultat." : "Aucun entretien enregistré pour ce véhicule.";

  const garages = [...new Set(data.vehicules.flatMap(x => x.interventions.map(i => i.garage)).filter(Boolean))];
  $("#garages").innerHTML = garages.map(g => `<option value="${esc(g)}">`).join("");
}

function rendreVehicules() {
  const v = V();
  $("#liste-vehicules").innerHTML = data.vehicules.map((x, i) => {
    const sous = [x.infos.immat, kmCourant(x) != null ? kmFmt(kmCourant(x)) : null].filter(Boolean).join(" · ") || "Infos à compléter";
    return `<button type="button" class="vehicule-ligne ${x.id === v.id ? "actif" : ""}" data-vehicule="${x.id}">
      <span class="radio"></span>
      <span class="v-texte"><span class="v-nom">${esc(nomVehicule(x, i))}</span><span class="v-sous">${esc(sous)}</span></span>
      ${x.id === v.id ? '<span class="v-actif">Affiché</span>' : ""}
    </button>`;
  }).join("");

  // ne pas écraser un champ en cours de saisie
  const champs = { "#v-marque": v.infos.marque, "#v-modele": v.infos.modele, "#v-immat": v.infos.immat, "#v-mec": v.infos.mec };
  Object.entries(champs).forEach(([sel, val]) => { if (document.activeElement !== $(sel)) $(sel).value = val || ""; });

  const pt = planTypeDe(v);
  $("#plan-type").innerHTML = pt ? `<div class="carte plan-type">
      <div class="plan-type-texte"><strong>Plan type : ${esc(pt.nom)}</strong>
        <div class="petit muted">${esc(pt.source)}</div></div>
      <button type="button" class="secondaire" data-plantype="${pt.id}">${v.plansAppliques.includes(pt.id) ? "Réappliquer" : "Appliquer"}</button>
    </div>` : "";

  $("#liste-plan").innerHTML = v.plan.map(p => `
    <div class="plan-ligne">
      <span class="plan-nom">${esc(p.type)}</span>
      <input type="number" inputmode="numeric" min="0" data-plan="${p.id}" data-champ="km" value="${p.km ?? ""}" aria-label="Tous les … km">
      <input type="number" inputmode="numeric" min="0" data-plan="${p.id}" data-champ="mois" value="${p.mois ?? ""}" aria-label="Tous les … mois">
      <button type="button" class="icone-btn suppr" data-delplan="${p.id}" aria-label="Retirer">${ICONES.poubelle}</button>
    </div>`).join("");
}

// ---------- Onglet « Ajouter » : choix des opérations ----------
// choix : clé (id d'opération du plan, ou "autre") -> { coche, cout, nom }
let choix = {};
let idEdition = null;

function rendreChoix() {
  const statuts = Object.fromEntries(calculerRappels().map(r => [r.plan.id, r.statut]));
  const lignes = V().plan.map(p => ({ cle: p.id, type: p.type, statut: statuts[p.id] }));
  lignes.push({ cle: "autre" });
  $("#choix-entretiens").innerHTML = lignes.map(l => {
    const c = choix[l.cle] || {};
    return `<div class="option ${c.coche ? "cochee" : ""}">
      <label class="option-tete">
        <input type="checkbox" data-cle="${l.cle}" ${c.coche ? "checked" : ""}>
        <span class="coche-visuelle"></span>
        <span class="option-texte">
          <span class="option-nom">${l.type ? esc(l.type) : "Autre opération"}</span>
          ${l.type ? `<span class="option-statut ${l.statut}">${LIB_STATUT[l.statut]}</span>` : `<span class="option-statut none">Réparation, batterie…</span>`}
        </span>
      </label>
      ${c.coche ? `<input type="number" inputmode="decimal" min="0" step="0.01" class="option-cout" data-cle="${l.cle}" data-champ="cout" placeholder="Coût €" value="${c.cout ?? ""}" aria-label="Coût TTC">` : ""}
      ${c.coche && !l.type ? `<input type="text" class="option-nom-autre" data-cle="autre" data-champ="nom" placeholder="Nom de l'opération" value="${esc(c.nom || "")}">` : ""}
    </div>`;
  }).join("");
  majTotal();
}
function selection() {
  const ids = new Set(V().plan.map(p => p.id));
  return Object.entries(choix).filter(([cle, c]) => c.coche && (cle === "autre" || ids.has(cle)));
}
function majTotal() {
  const sel = selection();
  const total = sel.reduce((s, [, c]) => s + (Number(c.cout) || 0), 0);
  $("#i-enregistrer").textContent = !sel.length ? "Enregistrer"
    : `Enregistrer${sel.length > 1 ? ` ${sel.length} opérations` : ""} · ${eur(total)}`;
}

$("#choix-entretiens").addEventListener("change", e => {
  const cb = e.target;
  if (cb.type !== "checkbox") return;
  const cle = cb.dataset.cle;
  // en modification, une ligne d'historique = une seule opération
  if (idEdition && cb.checked) Object.values(choix).forEach(c => { c.coche = false; });
  choix[cle] = { ...choix[cle], coche: cb.checked };
  rendreChoix();
  if (cb.checked) {
    const champ = cle === "autre" ? '[data-cle="autre"][data-champ="nom"]' : `[data-cle="${cle}"][data-champ="cout"]`;
    $("#choix-entretiens " + champ)?.focus();
  }
});
$("#choix-entretiens").addEventListener("input", e => {
  const { cle, champ } = e.target.dataset;
  if (!champ) return;
  choix[cle] = { ...choix[cle], [champ]: e.target.value };
  majTotal();
});

function resetFormInterv() {
  $("#form-interv").reset();
  idEdition = null;
  choix = {};
  $("#i-date").value = aujourdhui();
  if (kmCourant() != null) $("#i-km").value = kmCourant();
  $("#titre-form-interv").textContent = "Nouvel entretien";
  $("#aide-choix").textContent = "Touche une opération pour la cocher, puis indique son coût.";
  $("#i-annuler").hidden = true;
  rendreChoix();
}

$("#form-interv").addEventListener("submit", e => {
  e.preventDefault();
  const date = $("#i-date").value, kmTxt = $("#i-km").value;
  if (!date) return toast("Indique la date");
  if (kmTxt === "") return toast("Indique le kilométrage");
  const sel = selection();
  if (!sel.length) return toast("Coche au moins une opération");
  const v = V();
  const operations = sel.map(([cle, c]) => ({
    type: cle === "autre" ? (c.nom || "").trim() : v.plan.find(p => p.id === cle).type,
    cout: Number(c.cout) || 0,
  }));
  if (operations.some(o => !o.type)) return toast("Donne un nom à l'opération « Autre »");

  const commun = { date, km: Number(kmTxt), garage: $("#i-garage").value.trim(), description: $("#i-desc").value.trim() };
  const modif = idEdition;
  if (modif) {
    const idx = v.interventions.findIndex(i => i.id === modif);
    v.interventions[idx] = { id: modif, ...commun, ...operations[0] };
  } else {
    operations.forEach(o => v.interventions.push({ id: uid(), ...commun, ...o }));
  }
  sauver(); resetFormInterv(); rendre();
  allerOnglet(modif ? "historique" : "accueil");
  toast(modif ? "Entretien modifié" : operations.length > 1 ? `${operations.length} opérations enregistrées` : "Entretien enregistré");
});
$("#i-annuler").addEventListener("click", () => { resetFormInterv(); allerOnglet("historique"); });

// ---------- Navigation ----------
function allerOnglet(nom) {
  document.querySelectorAll(".onglet, .panel").forEach(e => e.classList.remove("active"));
  $(`.onglet[data-tab="${nom}"]`).classList.add("active");
  $("#" + nom).classList.add("active");
  window.scrollTo(0, 0);
}
document.querySelectorAll(".onglet").forEach(b => b.addEventListener("click", () => allerOnglet(b.dataset.tab)));

function changerVehicule(id) {
  data.actif = id;
  sauver(); $("#filtre").value = ""; resetFormInterv(); rendre();
}
function ajouterVehicule() {
  const v = vehiculeVide();
  data.vehicules.push(v);
  changerVehicule(v.id);
  allerOnglet("vehicules");
  $("#v-marque").focus();
  toast("Nouveau véhicule : renseigne ses informations");
}

// ---------- Événements ----------
$("#sel-vehicule").addEventListener("change", e => {
  if (e.target.value === "__nouveau") ajouterVehicule();
  else changerVehicule(e.target.value);
});

// Boutons « Fait » / « Saisir » des rappels
$("#accueil").addEventListener("click", e => {
  const b = e.target.closest("[data-ajout]");
  if (!b) return;
  resetFormInterv();
  choix = { [b.dataset.ajout]: { coche: true } };
  rendreChoix();
  allerOnglet("ajouter");
});

$("#form-km").addEventListener("submit", e => {
  e.preventDefault();
  const v = V();
  const val = Number($("#km-actuel").value);
  const ref = kmCourant();
  if (ref != null && val < ref && !confirm(`Ce relevé (${kmFmt(val)}) est inférieur au kilométrage déjà connu (${kmFmt(ref)}). Continuer ?`)) return;
  v.km = { valeur: val, date: aujourdhui() };
  sauver(); $("#km-actuel").value = ""; $("#km-actuel").blur();
  if (!idEdition && !selection().length) $("#i-km").value = kmCourant();
  rendre(); toast("Kilométrage mis à jour");
});

$("#liste-visites").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const v = V();
  if (b.dataset.edit) {
    const i = v.interventions.find(x => x.id === b.dataset.edit);
    resetFormInterv();
    idEdition = i.id;
    $("#i-date").value = i.date; $("#i-km").value = i.km;
    $("#i-garage").value = i.garage || ""; $("#i-desc").value = i.description || "";
    const p = v.plan.find(x => norm(x.type) === norm(i.type));
    choix = p ? { [p.id]: { coche: true, cout: i.cout } } : { autre: { coche: true, cout: i.cout, nom: i.type } };
    rendreChoix();
    $("#titre-form-interv").textContent = "Modifier l'entretien";
    $("#aide-choix").textContent = "En modification, une seule opération peut être cochée.";
    $("#i-annuler").hidden = false;
    allerOnglet("ajouter");
  }
  if (b.dataset.del && confirm("Supprimer cette opération de l'historique ?")) {
    v.interventions = v.interventions.filter(x => x.id !== b.dataset.del);
    sauver(); rendre(); toast("Opération supprimée");
  }
});
$("#filtre").addEventListener("input", rendreHistorique);

// Véhicules
$("#liste-vehicules").addEventListener("click", e => {
  const b = e.target.closest("[data-vehicule]");
  if (b && b.dataset.vehicule !== data.actif) { changerVehicule(b.dataset.vehicule); toast("Véhicule affiché : " + $("#sel-vehicule").selectedOptions[0].text); }
});
$("#btn-ajout-vehicule").addEventListener("click", ajouterVehicule);
$("#form-vehicule").addEventListener("submit", e => e.preventDefault());
$("#form-vehicule").addEventListener("change", () => {
  V().infos = {
    marque: $("#v-marque").value.trim(), modele: $("#v-modele").value.trim(),
    immat: $("#v-immat").value.trim().toUpperCase(), mec: $("#v-mec").value,
  };
  sauver();
  const appliques = appliquerPlansAuto();
  if (appliques.length) { resetFormInterv(); rendre(); toast(`Plan d'entretien ${appliques.join(", ")} appliqué`); }
  else { rendreEntete(); rendreVehicules(); toast("Enregistré"); }
});
$("#plan-type").addEventListener("click", e => {
  const b = e.target.closest("[data-plantype]");
  if (!b) return;
  const pt = PLANS_TYPES.find(x => x.id === b.dataset.plantype);
  if (!confirm(`Remettre les périodicités du plan type « ${pt.nom} » ? Tes opérations personnalisées sont conservées.`)) return;
  appliquerPlanType(V(), pt);
  sauver(); resetFormInterv(); rendre(); toast("Plan type appliqué");
});
$("#btn-suppr-vehicule").addEventListener("click", () => {
  const v = V(), idx = data.vehicules.indexOf(v);
  const n = v.interventions.length;
  if (!confirm(`Supprimer « ${nomVehicule(v, idx)} »${n ? ` et ses ${n} opération${n > 1 ? "s" : ""}` : ""} ? Pense à exporter avant.`)) return;
  data.vehicules = data.vehicules.filter(x => x !== v);
  if (!data.vehicules.length) data.vehicules.push(vehiculeVide());
  changerVehicule(data.vehicules[0].id);
  toast("Véhicule supprimé");
});

// Plan d'entretien (propre à chaque véhicule)
$("#liste-plan").addEventListener("change", e => {
  const id = e.target.dataset.plan;
  if (!id) return;
  const p = V().plan.find(x => x.id === id);
  p[e.target.dataset.champ] = e.target.value === "" ? null : Number(e.target.value);
  sauver(); rendre();
});
$("#liste-plan").addEventListener("click", e => {
  const b = e.target.closest("[data-delplan]");
  if (b && confirm("Retirer cette opération du plan d'entretien ?")) {
    V().plan = V().plan.filter(x => x.id !== b.dataset.delplan); sauver(); rendre();
  }
});
$("#form-plan").addEventListener("submit", e => {
  e.preventDefault();
  const km = $("#p-km").value, mois = $("#p-mois").value;
  V().plan.push({ id: uid(), type: $("#p-type").value.trim(), km: km ? Number(km) : null, mois: mois ? Number(mois) : null });
  e.target.reset(); sauver(); rendre(); toast("Opération ajoutée au plan");
});

// Sauvegarde
function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#btn-export").addEventListener("click", () =>
  telecharger(`suivi-garage-${aujourdhui()}.json`, JSON.stringify(data, null, 2), "application/json"));
$("#btn-csv").addEventListener("click", () => {
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lignes = [["Véhicule", "Immatriculation", "Date", "Km", "Opération", "Garage", "Remarques", "Coût TTC"].map(q).join(";")];
  data.vehicules.forEach((v, idx) => [...v.interventions].sort((a, b) => a.date.localeCompare(b.date)).forEach(i =>
    lignes.push([nomVehicule(v, idx), v.infos.immat, i.date, i.km, i.type, i.garage, i.description, String(i.cout).replace(".", ",")].map(q).join(";"))));
  telecharger(`historique-${aujourdhui()}.csv`, "﻿" + lignes.join("\r\n"), "text/csv");
});
$("#btn-import").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const d = migrer(JSON.parse(await f.text()));
    if (!d) throw new Error("format");
    if (!confirm("Remplacer toutes les données actuelles par celles du fichier ?")) return;
    data = d; sauver(); resetFormInterv(); rendre(); toast("Import réussi");
  } catch { toast("⚠️ Fichier invalide"); }
});
$("#btn-reset").addEventListener("click", () => {
  if (confirm("Effacer tous les véhicules et tout l'historique ? Pense à exporter avant.")) {
    data = etatVide(); sauver(); resetFormInterv(); rendre(); toast("Données effacées");
  }
});

// Sélectionner le contenu d'un champ chiffré quand on clique dedans, pour le remplacer directement
document.addEventListener("focusin", e => {
  const el = e.target;
  if (el.tagName !== "INPUT" || el.type !== "number") return;
  el.select();
  setTimeout(() => { if (document.activeElement === el) el.select(); }, 0); // iOS
  el.addEventListener("mouseup", ev => ev.preventDefault(), { once: true });
});

// ---------- Mise à jour automatique ----------
// version.json est relu sans cache à l'ouverture et à chaque retour sur l'appli.
// Si une nouvelle version est en ligne, la page se recharge avec une adresse
// nouvelle (?v=…) pour que Safari ne resserve pas les anciens fichiers.
const VERSION = document.querySelector('meta[name="app-version"]')?.content || "0";

async function verifierMiseAJour() {
  if (location.protocol === "file:") return;           // ouverture en local : rien à vérifier
  if (idEdition || selection().length) return;          // saisie en cours : on ne la perd pas
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const { version } = await r.json();
    if (!version || version === VERSION) return;
    // garde-fou : une seule tentative par version, pour éviter une boucle de rechargement
    let deja = null;
    try { deja = sessionStorage.getItem("sg-maj"); sessionStorage.setItem("sg-maj", version); } catch (e) { /* ignoré */ }
    if (deja === version) return;
    location.replace(`${location.pathname}?v=${encodeURIComponent(version)}${location.hash}`);
  } catch (e) { /* hors ligne : on garde la version actuelle */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verifierMiseAJour(); });
window.addEventListener("pageshow", verifierMiseAJour);

const plansAuto = appliquerPlansAuto();
resetFormInterv();
rendre();
if (plansAuto.length) toast(`Plan d'entretien ${plansAuto.join(", ")} appliqué`);
