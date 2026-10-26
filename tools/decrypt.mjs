#!/usr/bin/env node
// Recrée puzzles/livre/ (grilles privées en clair, ignorées par git) à partir de puzzles/livre.enc.json.
// Usage : HC_PASSWORD='…' node tools/decrypt.mjs
//   Utile en début de session : le dépôt ne contient que la version chiffrée.
//   N'écrase pas un fichier existant différent, sauf avec --force.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { deriveKey, open, fromB64 } from '../js/vault.js';

const password = process.env.HC_PASSWORD;
if (!password) { console.error('Donne le mot de passe dans HC_PASSWORD.'); process.exit(1); }
const force = process.argv.includes('--force');

const box = JSON.parse(readFileSync('puzzles/livre.enc.json', 'utf8'));
let cases;
try {
  cases = await open(box, await deriveKey(password, fromB64(box.salt), box.iterations));
} catch {
  console.error('Mot de passe incorrect.');
  process.exit(1);
}

mkdirSync('puzzles/livre', { recursive: true });
const write = (file, data) => {
  const text = JSON.stringify(data, null, 1);
  if (existsSync(file) && readFileSync(file, 'utf8').trim() !== text && !force) {
    console.error(`${file} existe et diffère : ignoré (--force pour écraser).`);
    return;
  }
  writeFileSync(file, text);
};
for (const { puzzle, ...entry } of cases) write(`puzzles/${entry.file}`, puzzle);
write('puzzles/livre/index.json', cases.map(({ puzzle, ...entry }) => entry));
console.log(`puzzles/livre/ : ${cases.length} affaires (${cases.map(c => c.id).join(', ')}).`);
