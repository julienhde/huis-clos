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
- Pièces : `floor` (facultatif) force le type de sol (`wood`, `tiles`, `checker`, `diamond`, `grass`, `deck`, `water`, `carpet`, `concrete`, `stage`), sinon il est déduit du nom.
- `rules` : règles globales, ex. `["no_empty_room"]`.
- `roles` (rôles inconnus) : `{ "candidates": ["B","C","D"], "list": { "acrobate": { "label": "l'acrobate", "g": "f" }, … } }`.
  Dans les indices, `"who": "role:acrobate"` ou `"other": "role:acrobate"`.

### Types d'indices

| type                 | champs                                   | exemple affiché |
|----------------------|------------------------------------------|-----------------|
| `on` / `not_on`      | `object`                                 | Cora était sur un tapis. |
| `only_on`            | `object`                                 | Donna était la seule personne dans un fauteuil. |
| `next_to` / `not_next_to` | `object`                            | Ella était à côté d'une plante. |
| `window`             | —                                        | Axel était devant une fenêtre. |
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
| `col_has`            | `object`, `otherRoom`                    | Il y avait une TV dans la colonne de Benjamin, dans une autre pièce. |
| `col_has_exclusive`  | `object`                                 | Il y avait un tonneau dans la colonne d'Eddie. Toutes les autres colonnes avec un tonneau étaient vides. |
| `adjacent_col_empty` | `dir` (e/w)                              | La colonne directement à l'est de Brenda était vide. |

Tout indice accepte un champ `text` pour remplacer la phrase générée.
« À côté » = case adjacente par un côté **dans la même pièce**. « Coin » = coin d'une pièce.

## Thèmes

Un thème est purement visuel : les textes ne changent pas (un fauteuil reste « un fauteuil », même dessiné en trône).

- `js/art.js` : dessins SVG des objets par thème (`THEMES`). Un objet absent d'un thème est dessiné avec le Manoir.
- `style.css`, section « Thèmes visuels » : variables de couleur, motifs de sol, tables, lits, tapis et étiquettes, scopés par `.board.t-<thème>`.

Pour ajouter un thème : une entrée dans `THEMES`, un bloc `.board.t-<id>` dans le CSS, et la police éventuelle dans le lien Google Fonts de `index.html`.
