"use strict";

const CLE = "suivi-garage-v1";
const SEUIL_KM = 1000;   // alerte « bientôt » à moins de 1 000 km
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

// ---------- Données ----------
let data = charger();

function etatVide() {
  return {
    vehicule: { marque: "", modele: "", immat: "", mec: "" },
    km: { valeur: null, date: null },
    interventions: [],
    plan: PLAN_DEFAUT.map(p => ({ id: uid(), ...p })),
  };
}
function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return { ...etatVide(), ...JSON.parse(brut) };
  } catch (e) { /* stockage indisponible */ }
  return etatVide();
}
function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(data)); }
  catch (e) { toast("⚠️ Impossible d'enregistrer dans ce navigateur"); }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---------- Utilitaires ----------
const $ = s => document.querySelector(s);
const eur = n => (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const kmFmt = n => n == null ? "–" : Math.round(n).toLocaleString("fr-FR") + " km";
const dateFmt = d => d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR") : "–";
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const norm = s => (s || "").trim().toLowerCase();
function ajouterMois(iso, mois) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + mois);
  return d;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// Kilométrage de référence : le plus élevé entre la saisie manuelle et les interventions
function kmCourant() {
  const kms = data.interventions.map(i => i.km);
  if (data.km.valeur != null) kms.push(data.km.valeur);
  return kms.length ? Math.max(...kms) : null;
}

// ---------- Rappels ----------
function calculerRappels() {
  const km = kmCourant();
  const today = new Date(aujourdhui() + "T00:00:00");
  return data.plan.map(p => {
    const faites = data.interventions
      .filter(i => norm(i.type) === norm(p.type))
      .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km);
    const der = faites[0];
    const r = { plan: p, derniere: der, statut: "none", texte: "Jamais enregistré", score: Infinity };
    if (!der) return r;

    const echKm = p.km ? der.km + p.km : null;
    const echDate = p.mois ? ajouterMois(der.date, p.mois) : null;
    const resteKm = echKm != null && km != null ? echKm - km : null;
    const resteJ = echDate ? Math.round((echDate - today) / 86400000) : null;

    const parts = [];
    if (echKm != null) parts.push(`à ${kmFmt(echKm)}` + (resteKm != null ? ` (${resteKm >= 0 ? "reste " + kmFmt(resteKm) : "dépassé de " + kmFmt(-resteKm)})` : ""));
    if (echDate) parts.push(`le ${echDate.toLocaleDateString("fr-FR")}` + ` (${resteJ >= 0 ? "dans " + resteJ + " j" : "retard " + -resteJ + " j"})`);
    r.texte = parts.join(" ou ") || "Pas de périodicité";

    const enRetard = (resteKm != null && resteKm <= 0) || (resteJ != null && resteJ <= 0);
    const bientot = (resteKm != null && resteKm <= SEUIL_KM) || (resteJ != null && resteJ <= SEUIL_JOURS);
    r.statut = enRetard ? "late" : bientot ? "soon" : "ok";
    // score pour trier : ce qui arrive le plus tôt en premier
    r.score = Math.min(resteKm != null ? resteKm / 50 : Infinity, resteJ != null ? resteJ : Infinity);
    return r;
  });
}

// ---------- Rendu ----------
const LIB_STATUT = { late: "En retard", soon: "Bientôt", ok: "À jour", none: "À renseigner" };
const ORDRE_STATUT = { late: 0, soon: 1, ok: 2, none: 3 };

function rendre() {
  const v = data.vehicule;
  const nom = [v.marque, v.modele].filter(Boolean).join(" ");
  $("#resume-vehicule").textContent = nom
    ? `${nom}${v.immat ? " · " + v.immat : ""} · ${kmFmt(kmCourant())}`
    : "Renseigne ton véhicule dans l'onglet « Véhicule »";

  // Km
  $("#km-actuel").placeholder = kmCourant() != null ? kmCourant() : "ex. 85000";
  $("#km-date").textContent = data.km.date ? `Dernier relevé : ${kmFmt(data.km.valeur)} le ${dateFmt(data.km.date)}` : "";

  // Rappels
  const rappels = calculerRappels().sort((a, b) => ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut] || a.score - b.score);
  $("#liste-rappels").innerHTML = rappels.length ? rappels.map(r => `
    <li>
      <div><strong>${esc(r.plan.type)}</strong><br>
        <span class="muted">${r.derniere ? `Fait le ${dateFmt(r.derniere.date)} à ${kmFmt(r.derniere.km)} · prochain ${esc(r.texte)}` : esc(r.texte)}</span>
      </div>
      <span class="droite">
        <span class="badge ${r.statut}">${LIB_STATUT[r.statut]}</span>
        <button class="secondary plus" data-ajout="${r.plan.id}" title="Enregistrer cet entretien">+</button>
      </span>
    </li>`).join("") : `<li class="muted">Aucune opération dans le plan d'entretien.</li>`;

  // Coûts
  const ints = data.interventions;
  const total = ints.reduce((s, i) => s + (i.cout || 0), 0);
  const an = aujourdhui().slice(0, 4);
  const totalAn = ints.filter(i => i.date.startsWith(an)).reduce((s, i) => s + (i.cout || 0), 0);
  $("#kpi-total").textContent = eur(total);
  $("#kpi-annee").textContent = eur(totalAn);
  const kms = ints.map(i => i.km);
  const parcourus = kms.length ? kmCourant() - Math.min(...kms) : 0;
  $("#kpi-km").textContent = parcourus > 0 ? eur(total / parcourus * 1000) : "–";

  const parType = {};
  ints.forEach(i => { parType[i.type] = (parType[i.type] || 0) + (i.cout || 0); });
  const lignes = Object.entries(parType).sort((a, b) => b[1] - a[1]);
  $("#table-couts-type").innerHTML = lignes.length
    ? `<thead><tr><th>Par type</th><th class="num">Montant</th><th class="num">%</th></tr></thead><tbody>` +
      lignes.map(([t, m]) => `<tr><td>${esc(t)}</td><td class="num">${eur(m)}</td><td class="num">${(total ? m / total * 100 : 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</td></tr>`).join("") + "</tbody>"
    : "";

  // Historique
  const f = norm($("#filtre").value);
  const liste = [...ints]
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)
    .filter(i => !f || [i.type, i.description, i.garage].some(x => norm(x).includes(f)));
  $("#table-interv tbody").innerHTML = liste.map(i => `
    <tr>
      <td>${dateFmt(i.date)}</td>
      <td class="num">${kmFmt(i.km)}</td>
      <td>${esc(i.type)}</td>
      <td>${esc(i.description)}${i.garage ? `<br><span class="muted">${esc(i.garage)}</span>` : ""}</td>
      <td class="num">${eur(i.cout)}</td>
      <td class="num"><button class="link" data-edit="${i.id}">Modifier</button><button class="link del" data-del="${i.id}">Suppr.</button></td>
    </tr>`).join("");
  $("#vide-interv").hidden = ints.length > 0;

  rendreChoix();

  // Plan
  $("#table-plan tbody").innerHTML = data.plan.map(p => `
    <tr>
      <td>${esc(p.type)}</td>
      <td><input type="number" min="0" data-plan="${p.id}" data-champ="km" value="${p.km ?? ""}"></td>
      <td><input type="number" min="0" data-plan="${p.id}" data-champ="mois" value="${p.mois ?? ""}"></td>
      <td><button class="link del" data-delplan="${p.id}">Suppr.</button></td>
    </tr>`).join("");

  // Véhicule
  $("#v-marque").value = v.marque; $("#v-modele").value = v.modele;
  $("#v-immat").value = v.immat; $("#v-mec").value = v.mec;
}

// ---------- Sélection des entretiens (onglet « Ajouter un entretien ») ----------
// choix : clé (id d'opération du plan, ou "autre") -> { coche, cout, nom }
let choix = {};
let idEdition = null; // id de l'intervention en cours de modification

function rendreChoix() {
  const statuts = Object.fromEntries(calculerRappels().map(r => [r.plan.id, r.statut]));
  const lignes = data.plan.map(p => ({ cle: p.id, type: p.type, statut: statuts[p.id] }));
  lignes.push({ cle: "autre" });
  $("#choix-entretiens").innerHTML = lignes.map(l => {
    const c = choix[l.cle] || {};
    const off = c.coche ? "" : "disabled";
    return `<li class="${c.coche ? "coche" : ""}">
      <label>
        <input type="checkbox" data-cle="${l.cle}" ${c.coche ? "checked" : ""}>
        ${l.type ? `<span>${esc(l.type)}</span><span class="badge ${l.statut}">${LIB_STATUT[l.statut]}</span>` : "<span>Autre</span>"}
      </label>
      ${l.type ? "" : `<input type="text" data-cle="autre" data-champ="nom" placeholder="ex. Réparation, batterie…" value="${esc(c.nom || "")}" ${off}>`}
      <input type="number" min="0" step="0.01" data-cle="${l.cle}" data-champ="cout" placeholder="Coût TTC €" value="${c.cout ?? ""}" ${off}>
    </li>`;
  }).join("");
  majTotal();
}

function selection() {
  const ids = new Set(data.plan.map(p => p.id));
  return Object.entries(choix).filter(([cle, c]) => c.coche && (cle === "autre" || ids.has(cle)));
}
function majTotal() {
  const sel = selection();
  const total = sel.reduce((s, [, c]) => s + (Number(c.cout) || 0), 0);
  $("#i-total").textContent = sel.length
    ? `${sel.length} opération${sel.length > 1 ? "s" : ""} · total ${eur(total)}` : "";
}

$("#choix-entretiens").addEventListener("change", e => {
  const cb = e.target;
  if (cb.type !== "checkbox") return;
  const cle = cb.dataset.cle;
  // En modification, une intervention ne porte que sur une seule opération
  if (idEdition && cb.checked) Object.values(choix).forEach(c => { c.coche = false; });
  choix[cle] = { ...choix[cle], coche: cb.checked };
  rendreChoix();
  if (cb.checked) {
    const champ = cle === "autre" ? `[data-cle="autre"][data-champ="nom"]` : `[data-cle="${cle}"][data-champ="cout"]`;
    $("#choix-entretiens " + champ).focus();
  }
});
$("#choix-entretiens").addEventListener("input", e => {
  const { cle, champ } = e.target.dataset;
  if (!champ) return;
  choix[cle] = { ...choix[cle], [champ]: e.target.value };
  majTotal();
});

function allerOnglet(nom) {
  document.querySelectorAll(".tab, .panel").forEach(e => e.classList.remove("active"));
  $(`.tab[data-tab="${nom}"]`).classList.add("active");
  $("#" + nom).classList.add("active");
}

// ---------- Événements ----------
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => allerOnglet(b.dataset.tab)));

$("#liste-rappels").addEventListener("click", e => {
  const id = e.target.dataset.ajout;
  if (!id) return;
  resetFormInterv();
  choix = { [id]: { coche: true } };
  rendreChoix();
  allerOnglet("historique");
  $("#i-km").focus();
});

$("#form-km").addEventListener("submit", e => {
  e.preventDefault();
  const v = Number($("#km-actuel").value);
  const ref = kmCourant();
  if (ref != null && v < ref && !confirm(`Ce relevé (${kmFmt(v)}) est inférieur au kilométrage déjà connu (${kmFmt(ref)}). Continuer ?`)) return;
  data.km = { valeur: v, date: aujourdhui() };
  sauver(); $("#km-actuel").value = ""; rendre(); toast("Kilométrage mis à jour");
});

function resetFormInterv() {
  $("#form-interv").reset();
  idEdition = null;
  choix = {};
  $("#i-date").value = aujourdhui();
  if (kmCourant() != null) $("#i-km").value = kmCourant();
  $("#titre-form-interv").textContent = "Ajouter un entretien";
  $("#aide-choix").textContent = "Coche ce qui a été fait et indique le coût TTC de chaque opération.";
  $("#i-annuler").hidden = true;
  rendreChoix();
}

$("#form-interv").addEventListener("submit", e => {
  e.preventDefault();
  const sel = selection();
  if (!sel.length) return toast("Coche au moins un entretien");
  const operations = sel.map(([cle, c]) => ({
    type: cle === "autre" ? (c.nom || "").trim() : data.plan.find(p => p.id === cle).type,
    cout: Number(c.cout) || 0,
  }));
  if (operations.some(o => !o.type)) return toast("Précise le nom de l'opération « Autre »");

  const commun = {
    date: $("#i-date").value,
    km: Number($("#i-km").value),
    garage: $("#i-garage").value.trim(),
    description: $("#i-desc").value.trim(),
  };
  const modif = idEdition;
  if (modif) {
    const idx = data.interventions.findIndex(i => i.id === modif);
    data.interventions[idx] = { id: modif, ...commun, ...operations[0] };
  } else {
    operations.forEach(o => data.interventions.push({ id: uid(), ...commun, ...o }));
  }
  sauver(); resetFormInterv(); rendre();
  toast(modif ? "Entretien modifié"
    : operations.length > 1 ? `${operations.length} entretiens ajoutés` : "Entretien ajouté");
});
$("#i-annuler").addEventListener("click", resetFormInterv);

$("#table-interv").addEventListener("click", e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) {
    const i = data.interventions.find(x => x.id === ed);
    idEdition = i.id;
    $("#i-date").value = i.date; $("#i-km").value = i.km;
    $("#i-garage").value = i.garage || ""; $("#i-desc").value = i.description || "";
    const p = data.plan.find(x => norm(x.type) === norm(i.type));
    choix = p ? { [p.id]: { coche: true, cout: i.cout } } : { autre: { coche: true, cout: i.cout, nom: i.type } };
    rendreChoix();
    $("#titre-form-interv").textContent = "Modifier l'entretien";
    $("#aide-choix").textContent = "En modification, une seule opération peut être cochée.";
    $("#i-annuler").hidden = false;
    $("#form-interv").scrollIntoView({ behavior: "smooth" });
  }
  if (del && confirm("Supprimer cette intervention ?")) {
    data.interventions = data.interventions.filter(x => x.id !== del);
    sauver(); rendre(); toast("Intervention supprimée");
  }
});
$("#filtre").addEventListener("input", rendre);

$("#table-plan").addEventListener("change", e => {
  const id = e.target.dataset.plan;
  if (!id) return;
  const p = data.plan.find(x => x.id === id);
  p[e.target.dataset.champ] = e.target.value === "" ? null : Number(e.target.value);
  sauver(); rendre();
});
$("#table-plan").addEventListener("click", e => {
  const id = e.target.dataset.delplan;
  if (id && confirm("Retirer cette opération du plan ?")) {
    data.plan = data.plan.filter(x => x.id !== id); sauver(); rendre();
  }
});
$("#form-plan").addEventListener("submit", e => {
  e.preventDefault();
  const km = $("#p-km").value, mois = $("#p-mois").value;
  data.plan.push({ id: uid(), type: $("#p-type").value.trim(), km: km ? Number(km) : null, mois: mois ? Number(mois) : null });
  e.target.reset(); sauver(); rendre(); toast("Opération ajoutée");
});

$("#form-vehicule").addEventListener("submit", e => {
  e.preventDefault();
  data.vehicule = {
    marque: $("#v-marque").value.trim(), modele: $("#v-modele").value.trim(),
    immat: $("#v-immat").value.trim().toUpperCase(), mec: $("#v-mec").value,
  };
  sauver(); rendre(); toast("Véhicule enregistré");
});

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
  const lignes = [["Date", "Km", "Type", "Détails", "Garage", "Coût TTC"].map(q).join(";")];
  [...data.interventions].sort((a, b) => a.date.localeCompare(b.date)).forEach(i =>
    lignes.push([i.date, i.km, i.type, i.description, i.garage, String(i.cout).replace(".", ",")].map(q).join(";")));
  telecharger(`historique-${aujourdhui()}.csv`, "﻿" + lignes.join("\r\n"), "text/csv");
});
$("#btn-import").addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!Array.isArray(obj.interventions)) throw new Error();
    if (!confirm("Remplacer les données actuelles par celles du fichier ?")) return;
    data = { ...etatVide(), ...obj };
    sauver(); rendre(); toast("Import réussi");
  } catch { toast("⚠️ Fichier invalide"); }
  e.target.value = "";
});
$("#btn-reset").addEventListener("click", () => {
  if (confirm("Effacer toutes les données ? Pense à exporter avant.")) {
    data = etatVide(); sauver(); rendre(); toast("Données effacées");
  }
});

// Sélectionner le contenu d'un champ chiffré quand on clique dedans, pour le remplacer directement
document.addEventListener("focusin", e => {
  const el = e.target;
  if (el.tagName !== "INPUT" || el.type !== "number") return;
  el.select();
  setTimeout(() => { if (document.activeElement === el) el.select(); }, 0); // iOS
  // empêche le clic de replacer le curseur et d'annuler la sélection
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

resetFormInterv();
rendre();
