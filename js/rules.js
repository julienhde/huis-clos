// Moteur de règles partagé (navigateur + node).
//
// Une grille = une matrice de pièces (roomMap) où `null` marque une case hors du plan.
// Règles de base :
//   - au plus une personne par ligne et par colonne (exactement une quand la grille
//     a autant de lignes et de colonnes que de personnes) ;
//   - on ne peut se tenir que sur une case dont tous les objets sont occupables ;
//   - le coupable est le seul suspect dans la même pièce que la victime.

export const OBJECTS = {
  fauteuil: { label: 'Fauteuil', icon: '🛋️', occupiable: true,  single: true, un: 'un fauteuil', sur: 'dans un fauteuil', de: "d'un fauteuil" },
  tapis:    { label: 'Tapis',    icon: '',   occupiable: true,  un: 'un tapis',    sur: 'sur un tapis',     de: "d'un tapis" },
  lit:      { label: 'Lit',      icon: '🛏️', occupiable: true,  un: 'un lit',      sur: 'sur un lit',       de: "d'un lit" },
  cheval:   { label: 'Cheval',   icon: '🐴', occupiable: true,  single: true, un: 'un cheval',   sur: 'sur un cheval',    de: "d'un cheval" },
  table:    { label: 'Table',    icon: '',   occupiable: false, un: 'une table',   de: "d'une table" },
  tv:       { label: 'TV',       icon: '📺', occupiable: false, single: true, un: 'une TV',      de: "d'une TV" },
  plante:   { label: 'Plante',   icon: '🪴', occupiable: false, single: true, un: 'une plante',  de: "d'une plante" },
  etagere:  { label: 'Étagère',  icon: '📚', occupiable: false, single: true, un: 'une étagère', de: "d'une étagère" },
  carton:   { label: 'Carton',   icon: '📦', occupiable: false, single: true, un: 'un carton',   de: "d'un carton" },
  rocher:   { label: 'Rocher',   icon: '🪨', occupiable: false, single: true, un: 'un rocher',   de: 'du rocher' },
  gravats:  { label: 'Gravats',  icon: '🧱', occupiable: false, single: true, un: 'des gravats', de: 'des gravats' },
  tonneau:  { label: 'Tonneau',  icon: '🛢️', occupiable: false, single: true, un: 'un tonneau',  de: "d'un tonneau" },
  lion:     { label: 'Lion',     icon: '🦁', occupiable: false, single: true, un: 'un lion',     de: "d'un lion" },
  ratelier: { label: "Râtelier d'armes", icon: '⚔️', occupiable: false, single: true, un: "un râtelier d'armes", de: "d'un râtelier d'armes" },
  cadeau:   { label: 'Cadeau',   icon: '🎁', occupiable: false, single: true, un: 'un cadeau',   de: "d'un cadeau" },
  statue:   { label: 'Statue',   icon: '🗿', occupiable: false, single: true, un: 'une statue',  de: "d'une statue" },
  casier:   { label: 'Casier',   icon: '🗄️', occupiable: false, single: true, un: 'un casier',   de: "d'un casier" },
  sac:      { label: 'Sac de frappe', icon: '🥊', occupiable: false, single: true, un: 'un sac de frappe', de: "d'un sac de frappe" },
  voiture:  { label: 'Voiture',  icon: '🚗', occupiable: true,  un: 'une voiture', sur: 'dans une voiture', de: "d'une voiture" },
  // Case arrière d'une voiture (à l'ouest : dans le livre l'avant est à droite). Invisible, sert aux indices.
  arriere:  { label: 'Arrière de voiture', occupiable: true, hidden: true, un: "l'arrière d'une voiture", sur: "à l'arrière d'une voiture", de: "de l'arrière d'une voiture" },
  tache:    { label: "Tache d'essence", icon: '💧', occupiable: true, single: true, un: "une tache d'essence", sur: "sur une tache d'essence", de: "d'une tache d'essence" },
  pompe:    { label: 'Pompe à essence', icon: '⛽', occupiable: false, single: true, un: 'une pompe à essence', de: "d'une pompe à essence" },
  caisse:   { label: 'Caisse enregistreuse', icon: '🧾', occupiable: false, single: true, un: 'une caisse enregistreuse', de: "d'une caisse enregistreuse" },
};

export const GLOBAL_RULES = {
  no_empty_room: "Il n'y avait pas de pièce vide.",
};

/** Texte d'une règle globale : un nom (`no_empty_room`) ou un objet (`{ type: 'only_one_on', object: 'lit' }`). */
export function ruleText(g, rule) {
  if (typeof rule === 'string') return GLOBAL_RULES[rule];
  if (rule.text) return rule.text;
  if (rule.type === 'only_one_on') return `Une seule personne était ${g.types[rule.object].sur}.`;
  if (rule.type === 'empty_rooms') return `Exactement ${NUMBERS[rule.count]} de ces pièces étaient vides : ${rule.rooms.map(i => g.rooms[i].name).join(', ')}.`;
  throw new Error(`Règle inconnue : ${JSON.stringify(rule)}`);
}

const key = (r, c) => `${r},${c}`;
const SIDES = { n: [-1, 0], s: [1, 0], w: [0, -1], e: [0, 1] };
const NUMBERS = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const ORDINALS = ['première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième', 'onzième', 'douzième', 'treizième'];
const DIR_NAMES = { n: 'au nord', s: 'au sud', e: "à l'est", w: "à l'ouest", ne: 'au nord-est', nw: 'au nord-ouest', se: 'au sud-est', sw: 'au sud-ouest' };

// ---------------------------------------------------------------- compilation

/** Découpe une liste de cases en objets : composantes connexes (même pièce), sauf objets d'une case. */
function splitInstances(type, cells, roomAt, def) {
  if (def.single) return cells.map(c => [c]);
  const left = new Set(cells.map(([r, c]) => key(r, c)));
  const out = [];
  for (const [r0, c0] of cells) {
    if (!left.has(key(r0, c0))) continue;
    const comp = [];
    const stack = [[r0, c0]];
    left.delete(key(r0, c0));
    while (stack.length) {
      const [r, c] = stack.pop();
      comp.push([r, c]);
      for (const [dr, dc] of Object.values(SIDES)) {
        const k = key(r + dr, c + dc);
        if (left.has(k) && roomAt(r + dr, c + dc) === roomAt(r, c)) { left.delete(k); stack.push([r + dr, c + dc]); }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Prépare une grille brute (JSON) pour des accès rapides. */
export function compile(puzzle) {
  const types = { ...OBJECTS, ...(puzzle.objectTypes ?? {}) };
  const rows = puzzle.roomMap.length;
  const cols = Math.max(...puzzle.roomMap.map(r => r.length));
  const roomAt = (r, c) => (r < 0 || c < 0 || r >= rows || c >= cols) ? null : (puzzle.roomMap[r][c] ?? null);
  const inGrid = (r, c) => roomAt(r, c) !== null;

  // Objets : instances (un lit de 2 cases = 1 objet) et index par case (plusieurs objets possibles par case).
  const instances = [];
  for (const o of puzzle.objects) {
    if (!types[o.type]) throw new Error(`Type d'objet inconnu : ${o.type}`);
    const parts = o.one ? [o.cells] : splitInstances(o.type, o.cells, roomAt, types[o.type]);
    for (const cells of parts) instances.push({ type: o.type, cells });
  }
  const objectsAt = new Map();
  for (const inst of instances) for (const [r, c] of inst.cells) {
    const k = key(r, c);
    if (!objectsAt.has(k)) objectsAt.set(k, []);
    objectsAt.get(k).push(inst.type);
  }
  const has = (r, c, type) => (objectsAt.get(key(r, c)) ?? []).includes(type);
  const occupiable = (r, c) => inGrid(r, c) && (objectsAt.get(key(r, c)) ?? []).every(t => types[t].occupiable);

  // Une fenêtre est posée sur un côté de case ; elle touche aussi la case voisine.
  const windowCells = new Set();
  for (const w of puzzle.windows ?? []) {
    const [r, c] = w.cell;
    windowCells.add(key(r, c));
    const [dr, dc] = SIDES[w.side];
    if (inGrid(r + dr, c + dc)) windowCells.add(key(r + dr, c + dc));
  }

  const roomObjects = puzzle.rooms.map(() => new Set());
  for (const [k, ts] of objectsAt) {
    const [r, c] = k.split(',').map(Number);
    for (const t of ts) roomObjects[roomAt(r, c)].add(t);
  }
  // Cases de chaque type d'objet, pour les indices de direction et de colonne.
  const cellsOf = {};
  for (const inst of instances) (cellsOf[inst.type] ??= []).push(...inst.cells);

  const people = puzzle.people.map(p => ({ ...p, victim: p.id === puzzle.victim }));
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  return {
    rules: [], windows: [], roles: null, ...puzzle,
    people, byId, types, rows, cols, n: Math.max(rows, cols),
    roomAt, inGrid, occupiable, has, objectsAt, instances, windowCells, roomObjects, cellsOf,
  };
}

// ---------------------------------------------------------------- géométrie

/** Voisins par un côté ET dans la même pièce (« à côté » au sens du livre). */
function neighbors(g, r, c) {
  const out = [];
  for (const [dr, dc] of Object.values(SIDES)) {
    if (g.roomAt(r + dr, c + dc) === g.roomAt(r, c)) out.push([r + dr, c + dc]);
  }
  return out;
}

/** Contre un mur : une case voisine d'une autre pièce, hors plan ou au bord. */
const touchesWall = (g, r, c) => Object.values(SIDES).some(([dr, dc]) => g.roomAt(r + dr, c + dc) !== g.roomAt(r, c));

/** Coin de pièce : un mur (autre pièce, hors plan ou bord) en haut ou en bas, ET à gauche ou à droite. */
function isRoomCorner(g, r, c) {
  const wall = (dr, dc) => g.roomAt(r + dr, c + dc) !== g.roomAt(r, c);
  return (wall(-1, 0) || wall(1, 0)) && (wall(0, -1) || wall(0, 1));
}

/** (r, c) est-il dans la direction `dir` par rapport à (r0, c0) ? `exact` : écart exact sur l'axe. */
function inDirection([r, c], [r0, c0], dir, exact) {
  if (exact !== undefined) {
    if (dir === 'n') return r0 - r === exact;
    if (dir === 's') return r - r0 === exact;
    if (dir === 'e') return c - c0 === exact;
    if (dir === 'w') return c0 - c === exact;
  }
  return (!dir.includes('n') || r < r0) && (!dir.includes('s') || r > r0)
      && (!dir.includes('e') || c > c0) && (!dir.includes('w') || c < c0);
}

const others = (pos, id) => Object.keys(pos).filter(o => o !== id);
const othersInRoom = (g, pos, id) => {
  const [r, c] = pos[id];
  return others(pos, id).filter(o => g.roomAt(...pos[o]) === g.roomAt(r, c));
};
/** Une personne (case r, c) remplit-elle les conditions { on, next_to, not_next_to, gender } ? */
const matches = (g, cond, id, [r, c]) =>
  (!cond.on || g.has(r, c, cond.on))
  && (!cond.next_to || neighbors(g, r, c).some(([rr, cc]) => g.has(rr, cc, cond.next_to)))
  && (!cond.not_next_to || !neighbors(g, r, c).some(([rr, cc]) => cond.not_next_to.some(t => g.has(rr, cc, t))))
  && (!cond.gender || g.byId[id].g === cond.gender)
  && (!cond.tag || (g.byId[id].tags ?? []).includes(cond.tag))
  && (!cond.corner || isRoomCorner(g, r, c));
const colEmpty = (pos, col, except) => Object.entries(pos).every(([id, [, c]]) => id === except || c !== col);

// ---------------------------------------------------------------- indices

/** Indices qui ne dépendent que de la position de la personne (servent à élaguer). */
const UNARY = new Set(['on', 'not_on', 'next_to', 'not_next_to', 'window', 'in_room', 'not_in_room', 'room_has',
  'row', 'col', 'corner', 'dir_object', 'col_has', 'next_to_wall', 'not_next_to_wall', 'in_rooms', 'not_col_has',
  'row_has', 'easternmost_col']);

/**
 * Évalue un indice. Avec `partial`, `pos` peut être incomplet : on ne renvoie faux
 * que si l'indice est déjà violé quoi qu'il arrive ensuite.
 */
export function checkClue(g, clue, pos, partial = false) {
  const p = pos[clue.who];
  if (!p) return partial;
  const [r, c] = p;
  const q = clue.other ? pos[clue.other] : null;
  if (clue.other && !q && !['alone_with'].includes(clue.type)) return partial;
  switch (clue.type) {
    case 'on':          return g.has(r, c, clue.object);
    case 'not_on':      return !g.has(r, c, clue.object);
    case 'only_on':     return g.has(r, c, clue.object) && others(pos, clue.who).every(o => !g.has(...pos[o], clue.object));
    case 'next_to':     return neighbors(g, r, c).some(([rr, cc]) => g.has(rr, cc, clue.object));
    case 'not_next_to': return !neighbors(g, r, c).some(([rr, cc]) => (clue.objects ?? [clue.object]).some(t => g.has(rr, cc, t)));
    case 'only_not_on': return !g.has(r, c, clue.object) && others(pos, clue.who).every(o => g.has(...pos[o], clue.object));
    case 'window':      return g.windowCells.has(key(r, c));
    case 'only_window': return g.windowCells.has(key(r, c)) && others(pos, clue.who).every(o => !g.windowCells.has(key(...pos[o])));
    case 'next_to_wall':     return touchesWall(g, r, c);
    case 'not_next_to_wall': return !touchesWall(g, r, c);
    case 'in_room':     return g.roomAt(r, c) === clue.room;
    case 'not_in_room': return g.roomAt(r, c) !== clue.room;
    case 'in_rooms':    return clue.rooms.includes(g.roomAt(r, c));
    case 'only_in_rooms': return clue.rooms.includes(g.roomAt(r, c))
                          && others(pos, clue.who).every(o => !clue.rooms.includes(g.roomAt(...pos[o])));
    case 'room_has':    return g.roomObjects[g.roomAt(r, c)].has(clue.object);
    case 'row':         return r === clue.row;
    case 'col':         return c === clue.col;
    case 'corner':      return isRoomCorner(g, r, c);
    case 'dir_object':  return (g.cellsOf[clue.object] ?? []).some(o =>
                          inDirection([r, c], o, clue.dir, clue.exact) && (!clue.sameRoom || g.roomAt(...o) === g.roomAt(r, c)));
    case 'col_has':     return (g.cellsOf[clue.object] ?? []).some(([rr, cc]) => cc === c
                          && (!clue.otherRoom || g.roomAt(rr, cc) !== g.roomAt(r, c))
                          && (!clue.sameRoom || g.roomAt(rr, cc) === g.roomAt(r, c)));
    case 'row_has':     return (g.cellsOf[clue.object] ?? []).some(([rr, cc]) => rr === r
                          && (!clue.sameRoom || g.roomAt(rr, cc) === g.roomAt(r, c)));
    // Dans la colonne la plus à l'est de sa pièce.
    case 'easternmost_col': {
      for (let rr = 0; rr < g.rows; rr++) for (let cc = c + 1; cc < g.cols; cc++) if (g.roomAt(rr, cc) === g.roomAt(r, c)) return false;
      return true;
    }
    case 'only_next_to': return neighbors(g, r, c).some(([rr, cc]) => g.has(rr, cc, clue.object))
                          && others(pos, clue.who).every(o => !neighbors(g, ...pos[o]).some(([rr, cc]) => g.has(rr, cc, clue.object)));
    // Sur la même diagonale que l'une des personnes citées.
    case 'same_diagonal': {
      const placed = clue.others.filter(o => pos[o]);
      if (placed.length < clue.others.length && partial) return true;
      return placed.some(o => Math.abs(pos[o][0] - r) === Math.abs(pos[o][1] - c));
    }
    // À côté d'un objet (une case) à côté duquel se trouve aussi quelqu'un d'autre.
    case 'shared_next_to':
      return neighbors(g, r, c).filter(([rr, cc]) => g.has(rr, cc, clue.object)).some(([tr, tc]) =>
          others(pos, clue.who).some(o => neighbors(g, tr, tc).some(([rr, cc]) => rr === pos[o][0] && cc === pos[o][1])))
        || (partial && Object.keys(pos).length < g.people.length);
    // Tous les autres occupants de sa pièce remplissent les conditions (sur un lit…).
    case 'room_all':
      return othersInRoom(g, pos, clue.who).every(o => matches(g, clue, o, pos[o]));
    case 'not_col_has': return !(g.cellsOf[clue.object] ?? []).some(([, cc]) => cc === c);
    case 'col_has_exclusive': {
      const cols = new Set((g.cellsOf[clue.object] ?? []).map(([, cc]) => cc));
      return cols.has(c) && [...cols].every(cc => cc === c || colEmpty(pos, cc, clue.who));
    }
    case 'adjacent_col_empty': {
      const cc = c + (clue.dir === 'e' ? 1 : -1);
      return cc >= 0 && cc < g.cols && colEmpty(pos, cc, clue.who);
    }
    case 'dir_person':  return inDirection([r, c], q, clue.dir, clue.exact);
    case 'same_room':   return g.roomAt(r, c) === g.roomAt(...q);
    case 'not_same_room': return g.roomAt(r, c) !== g.roomAt(...q);
    case 'alone':
      return (clue.room === undefined || g.roomAt(r, c) === clue.room)
        && (!clue.rooms || clue.rooms.includes(g.roomAt(r, c)))
        && othersInRoom(g, pos, clue.who).length === 0;
    // Quelqu'un d'autre dans sa pièce remplit les conditions (assis dans un fauteuil, femme, à côté d'un casier…).
    case 'someone_in_room':
      return othersInRoom(g, pos, clue.who).some(o => matches(g, clue, o, pos[o])) || (partial && Object.keys(pos).length < g.people.length);
    // Quelqu'un, une colonne (dCol) ou une ligne (dRow) plus loin, remplit les conditions.
    case 'someone_offset':
      return others(pos, clue.who).some(o => (clue.dCol === undefined || pos[o][1] === c + clue.dCol)
          && (clue.dRow === undefined || pos[o][0] === r + clue.dRow) && matches(g, clue, o, pos[o]))
        || (partial && Object.keys(pos).length < g.people.length);
    // Tous les autres occupants de sa pièce ont l'étiquette (ex. lunettes).
    case 'room_all_tag':
      return othersInRoom(g, pos, clue.who).every(o => (g.byId[o].tags ?? []).includes(clue.tag));
    // Debout (pas sur l'objet) et le plus à l'est des personnes debout de sa pièce.
    case 'easternmost_standing':
      return !g.has(r, c, clue.object)
        && othersInRoom(g, pos, clue.who).every(o => g.has(...pos[o], clue.object) || pos[o][1] < c);
    // Nombre exact d'autres occupants de sa pièce qui remplissent les conditions.
    case 'count_in_room': {
      const n = othersInRoom(g, pos, clue.who).filter(o => matches(g, clue, o, pos[o])).length;
      return partial ? n <= clue.count : n === clue.count;
    }
    // Composition exacte des autres occupants de sa pièce : { m: 1, f: 1 }.
    case 'room_composition': {
      const o = othersInRoom(g, pos, clue.who);
      const m = o.filter(x => g.byId[x].g === 'm').length, f = o.length - m;
      return partial ? m <= clue.m && f <= clue.f : m === clue.m && f === clue.f;
    }
    case 'alone_with': {
      const o = othersInRoom(g, pos, clue.who);
      if (partial) return o.every(x => x === clue.other);
      return o.length === 1 && o[0] === clue.other;
    }
    case 'alone_with_gender': {
      const o = othersInRoom(g, pos, clue.who);
      if (partial) return o.length <= 1 && o.every(x => g.byId[x].g === clue.gender);
      return o.length === 1 && g.byId[o[0]].g === clue.gender;
    }
    case 'no_gender_in_room':
      return othersInRoom(g, pos, clue.who).every(o => g.byId[o].g !== clue.gender);
    default:
      throw new Error(`Type d'indice inconnu : ${clue.type}`);
  }
}

export function checkGlobal(g, rule, pos) {
  if (rule.type === 'empty_rooms') {
    const used = new Set(Object.values(pos).map(([r, c]) => g.roomAt(r, c)));
    return rule.rooms.filter(i => !used.has(i)).length === rule.count;
  }
  if (rule.type === 'only_one_on') {
    return Object.values(pos).filter(([r, c]) => g.has(r, c, rule.object)).length === 1;
  }
  if (rule === 'no_empty_room') {
    const used = new Set(Object.values(pos).map(([r, c]) => g.roomAt(r, c)));
    return used.size === g.rooms.length;
  }
  throw new Error(`Règle inconnue : ${rule}`);
}

/** Id du coupable si la règle du meurtre est respectée, sinon null. */
export function murderer(g, pos) {
  if (!pos[g.victim]) return null;
  const o = othersInRoom(g, pos, g.victim);
  return o.length === 1 ? o[0] : null;
}

// ---------------------------------------------------------------- rôles inconnus

function permutations(arr, k = arr.length) {
  if (k === 0) return [[]];
  const out = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)], k - 1)) out.push([x, ...p]);
  });
  return out;
}

/** Toutes les attributions possibles des rôles inconnus : [{ acrobate: 'B', ... }]. */
export function roleAssignments(g) {
  if (!g.roles) return [{}];
  const names = Object.keys(g.roles.list);
  return permutations(g.roles.candidates, names.length).map(p => Object.fromEntries(names.map((n, i) => [n, p[i]])));
}

const resolve = (ref, roles) => ref?.startsWith?.('role:') ? roles[ref.slice(5)] : ref;
export function resolveClues(clues, roles) {
  return clues.map(cl => ({ ...cl, who: resolve(cl.who, roles), other: resolve(cl.other, roles) }));
}

// ---------------------------------------------------------------- solveur

function solveFixed(g, clues, limit, out) {
  const ids = g.people.map(p => p.id);
  const cand = {};
  for (const id of ids) {
    const unary = clues.filter(cl => cl.who === id && UNARY.has(cl.type))
      .concat(clues.filter(cl => cl.who === id && cl.type === 'only_on').map(cl => ({ ...cl, type: 'on' })))
      .concat(clues.filter(cl => cl.who === id && cl.type === 'only_window').map(cl => ({ ...cl, type: 'window' })))
      .concat(clues.filter(cl => cl.who === id && cl.type === 'only_next_to').map(cl => ({ ...cl, type: 'next_to' })))
      .concat(clues.filter(cl => cl.who === id && cl.type === 'col_has_exclusive').map(cl => ({ ...cl, type: 'col_has' })))
      .concat(clues.filter(cl => cl.who === id && cl.type === 'alone' && cl.room !== undefined).map(cl => ({ who: id, type: 'in_room', room: cl.room })))
      .concat(clues.filter(cl => cl.who === id && (cl.type === 'only_in_rooms' || (cl.type === 'alone' && cl.rooms))).map(cl => ({ who: id, type: 'in_rooms', rooms: cl.rooms })))
      .concat(clues.filter(cl => cl.who === id && cl.type === 'easternmost_standing').map(cl => ({ who: id, type: 'not_on', object: cl.object })))
      .concat(clues.filter(cl => cl.type === 'only_not_on').map(cl => ({ who: id, type: cl.who === id ? 'not_on' : 'on', object: cl.object })));
    cand[id] = [];
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      if (!g.occupiable(r, c)) continue;
      const pos = { [id]: [r, c] };
      if (unary.every(cl => checkClue(g, cl, pos))) cand[id].push([r, c]);
    }
  }
  const rest = clues.filter(cl => !UNARY.has(cl.type));
  const rowsUsed = new Array(g.rows).fill(false);
  const colsUsed = new Array(g.cols).fill(false);
  const pos = {};
  const order = ids.slice().sort((a, b) => cand[a].length - cand[b].length);

  const victimOk = () => {
    if (!pos[g.victim]) return true;
    const o = othersInRoom(g, pos, g.victim);
    return o.length <= 1;
  };

  function rec(i) {
    if (i === order.length) {
      if (rest.every(cl => checkClue(g, cl, pos)) && g.rules.every(rule => checkGlobal(g, rule, pos)) && murderer(g, pos)) {
        out.push(structuredClone(pos));
      }
      return;
    }
    const id = order[i];
    for (const [r, c] of cand[id]) {
      if (rowsUsed[r] || colsUsed[c]) continue;
      rowsUsed[r] = colsUsed[c] = true;
      pos[id] = [r, c];
      if (victimOk() && rest.every(cl => checkClue(g, cl, pos, true))) rec(i + 1);
      delete pos[id];
      rowsUsed[r] = colsUsed[c] = false;
      if (out.length >= limit) return;
    }
  }
  rec(0);
}

/** Liste les solutions distinctes (positions), jusqu'à `limit`. Chaque solution porte ses rôles en `_roles`. */
export function solve(g, clues = g.clues, limit = 2) {
  const seen = new Map();
  for (const roles of roleAssignments(g)) {
    const found = [];
    solveFixed(g, resolveClues(clues, roles), limit, found);
    for (const s of found) {
      const k = JSON.stringify(Object.keys(s).sort().map(id => [id, s[id]]));
      if (!seen.has(k)) seen.set(k, Object.assign(s, { _roles: roles }));
    }
    if (seen.size >= limit) break;
  }
  return [...seen.values()].slice(0, limit).map(s => {
    const roles = s._roles;
    delete s._roles;
    return Object.defineProperty(s, 'roles', { value: roles, enumerable: false });
  });
}

// ---------------------------------------------------------------- textes

function subject(g, ref) {
  if (ref?.startsWith('role:')) {
    const role = g.roles.list[ref.slice(5)];
    return { name: role.label, g: role.g };
  }
  return { name: g.byId[ref].name, g: g.byId[ref].g };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const de = name => /^le /i.test(name) ? name.replace(/^le /i, 'du ')
  : /^les /i.test(name) ? name.replace(/^les /i, 'des ')
  : /^[aeiouyéèêàâîïôûh]/i.test(name) && !/^l'/i.test(name) ? `d'${name}` : `de ${name}`;

const que = name => /^[aeiouyéèêàâîïôûh]/i.test(name) ? `qu'${name}` : `que ${name}`;

/** Phrase française d'un indice, à l'imparfait comme dans un rapport d'enquête. */
export function clueText(g, clue) {
  if (clue.text !== undefined) return clue.text; // "" : condition déjà dite par l'indice précédent
  const who = subject(g, clue.who);
  const n = who.name;
  const seul = who.g === 'f' ? 'seule' : 'seul';
  const other = clue.other ? subject(g, clue.other).name : '';
  const room = id => g.rooms[id];
  const O = clue.object ? g.types[clue.object] : null;
  const dirText = (dir, exact, unit) => exact !== undefined
    ? `${['n', 's'].includes(dir) ? 'exactement ' : ''}${NUMBERS[exact] ?? exact} ${unit}${exact > 1 ? 's' : ''} ${DIR_NAMES[dir]}`
    : DIR_NAMES[dir];
  const unit = dir => ['n', 's'].includes(dir) ? 'ligne' : 'colonne';
  const s = (() => {
    switch (clue.type) {
      case 'on':          return `${n} était ${O.sur}.`;
      case 'not_on':      return `${n} n'était pas ${O.sur}.`;
      case 'only_on':     return `${n} était la seule personne ${O.sur}.`;
      case 'next_to':     return `${n} était à côté ${O.de}.`;
      case 'not_next_to': return clue.objects
        ? `${n} n'était pas à côté ${clue.objects.map(t => g.types[t].de).join(' ni ')}.`
        : `${n} n'était pas à côté ${O.de}.`;
      case 'only_not_on': return `${n} était la seule personne qui n'était pas ${O.sur}.`;
      case 'in_rooms':    return `${n} était ${clue.rooms.map(i => room(i).dans).join(' ou ')}.`;
      case 'only_in_rooms': return `${n} était la seule personne ${clue.rooms.map(i => room(i).dans).join(' ou ')}.`;
      case 'not_col_has': return `Il n'y avait pas ${O.un.replace(/^une? /, 'de ').replace(/^de ([aeiouyéh])/i, "d'$1")} dans la colonne ${de(n)}.`;
      case 'window':      return `${n} était devant une fenêtre.`;
      case 'only_window': return `${n} était la seule personne devant une fenêtre.`;
      case 'next_to_wall':     return `${n} était à côté d'un mur.`;
      case 'not_next_to_wall': return `${n} n'était pas à côté d'un mur.`;
      case 'in_room':     return `${n} était ${room(clue.room).dans}.`;
      case 'not_in_room': return `${n} n'était pas ${room(clue.room).dans}.`;
      case 'room_has':    return `Il y avait ${O.un} dans la pièce ${de(n)}.`;
      case 'same_room':   return `${n} était dans la même pièce ${que(other)}.`;
      case 'not_same_room': return `${n} n'était pas dans la même pièce ${que(other)}.`;
      case 'alone':       return clue.rooms ? `${n} était ${seul} ${clue.rooms.map(i => room(i).dans).join(' ou ')}.`
        : clue.room === undefined ? `${n} était ${seul}.` : `${n} était ${seul} ${room(clue.room).dans}.`;
      case 'someone_in_room': return `Il y avait quelqu'un d'autre dans la pièce ${de(n)} qui remplissait cette condition.`;
      case 'someone_offset':  return `Quelqu'un ${clue.dCol !== undefined ? 'dans la colonne voisine' : 'dans la ligne voisine'} ${de(n)} remplissait cette condition.`;
      case 'row_has':     return `Il y avait ${O.un} dans la ligne ${de(n)}${clue.sameRoom ? ', dans la même pièce' : ''}.`;
      case 'easternmost_col': return `${n} était dans la colonne la plus à l'est de sa pièce.`;
      case 'only_next_to': return `${n} était la seule personne à côté ${O.de}.`;
      case 'same_diagonal': return `${n} était sur la même diagonale que ${clue.others.map(o => subject(g, o).name).join(' ou ')}.`;
      case 'shared_next_to': return `${n} était à côté ${O.de}. Quelqu'un d'autre était à côté de ce même objet.`;
      case 'room_all':    return `Toutes les autres personnes de la pièce ${de(n)} remplissaient cette condition.`;
      case 'room_all_tag':    return `Toutes les personnes dans la pièce ${de(n)} avaient : ${clue.tag}.`;
      case 'easternmost_standing': return `${n} était la personne debout la plus à l'est de sa pièce.`;
      case 'count_in_room':   return `Il y avait ${NUMBERS[clue.count]} personnes de ce genre dans la pièce ${de(n)}.`;
      case 'room_composition': return `Il y avait ${clue.m} homme(s) et ${clue.f} femme(s) de plus dans la pièce ${de(n)}.`;
      case 'alone_with':  return `${n} était ${seul} avec ${other}.`;
      case 'no_gender_in_room': return `Il n'y avait pas ${clue.gender === 'f' ? 'de femme' : "d'homme"} dans la pièce ${de(n)}.`;
      case 'corner':      return `${n} était dans un coin.`;
      case 'row':         return clue.row === 0 ? `${n} était dans la ligne du haut.`
                            : clue.row === g.rows - 1 ? `${n} était dans la ligne du bas.`
                            : `${n} était dans la ${ORDINALS[clue.row]} ligne.`;
      case 'col':         return `${n} était dans la ${ORDINALS[clue.col]} colonne.`;
      case 'dir_object':  return `${n} était ${dirText(clue.dir, clue.exact, unit(clue.dir))} ${O.de}${clue.sameRoom ? ', dans la même pièce' : ''}.`;
      case 'dir_person':  return `${n} était ${dirText(clue.dir, clue.exact, unit(clue.dir))} ${de(other)}.`;
      case 'col_has':     return `Il y avait ${O.un} dans la colonne ${de(n)}${clue.otherRoom ? ', dans une autre pièce' : clue.sameRoom ? ', dans la même pièce' : ''}.`;
      case 'alone_with_gender': return `${n} était ${seul} avec ${clue.gender === 'f' ? 'une femme' : 'un homme'}.`;
      case 'col_has_exclusive': return `Il y avait ${O.un} dans la colonne ${de(n)}. Toutes les autres colonnes avec ${O.un} étaient vides.`;
      case 'adjacent_col_empty': return `La colonne directement ${clue.dir === 'e' ? "à l'est" : "à l'ouest"} ${de(n)} était vide.`;
      default:            return '?';
    }
  })();
  return cap(s);
}

/** Lignes du carnet : rôles à deviner, indices, règles globales, victime. */
export function notebook(g) {
  const v = g.byId[g.victim];
  const lines = [];
  if (g.roles) {
    const names = g.roles.candidates.map(id => g.byId[id].name);
    const roles = Object.values(g.roles.list).map(r => r.label);
    lines.push(`${names.slice(0, -1).join(', ')} et ${names.at(-1)} étaient ${roles.slice(0, -1).join(', ')} et ${roles.at(-1)}, dans un ordre inconnu.`);
  }
  lines.push(...g.clues.map(cl => clueText(g, cl)).filter(Boolean));
  lines.push(...g.rules.map(r => ruleText(g, r)));
  lines.push(`${v.name} est la victime : ${v.g === 'f' ? 'elle' : 'il'} était ${v.g === 'f' ? 'seule' : 'seul'} avec le meurtrier.`);
  return lines;
}

export const cellKey = key;
