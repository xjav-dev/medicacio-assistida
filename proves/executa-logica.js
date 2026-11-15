'use strict';
/**
 * executa-logica.js — proves del calendari, les zones, la seguretat dinàmica i
 * un recorregut complet (instal·lació → pràctica → ús real → avisos) amb el simulador.
 */
const { creaEntorn } = require('./simulador');

let n = 0, fallades = 0;
function comprova(ok, desc, det) {
  n++; if (!ok) fallades++;
  console.log((ok ? '✓ ' : '✗ ') + desc + (ok ? '' : '  → ' + JSON.stringify(det)));
}

const env = creaEntorn({ silenci: true });
const g = env.context;

// ---------- Calendari ----------
const med = { dies: '1,5', hora: '10:00' };
const d = (s) => g.deClau_(s);
let c = g.estatCalendari_(med, '', [], d('2026-11-16 10:40'), 60);
comprova(c.pendent === '2026-11-16 10:00' && c.minutsRetard === 40, 'dilluns 10:40: pendent el de les 10:00 amb 40 min de retard', c);
c = g.estatCalendari_(med, '', [{ tipus: 'programat', estat: 'completat', dataProgramada: '2026-11-16 10:00' }], d('2026-11-16 10:40'), 60);
comprova(c.pendent === null && c.propera === '2026-11-20 10:00', 'un cop fet, el proper és divendres', c);
c = g.estatCalendari_(med, '', [{ tipus: 'programat', estat: 'completat', dataProgramada: '2026-11-13 10:00' }], d('2026-11-16 09:15'), 60);
comprova(c.pendent === '2026-11-16 10:00' && c.minutsRetard === -45, 'l\'app l\'ofereix 45 min abans', c);
c = g.estatCalendari_(med, '', [{ tipus: 'programat', estat: 'completat', dataProgramada: '2026-11-13 10:00' }], d('2026-11-16 08:50'), 60);
comprova(c.pendent === null && c.propera === '2026-11-16 10:00', 'a les 8:50 encara no toca', c);
c = g.estatCalendari_(med, '', [], d('2026-11-20 10:30'), 0);
comprova(c.pendent === '2026-11-20 10:00' && c.anteriorsNoFets.indexOf('2026-11-16 10:00') > -1, 'el de dilluns no fet queda com a anterior no fet', c);
c = g.estatCalendari_(med, '2026-11-18 12:00', [], d('2026-11-20 10:30'), 0);
comprova(c.anteriorsNoFets.length === 0, 'no compten els anteriors a la data d\'inici', c);
comprova(g.validaDies_([1, 5], 4).length === 0 && g.validaDies_([1, 2], 4)[0] === 'SEPARACIO', 'validació de la separació entre dies');

// ---------- Zones ----------
const zones = g.ZONES_DEFECTE_;
let z = g.suggereixZona_(zones, [], d('2026-11-16 10:00'), 14);
comprova(z.suggerida === 'A', 'sense historial proposa A', z.suggerida);
z = g.suggereixZona_(zones, [{ estat: 'completat', zona: 'A', fi: '2026-11-13 10:05:00' }], d('2026-11-16 10:00'), 14);
comprova(z.suggerida === 'B' && !z.zones[0].disponible, 'A usada fa 3 dies: proposa B i bloqueja A', z);
const usades = 'ABCDEFG'.split('').map((k, i) => ({ estat: 'completat', zona: k, fi: '2026-11-' + String(2 + i * 2).padStart(2, '0') + ' 10:00:00' }));
z = g.suggereixZona_(zones, usades, d('2026-11-17 10:00'), 14);
comprova(z.suggerida === 'H', 'proposa la que no s\'ha fet servir mai', z.suggerida);
z = g.suggereixZona_(zones, usades.concat([{ estat: 'completat', zona: 'H', fi: '2026-11-16 10:00:00' }]), d('2026-11-17 10:00'), 14);
comprova(z.suggerida === 'A' && !z.capDisponible, 'A (fa 15 dies) torna a estar disponible', z);
z = g.suggereixZona_(zones.slice(0, 2), [{ estat: 'completat', zona: 'A', fi: '2026-11-10 10:00:00' }, { estat: 'completat', zona: 'B', fi: '2026-11-13 10:00:00' }], d('2026-11-16 10:00'), 14);
comprova(z.capDisponible && z.suggerida === 'A', 'si cap és disponible, la més antiga i avís', z);
comprova(g.zonesMinimes_('1,5', 14) === 5, 'calen 5 zones amb 2 canvis/setmana i 14 dies');

// ---------- Seguretat dinàmica ----------
const publiques = g.OPERACIONS_PUBLIQUES_;
const ambSessio = Object.keys(g.RUTES_).filter((k) => publiques.indexOf(k) < 0);
let malament = ambSessio.filter((op) => env.post(op, {}, '').error.codi !== 'SENSE_USUARI');
comprova(!malament.length, 'sense testimoni, cap operació amb sessió funciona (' + ambSessio.length + ')', malament);
malament = Object.keys(g.RUTES_).filter((op) => { const r = g[op](); return r.ok || r.error.codi !== 'SENSE_USUARI'; });
comprova(!malament.length, 'cridades directament (sense doPost), totes responen SENSE_USUARI', malament);
comprova(env.post('apiQualsevol', {}).error.codi === 'DADES', 'operació desconeguda rebutjada');
let llança = false; try { g.instalacio(); } catch (e) { llança = true; }
comprova(llança, 'instalacio() no funciona si no és el propietari');

// ---------- Instal·lació ----------
env.estat.usuariActiu = env.estat.propietari;
g.instalacio(); g.instalacio();
env.estat.usuariActiu = '';
comprova(env.llibre.getSheetByName('Registre') && env.estat.activadors.length === 1, 'instal·lació idempotent: fulls i un sol activador');
comprova(env.post('apiEstatApp', {}, 'x.y').error.codi === 'SENSE_USUARI', 'testimoni fals rebutjat');
const mutat = (t) => t.slice(0, -2) + (t.slice(-2) === 'AA' ? 'BB' : 'AA');

g.activadorRevisio({ triggerUid: 'fals' });
comprova(env.estat.correus.length === 0, 'l\'activador amb triggerUid inventat no fa res');

// ---------- Entrada al panell ----------
let r = env.post('apiDemanaCodi', { correu: 'algu@desconegut.cat' });
comprova(r.ok && env.estat.correus.length === 0, 'correu desconegut: mateixa resposta i cap correu');
r = env.post('apiDemanaCodi', { correu: 'Propietari@exemple.cat' });
const codi = (/([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(env.estat.correus[0].body) || [])[1];
comprova(r.ok && !!codi, 'arriba el codi d\'entrada per correu', env.estat.correus[0] && env.estat.correus[0].body);
r = env.post('apiEntra', { correu: 'propietari@exemple.cat', codi: 'AAAA-AAAA' });
comprova(r.error && r.error.codi === 'CODI_INVALID', 'codi incorrecte rebutjat');
r = env.post('apiEntra', { correu: 'propietari@exemple.cat', codi });
const tAdmin = r.dades && r.dades.testimoni;
comprova(!!tAdmin && r.dades.jo.rol === 'administrador', 'entra com a administrador');
comprova(env.post('apiEntra', { correu: 'propietari@exemple.cat', codi }).error.codi === 'CODI_INVALID', 'el codi no es pot reutilitzar');
comprova(env.post('apiJo', {}, tAdmin).dades.avisPendent === true, 'la primera vegada cal acceptar l\'avís d\'ús');
env.post('apiAcceptaAvis', {}, tAdmin);
comprova(env.post('apiJo', {}, tAdmin).dades.avisPendent === false, 'un cop acceptat, ja no es demana');
comprova(env.post('apiConfig', {}, mutat(tAdmin)).error.codi === 'SENSE_USUARI', 'testimoni manipulat rebutjat');
comprova(env.post('apiEstatApp', {}, tAdmin).error.codi === 'SENSE_PERMIS', 'un supervisor no pot fer operacions del dispositiu');

// ---------- Vinculació del dispositiu ----------
r = env.post('apiCodiVinculacio', { nom: 'iPhone mare' }, tAdmin);
const codiVin = r.dades.codi;
r = env.post('apiVinculaDispositiu', { codi: codiVin });
const tDis = r.dades && r.dades.testimoni;
comprova(!!tDis, 'el dispositiu es vincula amb el codi de 6 xifres');
comprova(env.post('apiVinculaDispositiu', { codi: codiVin }).error.codi === 'CODI_INVALID', 'el codi de vinculació és d\'un sol ús');
comprova(env.post('apiResum', {}, tDis).error.codi === 'SENSE_PERMIS', 'el dispositiu no pot entrar al panell');

// ---------- Pràctica (DEMO) ----------
let e = env.post('apiEstatApp', {}, tDis).dades;
const medId = e.medicaments[0].id;
comprova(e.estat === 'DEMO' && e.medicaments[0].passos.length === 9 && e.medicaments[0].pendent === null, 'estat inicial DEMO amb 9 passos', e.estat);
const FOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
r = env.post('apiIniciaCanvi', { medicament: medId, tipus: 'programat' }, tDis);
comprova(r.ok && r.dades.mode === 'DEMO' && r.dades.zonaSuggerida === 'A', 'iniciar pràctica', r);
env.estat.correus.length = 0;
r = env.post('apiCompletaCanvi', { medicament: medId, tipus: 'programat', mode: 'DEMO', idClient: 'demo1', anteriorRetirat: 'si', zona: 'A', foto: FOTO }, tDis);
comprova(r.ok && env.estat.correus.length === 1 && /PRÁCTICA/.test(env.estat.correus[0].body), 'pràctica registrada i avisada com a pràctica', r);
comprova(/(lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d\d\/\d\d/.test(env.estat.correus[0].body), 'el missatge porta el nom del dia', env.estat.correus[0].body);

// ---------- Pas a ACTIU amb un horari d'ara ----------
const cfgP = env.post('apiConfig', {}, tAdmin).dades;
const m0 = cfgP.medicaments[0];
const ara = new Date();
const fa40 = new Date(ara.getTime() - 40 * 60000);
const p2 = (x) => String(x).padStart(2, '0');
const diaIso = (x) => (x.getDay() === 0 ? 7 : x.getDay());
const diaAltre = diaIso(fa40) === 1 ? 4 : 1;
const nouMed = Object.assign({}, m0, { dies: [diaIso(fa40), diaAltre], hora: p2(fa40.getHours()) + ':' + p2(fa40.getMinutes()), maxDiesEntreCanvis: 0 });
r = env.post('apiDesaMedicament', nouMed, tAdmin);
comprova(r.ok, 'l\'administrador canvia dies i hora', r.error);
// Simulem que l'horari es va canviar fa 3 hores.
g.actualitzaPerId_('Medicaments', medId, { vigentDes: g.clau_(new Date(ara.getTime() - 3 * 3600000)) });
r = env.post('apiDesaEstat', { estat: 'ACTIU', dataInici: g.clau_(new Date(ara.getTime() - 2 * 3600000)) }, tAdmin);
comprova(r.ok && r.dades.config.estat === 'ACTIU', 'passa a ACTIU');
e = env.post('apiEstatApp', {}, tDis).dades;
comprova(e.estat === 'ACTIU' && !!e.medicaments[0].pendent, 'en ACTIU hi ha un canvi pendent', e.medicaments[0]);

// Avisos de retard
env.estat.correus.length = 0;
const act = { triggerUid: env.estat.activadors[0].id };
g.activadorRevisio(act); g.activadorRevisio(act);
comprova(env.estat.correus.length === 1 && /pendiente/.test(env.estat.correus[0].body), 'un sol avís de pendent (no es repeteix)', env.estat.correus.map((x) => x.body));

// Canvi real
r = env.post('apiIniciaCanvi', { medicament: medId, tipus: 'programat' }, tDis);
const prog = r.dades.dataProgramada;
comprova(r.ok && r.dades.mode === 'REAL' && r.dades.zonaSuggerida === 'A', 'iniciar canvi real: la pràctica no compta per a les zones', r.dades);
const base = { medicament: medId, tipus: 'programat', mode: 'REAL', dataProgramada: prog, idClient: 'real1', zona: 'A', foto: FOTO };
comprova(env.post('apiCompletaCanvi', base, tDis).error.codi === 'DADES', 'sense confirmar la retirada no es pot completar');
comprova(env.post('apiCompletaCanvi', Object.assign({}, base, { anteriorRetirat: 'si', zona: 'Z' }), tDis).error.codi === 'DADES', 'zona inventada rebutjada');
comprova(env.post('apiCompletaCanvi', Object.assign({}, base, { anteriorRetirat: 'si', foto: '' }), tDis).error.codi === 'DADES', 'sense foto ni motiu rebutjat');
env.estat.correus.length = 0;
r = env.post('apiCompletaCanvi', Object.assign({}, base, { anteriorRetirat: 'si' }), tDis);
comprova(r.ok && env.estat.correus.length === 1 && /✅/.test(env.estat.correus[0].body) && !!env.estat.correus[0].inlineImages, 'canvi real completat i avisat amb foto', r);
comprova(r.dades.ratxa === 1, 'ratxa d\'un canvi seguit', r.dades);
comprova(g.ratxa_([{ tipus: 'programat', estat: 'completat', dataProgramada: '2026-11-20 10:00' }, { tipus: 'programat', estat: 'completat', dataProgramada: '2026-11-16 10:00' },
  { tipus: 'programat', estat: 'no fet', dataProgramada: '2026-11-13 10:00' }, { tipus: 'programat', estat: 'completat', dataProgramada: '2026-11-09 10:00' }]) === 2, 'la ratxa es talla en un canvi no fet');
r = env.post('apiCompletaCanvi', Object.assign({}, base, { anteriorRetirat: 'si' }), tDis);
comprova(r.ok && r.dades.repetit && env.estat.correus.length === 1, 'reenviament (cua sense connexió) no duplica', r.dades);
e = env.post('apiEstatApp', {}, tDis).dades;
comprova(e.medicaments[0].pendent === null && e.medicaments[0].darrer.zona === 'A', 'ja no hi ha pendent', e.medicaments[0]);
g.activadorRevisio(act);
comprova(env.estat.correus.length === 1, 'després de fer-lo, l\'activador ja no avisa');
comprova(env.post('apiIniciaCanvi', { medicament: medId, tipus: 'programat' }, tDis).error.codi === 'SENSE_PENDENT', 'no es pot començar un canvi que no toca');

// Pegat caigut
r = env.post('apiIniciaCanvi', { medicament: medId, tipus: 'caiguda' }, tDis);
comprova(r.ok && r.dades.zonaSuggerida === 'B', 'pegat caigut: proposa B (A acabada d\'usar)', r.dades);
r = env.post('apiCompletaCanvi', { medicament: medId, tipus: 'caiguda', mode: 'REAL', idClient: 'cai1', zona: 'B', senseFotoMotiu: 'Zona de l\'esquena' }, tDis);
comprova(r.ok && /caído/.test(env.estat.correus[env.estat.correus.length - 1].body) && /Sin foto/.test(env.estat.correus[env.estat.correus.length - 1].body), 'pegat caigut registrat, sense foto amb motiu');
e = env.post('apiEstatApp', {}, tDis).dades;
comprova(e.medicaments[0].pendent === null, 'el pegat caigut no mou el calendari');

// Historial i fotos
const h = env.post('apiHistorial', { mode: 'REAL' }, tAdmin).dades;
comprova(h.length === 2 && h.some((x) => x.teFoto), 'historial real amb 2 registres', h);
const ambFoto = h.find((x) => x.teFoto);
r = env.post('apiFoto', { id: ambFoto.id }, tAdmin);
comprova(r.ok && r.dades.b64 === FOTO, 'la foto es pot veure des del panell');
comprova(env.post('apiHistorial', { mode: 'DEMO' }, tAdmin).dades.length === 1, 'la pràctica queda a part');
comprova(env.post('apiAudio', { id: 'llibre1' }, tDis).error.codi === 'NO_TROBAT', 'no es pot llegir un fitxer qualsevol de Drive');

// Zones mínimes
const poquesZones = Object.assign({}, nouMed, { zones: nouMed.zones.map((x, i) => Object.assign({}, x, { activa: i < 4 })) });
r = env.post('apiDesaMedicament', poquesZones, tAdmin);
comprova(!r.ok && /almenys 5/.test(r.error.missatge), 'amb 4 zones actives no es pot desar', r.error);

// Supervisors i rols
r = env.post('apiDesaSupervisor', { nom: 'Ana', correu: 'ana@exemple.cat', rol: 'supervisor', perCorreu: true }, tAdmin);
comprova(r.ok && r.dades.supervisors.length === 2, 'afegir una supervisora');
env.post('apiDemanaCodi', { correu: 'ana@exemple.cat' });
const codiAna = (/([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(env.estat.correus[env.estat.correus.length - 1].body) || [])[1];
const tAna = env.post('apiEntra', { correu: 'ana@exemple.cat', codi: codiAna }).dades.testimoni;
comprova(env.post('apiResum', {}, tAna).ok, 'la supervisora veu el resum');
comprova(env.post('apiDesaEstat', { estat: 'DEMO' }, tAna).error.codi === 'SENSE_PERMIS', 'la supervisora no pot canviar la configuració');
const idAdmin = env.post('apiJo', {}, tAdmin).dades.id;
comprova(env.post('apiTreuSupervisor', { id: idAdmin }, tAdmin).error.codi === 'DADES', 'no es pot treure l\'últim administrador');

// Telegram
r = env.post('apiDesaConfig', { telegramToken: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' }, tAdmin);
comprova(r.ok && r.dades.config.telegramBot === 'prova_bot', 'bot de Telegram configurat', r);
const enllac = env.post('apiEnllacTelegram', {}, tAna).dades.enllac;
env.estat.updates = [{ update_id: 7, message: { chat: { id: 555 }, text: '/start ' + enllac.split('start=')[1] } }];
r = env.post('apiComprovaTelegram', {}, tAna);
const ana = env.post('apiConfig', {}, tAdmin).dades.supervisors.find((s) => s.nom === 'Ana');
comprova(r.dades.vinculats === 1 && ana.teTelegram && ana.perTelegram, 'Telegram vinculat amb /start', ana);

// Telèfons de suport i seguiment en directe
r = env.post('apiCodiVinculacio', { nom: 'iPhone Ana', tipus: 'usuaria' }, tAna);
comprova(r.ok && r.dades.tipus === 'suport', 'una supervisora només pot vincular telèfons de suport', r.dades);
const tSup = env.post('apiVinculaDispositiu', { codi: r.dades.codi }).dades.testimoni;
let eS = env.post('apiEstatApp', {}, tSup).dades;
comprova(eS.estat === 'DEMO' && eS.estatSistema === 'ACTIU' && eS.dispositiu.tipus === 'suport' && Array.isArray(eS.seguiment),
  'el telèfon de suport va en pràctica encara que el sistema estigui ACTIU', eS.dispositiu);
comprova(env.post('apiIniciaCanvi', { medicament: medId, tipus: 'programat' }, tSup).dades.mode === 'DEMO', 'el suport comença sempre una pràctica');
const nCorreus = env.estat.correus.length;
r = env.post('apiCompletaCanvi', { medicament: medId, tipus: 'programat', mode: 'REAL', idClient: 'sup1', anteriorRetirat: 'si', zona: 'D', foto: FOTO }, tSup);
const regSup = g.llegeixFull_('Registre').find((x) => x.idClient === 'sup1');
comprova(r.ok && regSup.mode === 'DEMO' && env.estat.correus.length === nCorreus, 'un canvi del suport es desa com a pràctica i no s\'avisa', regSup);
env.post('apiProgres', { medicament: medId, pas: 3, total: 9, titol: 'Piel limpia', fase: 'pas', mode: 'REAL' }, tDis);
env.post('apiProgres', { medicament: medId, pas: 7, total: 9, fase: 'pas' }, tSup);
let seg = env.post('apiSeguiment', {}, tSup).dades;
comprova(seg.length === 1 && seg[0].pas === 3 && seg[0].titol === 'Piel limpia', 'el suport veu el pas de la usuària (i no el seu)', seg);
comprova(env.post('apiSeguiment', {}, tAna).dades[0].pas === 3, 'el panell també veu el seguiment');
comprova(env.post('apiSeguiment', {}, tDis).error.codi === 'SENSE_PERMIS', 'el telèfon de la usuària no pot consultar el seguiment');
const idSup = env.post('apiConfig', {}, tAdmin).dades.dispositius.find((d) => d.tipus === 'suport').id;
comprova(env.post('apiDesaDispositiu', { id: idSup, tipus: 'usuaria' }, tAna).error.codi === 'SENSE_PERMIS', 'una supervisora no pot canviar el tipus d\'un telèfon');
r = env.post('apiDesaDispositiu', { id: idSup, tipus: 'usuaria' }, tAdmin);
comprova(r.ok && env.post('apiEstatApp', {}, tSup).dades.dispositiu.tipus === 'usuaria', 'l\'administrador pot convertir un telèfon de suport en de la usuària');
env.post('apiDesaDispositiu', { id: idSup, tipus: 'suport' }, tAdmin);

// Còpies de seguretat
comprova(env.post('apiFesCopia', {}, tAna).error.codi === 'SENSE_PERMIS', 'una supervisora no pot fer còpies');
r = env.post('apiFesCopia', {}, tAdmin);
const idCopia = r.dades && r.dades.id;
comprova(r.ok && /^MEDA_copia_v[\d.]+_e\d+_\d{4}-\d\d-\d\d_\d{4}$/.test(r.dades.nom), 'còpia manual amb el nom normalitzat', r);
let copies = env.post('apiCopies', {}, tAdmin).dades;
const registresAbans = copies[0].files.Registre;
comprova(copies.length === 1 && copies[0].motiu === 'manual' && registresAbans > 0, 'la llista de còpies mostra versió, motiu i files', copies);
const nomAbans = env.post('apiConfig', {}, tAdmin).dades.config.nomUsuaria;
env.post('apiDesaConfig', { nomUsuaria: 'Després de la còpia' }, tAdmin);
env.post('apiCompletaCanvi', { medicament: medId, tipus: 'caiguda', mode: 'REAL', idClient: 'cai2', zona: 'C', senseFotoMotiu: 'x' }, tDis);
comprova(g.llegeixFull_('Registre').length > registresAbans, 'hi ha dades noves després de la còpia');
comprova(env.post('apiPreparaImportacio', { id: 'llibre1' }, tAdmin).error.codi === 'NO_TROBAT', 'no es pot importar un full qualsevol de Drive');
r = env.post('apiPreparaImportacio', { id: idCopia }, tAdmin);
comprova(r.ok && r.dades.resum.accio === 'directa' && r.dades.frase === 'MEDICACIÓ ASSISTIDA IMPORTA', 'preparar la importació: resum i frase', r);
const tImp = r.dades.testimoni;
comprova(env.post('apiImporta', { id: idCopia, testimoni: tImp, frase: 'sí' }, tAdmin).error.codi === 'DADES', 'sense la frase exacta no s\'importa');
comprova(env.post('apiImporta', { id: idCopia, testimoni: tImp, frase: 'MEDICACIÓ ASSISTIDA IMPORTA' }, tAdmin).error.codi === 'TESTIMONI', 'el testimoni és d\'un sol ús (s\'ha gastat amb l\'intent anterior)');
comprova(g.llegeixFull_('Registre').length > registresAbans, 'els intents fallits no han tocat les dades');
comprova(env.post('apiImporta', { id: idCopia, testimoni: 'inventat', frase: 'MEDICACIÓ ASSISTIDA IMPORTA' }, tAdmin).error.codi === 'TESTIMONI', 'sense testimoni vàlid no s\'importa');
const tImp2 = env.post('apiPreparaImportacio', { id: idCopia }, tAdmin).dades.testimoni;
r = env.post('apiImporta', { id: idCopia, testimoni: tImp2, frase: 'medicació assistida importa' }, tAdmin);
comprova(r.ok && /abans|copia/.test(r.dades.previa), 'importació feta amb còpia prèvia', r);
const cfgDesp = env.post('apiConfig', {}, tAdmin).dades;
comprova(cfgDesp.config.nomUsuaria === nomAbans && g.llegeixFull_('Registre').length === registresAbans, 'les dades tornen a ser les de la còpia');
comprova(cfgDesp.supervisors.some((x) => x.nom === 'Ana') && env.post('apiEstatApp', {}, tDis).ok, 'es conserven les persones i el telèfon');
copies = env.post('apiCopies', {}, tAdmin).dades;
comprova(copies.length === 2 && copies.some((c) => c.motiu === 'abans d\'importar'), 'abans d\'importar es fa una còpia automàtica', copies.map((c) => c.motiu));
const meta = env.llibres.get(idCopia).getSheetByName('_Metadades');
const filaDe = (clau) => meta.getDataRange().getValues().findIndex((f) => f[0] === clau) + 1;
const prova = (clau, valor, desc, patro) => {
  const vell = meta.getRange(filaDe(clau), 2).getValues()[0][0];
  meta.getRange(filaDe(clau), 2).setValue(valor);
  const x = env.post('apiPreparaImportacio', { id: idCopia }, tAdmin);
  comprova(x.error && x.error.codi === 'COPIA_NO_VALIDA' && patro.test(x.error.missatge), desc, x.error);
  meta.getRange(filaDe(clau), 2).setValue(vell);
};
prova('aplicacio', 'ALTRA', 'es rebutja una còpia d\'una altra aplicació', /altra aplicació/);
prova('entorn', 'produccio', 'es rebutja una còpia d\'un altre entorn', /entorn/);
prova('esquema', '9', 'es rebutja una còpia d\'un esquema posterior', /més nova/);
env.llibres.get(idCopia).getSheetByName('Registre').appendRow(['rX', medId, 'REAL']);
const x2 = env.post('apiPreparaImportacio', { id: idCopia }, tAdmin);
comprova(x2.error && /files/.test(x2.error.missatge), 'es rebutja una còpia amb files que no quadren', x2.error);

// Enllaç de la drecera
const idDis0 = env.post('apiConfig', {}, tAdmin).dades.dispositius[0].id;
comprova(env.post('apiEnllacDispositiu', { id: idDis0 }, tAna).error.codi === 'SENSE_PERMIS', 'una supervisora no pot obtenir l\'enllaç de la drecera');
const tDrecera = env.post('apiEnllacDispositiu', { id: idDis0 }, tAdmin).dades.testimoni;
comprova(env.post('apiEstatApp', {}, tDrecera).ok, 'l\'enllaç de la drecera fa funcionar l\'app');

// Tancar sessió i desvincular
comprova(env.post('apiSurt', {}, tAna).ok && env.post('apiResum', {}, tAna).error.codi === 'SENSE_USUARI', 'en sortir, el testimoni deixa de valer');
const idDis = env.post('apiConfig', {}, tAdmin).dades.dispositius[0].id;
env.post('apiDesvinculaDispositiu', { id: idDis }, tAdmin);
comprova(env.post('apiEstatApp', {}, tDis).error.codi === 'SENSE_USUARI', 'el dispositiu desvinculat ja no funciona');
comprova(env.post('apiAuditoria', {}, tAdmin).dades.length > 5, 'l\'auditoria registra els canvis');

// ---------- Migració de l'esquema 1 al 2 ----------
const env2 = creaEntorn({ silenci: true });
const g2 = env2.context;
env2.estat.usuariActiu = env2.estat.propietari;
g2.instalacio();
// Simulem una instal·lació de l'esquema 1: sense la columna «tipus» i amb un dispositiu.
const fullD = env2.llibre.getSheetByName('Dispositius')._f;
const col = fullD.dades[0].indexOf('tipus');
fullD.dades.forEach((fila) => fila.splice(col, 1));
fullD.dades.push(['dVell', 'iPhone vell', 'si', '1', '2026-11-01 10:00', '']);
g2.desaConfig_({ esquema: '1' });
g2.instalacio();
const dVell = g2.llegeixFull_('Dispositius').find((d) => d.id === 'dVell');
comprova(dVell && dVell.tipus === 'usuaria' && g2.llegeixConfig_().esquema === '2', 'la migració 1→2 afegeix «tipus» i marca els telèfons existents com de la usuària', dVell);
comprova(g2.llegeixFull_('Auditoria').some((a) => a.accio === 'fa una còpia de seguretat' && /abans de migrar/.test(a.detall)), 'abans de migrar es fa una còpia');
g2.instalacio();
comprova(g2.llegeixFull_('Auditoria').filter((a) => a.accio === 'migra l\'esquema').length === 1, 'la migració no es repeteix');

console.log('\n' + n + ' comprovacions, ' + fallades + ' fallades');
process.exit(fallades ? 1 : 0);
