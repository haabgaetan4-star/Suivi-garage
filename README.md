# Suivi garage

Application web pour suivre l'entretien de sa voiture, sans installation ni compte.

## Fonctionnalités

- **Tableau de bord** : kilométrage actuel, prochains entretiens avec un statut (en retard, bientôt, à jour), coûts (total, année en cours, coût pour 1 000 km, répartition par type).
- **Ajouter un entretien** : on coche une ou plusieurs opérations du plan (ou « Autre »), avec le coût de chacune ; la date, le kilométrage, le garage et les détails sont communs. Le bouton « + » d'un rappel du tableau de bord ouvre ce formulaire avec l'opération déjà cochée. L'historique, en dessous, permet de modifier, supprimer et filtrer les interventions.
- **Plan d'entretien** : périodicités en km et/ou en mois, modifiables (valeurs par défaut indicatives).
- **Véhicule** : marque, modèle, immatriculation, date de mise en circulation.
- **Sauvegarde** : export/import JSON, export CSV de l'historique (lisible dans Excel).

Un rappel passe en « Bientôt » à moins de 1 000 km ou de 30 jours de l'échéance.

## Utilisation

Ouvre `index.html` dans un navigateur. Les données restent dans le navigateur (localStorage) :
exporte-les régulièrement pour ne pas les perdre.

Pour l'utiliser en ligne (téléphone compris), active GitHub Pages sur le dépôt :
*Settings → Pages → Deploy from a branch*.
