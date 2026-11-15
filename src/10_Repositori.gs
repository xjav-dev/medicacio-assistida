/**
 * 10_Repositori.gs — Medicació assistida
 *
 * Accés genèric als fulls per nom de capçalera, en bloc. És l'única part que
 * crida SpreadsheetApp. Les escriptures s'han de fer dins d'ambBloqueig_().
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */

function llibre_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function full_(nom) {
  var f = llibre_().getSheetByName(nom);
  if (!f) throw errorApp_('SENSE_INSTALLAR', 'Falta el full ' + nom + '. Cal executar instalacio().');
  return f;
}

/** Llegeix tot un full com a llista d'objectes {capçalera: valor}. */
function llegeixFull_(nom) {
  var f = full_(nom);
  var valors = f.getDataRange().getValues();
  if (valors.length < 2) return [];
  var caps = valors[0].map(String);
  var sortida = [];
  for (var i = 1; i < valors.length; i++) {
    var fila = valors[i];
    if (fila.join('') === '') continue;
    var obj = { _fila: i + 1 };
    for (var c = 0; c < caps.length; c++) obj[caps[c]] = valorCel_(fila[c]);
    sortida.push(obj);
  }
  return sortida;
}

function valorCel_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return v === null || v === undefined ? '' : String(v);
}

function capcaleres_(f) {
  return f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0].map(String);
}

/** Converteix un objecte en fila segons les capçaleres del full. Tot es desa com a text. */
function filaDe_(caps, obj) {
  return caps.map(function (c) {
    var v = obj[c];
    return v === undefined || v === null ? '' : String(v);
  });
}

function afegeixFila_(nom, obj) {
  var f = full_(nom);
  var caps = capcaleres_(f);
  var fila = filaDe_(caps, obj);
  f.getRange(f.getLastRow() + 1, 1, 1, caps.length).setNumberFormat('@').setValues([fila]);
  return obj;
}

function afegeixFiles_(nom, objs) {
  if (!objs.length) return;
  var f = full_(nom);
  var caps = capcaleres_(f);
  var files = objs.map(function (o) { return filaDe_(caps, o); });
  f.getRange(f.getLastRow() + 1, 1, files.length, caps.length).setNumberFormat('@').setValues(files);
}

/** Actualitza la fila amb id = id. Retorna l'objecte resultant o null si no hi és. */
function actualitzaPerId_(nom, id, canvis) {
  var f = full_(nom);
  var valors = f.getDataRange().getValues();
  var caps = valors[0].map(String);
  var colId = caps.indexOf('id');
  for (var i = 1; i < valors.length; i++) {
    if (String(valors[i][colId]) !== String(id)) continue;
    var obj = {};
    caps.forEach(function (c, k) { obj[c] = valorCel_(valors[i][k]); });
    Object.keys(canvis).forEach(function (k) { if (caps.indexOf(k) > -1) obj[k] = canvis[k]; });
    f.getRange(i + 1, 1, 1, caps.length).setNumberFormat('@').setValues([filaDe_(caps, obj)]);
    return obj;
  }
  return null;
}

function esborraPerId_(nom, id) {
  var f = full_(nom);
  var valors = f.getDataRange().getValues();
  var colId = valors[0].map(String).indexOf('id');
  for (var i = valors.length - 1; i >= 1; i--) {
    if (String(valors[i][colId]) === String(id)) { f.deleteRow(i + 1); return true; }
  }
  return false;
}

function cercaPerId_(nom, id) {
  var tots = llegeixFull_(nom);
  for (var i = 0; i < tots.length; i++) if (String(tots[i].id) === String(id)) return tots[i];
  return null;
}

// ---- Config (clau/valor) amb memòria cau ----

function llegeixConfig_() {
  var cau = CacheService.getScriptCache();
  var desat = cau.get('config');
  if (desat) return JSON.parse(desat);
  var cfg = {};
  Object.keys(CONFIG_DEFECTE_).forEach(function (k) { cfg[k] = CONFIG_DEFECTE_[k]; });
  llegeixFull_('Config').forEach(function (r) { cfg[r.clau] = r.valor; });
  cau.put('config', JSON.stringify(cfg), 300);
  return cfg;
}

function desaConfig_(canvis) {
  var f = full_('Config');
  var valors = f.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < valors.length; i++) index[String(valors[i][0])] = i + 1;
  Object.keys(canvis).forEach(function (k) {
    var v = String(canvis[k] === undefined || canvis[k] === null ? '' : canvis[k]);
    if (index[k]) f.getRange(index[k], 2).setNumberFormat('@').setValue(v);
    else { f.appendRow([k, v]); f.getRange(f.getLastRow(), 1, 1, 2).setNumberFormat('@'); }
  });
  CacheService.getScriptCache().remove('config');
}

// ---- Utilitats comunes ----

var PROFUNDITAT_BLOQUEIG_ = 0;

/** Executa fn amb el bloqueig de l'script. És reentrant dins de la mateixa execució. */
function ambBloqueig_(fn) {
  if (PROFUNDITAT_BLOQUEIG_ > 0) {
    PROFUNDITAT_BLOQUEIG_++;
    try { return fn(); } finally { PROFUNDITAT_BLOQUEIG_--; }
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw errorApp_('OCUPAT', 'El sistema està ocupat. Torna-ho a provar.');
  PROFUNDITAT_BLOQUEIG_ = 1;
  try { return fn(); } finally { PROFUNDITAT_BLOQUEIG_ = 0; SpreadsheetApp.flush(); lock.releaseLock(); }
}

function nouId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function araText_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}
