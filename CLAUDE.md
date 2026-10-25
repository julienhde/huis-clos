# Huis Clos

Casse-tête logique de déduction sur plan, inspiré d'une série de livres : placer les suspects sur un plan, démasquer le coupable.
Projet perso de Julien, d'abord pour sa sœur (qui joue aux livres papier et sert de testeuse).
Idée à plus long terme : proposer une version mobile à l'auteur. D'où la règle : rien de publié avec son nom ou ses grilles.

## Stack

- Site 100 % statique, sans build ni backend. Modules ES natifs. Déploiement sur GitHub Pages (comme le Boggle de Julien).
- PWA : `manifest.json` + `sw.js`. **Incrémenter `VERSION` dans `sw.js` à chaque changement de JS, CSS ou HTML**, sinon les téléphones gardent l'ancienne version.
- En local : `python3 -m http.server` ou `npx serve .`. Ne pas ouvrir `index.html` en `file://`, les `fetch` des grilles échoueraient.

## Fichiers

- `js/rules.js` : modèle, règles, types d'objets (`OBJECTS`), indices typés, solveur (backtracking + rôles inconnus), textes FR des indices. Partagé navigateur et node.
- `js/art.js` : rendu visuel. Sols par type de pièce, dessins SVG des objets par thème (`THEMES`).
- `js/app.js` : interface (crayon, barrer, gomme, annuler, vérifier, sauvegarde localStorage, choix du thème, légende).
- `style.css` : thème de l'interface, plan, puis section « Thèmes visuels » scopée par `.t-<thème>`.
- `tools/check.mjs` : `node tools/check.mjs puzzles/X.json` vérifie que la solution est unique. `--suggest [--seed=N]` propose un jeu d'indices minimal.
- `puzzles/` : grilles originales. `puzzles/livre/` : grilles recopiées du livre, **usage privé, ignorées par git, ne jamais les publier**.
- `README.md` : format JSON complet des grilles et liste des types d'indices.

## Règles du jeu (validées contre les grilles du livre)

- Une personne par ligne et par colonne. Une grille peut avoir plus de lignes ou de colonnes que de personnes (le cirque fait 9×12) : certaines restent vides.
- L'occupabilité dépend du type d'objet, et chaque affaire peut ajouter ses types (`objectTypes`). Occupables de base : fauteuil, tapis, lit, cheval.
- « À côté de » : case adjacente par un côté **dans la même pièce**.
- « Dans un coin » : coin **de pièce**, pas de la grille. C'est ce qui rend l'affaire 30 soluble.
- Les fenêtres sont posées sur les murs et touchent les deux cases de part et d'autre.
- Plans irréguliers : `null` dans `roomMap`. Plusieurs objets peuvent partager une case (tonneau sur tapis).
- Les cases adjacentes d'un même type forment un seul objet (lit de 2 cases, table en L), sauf pour les objets `single` (fauteuil, plante…). `"one": true` force un objet unique.
- Rôles inconnus (affaire 75) : `roles` dans la grille, `role:<nom>` dans les indices. Le solveur essaie toutes les attributions.
- Le coupable est le seul suspect dans la pièce de la victime.

## Décisions

- Les indices sont typés, jamais en texte libre. La phrase est générée (le champ `text` permet de la surcharger). Le solveur et l'interface lisent le même modèle.
- **Les thèmes sont purement visuels** (décision de Julien) : les textes ne changent pas, un fauteuil reste « un fauteuil » même dessiné en trône. On verra les vocabulaires par thème plus tard, si besoin d'industrialiser.
- Choix du thème : réglage du joueur, sinon `"theme"` de l'affaire, sinon `manoir`. Un objet absent d'un thème reprend le dessin du Manoir.
- Thèmes existants : `manoir`, `chateau`, `cyberpunk`. Idées : post-apo, futuriste, pixel art.
- La légende des objets reprend les dessins du thème courant.
- « Huis Clos » est un nom provisoire, choisi pour éviter le nom de la série de livres (probablement une marque).

## À faire / ouvert

- Faire vérifier par la sœur les coupables trouvés par le solveur dans les solutions du livre : affaire 30 = Albert, 31 = Bella, 75 = Arnold (rôles : Brenda acrobate, Daniel lanceur, Cecily dompteuse). Les affaires 1, 8 et 11 sont confirmées.
- Une étiquette de pièce chevauche parfois un objet de la pièce du dessous (affaire 8 : « Terrasse » sur la TV).
- Lion et cheval sont encore en emoji : à dessiner.
- Pas encore de générateur de grilles (seulement `--suggest` pour les indices).
- Pack pixel art craftpix envisagé : vérifier la licence de redistribution (un repo public expose les PNG) et la perspective 3/4 (lits verticaux et horizontaux).
