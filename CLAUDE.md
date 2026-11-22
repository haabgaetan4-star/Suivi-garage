# Suivi garage

Appli web statique (index.html, style.css, app.js) publiée par GitHub Pages depuis `main`.
Données dans le localStorage du navigateur (clé `suivi-garage-v1`) : ne jamais changer
cette clé ni le format des données sans migration, sinon l'utilisateur perd son historique.
Photos de factures et des véhicules : IndexedDB `suivi-garage-photos` (store `factures`), référencées par
`intervention.facture`, `vehicule.infos.photo` (cadrage dans `infos.cadrage`) et `vehicule.infos.modele3d`
(modèle .glb importé, affiché si `infos.affichage` n'est pas "photo" ; matériau nommé « peinture » recoloré).
Les modèles 3D importés (licence incertaine) restent sur l'appareil, jamais dans le dépôt. Ne jamais publier les photos
du propriétaire dans le dépôt (plaques d'immatriculation visibles). Lecture : texte des PDF avec pdf.js 3.11.174 (build UMD), OCR des photos et PDF scannés avec
Tesseract.js 5.1.1, tous deux chargés à la demande depuis jsDelivr
Modèles 3D de l'en-tête : Three.js r128 (cdnjs), modèles génériques construits dans le code
(`construireVoiture`, `construireMoto`), plus des modèles dédiés aux véhicules du propriétaire
(`MODELES_3D` : BMW Série 3 Touring E91 gris argent, Yamaha MT-09 2014-2016 gris mat), d'après ses photos, un seul contexte WebGL copié dans le canvas de chaque carte.
(versions figées dans `OCR` dans app.js ; `window.OCR_CHEMINS` permet de les servir en local pour les tests).

## Publication

- Le propriétaire autorise la publication directe sur `main`, sans pull request.
- Avant chaque publication, lancer `./maj-version.sh` : il change le numéro de version
  (version.json, meta `app-version`, liens `?v=`). L'appli compare ce numéro à
  version.json et se recharge seule si une nouvelle version est en ligne.
  Sans ce script, l'utilisateur continue de voir l'ancienne version.
- Langue de l'interface et des commits : français.
