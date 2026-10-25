#!/usr/bin/env node
// Vérifie une grille : solution cohérente avec les règles et les indices, et unique.
// Usage : node tools/check.mjs puzzles/001.json [--suggest] [--seed=N]
//   sans "solution" dans le JSON : résout la grille et affiche la ou les solutions.
//   --suggest : propose un jeu d'indices minimal qui rend la solution unique,
//               à la manière du livre (pas d'indice sur la victime, un indice par suspect si possible).
import { readFileSync } from 'node:fs';
import { compile, solve, checkClue, checkGlobal, murderer, clueText, roleAssignments, resolveClues, OBJECTS } from '../js/rules.js';

const file = process.argv[2];
const suggest = process.argv.includes('--suggest');
const g = compile(JSON.parse(readFileSync(file, 'utf8')));
const sol = g.solution;

if (!sol) {
  const s = solve(g, g.clues, 3);
  console.log(s.length === 1 ? '✅ Solution unique' : `❌ ${s.length === 0 ? 'Aucune solution' : 'Plusieurs solutions'}`);
  for (const p of s) console.log(' ', JSON.stringify(p), '→ coupable :', g.byId[murderer(g, p)].name);
  process.exit(s.length === 1 ? 0 : 1);
}

// 1. La solution respecte-t-elle les règles ?
const rows = new Set(), cols = new Set();
for (const [id, [r, c]] of Object.entries(sol)) {
  if (!g.occupiable(r, c)) throw new Error(`${id} est sur une case non occupable (${r},${c})`);
  rows.add(r); cols.add(c);
}
if (rows.size !== g.people.length || cols.size !== g.people.length) throw new Error('Une ligne ou une colonne a plusieurs personnes');
for (const rule of g.rules) if (!checkGlobal(g, rule, sol)) throw new Error(`Règle non respectée : ${rule}`);
const killer = murderer(g, sol);
if (!killer) throw new Error('La victime doit partager sa pièce avec exactement un suspect');
console.log(`Coupable : ${g.byId[killer].name}`);

// Avec des rôles inconnus, il faut au moins une attribution qui rende tous les indices vrais.
const okRoles = roleAssignments(g).find(roles => resolveClues(g.clues, roles).every(cl => checkClue(g, cl, sol)));
if (!okRoles) {
  const bad = g.clues.find(cl => !checkClue(g, resolveClues([cl], roleAssignments(g)[0])[0], sol));
  throw new Error(`Indice faux pour la solution : ${bad ? clueText(g, bad) : '?'}`);
}
if (g.roles) console.log('Rôles :', Object.entries(okRoles).map(([r, id]) => `${g.byId[id].name} = ${r}`).join(', '));

if (!suggest) {
  const s = solve(g, g.clues, 2);
  console.log(s.length === 1 ? '✅ Solution unique' : `❌ ${s.length === 0 ? 'Aucune' : 'Plusieurs'} solution(s)`);
  process.exit(s.length === 1 ? 0 : 1);
}

// 2. Suggestion : tous les indices vrais sur les suspects, puis glouton + minimisation.
const suspects = g.people.filter(p => p.id !== g.victim).map(p => p.id);
const pool = [];
const add = cl => { if (checkClue(g, cl, sol)) pool.push(cl); };
for (const id of suspects) {
  for (const t of Object.keys(OBJECTS)) {
    if (OBJECTS[t].occupiable) { add({ who: id, type: 'on', object: t }); add({ who: id, type: 'only_on', object: t }); }
    add({ who: id, type: 'next_to', object: t });
    add({ who: id, type: 'room_has', object: t });
  }
  add({ who: id, type: 'window' });
  add({ who: id, type: 'corner' });
  add({ who: id, type: 'row', row: 0 });
  add({ who: id, type: 'row', row: g.rows - 1 });
  add({ who: id, type: 'col', col: 0 });
  add({ who: id, type: 'col', col: g.cols - 1 });
  add({ who: id, type: 'no_gender_in_room', gender: 'f' });
  add({ who: id, type: 'no_gender_in_room', gender: 'm' });
  g.rooms.forEach((_, i) => {
    add({ who: id, type: 'in_room', room: i });
    add({ who: id, type: 'not_in_room', room: i });
    add({ who: id, type: 'alone', room: i });
  });
  for (const other of suspects) if (other !== id) {
    add({ who: id, type: 'same_room', other });
    add({ who: id, type: 'alone_with', other });
  }
}

const count = cls => solve(g, cls, 3000).length;
let chosen = [...g.clues];
let seed = Number(process.argv.find(a => a.startsWith('--seed='))?.slice(7) ?? 1);
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
pool.sort(() => rnd() - 0.5);
const perPerson = id => chosen.filter(c => c.who === id).length;
while (count(chosen) > 1) {
  let best = null, bestScore = Infinity;
  for (const cl of pool) {
    if (chosen.includes(cl)) continue;
    const k = count([...chosen, cl]);
    if (k < 1) continue;
    const score = k * (1 + perPerson(cl.who)); // favorise les suspects sans indice
    if (score < bestScore) { best = cl; bestScore = score; }
  }
  if (!best) { console.log('Impossible de rendre la solution unique avec ces types d\'indices.'); process.exit(1); }
  chosen.push(best);
}
for (const cl of [...chosen].reverse()) {
  const without = chosen.filter(x => x !== cl);
  if (count(without) === 1) chosen = without;
}
console.log(`\n${chosen.length} indices :`);
for (const cl of chosen) console.log(' ', clueText(g, cl), '  ', JSON.stringify(cl));
