#!/usr/bin/env bash
# Attribue un nouveau numéro de version à l'appli, à lancer avant chaque publication.
# Met à jour version.json, la balise <meta name="app-version"> et les liens ?v= de index.html.
set -euo pipefail
cd "$(dirname "$0")"
V=$(date -u +%Y%m%d%H%M%S)
printf '{ "version": "%s" }\n' "$V" > version.json
sed -i -E \
  -e "s/(<meta name=\"app-version\" content=\")[^\"]*/\1$V/" \
  -e "s/(href=\"style\.css\?v=)[^\"]*/\1$V/" \
  -e "s/(src=\"app\.js\?v=)[^\"]*/\1$V/" \
  index.html
echo "Version $V"
