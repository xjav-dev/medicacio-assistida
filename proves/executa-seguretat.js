'use strict';
// Comprova que cap funció global és cridable des del navegador sense passar per executa_.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'src');
// Punts d'entrada que no són «api…» i què ha de contenir el seu cos.
const ENTRADES = {
  doGet: ['paginaMinima_'],
  doPost: ['RUTES_', 'PETICIO_'],
  instalacio: ['esPropietari_'],
  passaAProduccio: ['esPropietari_'],
  activadorRevisio: ['esActivadorPropi_']
};
let fallades = 0, n = 0;
const comprova = (ok, desc, det) => { n++; if (!ok) fallades++; console.log((ok ? '✓ ' : '✗ ') + desc + (ok ? '' : '  → ' + JSON.stringify(det))); };
const fns = [], noms = [];
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.gs'))) {
  const codi = fs.readFileSync(path.join(src, f), 'utf8');
  for (const m of codi.matchAll(/^function ([\w$]*[A-Za-z0-9$])\s*\([^)]*\)\s*\{\n([\s\S]*?)\n\}/gm)) fns.push({ nom: m[1], cos: m[2] });
  for (const m of codi.matchAll(/^(?:function ([\w$]+)\s*\(|var ([\w$]+)\s*=\s*function\b)/gm)) if (!/_$/.test(m[1] || m[2])) noms.push(m[1] || m[2]);
}
const ops = fns.filter((p) => /^api[A-Z]/.test(p.nom)), altres = fns.filter((p) => !/^api[A-Z]/.test(p.nom));
const malament = ops.filter((p) => !p.cos.includes("executa_('" + p.nom + "'")).map((p) => p.nom);
comprova(noms.length === fns.length, 'totes les funcions globals sense «_» analitzades', noms);
comprova(!malament.length, 'les operacions api… passen per executa_ amb el seu nom', malament);
comprova(altres.every((p) => ENTRADES[p.nom]), 'cap altra funció cridable des del navegador', altres.filter((p) => !ENTRADES[p.nom]).map((p) => p.nom));
altres.filter((p) => ENTRADES[p.nom]).forEach((p) => comprova(ENTRADES[p.nom].every((c) => p.cos.includes(c)), p.nom + ' protegida', ENTRADES[p.nom]));
const api = fs.readFileSync(path.join(src, '40_Api.gs'), 'utf8');
const publiques = JSON.parse(((/var OPERACIONS_PUBLIQUES_ = (\[[^\]]*\])/.exec(api)) || [0, '[]'])[1].replace(/'/g, '"'));
const acces = (JSON.parse(fs.readFileSync(path.join(src, 'appsscript.json'), 'utf8')).webapp || {}).access || '—';
const amb = ops.map((p) => p.nom).filter((x) => !publiques.includes(x));
// Específic d'aquesta aplicació: cada operació amb sessió té rols a ROLS_ i és a RUTES_.
const rols = (/var ROLS_ = \{([\s\S]*?)\n\};/.exec(api) || [0, ''])[1];
const rutes = (/var RUTES_ = \{([\s\S]*?)\n\};/.exec(api) || [0, ''])[1];
comprova(amb.every((x) => new RegExp('\\b' + x + ':').test(rols)), 'totes les operacions amb sessió tenen rols', amb.filter((x) => !new RegExp('\\b' + x + ':').test(rols)));
comprova(ops.every((p) => new RegExp('\\b' + p.nom + ': ' + p.nom + '\\b').test(rutes)), 'totes les operacions són a RUTES_', ops.filter((p) => !new RegExp('\\b' + p.nom + ': ' + p.nom + '\\b').test(rutes)).map((p) => p.nom));
if (process.argv.includes('--exposicio')) {
  console.log('\nAccés: ' + acces + '\nSense sessió: ' + (publiques.join(', ') || '—') + '\nAmb sessió (' + amb.length + '): ' +
    amb.join(', ') + '\nAltres entrades: ' + Object.keys(ENTRADES).join(', '));
}
console.log('\n' + n + ' comprovacions, ' + fallades + ' fallades · exposició: accés ' + acces + ', ' + publiques.length +
  ' operacions sense sessió, ' + amb.length + ' amb sessió, ' + Object.keys(ENTRADES).length + ' altres entrades.');
process.exit(fallades ? 1 : 0);
