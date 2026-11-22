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
  facture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/></svg>',
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
      ${[...new Set(ops.map(i => i.facture).filter(Boolean))].map((f, n, tab) =>
        `<button type="button" class="btn-facture" data-facture="${esc(f)}">${ICONES.facture}Voir la facture${tab.length > 1 ? ` ${n + 1}` : ""}</button>`).join(" ")}
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
  retirerPhoto();
  $("#scan-libelle").textContent = "Scanner une facture (photo ou PDF)";
  $("#scan-aide").textContent = "Prends la facture en photo ou choisis le PDF du garage : date, kilométrage, opérations et montants sont préremplis. Vérifie avant d'enregistrer.";
  rendreChoix();
}

$("#form-interv").addEventListener("submit", async e => {
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
  // photo de la facture : enregistrée sur l'appareil et rattachée aux opérations
  let facture = null;
  if (photoEnCours) {
    try { await Photos.mettre(photoEnCours.id, photoEnCours.blob); facture = photoEnCours.id; }
    catch (err) { toast("⚠️ Photo non enregistrée (stockage indisponible)"); }
  }
  const modif = idEdition;
  if (modif) {
    const idx = v.interventions.findIndex(i => i.id === modif);
    const avecFacture = facture || v.interventions[idx].facture;
    v.interventions[idx] = { id: modif, ...commun, ...operations[0], ...(avecFacture ? { facture: avecFacture } : {}) };
  } else {
    operations.forEach(o => v.interventions.push({ id: uid(), ...commun, ...o, ...(facture ? { facture } : {}) }));
  }
  sauver(); resetFormInterv(); rendre();
  if (modif && facture) nettoyerPhotos();
  allerOnglet(modif ? "historique" : "accueil");
  toast(modif ? "Entretien modifié" : operations.length > 1 ? `${operations.length} opérations enregistrées` : "Entretien enregistré");
});
$("#i-annuler").addEventListener("click", () => { resetFormInterv(); allerOnglet("historique"); });

// ---------- Photos de factures (IndexedDB, sur l'appareil uniquement) ----------
const Photos = {
  db: null,
  ouvrir() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((ok, ko) => {
      const r = indexedDB.open("suivi-garage-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("factures");
      r.onsuccess = () => ok(this.db = r.result);
      r.onerror = () => ko(r.error);
    });
  },
  async op(mode, fn) {
    const db = await this.ouvrir();
    return new Promise((ok, ko) => {
      const tx = db.transaction("factures", mode);
      const req = fn(tx.objectStore("factures"));
      tx.oncomplete = () => ok(req && req.result);
      tx.onerror = () => ko(tx.error);
    });
  },
  mettre(id, blob) { return this.op("readwrite", s => s.put(blob, id)); },
  lire(id) { return this.op("readonly", s => s.get(id)); },
  supprimer(id) { return this.op("readwrite", s => s.delete(id)); },
  cles() { return this.op("readonly", s => s.getAllKeys()); },
};
// Supprime les photos qui ne sont plus rattachées à aucune opération
async function nettoyerPhotos() {
  try {
    const utilisees = new Set(data.vehicules.flatMap(v => v.interventions.map(i => i.facture)).filter(Boolean));
    for (const cle of await Photos.cles()) if (!utilisees.has(cle)) await Photos.supprimer(cle);
  } catch (e) { /* stockage indisponible */ }
}

function chargerImage(fichier) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("image illisible"));
    img.src = url;
  });
}
function redimensionner(img, cote) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; // image ou canvas
  const r = Math.min(1, cote / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * r); c.height = Math.round(h * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}
// Niveaux de gris + contraste renforcé : améliore nettement la reconnaissance des photos
function preparerPourLecture(img) {
  const c = redimensionner(img, 2200), ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.5 + 140));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

// ---------- Lecture de la facture (OCR gratuit dans le navigateur : Tesseract.js) ----------
const OCR = window.OCR_CHEMINS || {
  script: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
  corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
  langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int",
  pdfScript: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
};
function chargerTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = OCR.script; s.onload = ok; s.onerror = () => ko(new Error("chargement"));
    document.head.appendChild(s);
  });
}
// Deux lectures avec des découpages de page différents (bloc unique / colonnes) :
// selon la mise en page de la facture, l'une ou l'autre perd moins de lignes.
const MODES_LECTURE = ["6", "4"];
async function lireTexte(canvas, progression) {
  await chargerTesseract();
  let passe = 0;
  const worker = await Tesseract.createWorker("fra", 1, {
    workerPath: OCR.workerPath, corePath: OCR.corePath, langPath: OCR.langPath,
    logger: m => {
      if (m.status === "recognizing text") progression(0.25 + (passe + m.progress) / MODES_LECTURE.length * 0.75, "Lecture du texte…");
      else if (/load|initializ/.test(m.status)) progression(Math.min(0.25, (m.progress || 0) * 0.25), "Préparation (première fois : un peu plus long)…");
    },
  });
  try {
    const textes = [];
    for (const psm of MODES_LECTURE) {
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: "1" });
      textes.push((await worker.recognize(canvas)).data.text);
      passe++;
    }
    return textes;
  } finally { worker.terminate(); }
}
// Garde l'analyse qui explique le mieux le total (plus petit reste non attribué), puis la plus complète
function meilleureAnalyse(textes, plan) {
  const score = r => [r.total ? Math.abs(r.reste) : Infinity, -Object.keys(r.ops).length, -(!!r.date + !!r.km)];
  return textes.map(t => analyserFacture(t, plan)).sort((a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
    return 0;
  })[0];
}

// --- Analyse du texte reconnu ---
const sansAccents = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const RE_DATE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g;
const RE_MONTANT = /(\d{1,3}(?:[   .]\d{3})+|\d+)[,.](\d{2})(?!\d)/g;
const MOIS_FR = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const montantsLigne = l => [...l.replace(RE_DATE, " ").matchAll(RE_MONTANT)]
  .map(m => Number(m[1].replace(/[   .]/g, "") + "." + m[2]));
const iso = (a, m, j) => `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;

function trouverDate(lignes) {
  const cands = [];
  lignes.forEach((l, idx) => {
    const s = sansAccents(l), prio = /date|factur|emis/.test(s) ? 0 : 1;
    for (const m of s.matchAll(RE_DATE)) {
      const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      cands.push({ a, m: Number(m[2]), j: Number(m[1]), prio, idx });
    }
    for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})\\b`, "g")))
      cands.push({ a: Number(m[3]), m: MOIS_FR.indexOf(m[2]) + 1, j: Number(m[1]), prio, idx });
  });
  const ok = cands
    .filter(c => c.m >= 1 && c.m <= 12 && c.j >= 1 && c.j <= 31 && c.a >= 1990 && iso(c.a, c.m, c.j) <= aujourdhui())
    .sort((x, y) => x.prio - y.prio || x.idx - y.idx);
  return ok.length ? iso(ok[0].a, ok[0].m, ok[0].j) : null;
}
function trouverKm(lignes) {
  const nombre = "(\\d{1,3}(?:[ \\u00a0\\u202f.]\\d{3})+|\\d{3,7})";
  for (const l of lignes) {
    const s = sansAccents(l);
    const m = s.match(new RegExp(`(?:kilometrage|kilometres|compteur|km)\\s*[:.]?\\s*${nombre}`))
      || s.match(new RegExp(`${nombre}\\s*(?:km|kms)\\b`));
    if (m) { const n = Number(m[1].replace(/\D/g, "")); if (n >= 100 && n < 2e6) return n; }
  }
  return null;
}
function trouverTotal(lignes, motif) {
  for (const l of [...lignes].reverse()) {
    if (!motif.test(sansAccents(l))) continue;
    const ms = montantsLigne(l);
    if (ms.length) return ms[ms.length - 1];
  }
  return null;
}
function trouverGarage(lignes) {
  return lignes.slice(0, 5).map(l => l.trim()).find(l => {
    const s = sansAccents(l);
    return (l.match(/[a-zà-ÿ]/gi) || []).length >= 4 && l.length <= 40
      && !/factur|devis|date|client|tel|n[°o]|siret|page|www|@/.test(s);
  }) || null;
}
// Mots-clés qui relient une ligne de facture à une opération du plan
const SYNONYMES = [
  ["vidange", ["vidange", "huile moteur", "huile"]],
  ["filtre a huile", ["filtre a huile", "filtre huile", "filtre d'huile", "filtre de huile"]],
  ["habitacle", ["habitacle", "pollen", "microfiltre"]],
  ["filtre a air", ["filtre a air", "filtre air", "filtre d'air"]],
  ["carburant", ["carburant", "gazole", "gasoil", "filtre a gaz"]],
  ["liquide de frein", ["liquide de frein", "liquide frein", "dot 4", "dot4", "purge"]],
  ["plaquette", ["plaquette"]],
  ["pneu", ["pneu"]],
  ["controle technique", ["controle technique"]],
  ["chaine", ["chaine", "graissage"]],
  ["bougie", ["bougie"]],
  ["soupape", ["soupape"]],
  ["refroidissement", ["refroidissement", "antigel", "anti-gel"]],
  ["durite", ["durite"]],
  ["courroie", ["courroie"]],
];
function motsCles(type) {
  const t = sansAccents(type), k = new Set([t]);
  SYNONYMES.forEach(([cle, syn]) => { if (t.includes(cle)) syn.forEach(x => k.add(x)); });
  return [...k];
}
function analyserFacture(texte, plan) {
  const lignes = texte.split(/\n/).map(l => l.trim()).filter(Boolean);
  const res = { date: trouverDate(lignes), km: trouverKm(lignes), garage: trouverGarage(lignes), total: null, ops: {}, reste: 0 };
  res.total = trouverTotal(lignes, /net a payer|a payer|total\s*t\.?t\.?c|montant\s*t\.?t\.?c|\bttc\b/);
  const ht = trouverTotal(lignes, /total\s*h\.?t\b|montant\s*h\.?t\b/);

  const recap = /total|tva|t\.v\.a|net a payer|a payer|acompte|remise|sous-total|solde|\bht\b|\bttc\b/;
  const cles = plan.map(p => ({ id: p.id, mots: motsCles(p.type) }));
  let sommeLignes = 0;
  lignes.forEach(l => {
    const s = sansAccents(l);
    if (recap.test(s)) return;
    const ms = montantsLigne(l), montant = ms.length ? ms[ms.length - 1] : 0;
    sommeLignes += montant;
    // l'opération dont le mot-clé reconnu est le plus long l'emporte (« filtre à huile » plutôt que « huile »)
    let meilleur = null, long = 0;
    cles.forEach(c => c.mots.forEach(m => { if (s.includes(m) && m.length > long) { meilleur = c.id; long = m.length; } }));
    if (meilleur) res.ops[meilleur] = (res.ops[meilleur] || 0) + montant;
  });
  // lignes en HT et total en TTC : on applique le taux pour obtenir des montants TTC
  if (res.total && ht && res.total > ht && Math.abs(sommeLignes - ht) < Math.abs(sommeLignes - res.total)) {
    const taux = res.total / ht;
    Object.keys(res.ops).forEach(id => { res.ops[id] = Math.round(res.ops[id] * taux * 100) / 100; });
  }
  if (res.total) {
    const reparti = Object.values(res.ops).reduce((a, b) => a + b, 0);
    if (Object.keys(res.ops).length === 1 && reparti === 0) res.ops[Object.keys(res.ops)[0]] = res.total;
    else res.reste = Math.round((res.total - reparti) * 100) / 100;
  }
  return res;
}

// --- Interface du scan ---
let photoEnCours = null; // { id, blob, url }

function retirerPhoto() {
  if (photoEnCours) URL.revokeObjectURL(photoEnCours.url);
  photoEnCours = null;
  $("#scan-etat").hidden = true;
  $("#bloc-scan").hidden = false;
}
function etatScan(titre, detail, progression) {
  $("#scan-titre").textContent = titre;
  $("#scan-detail").innerHTML = detail || "";
  $("#scan-progression").hidden = progression == null;
  if (progression != null) $("#scan-barre").style.width = Math.round(progression * 100) + "%";
}

// --- PDF (pdf.js, chargé à la demande) ---
const estPdf = f => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
function chargerPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = OCR.pdfScript;
    s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = OCR.pdfWorker; ok(); };
    s.onerror = () => ko(new Error("chargement"));
    document.head.appendChild(s);
  });
}
async function ouvrirPdf(blob) {
  await chargerPdfJs();
  return pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
}
async function rendrePage(pdf, n, largeur) {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale: largeur / page.getViewport({ scale: 1 }).width });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c;
}
// Texte d'un PDF numérique : les morceaux de texte sont regroupés en lignes selon leur hauteur
async function textePdf(pdf, maxPages = 5) {
  const lignes = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const items = (await (await pdf.getPage(n)).getTextContent()).items.filter(it => it.str && it.str.trim());
    const groupes = [];
    items.forEach(it => {
      const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
      let g = groupes.find(gr => Math.abs(gr.y - y) < h * 0.5);
      if (!g) groupes.push(g = { y, items: [] });
      g.items.push({ x, str: it.str });
    });
    groupes.sort((a, b) => b.y - a.y).forEach(g =>
      lignes.push(g.items.sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim()));
  }
  return lignes.join("\n");
}

// Plusieurs lectures OCR : on garde la meilleure et on complète date/km/garage avec les autres
function combinerAnalyses(textes) {
  const r = meilleureAnalyse(textes, V().plan);
  const autres = textes.map(t => analyserFacture(t, V().plan));
  r.date = r.date || autres.map(x => x.date).find(Boolean) || null;
  r.km = r.km || autres.map(x => x.km).find(Boolean) || null;
  r.garage = r.garage || autres.map(x => x.garage).find(Boolean) || null;
  return r;
}
function afficherScan(url) {
  if (url) $("#scan-miniature").src = url; else $("#scan-miniature").removeAttribute("src");
  $("#bloc-scan").hidden = true;
  $("#scan-etat").hidden = false;
}
const messageErreur = err => err && err.message === "chargement"
  ? "Pas de connexion pour charger l'outil de lecture." : "Le texte n'a pas pu être lu.";

$("#i-photo").addEventListener("change", async e => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (!fichier) return;
  if (estPdf(fichier)) return traiterPdf(fichier);

  let img;
  try { img = await chargerImage(fichier); } catch { return toast("⚠️ Image illisible"); }
  const blob = await new Promise(ok => redimensionner(img, 1600).toBlob(ok, "image/jpeg", 0.72));
  retirerPhoto();
  const enCours = photoEnCours = { id: "f-" + uid(), blob, url: URL.createObjectURL(blob) };
  afficherScan(enCours.url);
  if (idEdition) { etatScan("Facture jointe", "Elle sera rattachée à cette opération à l'enregistrement."); return; }

  etatScan("Lecture de la facture…", "Préparation…", 0);
  try {
    const textes = await lireTexte(preparerPourLecture(img), (p, msg) => { if (photoEnCours === enCours) etatScan("Lecture de la facture…", msg, p); });
    if (photoEnCours !== enCours) return; // photo retirée pendant la lecture
    preremplir(combinerAnalyses(textes));
  } catch (err) {
    if (photoEnCours !== enCours) return;
    etatScan("Lecture impossible", `<span class="scan-alerte">${messageErreur(err)}</span> La photo reste jointe : remplis le formulaire à la main.`);
  }
});

async function traiterPdf(fichier) {
  if (fichier.size > 15e6) return toast("⚠️ PDF trop lourd (15 Mo maximum)");
  retirerPhoto();
  const blob = fichier.type === "application/pdf" ? fichier : new Blob([fichier], { type: "application/pdf" });
  const enCours = photoEnCours = { id: "f-" + uid(), blob, url: "" };
  afficherScan(null);
  etatScan("Ouverture du PDF…", "", 0.05);
  let pdf;
  try { pdf = await ouvrirPdf(blob); }
  catch (err) {
    if (photoEnCours !== enCours) return;
    retirerPhoto();
    return toast(err.message === "chargement" ? "⚠️ Pas de connexion pour ouvrir le PDF" : "⚠️ PDF illisible");
  }
  if (photoEnCours !== enCours) return;
  try { enCours.url = (await rendrePage(pdf, 1, 240)).toDataURL("image/jpeg", 0.7); $("#scan-miniature").src = enCours.url; } catch (e) { /* pas d'aperçu */ }
  if (idEdition) { etatScan("Facture PDF jointe", "Elle sera rattachée à cette opération à l'enregistrement."); return; }

  try {
    const texte = await textePdf(pdf);
    if (photoEnCours !== enCours) return;
    if (texte.replace(/\s/g, "").length >= 40) { preremplir(analyserFacture(texte, V().plan)); return; }
    // PDF scanné (image sans texte) : lecture de la première page comme une photo
    const page = await rendrePage(pdf, 1, 2200);
    const textes = await lireTexte(preparerPourLecture(page), (p, msg) => { if (photoEnCours === enCours) etatScan("Lecture du PDF scanné…", msg, p); });
    if (photoEnCours !== enCours) return;
    preremplir(combinerAnalyses(textes));
  } catch (err) {
    if (photoEnCours !== enCours) return;
    etatScan("Lecture impossible", `<span class="scan-alerte">${messageErreur(err)}</span> Le PDF reste joint : remplis le formulaire à la main.`);
  }
}
$("#scan-retirer").addEventListener("click", retirerPhoto);

function preremplir(r) {
  const trouve = [], manque = [];
  if (r.date) { $("#i-date").value = r.date; trouve.push("date"); } else manque.push("date");
  if (r.km) { $("#i-km").value = r.km; trouve.push("kilométrage"); } else manque.push("kilométrage");
  if (r.garage && !$("#i-garage").value) $("#i-garage").value = r.garage;

  choix = {};
  Object.entries(r.ops).forEach(([id, montant]) => { choix[id] = { coche: true, cout: montant ? montant.toFixed(2) : "" }; });
  if (r.reste > 0.5) choix.autre = { coche: true, nom: "Main d'œuvre et divers", cout: r.reste.toFixed(2) };
  rendreChoix();

  const nbOps = Object.keys(r.ops).length;
  const lignes = [
    trouve.length ? `Trouvé : ${trouve.join(", ")}${r.total ? ` · total ${eur(r.total)}` : ""}` : (r.total ? `Total ${eur(r.total)}` : ""),
    nbOps ? `${nbOps} opération${nbOps > 1 ? "s" : ""} reconnue${nbOps > 1 ? "s" : ""}` : `<span class="scan-alerte">Aucune opération reconnue : coche-les ci-dessous.</span>`,
    manque.length ? `<span class="scan-alerte">À compléter : ${manque.join(", ")}</span>` : "",
  ].filter(Boolean);
  etatScan("Facture lue : vérifie les informations", lignes.join("<br>"));
}

// Visionneuse (photo ou PDF multi-pages)
function viderVisionneuse() {
  const c = $("#visio-cadre");
  if (c.dataset.url) { URL.revokeObjectURL(c.dataset.url); delete c.dataset.url; }
  c.innerHTML = "";
  c.classList.remove("zoom", "pages");
}
async function ouvrirFacture(id) {
  let blob = null;
  try { blob = await Photos.lire(id); } catch (e) { /* ignoré */ }
  if (!blob) return toast("Facture introuvable sur cet appareil");
  viderVisionneuse();
  const cadre = $("#visio-cadre");
  $("#visionneuse").hidden = false;
  if (blob.type === "application/pdf") {
    cadre.classList.add("pages");
    cadre.innerHTML = '<p class="visio-chargement">Ouverture du PDF…</p>';
    try {
      const pdf = await ouvrirPdf(blob);
      cadre.innerHTML = "";
      for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
        const img = new Image();
        img.alt = `Page ${n}`;
        img.src = (await rendrePage(pdf, n, 1400)).toDataURL("image/jpeg", 0.85);
        cadre.appendChild(img);
      }
    } catch (e) {
      cadre.innerHTML = '<p class="visio-chargement">Impossible d\'afficher le PDF (connexion ?).</p>';
    }
  } else {
    cadre.dataset.url = URL.createObjectURL(blob);
    cadre.innerHTML = `<img src="${cadre.dataset.url}" alt="Facture">`;
  }
}
$("#visio-fermer").addEventListener("click", () => { $("#visionneuse").hidden = true; viderVisionneuse(); });
$("#visio-cadre").addEventListener("click", e => { if (e.target.tagName === "IMG") $("#visio-cadre").classList.toggle("zoom"); });

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
    $("#scan-libelle").textContent = i.facture ? "Remplacer la facture (photo ou PDF)" : "Joindre la facture (photo ou PDF)";
    $("#scan-aide").textContent = "La facture sera rattachée à cette opération.";
    allerOnglet("ajouter");
  }
  if (b.dataset.facture) ouvrirFacture(b.dataset.facture);
  if (b.dataset.del && confirm("Supprimer cette opération de l'historique ?")) {
    v.interventions = v.interventions.filter(x => x.id !== b.dataset.del);
    sauver(); rendre(); nettoyerPhotos(); toast("Opération supprimée");
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
  nettoyerPhotos();
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
    data = d; sauver(); resetFormInterv(); rendre(); nettoyerPhotos(); toast("Import réussi");
  } catch { toast("⚠️ Fichier invalide"); }
});
$("#btn-reset").addEventListener("click", () => {
  if (confirm("Effacer tous les véhicules et tout l'historique ? Pense à exporter avant.")) {
    data = etatVide(); sauver(); resetFormInterv(); rendre(); nettoyerPhotos(); toast("Données effacées");
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
  if (idEdition || selection().length || photoEnCours) return; // saisie en cours : on ne la perd pas
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
