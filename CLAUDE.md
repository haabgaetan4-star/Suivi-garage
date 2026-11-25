# Suivi garage

Appli web statique (index.html, style.css, app.js) publiée par GitHub Pages depuis `main`.
Données dans le localStorage du navigateur (clé `suivi-garage-v1`) : ne jamais changer
cette clé ni le format des données sans migration, sinon l'utilisateur perd son historique.
Photos de factures et des véhicules : IndexedDB `suivi-garage-photos` (store `factures`), référencées par
`intervention.facture` et `vehicule.infos.modele3d` (modèle .glb importé, matériau nommé « peinture » recoloré).
Le carrousel n'affiche que des modèles 3D ; d'anciennes photos de véhicules (`infos.photo`) peuvent rester
stockées : ne pas les effacer, elles ne sont plus affichées.
Les modèles 3D importés (licence incertaine) restent sur l'appareil, jamais dans le dépôt. Ne jamais publier les photos
du propriétaire dans le dépôt (plaques d'immatriculation visibles). Lecture : texte des PDF avec pdf.js 3.11.174 (build UMD), OCR des photos et PDF scannés avec
Tesseract.js 5.1.1, tous deux chargés à la demande depuis jsDelivr
Modèles 3D de l'en-tête : Three.js r128 (cdnjs), modèles génériques construits dans le code
(`construireVoiture`, `construireMoto`), plus des modèles dédiés aux véhicules du propriétaire
(`MODELES_3D` : BMW Série 3 Touring E91 gris argent, Yamaha MT-09 2014-2016 gris mat), d'après ses photos, un seul contexte WebGL copié dans le canvas de chaque carte.
(versions figées dans `OCR` dans app.js ; `window.OCR_CHEMINS` permet de les servir en local pour les tests).

Pneus : `vehicule.pneus = { trains: [{id, saison, nom}], montages: [{id, train, date, km}] }` ; le train monté est
le dernier montage par date ; chaque montage crée une opération d'historique liée par `montagePneus`.

Direction artistique (palette tirée d'une image de référence du propriétaire) : fond noir pur #000 (sans halo,
à la demande du propriétaire), cartes #1a1413, accent cuivré #f8893a / #e76728 (dégradé sur les boutons, texte très sombre dessus),
doré #f1c467 pour « Bientôt », thème sombre uniquement ;
les couleurs sont des variables CSS en tête de style.css.

Icône de l'appli (clé + tournevis cuivrés sur fond noir) : dossier icones/ (SVG source, PNG 180/192/512/32,
manifest.webmanifest) ; régénérer les PNG depuis icone-carree.svg si le dessin change.

## Publication

- Le propriétaire autorise la publication directe sur `main`, sans pull request.
- Avant chaque publication, lancer `./maj-version.sh` : il change le numéro de version
  (version.json, meta `app-version`, liens `?v=`). L'appli compare ce numéro à
  version.json et se recharge seule si une nouvelle version est en ligne.
  Sans ce script, l'utilisateur continue de voir l'ancienne version.
- Langue de l'interface et des commits : français.
