import { compile, notebook, murderer, cellKey } from './rules.js';
import { floorFor, objectSvg, SHAPES, THEMES } from './art.js';
import { deriveKey, exportKey, importKey, open, fromB64 } from './vault.js';

const $ = sel => document.querySelector(sel);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ---------- Stockage (tolérant aux navigateurs qui le bloquent) ----------
const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ }
  },
};

// notes : annotations au crayon, { "r,c": [ids] }. Ignorées par « Vérifier ».
const emptyState = () => ({ place: {}, marks: [], notes: {}, struck: [], solved: false });

// ---------- État de l'application ----------
let catalog = [];          // [{ id, file, puzzle }]
let g = null;              // grille compilée en cours
let state = emptyState();
let history = [];
let tool = null;           // id de personne, 'x' ou 'erase'
let noting = false;        // interrupteur « Annoter » : les appuis écrivent des initiales au crayon
let holdUntil = 0;         // après un appui long, ignore le clic qui suit
let resetArmed = false;
let options = { shade: true, theme: 'auto', ...store.get('hc:options', {}) };

// Essai : tous les joueurs peuvent comparer plusieurs façons d'annoter (réglage en bas de page).
// On ne gardera que celle qui plaît le plus.
const NOTE_MODES = {
  switch: { label: 'Interrupteur « Annoter »', hint: 'Active « Annoter » pour écrire des initiales au crayon.' },
  hold: { label: 'Appui long', hint: 'Appui long sur une case : initiale au crayon. Appui bref : placer.' },
  cycle: { label: 'Appuis successifs', hint: 'Chaque appui : initiale au crayon, puis placée, puis effacée.' },
};
const noteMode = () => (options.noteMode in NOTE_MODES ? options.noteMode : 'switch');

/** Thème affiché : le choix du joueur, sinon celui de l'affaire, sinon le Manoir. */
const themeOf = puzzle => (options.theme !== 'auto' && THEMES[options.theme]) ? options.theme : (THEMES[puzzle?.theme] ? puzzle.theme : 'manoir');

// ---------- Chargement ----------
async function loadCatalog() {
  const index = await (await fetch('puzzles/index.json')).json();
  catalog = await Promise.all(index.map(async entry => ({
    ...entry,
    puzzle: await (await fetch(`puzzles/${entry.file}`)).json(),
  })));
  catalog.push(...await privateCases());
}

// ---------- Affaires privées (grilles du livre) ----------
// En local, les fichiers en clair de puzzles/livre/. En ligne, seulement leur version chiffrée,
// ouverte par mot de passe (petit lien en bas de l'accueil) ; l'appareil garde ensuite la clé.
let vault = null;          // contenu de puzzles/livre.enc.json
let vaultOpen = false;
let showVault = new URLSearchParams(location.search).has('livre');

async function privateCases() {
  try {
    const res = await fetch('puzzles/livre/index.json');
    if (res.ok) {
      vaultOpen = true;
      return Promise.all((await res.json()).map(async entry => ({
        ...entry,
        puzzle: await (await fetch(`puzzles/${entry.file}`)).json(),
      })));
    }
  } catch { /* pas de fichiers en clair */ }
  try {
    const res = await fetch('puzzles/livre.enc.json');
    if (!res.ok) return [];
    vault = await res.json();
  } catch { return []; }
  const saved = store.get('hc:livre', null);
  if (!saved || saved.salt !== vault.salt) return [];
  try {
    const cases = await open(vault, await importKey(saved.key));
    vaultOpen = true;
    return cases;
  } catch {
    localStorage.removeItem('hc:livre'); // mot de passe changé depuis
    return [];
  }
}

function renderVault() {
  $('#vault-toggle').hidden = !vault || showVault;
  $('#vault').hidden = !(showVault && vault);
  $('#vault-ask').hidden = vaultOpen;
  $('#vault-done').hidden = !vaultOpen;
}

$('#vault').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#vault-msg');
  const input = $('#vault-pass');
  msg.textContent = 'Vérification…';
  try {
    const key = await deriveKey(input.value, fromB64(vault.salt), vault.iterations);
    const cases = await open(vault, key);
    store.set('hc:livre', { salt: vault.salt, key: await exportKey(key) });
    catalog = catalog.filter(c => !cases.some(x => x.id === c.id)).concat(cases);
    vaultOpen = true;
    input.value = '';
    msg.textContent = '';
    renderHome();
  } catch {
    msg.textContent = 'Mot de passe incorrect.';
  }
});

$('#vault-toggle').addEventListener('click', () => {
  showVault = true;
  renderVault();
  if (!vaultOpen) $('#vault-pass').focus();
});

$('#vault-lock').addEventListener('click', () => {
  localStorage.removeItem('hc:livre');
  location.reload();
});

function progressOf(id) {
  const s = store.get(`hc:case:${id}`, null);
  if (!s) return 'new';
  if (s.solved) return 'done';
  return Object.keys(s.place).length || s.marks.length || Object.keys(s.notes ?? {}).length ? 'progress' : 'new';
}

// ---------- Accueil ----------
function renderHome() {
  renderVault();
  const list = $('#case-list');
  list.replaceChildren(...catalog.map(({ id, puzzle }) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-link';
    const p = progressOf(id);
    const label = { new: 'Nouveau', progress: 'En cours', done: 'Classée' }[p];
    btn.innerHTML = `
      <span class="case-num">${id}</span>
      <span class="case-meta"><strong></strong><span></span></span>
      <span class="badge ${p}">${label}</span>`;
    btn.querySelector('strong').textContent = puzzle.title;
    const cols = Math.max(...puzzle.roomMap.map(row => row.length));
    btn.querySelector('.case-meta span').textContent = `${puzzle.difficulty} · ${puzzle.roomMap.length}×${cols}`;
    btn.addEventListener('click', () => { location.hash = `c${id}`; });
    li.append(btn);
    return li;
  }));
}

// ---------- Ouverture d'une affaire ----------
function openCase(id) {
  const entry = catalog.find(c => c.id === id);
  if (!entry) return showHome();
  g = compile(entry.puzzle);
  state = { ...emptyState(), ...store.get(`hc:case:${id}`, {}) };
  history = [];
  tool = g.people.find(p => !state.place[p.id])?.id ?? null;
  noting = false;
  resetArmed = false;

  $('#case-no').textContent = `Affaire n° ${id} · ${g.difficulty}`;
  $('#case-name').textContent = g.title;
  $('#case-intro').textContent = g.intro ?? '';
  $('#opt-shade').checked = options.shade;
  renderNoteModeSelect();
  renderThemeSelect();

  renderLegend();
  renderClues();
  renderTools();
  renderBoard();
  setStatus('');

  $('#home').hidden = true;
  $('#case').hidden = false;
  window.scrollTo(0, 0);
}

function showHome() {
  g = null;
  $('#case').hidden = true;
  $('#verdict').hidden = true;
  $('#home').hidden = false;
  renderHome();
}

function route() {
  const m = location.hash.match(/^#c(\w+)$/);
  if (m) openCase(m[1]); else showHome();
}

// ---------- Rendu ----------
function renderLegend() {
  const theme = themeOf(g);
  const legend = $('#obj-legend');
  legend.className = `obj-legend t-${theme}`;
  const present = [...new Set(g.instances.map(i => i.type))];
  legend.replaceChildren();
  for (const [ok, title] of [[true, 'Occupables'], [false, 'Non occupables']]) {
    const types = present.filter(t => g.types[t].occupiable === ok);
    if (!types.length) continue;
    const p = document.createElement('p');
    p.append(Object.assign(document.createElement('strong'), { textContent: title }));
    for (const t of types) {
      const item = Object.assign(document.createElement('span'), { className: 'lg-item' });
      const ico = Object.assign(document.createElement('span'), { className: 'lg-ico' });
      ico.append(objectPreview(t, theme, ico));
      item.append(ico, g.types[t].label);
      p.append(item);
    }
    legend.append(p);
  }
}

/** Petit dessin d'un objet tel qu'il apparaît sur le plan, dans le thème courant. */
function objectPreview(type, theme, box) {
  const el = document.createElement('span');
  const shape = g.types[type].shape ?? SHAPES[type];
  if (shape) {
    el.className = `ob ob-${shape} horiz`;
    if (shape === 'bed') { el.innerHTML = '<i class="pillow"></i>'; box.classList.add('wide'); el.style.setProperty('--len', 2); }
    else el.style.setProperty('--len', 1);
  } else {
    const svg = objectSvg(type, theme);
    if (svg) { el.className = 'ob ob-art'; el.innerHTML = svg; }
    else { el.className = 'ob ob-emoji'; el.textContent = g.types[type].icon ?? ''; }
  }
  return el;
}

function renderClues() {
  $('#clue-list').replaceChildren(...notebook(g).map((text, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'clue' + (state.struck.includes(i) ? ' struck' : '');
    b.innerHTML = '<span></span>';
    b.querySelector('span').textContent = text;
    b.setAttribute('aria-pressed', state.struck.includes(i));
    b.addEventListener('click', () => {
      state.struck = state.struck.includes(i) ? state.struck.filter(x => x !== i) : [...state.struck, i];
      save();
      renderClues();
    });
    li.append(b);
    return li;
  }));
}

function personDot(p, cls = 'dot') {
  const span = document.createElement('span');
  span.className = cls + (p.victim ? ' victim' : '');
  span.style.setProperty('--ph', p.hue);
  span.textContent = p.name[0];
  return span;
}

function renderTools() {
  $('#people').replaceChildren(...g.people.map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.place[p.id] ? ' placed' : '');
    b.setAttribute('aria-pressed', tool === p.id);
    b.append(personDot(p), document.createTextNode(p.victim ? `${p.name} (victime)` : p.name));
    b.addEventListener('click', () => { tool = p.id; renderTools(); });
    return b;
  }));
  for (const btn of document.querySelectorAll('.chip.tool')) {
    btn.setAttribute('aria-pressed', tool === btn.dataset.tool);
  }
  const note = $('#tool-note');
  note.hidden = noteMode() !== 'switch';
  note.setAttribute('aria-pressed', noting);
  $('#note-hint').textContent = NOTE_MODES[noteMode()].hint;
}

const X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5 Q12 11 19 18.5 M18.5 5 Q12 12.5 5.5 19" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

function renderBoard(popKey = null, nopeKey = null) {
  const board = $('#board');
  const theme = themeOf(g);
  board.className = `board t-${theme}`;
  board.style.setProperty('--cols', g.cols);
  const els = [];
  const place = (el, row, col, rowSpan = 1, colSpan = 1) => {
    el.style.gridRow = `${row + 2} / span ${rowSpan}`;
    el.style.gridColumn = `${col + 2} / span ${colSpan}`;
    return el;
  };

  // Personne par case, lignes/colonnes occupées, conflits.
  const at = new Map();
  const rowCount = {}, colCount = {};
  for (const [id, [r, c]] of Object.entries(state.place)) {
    at.set(cellKey(r, c), id);
    rowCount[r] = (rowCount[r] ?? 0) + 1;
    colCount[c] = (colCount[c] ?? 0) + 1;
  }
  const marks = new Set(state.marks);
  // Chaque personne a sa place fixe dans la case, comme les annotations d'un sudoku.
  const side = Math.ceil(Math.sqrt(g.people.length));
  board.style.setProperty('--nside', side);
  const floors = g.rooms.map(floorFor);

  // Axes.
  for (let c = 0; c < g.cols; c++) {
    const a = Object.assign(document.createElement('span'), { className: 'axis', textContent: LETTERS[c] });
    a.style.gridRow = '1'; a.style.gridColumn = `${c + 2}`;
    els.push(a);
  }
  for (let r = 0; r < g.rows; r++) {
    const a = Object.assign(document.createElement('span'), { className: 'axis row', textContent: r + 1 });
    a.style.gridRow = `${r + 2}`; a.style.gridColumn = '1';
    els.push(a);
  }

  // Géométrie des objets : boîte englobante, et forme rectangulaire ou non (table en L, tapis en T).
  const bbox = inst => {
    const rs = inst.cells.map(x => x[0]), cs = inst.cells.map(x => x[1]);
    const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...cs), c1 = Math.max(...cs);
    return { r0, c0, h: r1 - r0 + 1, w: c1 - c0 + 1, rect: (r1 - r0 + 1) * (c1 - c0 + 1) === inst.cells.length };
  };

  // Objets non rectangulaires : un morceau par case, collé aux morceaux voisins du même objet.
  const pieces = new Map();
  for (const inst of g.instances) {
    const shape = g.types[inst.type].shape ?? SHAPES[inst.type];
    if (!shape || bbox(inst).rect) continue;
    const mine = new Set(inst.cells.map(([r, c]) => cellKey(r, c)));
    for (const [r, c] of inst.cells) {
      const j = { n: mine.has(cellKey(r - 1, c)), s: mine.has(cellKey(r + 1, c)), w: mine.has(cellKey(r, c - 1)), e: mine.has(cellKey(r, c + 1)) };
      const el = document.createElement('span');
      el.className = `piece ${shape}`;
      const pad = shape === 'rug' ? '10%' : '8%';
      el.style.top = j.n ? '0' : pad; el.style.bottom = j.s ? '0' : pad;
      el.style.left = j.w ? '0' : pad; el.style.right = j.e ? '0' : pad;
      const rad = (a, b) => (j[a] || j[b]) ? '0' : '6px';
      el.style.borderRadius = `${rad('n', 'w')} ${rad('n', 'e')} ${rad('s', 'e')} ${rad('s', 'w')}`;
      for (const side of ['n', 's', 'e', 'w']) if (j[side]) el.classList.add(`j${side}`);
      if (!pieces.has(cellKey(r, c))) pieces.set(cellKey(r, c), []);
      pieces.get(cellKey(r, c)).push(el);
    }
  }

  const overlays = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!g.inGrid(r, c)) continue;
      const k = cellKey(r, c);
      const room = g.roomAt(r, c);
      const objs = g.objectsAt.get(k) ?? [];
      const who = at.get(k);
      const btn = place(document.createElement('button'), r, c);
      btn.type = 'button';
      btn.className = `cell f-${floors[room]}`;
      btn.style.setProperty('--h', g.rooms[room].hue);
      // Murs : en haut/à gauche dès que la pièce change ; à droite/en bas seulement au bord du plan.
      if (g.roomAt(r - 1, c) !== room) btn.classList.add('wt');
      if (g.roomAt(r, c - 1) !== room) btn.classList.add('wl');
      if (!g.inGrid(r + 1, c)) btn.classList.add('wb');
      if (!g.inGrid(r, c + 1)) btn.classList.add('wr');
      if (!g.occupiable(r, c)) btn.classList.add('blocked');
      if (k === popKey) btn.classList.add('pop');
      if (k === nopeKey) btn.classList.add('nope');
      if (options.shade && !who && (rowCount[r] || colCount[c])) {
        overlays.push(place(Object.assign(document.createElement('span'), { className: 'shade' }), r, c));
      }

      btn.append(...(pieces.get(k) ?? []));
      for (const w of g.windows) {
        if (w.cell[0] === r && w.cell[1] === c) {
          btn.append(Object.assign(document.createElement('span'), { className: `win ${w.side}` }));
        }
      }
      if (who) {
        const t = personDot(g.byId[who], 'token');
        if (rowCount[r] > 1 || colCount[c] > 1) t.classList.add('conflict');
        btn.append(t);
      } else if (marks.has(k)) {
        const m = document.createElement('span');
        m.className = 'mark';
        m.innerHTML = X_SVG;
        btn.append(m);
      }
      const noted = who ? [] : (state.notes[k] ?? []);
      if (noted.length) {
        const box = Object.assign(document.createElement('span'), { className: 'notes' });
        for (const id of noted) {
          const i = g.people.findIndex(p => p.id === id);
          const n = Object.assign(document.createElement('span'), { className: 'note', textContent: g.byId[id].name[0] });
          n.style.setProperty('--ph', g.byId[id].hue);
          n.style.gridRow = `${Math.floor(i / side) + 1}`;
          n.style.gridColumn = `${(i % side) + 1}`;
          box.append(n);
        }
        btn.append(box);
      }

      const parts = [`${LETTERS[c]}${r + 1}`, g.rooms[room].name, ...objs.map(t => g.types[t].label)];
      if (g.windowCells.has(k)) parts.push('devant une fenêtre');
      if (who) parts.push(g.byId[who].name);
      else if (marks.has(k)) parts.push('barrée');
      if (noted.length) parts.push(`annoté ${noted.map(id => g.byId[id].name).join(', ')}`);
      btn.setAttribute('aria-label', parts.join(', '));
      btn.addEventListener('click', () => { if (Date.now() > holdUntil) onCell(r, c); });
      if (noteMode() === 'hold') holdToNote(btn, r, c);
      els.push(btn);
    }
  }

  // Objets : un seul dessin par objet, sur toute sa surface (le lit de 2 cases est un lit).
  // Les surfaces (tapis, lits, tables) d'abord, les objets posés dessus ensuite (un tonneau sur un tapis).
  const byLayer = [...g.instances].sort((a, b) => Number(!(g.types[a.type].shape ?? SHAPES[a.type])) - Number(!(g.types[b.type].shape ?? SHAPES[b.type])));
  for (const inst of byLayer) {
    const def = g.types[inst.type];
    const b = bbox(inst);
    const shape = def.shape ?? SHAPES[inst.type];
    const el = document.createElement('span');
    if (shape) {
      if (!b.rect) continue; // déjà dessiné en morceaux
      el.className = `ob ob-${shape} ${b.h > b.w ? 'vert' : 'horiz'}`;
      el.style.setProperty('--len', Math.max(b.h, b.w));
      el.style.setProperty('--h', g.rooms[g.roomAt(...inst.cells[0])].hue);
      if (shape === 'bed') el.innerHTML = '<i class="pillow"></i>';
    } else {
      const svg = objectSvg(inst.type, theme);
      if (svg) { el.className = `ob ob-art ob-${inst.type}`; el.innerHTML = svg; }
      else if (def.icon) { el.className = 'ob ob-emoji'; el.textContent = def.icon; }
      else continue;
    }
    if (b.rect) els.push(place(el, b.r0, b.c0, b.h, b.w));
    else els.push(place(el, inst.cells[0][0], inst.cells[0][1]));
  }

  // Noms des pièces, posés sur le mur du bas comme sur un plan.
  g.rooms.forEach((room, i) => {
    let best = null;
    for (let r = g.rows - 1; r >= 0 && !best; r--) {
      let run = null;
      for (let c = 0; c <= g.cols; c++) {
        if (c < g.cols && g.roomAt(r, c) === i) { run ??= { r, c0: c, w: 0 }; run.w++; }
        else if (run) { if (!best || run.w > best.w) best = run; run = null; }
      }
    }
    if (!best) return;
    const el = place(document.createElement('span'), best.r, best.c0, 1, best.w);
    el.className = 'room-label';
    el.innerHTML = '<span></span>';
    el.firstChild.textContent = room.name;
    overlays.push(el);
  });
  els.push(...overlays);
  board.replaceChildren(...els);
}

// ---------- Interaction ----------
function snapshot() {
  history.push(JSON.stringify(state));
  if (history.length > 300) history.shift();
}

function save() {
  store.set(`hc:case:${g.id}`, state);
}

const whoAt = (r, c) => Object.entries(state.place).find(([, [rr, cc]]) => rr === r && cc === c)?.[0];

/** Ajoute ou retire l'initiale d'une personne au crayon dans une case. */
function toggleNote(r, c) {
  const k = cellKey(r, c);
  if (!tool || tool === 'x' || tool === 'erase') { setStatus('Choisis d’abord la personne à annoter.', 'bad'); return; }
  if (!g.occupiable(r, c) || whoAt(r, c)) { renderBoard(null, k); return; }
  disarmReset();
  snapshot();
  const list = state.notes[k] ?? [];
  const next = list.includes(tool) ? list.filter(id => id !== tool) : [...list, tool];
  if (next.length) state.notes[k] = next; else delete state.notes[k];
  state.marks = state.marks.filter(x => x !== k);
  save();
  setStatus('');
  renderBoard();
}

/** Mode essai « appui long » : maintenir le doigt sur une case l'annote. */
function holdToNote(btn, r, c) {
  let timer = null;
  const stop = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', e => {
    if (e.button) return;
    stop();
    timer = setTimeout(() => {
      timer = null;
      holdUntil = Date.now() + 700;
      navigator.vibrate?.(15);
      toggleNote(r, c);
    }, 420);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

function onCell(r, c) {
  if (!tool) { setStatus('Choisis d’abord une personne, Barrer ou Gomme.', 'bad'); return; }
  const k = cellKey(r, c);
  const who = whoAt(r, c);
  const isPerson = tool !== 'x' && tool !== 'erase';
  if (isPerson && noteMode() === 'switch' && noting) return toggleNote(r, c);
  // Mode essai « appuis successifs » : vide → annotée → placée → vide.
  if (isPerson && noteMode() === 'cycle' && who !== tool && !(state.notes[k] ?? []).includes(tool)) return toggleNote(r, c);
  disarmReset();

  if (tool === 'x') {
    if (who) return;
    snapshot();
    state.marks = state.marks.includes(k) ? state.marks.filter(x => x !== k) : [...state.marks, k];
    delete state.notes[k];
  } else if (tool === 'erase') {
    if (!who && !state.marks.includes(k) && !state.notes[k]) return;
    snapshot();
    if (who) delete state.place[who];
    state.marks = state.marks.filter(x => x !== k);
    delete state.notes[k];
  } else {
    if (!g.occupiable(r, c)) {
      const t = (g.objectsAt.get(k) ?? []).find(t => !g.types[t].occupiable);
      setStatus(`Personne ne peut se tenir sur ${g.types[t].un}.`, 'bad');
      renderBoard(null, k);
      return;
    }
    snapshot();
    if (who === tool) {
      delete state.place[tool];
    } else {
      if (who) delete state.place[who];
      state.place[tool] = [r, c];
      state.marks = state.marks.filter(x => x !== k);
      const left = (state.notes[k] ?? []).filter(id => id !== tool);
      if (left.length) state.notes[k] = left; else delete state.notes[k];
    }
  }
  save();
  setStatus('');
  renderTools();
  renderBoard(tool !== 'x' && tool !== 'erase' ? k : null);
  maybeSolved();
}

function wrongCount() {
  return Object.entries(state.place).filter(([id, [r, c]]) => {
    const [sr, sc] = g.solution[id];
    return sr !== r || sc !== c;
  }).length;
}

function maybeSolved() {
  const placed = Object.keys(state.place).length;
  if (placed !== g.people.length || wrongCount() > 0) return false;
  if (!state.solved) { state.solved = true; save(); }
  const killer = g.byId[murderer(g, g.solution)];
  const [vr, vc] = g.solution[g.victim];
  const room = g.rooms[g.roomAt(vr, vc)];
  const victim = g.byId[g.victim];
  $('#verdict-text').textContent =
    `${killer.name} était ${killer.g === 'f' ? 'seule' : 'seul'} avec ${victim.name} ${room.dans}. Toutes les pièces du puzzle sont en place.`;
  $('#verdict').hidden = false;
  $('#verdict-close').focus();
  return true;
}

function setStatus(msg, kind = '') {
  const el = $('#status');
  el.textContent = msg;
  el.className = 'status' + (kind ? ` ${kind}` : '');
}

function disarmReset() {
  resetArmed = false;
  const b = $('#reset');
  b.classList.remove('armed');
  b.textContent = 'Recommencer';
}

// ---------- Boutons ----------
$('#back').addEventListener('click', () => { location.hash = ''; });
$('#verdict-close').addEventListener('click', () => { location.hash = ''; });

for (const btn of document.querySelectorAll('.chip.tool')) {
  btn.addEventListener('click', () => { tool = btn.dataset.tool; renderTools(); });
}

$('#tool-note').addEventListener('click', () => {
  noting = !noting;
  if (noting && (tool === 'x' || tool === 'erase')) tool = g.people.find(p => !state.place[p.id])?.id ?? g.people[0].id;
  renderTools();
});

$('#undo').addEventListener('click', () => {
  disarmReset();
  if (!history.length) { setStatus('Rien à annuler.'); return; }
  state = JSON.parse(history.pop());
  save();
  setStatus('');
  renderTools();
  renderBoard();
  renderClues();
});

$('#check').addEventListener('click', () => {
  disarmReset();
  if (maybeSolved()) return;
  const placed = Object.keys(state.place).length;
  if (wrongCount() > 0) {
    setStatus('Quelque chose cloche : au moins une personne est mal placée.', 'bad');
  } else if (placed === 0) {
    setStatus('Le plan est vide. Commence par l’indice le plus précis.');
  } else {
    const left = g.people.length - placed;
    setStatus(`Rien d’incohérent pour l’instant. Encore ${left} à placer.`, 'ok');
  }
});

$('#reset').addEventListener('click', () => {
  const b = $('#reset');
  if (!resetArmed) {
    resetArmed = true;
    b.classList.add('armed');
    b.textContent = 'Tout effacer ?';
    return;
  }
  snapshot();
  state = emptyState();
  save();
  disarmReset();
  setStatus('Plan effacé. « Annuler » le restaure.');
  tool = g.people[0].id;
  renderTools();
  renderBoard();
  renderClues();
});

function renderNoteModeSelect() {
  const sel = $('#opt-notes');
  sel.replaceChildren(...Object.entries(NOTE_MODES).map(([id, m]) => new Option(m.label, id)));
  sel.value = noteMode();
}

$('#opt-notes').addEventListener('change', e => {
  options.noteMode = e.target.value;
  noting = false;
  store.set('hc:options', options);
  renderTools();
  renderBoard();
});

function renderThemeSelect() {
  const sel = $('#opt-theme');
  const auto = THEMES[g?.theme]?.label ?? THEMES.manoir.label;
  sel.replaceChildren(
    new Option(`Auto (${auto})`, 'auto'),
    ...Object.entries(THEMES).map(([id, t]) => new Option(t.label, id)),
  );
  sel.value = options.theme in THEMES ? options.theme : 'auto';
}

$('#opt-theme').addEventListener('change', e => {
  options.theme = e.target.value;
  store.set('hc:options', options);
  renderBoard();
  renderLegend();
});

$('#opt-shade').addEventListener('change', e => {
  options.shade = e.target.checked;
  store.set('hc:options', options);
  renderBoard();
});

document.addEventListener('keydown', e => {
  if (!g) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); $('#undo').click(); }
  if (e.key === 'Escape' && !$('#verdict').hidden) $('#verdict').hidden = true;
});

window.addEventListener('hashchange', route);

// ---------- Démarrage ----------
(async () => {
  try {
    await loadCatalog();
  } catch (err) {
    $('#case-list').innerHTML = '<li class="status bad">Impossible de charger les affaires. Ouvre le site via un serveur web (GitHub Pages ou <code>npx serve</code>), pas en double-cliquant le fichier.</li>';
    console.error(err);
    return;
  }
  route();
})();

// Mode hors ligne (ignoré là où les service workers ne sont pas permis).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
