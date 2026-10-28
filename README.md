# Huis Clos

Casse-têtes logiques façon « murder mystery » : place chaque personne sur le plan
(une par ligne, une par colonne), en respectant les indices. Le coupable est le seul
suspect dans la même pièce que la victime.

Site 100 % statique : aucun build, aucun backend. Installable sur téléphone (PWA)
et jouable hors ligne après la première visite.

## Lancer en local

Les grilles sont chargées avec `fetch`, il faut donc un petit serveur :

```sh
npx serve .        # ou : python3 -m http.server
```

## Déployer sur GitHub Pages

Pousser le dossier sur un repo, puis Settings → Pages → « Deploy from a branch » → `main` / racine.
Le fichier `.nojekyll` évite que GitHub retraite les fichiers.

Pas de numéro de version à gérer : le service worker passe par le réseau d'abord,
donc un téléphone en ligne charge toujours la dernière version publiée.
Le cache ne sert qu'hors ligne.

## Affaires privées (chiffrées)

Les grilles de `puzzles/livre/` ne sont jamais publiées en clair (dossier ignoré par git).
Seule leur version chiffrée, `puzzles/livre.enc.json`, est dans le dépôt :

```sh
HC_PASSWORD='le mot de passe' node tools/encrypt.mjs
```

Le mot de passe ne s'écrit nulle part dans le dépôt. Pour ouvrir les affaires sur un téléphone :
petit lien « Affaires privées » tout en bas de l'accueil (ou `?livre` à la fin de l'adresse),
saisir le mot de passe une fois. L'appareil garde la clé ; « Refermer » l'oublie.
Pour retrouver les grilles en clair (par exemple dans un clone neuf, où `puzzles/livre/` n'existe pas) :

```sh
HC_PASSWORD='le mot de passe' node tools/decrypt.mjs
```

Les majuscules et les espaces autour du mot de passe sont ignorés.
Réchiffrer avec le même mot de passe garde les téléphones déjà ouverts ; pour changer de mot de passe,
supprimer d'abord `puzzles/livre.enc.json`.

## Structure

```
index.html, style.css     interface
js/rules.js               règles, indices, solveur (partagé navigateur + node)
js/app.js                 interface : crayon, annuler, vérifier, sauvegarde locale
puzzles/index.json        liste des affaires
puzzles/NNN.json          une affaire
tools/check.mjs           vérifie qu'une grille a une solution unique
tools/encrypt.mjs         chiffre les affaires privées
tools/decrypt.mjs         les remet en clair dans puzzles/livre/
js/vault.js               chiffrement (navigateur + node)
sw.js, manifest.json      PWA
```

## Ajouter une grille

1. Copier `puzzles/001.json`, changer `id`, `title`, `roomMap`, `objects`, `people`, `solution`.
2. Écrire les indices, ou se faire aider :
   ```sh
   node tools/check.mjs puzzles/002.json --suggest --seed=3
   ```
   propose un jeu minimal d'indices vrais qui rend la solution unique (changer le seed pour varier).
3. Vérifier : `node tools/check.mjs puzzles/002.json` doit afficher « Solution unique ».
4. Ajouter l'entrée dans `puzzles/index.json`.

### Format d'une grille

- `roomMap` : matrice d'index de pièces (dans `rooms`). `null` = case hors du plan (grilles irrégulières).
  Le nombre de lignes et de colonnes peut dépasser le nombre de personnes : des lignes ou colonnes restent alors vides.
- `objects` : `{ type, cells: [[ligne, colonne], …] }`. Les cases adjacentes d'un même type (dans la même pièce)
  forment un seul objet (un lit de 2 cases, une table en L), sauf pour les objets d'une case (fauteuil, plante…).
  `"one": true` force les cases listées à former un seul objet. Plusieurs objets peuvent partager une case
  (un tonneau posé sur un tapis).
- Les types (`OBJECTS` dans `js/rules.js`) disent si l'objet est occupable. Une grille peut en ajouter
  avec `objectTypes` : `{ "trampoline": { "label": "Trampoline", "icon": "🤸", "occupiable": true, "un": "un trampoline", "sur": "sur un trampoline", "de": "d'un trampoline" } }`.
- `windows` : `{ cell: [l, c], side: "n" | "s" | "e" | "w" }`.
- `people` : `g` (`f`/`m`) accorde les phrases, `hue` colore le jeton. `victim` : id de la victime.
- `theme` (facultatif) : thème visuel par défaut de l'affaire (`manoir`, `chateau`, `cyberpunk`). Le joueur peut l'imposer partout via le réglage « Thème » ; sur « Auto », c'est celui de l'affaire qui s'applique.
- Pièces : le sol et parfois la teinte se déduisent du nom (`FLOOR_RULES` dans `js/art.js` : la mer est de l'eau bleue, les douches un carrelage bleu clair…). `floor` (facultatif) force le type de sol et garde alors la teinte `hue` de la grille (`wood`, `tiles`, `checker`, `diamond`, `grass`, `deck`, `water`, `carpet`, `concrete`, `stage`), sinon il est déduit du nom.
- Voitures : `voiture` (occupable, 2 cases) plus `arriere` (case arrière, invisible, à l'ouest : dans le livre l'avant est à droite) pour « à l'arrière d'une voiture ».
- Les conditions de `someone_in_room`, `someone_offset`, `count_in_room`, `room_all` : `on`, `next_to`, `not_next_to` (liste), `gender`, `tag`, `corner`.
- `alone` accepte `rooms` (seule dans l'une de ces pièces) ; `not_next_to` accepte `objects` (aucun de ces objets).
- Un indice avec `"text": ""` n'est pas affiché : sa condition est déjà dite par la phrase de l'indice précédent.
- `rules` : règles globales, ex. `["no_empty_room"]`, `{ "type": "only_one_on", "object": "lit" }` (« Une seule personne était sur un lit. ») ou
  `{ "type": "empty_rooms", "rooms": [0, 1, 2], "count": 2 }` (exactement deux de ces pièces vides). `text` facultatif.
- `roles` (rôles inconnus) : `{ "candidates": ["B","C","D"], "list": { "acrobate": { "label": "l'acrobate", "g": "f" }, … } }`.
  Dans les indices, `"who": "role:acrobate"` ou `"other": "role:acrobate"`.

### Types d'indices

| type                 | champs                                   | exemple affiché |
|----------------------|------------------------------------------|-----------------|
| `on` / `not_on`      | `object`                                 | Cora était sur un tapis. |
| `only_on`            | `object`                                 | Donna était la seule personne dans un fauteuil. |
| `next_to` / `not_next_to` | `object`                            | Ella était à côté d'une plante. |
| `window`             | —                                        | Axel était devant une fenêtre. |
| `only_window`        | —                                        | Clara était la seule personne devant une fenêtre. |
| `next_to_wall` / `not_next_to_wall` | —                         | Dahlia n'était pas à côté d'un mur (aucun côté de sa case ne touche un mur). |
| `in_room` / `not_in_room` | `room`                              | Bella était dans l'entrée. |
| `room_has`           | `object`                                 | Il y avait une TV dans la pièce d'Andy. |
| `same_room` / `not_same_room` | `other`                         | … |
| `alone`              | `room` (facultatif)                      | Betty était seule dans la cuisine. |
| `alone_with`         | `other`                                  | Clark était seul avec Frankie. |
| `no_gender_in_room`  | `gender`                                 | Il n'y avait pas de femme dans la pièce de Dale. |
| `corner`             | —                                        | Hannah était dans un coin (coin de pièce). |
| `row` / `col`        | `row` / `col` (index 0)                  | Bennett était dans la cinquième colonne. |
| `dir_person`         | `other`, `dir` (n,s,e,w,ne…), `exact`    | Cecily était exactement quatre lignes au sud d'Eddie. |
| `dir_object`         | `object`, `dir`, `exact`, `sameRoom`     | Clarence était au sud-ouest d'une TV, dans la même pièce. |
| `col_has`            | `object`, `otherRoom` ou `sameRoom`      | Il y avait une TV dans la colonne de Benjamin, dans une autre pièce. |
| `in_rooms` / `only_in_rooms` | `rooms` (liste)                 | Aria était la seule personne dans des toilettes. |
| `only_not_on`        | `object`                                 | Evangeline était debout ; tous les autres étaient dans un fauteuil. |
| `not_col_has`        | `object`                                 | Il n'y avait pas de carton dans la colonne d'Eli. |
| `someone_in_room`    | `on`, `next_to`, `not_next_to` (liste), `gender` | Quelqu'un d'autre était assis dans le fauteuil de sa pièce. |
| `someone_offset`     | `dCol` ou `dRow`, mêmes conditions       | À une colonne à l'est d'Alice, quelqu'un était à côté d'une plante. |
| `room_all_tag`       | `tag` (personnes : `tags`)               | Toutes les personnes de sa pièce portaient des lunettes. |
| `easternmost_standing` | `object` (ce qui compte comme assis)   | La personne debout la plus à l'est de sa pièce. |
| `count_in_room`      | `count`, mêmes conditions                | Deux hommes de sa pièce étaient à côté d'une étagère. |
| `room_composition`   | `m`, `f`                                 | Il y avait un autre homme et une femme dans sa pièce. |
| `row_has`            | `object`, `sameRoom`                     | Il y avait une TV dans la ligne d'Aubrey, dans la même pièce. |
| `only_next_to`       | `object`                                 | Aaliyah était la seule personne à côté d'une étagère. |
| `easternmost_col`    | —                                        | Dans la colonne la plus à droite de sa pièce. |
| `same_diagonal`      | `others` (liste)                         | Efim était sur la même diagonale qu'Anatoly ou que Boris. |
| `shared_next_to`     | `object`                                 | À côté d'une TV ; quelqu'un d'autre était à côté de cette même TV. |
| `room_all`           | mêmes conditions que `someone_in_room`   | Toutes les personnes de sa pièce étaient sur un lit. |
| `alone_with_gender`  | `gender`                                 | Gavin était seul avec une femme (une seule autre personne dans sa pièce). |
| `col_has_exclusive`  | `object`                                 | Il y avait un tonneau dans la colonne d'Eddie. Toutes les autres colonnes avec un tonneau étaient vides. |
| `adjacent_col_empty` | `dir` (e/w)                              | La colonne directement à l'est de Brenda était vide. |

Tout indice accepte un champ `text` pour remplacer la phrase générée.
« À côté » = case adjacente par un côté **dans la même pièce**. « Coin » = coin d'une pièce.

## Thèmes

Un thème est purement visuel : les textes ne changent pas (un fauteuil reste « un fauteuil », même dessiné en trône).

- `js/art.js` : dessins SVG des objets par thème (`THEMES`). Un objet absent d'un thème est dessiné avec le Manoir.
- `style.css`, section « Thèmes visuels » : variables de couleur, motifs de sol, tables, lits, tapis et étiquettes, scopés par `.board.t-<thème>`.

Pour ajouter un thème : une entrée dans `THEMES`, un bloc `.board.t-<id>` dans le CSS, et la police éventuelle dans le lien Google Fonts de `index.html`.
