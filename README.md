# Suivi garage

Application web pour suivre l'entretien de sa voiture, sans installation ni compte.

## Fonctionnalités

- **Tableau de bord** : kilométrage actuel, prochains entretiens avec un statut (en retard, bientôt, à jour), coûts (total, année en cours, coût pour 1 000 km, répartition par type).
- **Ajouter** : on coche une ou plusieurs opérations (ou « Autre »), avec le coût de chacune ; date, kilométrage, garage et remarques sont communs. Le bouton « Fait » d'un rappel ouvre ce formulaire avec l'opération déjà cochée.
- **Scan de facture** : photo ou PDF de la facture. Un PDF numérique est lu directement (pdf.js), une photo ou un PDF scanné est lu par OCR sur le téléphone (Tesseract.js, gratuit, sans compte) ; date, kilométrage, garage, opérations et montants sont préremplis, à vérifier avant d'enregistrer. La photo ou le PDF est conservé sur l'appareil (IndexedDB) et consultable depuis l'historique ; elle n'est pas incluse dans l'export JSON.
- **Historique** : entretiens regroupés par visite, modifiables et supprimables, avec recherche.
- **Plusieurs véhicules** : chacun a son kilométrage, son historique et son plan d'entretien. En haut de l'écran, un carrousel montre chaque véhicule en 3D (modèle .glb importé dans l'onglet Véhicules et conservé sur l'appareil, ou à défaut un modèle stylisé) ; le véhicule affiché tourne, les autres reviennent de trois quarts avant, et ses infos s'affichent sous le carrousel ; on touche une carte pour l'afficher.
- **Plan d'entretien** : périodicités en km et/ou en mois, modifiables (valeurs par défaut indicatives).
- **Véhicules** : marque, modèle, immatriculation, mise en circulation, plan d'entretien du véhicule.
- **Sauvegarde** : export/import JSON, export CSV de l'historique (lisible dans Excel).

Un rappel passe en « Bientôt » à moins de 1 000 km ou de 30 jours de l'échéance.

## Utilisation

Ouvre `index.html` dans un navigateur. Les données restent dans le navigateur (localStorage) :
exporte-les régulièrement pour ne pas les perdre.

Pour l'utiliser en ligne (téléphone compris), active GitHub Pages sur le dépôt :
*Settings → Pages → Deploy from a branch*.
