#!/usr/bin/env node
/**
 * genera-historial.js — eina de Medicació assistida
 *
 * Genera src/96_Historial.gs a partir de CANVIS.md. S'executa des de l'arrel
 * del projecte: node eines/genera-historial.js
 * S'atura si una versió no té data, resum o migració, si hi ha una categoria
 * desconeguda o si la primera versió no és VERSIO de src/00_Config.gs.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 */
'use strict';
const fs = require('fs');
const path = require('path');

const arrel = process.argv[2] || process.cwd();
const CATEGORIES = ['Afegit', 'Canviat', 'Obsolet', 'Eliminat', 'Corregit', 'Seguretat'];

function atura(missatge) {
  console.error('ERROR genera-historial: ' + missatge);
  process.exit(1);
}

const rutaCanvis = path.join(arrel, 'CANVIS.md');
const rutaConfig = path.join(arrel, 'src', '00_Config.gs');
const rutaSortida = path.join(arrel, 'src', '96_Historial.gs');
if (!fs.existsSync(rutaCanvis)) atura('no hi ha CANVIS.md');
if (!fs.existsSync(rutaConfig)) atura('no hi ha src/00_Config.gs');

const config = fs.readFileSync(rutaConfig, 'utf8');
const mVersio = config.match(/\bVERSIO\s*=\s*['"]([^'"]+)['"]/);
if (!mVersio) atura('no es troba VERSIO a 00_Config.gs');
const versioCodi = mVersio[1];

const linies = fs.readFileSync(rutaCanvis, 'utf8').split(/\r?\n/);
const mTitol = (linies.find(l => /^#\s+Registre de canvis/.test(l)) || '').match(/—\s*(.+)$/);
const nomApp = mTitol ? mTitol[1].trim() : 'Aplicació';

const neteja = s => s.replace(/`/g, '').trim();
const majuscula = s => s.charAt(0).toUpperCase() + s.slice(1);

const versions = [];
let actual = null;
let categoria = null;
for (const linia of linies) {
  const mV = linia.match(/^##\s+\[([^\]]+)\](?:\s*·\s*(\S+))?/);
  if (mV) {
    categoria = null;
    if (/sense publicar/i.test(mV[1])) { actual = null; continue; }
    actual = { versio: mV[1].trim(), data: mV[2] || '', resum: '', migracio: '', canvis: {} };
    versions.push(actual);
    continue;
  }
  if (!actual) continue;
  const mC = linia.match(/^###\s+(.+)$/);
  if (mC) {
    categoria = mC[1].trim();
    if (!CATEGORIES.includes(categoria)) atura(`categoria desconeguda «${categoria}» a ${actual.versio}`);
    actual.canvis[categoria] = [];
    continue;
  }
  const mR = linia.match(/^Resum:\s*(.+)$/);
  if (mR) { actual.resum = majuscula(neteja(mR[1])); continue; }
  const mM = linia.match(/^Migració d'esquema:\s*(.+)$/);
  if (mM) {
    let m = neteja(mM[1]);
    const tanca = m.indexOf(')');
    if (tanca > -1) m = m.slice(0, tanca + 1);
    else m = m.replace(/\.\s.*$/, '').replace(/\.$/, '');
    actual.migracio = majuscula(m);
    continue;
  }
  const mE = linia.match(/^[-*]\s+(.+)$/);
  if (mE && categoria) actual.canvis[categoria].push(neteja(mE[1]));
}

if (!versions.length) atura('CANVIS.md no té cap versió lliurada');
for (const v of versions) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) atura(`la versió ${v.versio} no té data AAAA-MM-DD`);
  if (!v.resum) atura(`la versió ${v.versio} no té Resum`);
  if (!v.migracio) atura(`la versió ${v.versio} no té Migració d'esquema`);
}
if (versions[0].versio !== versioCodi) {
  atura(`la primera versió de CANVIS.md (${versions[0].versio}) no és VERSIO (${versioCodi})`);
}

const avui = new Date().toISOString().slice(0, 10);
const capcalera = `/**
 * 96_Historial.gs — ${nomApp}
 *
 * Historial de versions per a la pantalla del backend.
 * FITXER GENERAT a partir de CANVIS.md: no s'edita a mà.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) ${avui.slice(0, 4)} xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: ${versioCodi} · ${versions[0].data || avui}
 */
`;
const tipus = '/** @type {Array<{versio: string, data: string, resum: string, migracio: string, canvis: Object<string, string[]>}>} */';
const cos = `const HISTORIAL = ${JSON.stringify(versions, null, 2)};\n`;
fs.writeFileSync(rutaSortida, capcalera + '\n' + tipus + '\n' + cos);
console.log(`96_Historial.gs: ${versions.length} versions, primera ${versioCodi}`);
