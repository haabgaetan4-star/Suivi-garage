# Suivi garage

Application web pour suivre l'entretien de sa voiture, sans installation ni compte.

## Fonctionnalités

- **Tableau de bord** : kilométrage actuel, prochains entretiens avec un statut (en retard, bientôt, à jour), coûts (total, année en cours, coût pour 1 000 km, répartition par type).
- **Historique** : ajout, modification et suppression des interventions (date, km, type, coût, garage, détails), avec un filtre de recherche.
- **Plan d'entretien** : périodicités en km et/ou en mois, modifiables (valeurs par défaut indicatives).
- **Véhicule** : marque, modèle, immatriculation, date de mise en circulation.
- **Sauvegarde** : export/import JSON, export CSV de l'historique (lisible dans Excel).

Un rappel passe en « Bientôt » à moins de 1 000 km ou de 30 jours de l'échéance.

## Utilisation

Ouvre `index.html` dans un navigateur. Les données restent dans le navigateur (localStorage) :
exporte-les régulièrement pour ne pas les perdre.

Pour l'utiliser en ligne (téléphone compris), active GitHub Pages sur le dépôt :
*Settings → Pages → Deploy from a branch*.
