# Suivi garage

Application web pour suivre l'entretien de sa voiture, sans installation ni compte.

## Fonctionnalités

- **Tableau de bord** : kilométrage actuel, prochains entretiens avec un statut (en retard, bientôt, à jour), coûts (total, année en cours, coût pour 1 000 km, répartition par type).
- **Ajouter** : on coche une ou plusieurs opérations (ou « Autre »), avec le coût de chacune ; date, kilométrage, garage et remarques sont communs. Le bouton « Fait » d'un rappel ouvre ce formulaire avec l'opération déjà cochée.
- **Historique** : entretiens regroupés par visite, modifiables et supprimables, avec recherche.
- **Plusieurs véhicules** : chacun a son kilométrage, son historique et son plan d’entretien ; on passe de l’N à l’utre depuis le titre en haut de l’écran.
- **Plan d'entretien** : périodicités en km et/ou en mois, modifiables (valeurs par défaut indicatives).
- **Véhicules** : marque, modèle, immatriculation, mise en circulation, plan d'entretien du véhicule.
- **Sauvegarde** : export/import JSON, export CSV de l'historique (lisible dans Excel).

Un rappel passe en « Bientôt » à moins de 1 000 km ou de 30 jours de l'échéance.

## Utilisation

Ouvre `index.html` dans un navigateur. Les données restent dans le navigateur (localStorage) :
exporte-les régulièrement pour ne pas les perdre.

Pour l'utiliser en ligne (téléphone compris), active GitHub Pages sur le dépôt :
*Settings → Pages → Deploy from a branch*.
