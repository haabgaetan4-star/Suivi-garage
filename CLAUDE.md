# Suivi garage

Appli web statique (index.html, style.css, app.js) publiée par GitHub Pages depuis `main`.
Données dans le localStorage du navigateur (clé `suivi-garage-v1`) : ne jamais changer
cette clé ni le format des données sans migration, sinon l'utilisateur perd son historique.

## Publication

- Le propriétaire autorise la publication directe sur `main`, sans pull request.
- Avant chaque publication, lancer `./maj-version.sh` : il change le numéro de version
  (version.json, meta `app-version`, liens `?v=`). L'appli compare ce numéro à
  version.json et se recharge seule si une nouvelle version est en ligne.
  Sans ce script, l'utilisateur continue de voir l'ancienne version.
- Langue de l'interface et des commits : français.
