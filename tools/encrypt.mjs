#!/usr/bin/env node
// Chiffre les grilles privées de puzzles/livre/ dans puzzles/livre.enc.json (seul fichier publié).
// Usage : HC_PASSWORD='…' node tools/encrypt.mjs
//   Le mot de passe ne doit jamais être écrit dans le dépôt.
//   Le sel du fichier existant est réutilisé : avec le même mot de passe, les téléphones
//   déjà déverrouillés voient les nouvelles grilles sans ressaisir le mot de passe.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { deriveKey, seal, open, fromB64, ITERATIONS } from '../js/vault.js';

const OUT = 'puzzles/livre.enc.json';
const password = process.env.HC_PASSWORD;
if (!password) { console.error('Donne le mot de passe dans HC_PASSWORD.'); process.exit(1); }

const index = JSON.parse(readFileSync('puzzles/livre/index.json', 'utf8'));
const puzzles = index.map(entry => ({ ...entry, puzzle: JSON.parse(readFileSync(`puzzles/${entry.file}`, 'utf8')) }));

const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const salt = old ? fromB64(old.salt) : crypto.getRandomValues(new Uint8Array(16));
const iterations = old?.iterations ?? ITERATIONS;
const key = await deriveKey(password, salt, iterations);
if (old) {
  try { await open(old, key); } catch {
    console.error(`Ce mot de passe n'ouvre pas ${OUT}. Pour en changer, supprime d'abord ce fichier.`);
    process.exit(1);
  }
}

const box = await seal(puzzles, key, salt, iterations);
if (JSON.stringify(await open(box, key)) !== JSON.stringify(puzzles)) throw new Error('relecture différente');
writeFileSync(OUT, JSON.stringify(box) + '\n');
console.log(`${OUT} : ${puzzles.length} affaires chiffrées (${puzzles.map(p => p.id).join(', ')}).`);
