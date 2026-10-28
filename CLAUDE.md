# Huis Clos

Casse-tête logique de déduction sur plan, inspiré d'une série de livres : placer les suspects sur un plan, démasquer le coupable.
Projet perso de Julien, d'abord pour sa sœur (qui joue aux livres papier et sert de testeuse).
Idée à plus long terme : proposer une version mobile à l'auteur. D'où la règle : rien de publié avec son nom ou ses grilles.

## Stack

- Site 100 % statique, sans build ni backend. Modules ES natifs. Déploiement sur GitHub Pages (comme le Boggle de Julien).
- PWA : `manifest.json` + `sw.js`. Le service worker passe par le réseau d'abord (cache seulement hors ligne) : pas de version à incrémenter, un push sur `main` suffit. Penser à ajouter dans `SHELL` tout nouveau fichier nécessaire hors ligne.
- En local : `python3 -m http.server` ou `npx serve .`. Ne pas ouvrir `index.html` en `file://`, les `fetch` des grilles échoueraient.

## Fichiers

- `js/rules.js` : modèle, règles, types d'objets (`OBJECTS`), indices typés, solveur (backtracking + rôles inconnus), textes FR des indices. Partagé navigateur et node.
- `js/art.js` : rendu visuel. Sols par type de pièce, dessins SVG des objets par thème (`THEMES`).
- `js/app.js` : interface (crayon, barrer, gomme, annuler, vérifier, sauvegarde localStorage, choix du thème, légende).
- `style.css` : thème de l'interface, plan, puis section « Thèmes visuels » scopée par `.t-<thème>`.
- `js/vault.js` : chiffrement des affaires privées (AES-GCM, clé PBKDF2), partagé navigateur et node.
- `tools/check.mjs` : `node tools/check.mjs puzzles/X.json` vérifie que la solution est unique. `--suggest [--seed=N]` propose un jeu d'indices minimal.
- `puzzles/` : grilles originales. `puzzles/livre/` : grilles recopiées du livre, **usage privé, ignorées par git, ne jamais les publier en clair**.
- `puzzles/livre.enc.json` : ces mêmes grilles chiffrées (décision de Julien, pour un usage familial). Seul ce fichier est publié. **Début de session : `puzzles/livre/` n'existe pas dans un clone neuf** ; le recréer avec `HC_PASSWORD='…' node tools/decrypt.mjs` (demander le mot de passe à Julien). Après tout ajout ou correction dans `puzzles/livre/`, rechiffrer avec `HC_PASSWORD='…' node tools/encrypt.mjs`. Le fichier chiffré est la seule sauvegarde des grilles transcrites : ne jamais le supprimer sans avoir les grilles en clair. **Le mot de passe n'est jamais écrit dans le dépôt** (ni code, ni commit, ni doc) ; Julien le garde. Dans l'app : petit lien « Affaires privées » en bas de l'accueil (ou `?livre`), l'appareil garde ensuite la clé. Sœurs : app installée sur l'écran d'accueil, donc pas de lien à taper.
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
- Fonds des pièces : pas de copie des couleurs du livre (décision de Julien). Le motif, et pour les pièces « évidentes » la teinte (mer, jardin, douches, chambre froide), viennent du nom via `FLOOR_RULES` (`js/art.js`). Compléter cette liste quand de nouveaux noms de pièces arrivent (sinon : parquet).
- Annotations au crayon (initiales temporaires dans les cases, ignorées par « Vérifier ») : en essai, un réglage « Annoter par » permet à tous de comparer l'interrupteur « Annoter », l'appui long et les appuis successifs. Après les retours, ne garder que la façon retenue. Julien n'est pas encore convaincu : piste d'un petit menu au toucher d'une case.
- « Huis Clos » est un nom provisoire, choisi pour éviter le nom de la série de livres (probablement une marque).

## À faire / ouvert

- Transcrire le reste du livre (Julien envoie les photos des pages, les solutions au crayon de sa sœur servent de contrôle). Ses deux sœurs ont le livre.
- Faire vérifier par la sœur les coupables trouvés par le solveur dans les solutions du livre : affaire 30 = Albert, 31 = Bella, 75 = Arnold (rôles : Brenda acrobate, Daniel lanceur, Cecily dompteuse). Les affaires 1 à 51, 55, 56, 61 et 75 sont transcrites, toutes à solution unique (52-54 et 57-60 pas encore reçues). Affaire 55 : la croix de la piste de danse est un tapis (sans elle, aucune solution). Affaire 35 : Hartley « au nord » et voitures avec l'arrière à gauche (32, 37) confirmés par Julien sur le livre. Coupables non confirmés par la sœur : 12 Greg, 26 Adeline (ses notes divergent), 28 Edison (ses notes sont fausses, confirmé par Julien), 29 Beckie (non résolue). **Les annotations de la sœur ne sont pas fiables** (surtout passé la 20) : le solveur fait foi, ses notes servent seulement d'indice en cas de doute sur la lecture d'un plan.
- Une étiquette de pièce chevauche parfois un objet de la pièce du dessous (affaire 8 : « Terrasse » sur la TV).
- Lion et cheval sont encore en emoji : à dessiner.
- Pas encore de générateur de grilles (seulement `--suggest` pour les indices).
- Pack pixel art craftpix envisagé : vérifier la licence de redistribution (un repo public expose les PNG) et la perspective 3/4 (lits verticaux et horizontaux).
