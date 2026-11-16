/**
 * 81_Copies.gs — Medicació assistida
 *
 * Còpies de seguretat de les dades (full nou amb SpreadsheetApp.create a la
 * carpeta de còpies, mai makeCopy) i importació d'una còpia amb control
 * d'aplicació, entorn, esquema i integritat abans de tocar cap dada.
 * Les fotos i els àudios no es copien: queden a les seves carpetes de Drive.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.8.0 · 2026-11-16
 */

/** Pestanyes que es desen a la còpia. */
var FULLS_COPIA_ = ['Config', 'Supervisors', 'Dispositius', 'Medicaments', 'Registre'];
/** Pestanyes que la importació substitueix (Config, només en part). Supervisors i Dispositius es conserven: són l'accés. */
var FULLS_SUBSTITUITS_ = ['Medicaments', 'Registre'];
/** Claus de Config que són de l'entorn i no es porten d'una còpia. */
var CONFIG_ENTORN_ = ['esquema', 'carpetaFotos', 'carpetaAudios', 'carpetaCopies', 'telegramBot'];
/** Migracions d'esquema: MIGRACIONS_[n] porta les dades de l'esquema n al n+1. Mai no se n'esborra cap. */
var MIGRACIONS_ = { 1: migra_1_a_2_, 2: migra_2_a_3_ };
var SEGONS_TESTIMONI_IMPORTACIO_ = 60;

/** Esquema 1 → 2: columna «tipus» a Dispositius; els dispositius que ja hi havia són de la usuària. Idempotent. */
function migra_1_a_2_() {
  var f = full_('Dispositius');
  var caps = capcaleres_(f);
  if (caps.indexOf('tipus') < 0) {
    f.getRange(1, caps.length + 1).setValue('tipus');
    caps.push('tipus');
  }
  llegeixFull_('Dispositius').forEach(function (d) {
    if (!d.tipus) actualitzaPerId_('Dispositius', d.id, { tipus: 'usuaria' });
  });
}

/** Esquema 2 → 3: columnes de la ubicació (lat, lon, precisioGps) a Registre. Idempotent. */
function migra_2_a_3_() {
  var f = full_('Registre');
  var caps = capcaleres_(f);
  var falten = ['lat', 'lon', 'precisioGps'].filter(function (c) { return caps.indexOf(c) < 0; });
  if (falten.length) f.getRange(1, caps.length + 1, 1, falten.length).setValues([falten]);
}

/** Aplica les migracions pendents de l'esquema de les dades, amb còpia prèvia. Retorna els esquemes migrats. */
function migraSiCal_(qui) {
  var actual = Number(llegeixConfig_().esquema || 1);
  if (actual >= VERSIO_ESQUEMA) return [];
  for (var e = actual; e < VERSIO_ESQUEMA; e++) if (!MIGRACIONS_[e]) throw new Error('Falta la migració de l\'esquema ' + e + ' al ' + (e + 1) + '.');
  var copia = fesCopia_(qui, 'abans de migrar');
  var fets = [];
  ambBloqueig_(function () {
    for (var e = actual; e < VERSIO_ESQUEMA; e++) { MIGRACIONS_[e](); fets.push(e + '→' + (e + 1)); }
    desaConfig_({ esquema: String(VERSIO_ESQUEMA) });
  });
  anotaAuditoria_(qui, 'migra l\'esquema', fets.join(', ') + '; còpia prèvia: ' + copia.nom);
  return fets;
}

function entorn_() {
  return PropertiesService.getScriptProperties().getProperty('ENTORN') || 'desenvolupament';
}

function fraseImportacio_() { return NOM_APP.toUpperCase() + ' IMPORTA'; }

/** Fa una còpia de seguretat. motiu: manual | abans d'importar | abans de migrar. */
function fesCopia_(qui, motiu) {
  var cfg = llegeixConfig_();
  var esquema = Number(cfg.esquema || VERSIO_ESQUEMA);
  var nom = CODI_APP + '_copia_v' + VERSIO + '_e' + esquema + '_' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  var desti = SpreadsheetApp.create(nom);
  var fulls = [];
  FULLS_COPIA_.forEach(function (n) {
    var valors = full_(n).getDataRange().getValues().map(function (fila) { return fila.map(valorCel_); });
    valors = valors.filter(function (fila, i) { return i === 0 || fila.join('') !== ''; });
    var f = desti.insertSheet(n);
    f.getRange(1, 1, valors.length, valors[0].length).setNumberFormat('@').setValues(valors);
    fulls.push({ nom: n, capcaleres: valors[0], files: valors.length - 1 });
  });
  var meta = { aplicacio: CODI_APP, versio: VERSIO, esquema: esquema, entorn: entorn_(), data: araText_(), autor: qui || '', motiu: motiu };
  var filesMeta = [['clau', 'valor']];
  Object.keys(meta).forEach(function (k) { filesMeta.push([k, String(meta[k])]); });
  filesMeta.push(['fulls', JSON.stringify(fulls)]);
  desti.insertSheet('_Metadades').getRange(1, 1, filesMeta.length, 2).setNumberFormat('@').setValues(filesMeta);
  desti.getSheets().forEach(function (f) {
    if (FULLS_COPIA_.indexOf(f.getName()) < 0 && f.getName() !== '_Metadades') desti.deleteSheet(f);
  });
  var fitxer = DriveApp.getFileById(desti.getId());
  fitxer.moveTo(carpeta_('carpetaCopies', 'Còpies medicació'));
  meta.files = {};
  fulls.forEach(function (f) { meta.files[f.nom] = f.files; });
  fitxer.setDescription(JSON.stringify(meta));
  anotaAuditoria_(qui, 'fa una còpia de seguretat', nom + ' (' + motiu + ')');
  return { id: desti.getId(), nom: nom, data: meta.data, motiu: motiu };
}

/** Còpies de la carpeta, de la més nova a la més antiga (amb el resum desat a la descripció). */
function llistaCopies_() {
  var carpeta = carpeta_('carpetaCopies', 'Còpies medicació');
  var fitxers = carpeta.getFiles();
  var llista = [];
  while (fitxers.hasNext()) {
    var f = fitxers.next();
    var meta = llegeixJson_(f.getDescription() || '', null);
    if (!meta || meta.aplicacio !== CODI_APP) continue;
    llista.push({ id: f.getId(), nom: f.getName(), versio: meta.versio, esquema: meta.esquema, entorn: meta.entorn,
      data: meta.data, autor: meta.autor, motiu: meta.motiu, files: meta.files || {} });
  }
  return llista.sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 100);
}

/** Obre una còpia només si és a la carpeta de còpies (mai un full qualsevol de Drive). */
function obreCopia_(id) {
  var idCarpeta = llegeixConfig_().carpetaCopies;
  var f;
  try { f = DriveApp.getFileById(String(id || '')); } catch (e) { throw errorApp_('NO_TROBAT', 'Còpia no trobada.'); }
  var dins = false;
  var pares = f.getParents();
  while (pares.hasNext()) if (pares.next().getId() === idCarpeta) dins = true;
  if (!idCarpeta || !dins) throw errorApp_('NO_TROBAT', 'Còpia no trobada.');
  return SpreadsheetApp.openById(f.getId());
}

function filesDe_(full) {
  var v = full.getDataRange().getValues().map(function (fila) { return fila.map(valorCel_); });
  return { capcaleres: v[0] || [], files: v.slice(1).filter(function (fila) { return fila.join('') !== ''; }) };
}

/** Totes les comprovacions abans de tocar res. Llança COPIA_NO_VALIDA amb el motiu. */
function comprovaCopia_(id) {
  var copia = obreCopia_(id);
  var no = function (m) { throw errorApp_('COPIA_NO_VALIDA', m); };
  var fm = copia.getSheetByName('_Metadades');
  if (!fm) no('No és una còpia d\'aquesta aplicació (no té _Metadades).');
  var meta = {};
  filesDe_(fm).files.forEach(function (f) { meta[f[0]] = f[1]; });
  if (meta.aplicacio !== CODI_APP) no('És una còpia d\'una altra aplicació (' + (meta.aplicacio || '?') + ').');
  if (meta.entorn !== entorn_()) no('La còpia és de l\'entorn «' + meta.entorn + '» i aquest és «' + entorn_() + '».');
  var esquema = Number(meta.esquema);
  if (!(esquema >= 1)) no('La còpia no diu de quin esquema és.');
  if (esquema > VERSIO_ESQUEMA) {
    no('La còpia és d\'una versió més nova (' + meta.versio + ', esquema ' + esquema + ') que la instal·lada (' + VERSIO + ', esquema ' + VERSIO_ESQUEMA + ').');
  }
  for (var e = esquema; e < VERSIO_ESQUEMA; e++) if (!MIGRACIONS_[e]) no('Falta la migració de l\'esquema ' + e + ' al ' + (e + 1) + '.');
  var fulls = llegeixJson_(meta.fulls, null);
  if (!fulls) no('Les metadades de la còpia estan malmeses.');
  var dades = {};
  FULLS_COPIA_.forEach(function (n) {
    var desc = fulls.filter(function (x) { return x.nom === n; })[0];
    var full = copia.getSheetByName(n);
    if (!desc || !full) no('Falta la pestanya ' + n + '.');
    var d = filesDe_(full);
    if (d.capcaleres.join('|') !== desc.capcaleres.join('|')) no('Les capçaleres de ' + n + ' no coincideixen amb les metadades.');
    if (d.files.length !== Number(desc.files)) no(n + ': hi ha ' + d.files.length + ' files i les metadades en diuen ' + desc.files + '.');
    if (esquema === VERSIO_ESQUEMA) {
      var falten = FULLS_[n].filter(function (c) { return d.capcaleres.indexOf(c) < 0; });
      var sobren = d.capcaleres.filter(function (c) { return FULLS_[n].indexOf(c) < 0; });
      if (falten.length || sobren.length) no(n + ': columnes diferents (falten: ' + (falten.join(', ') || '—') + '; sobren: ' + (sobren.join(', ') || '—') + ').');
    }
    dades[n] = d.files.map(function (fila) {
      var o = {}; d.capcaleres.forEach(function (c, i) { o[c] = fila[i]; }); return o;
    });
  });
  var resum = {
    versioCopia: meta.versio, esquemaCopia: esquema, dataCopia: meta.data, autorCopia: meta.autor,
    versioActual: VERSIO, esquemaActual: VERSIO_ESQUEMA,
    accio: esquema === VERSIO_ESQUEMA ? 'directa' : 'migracio',
    fulls: FULLS_SUBSTITUITS_.concat(['Config']).map(function (n) {
      return { nom: n, filesAra: llegeixFull_(n).length, filesCopia: dades[n].length, parcial: n === 'Config' };
    }),
    conservats: ['Supervisors', 'Dispositius', 'Auditoria', 'Errors']
  };
  return { meta: meta, dades: dades, resum: resum, esquema: esquema };
}

function preparaImportacio_(ctx, dades) {
  var c = comprovaCopia_(dades.id);
  var testimoni = codiAleatori_(24, ALFABET_CODI_);
  CacheService.getScriptCache().put('imp:' + testimoni,
    JSON.stringify({ id: String(dades.id), qui: ctx.id, exp: Date.now() + SEGONS_TESTIMONI_IMPORTACIO_ * 1000 }), SEGONS_TESTIMONI_IMPORTACIO_);
  return { resum: c.resum, testimoni: testimoni, frase: fraseImportacio_(), segons: SEGONS_TESTIMONI_IMPORTACIO_ };
}

function importaCopia_(ctx, dades) {
  // El testimoni es gasta sempre al primer intent, encara que la frase sigui incorrecta.
  var cau = CacheService.getScriptCache();
  var desat = cau.get('imp:' + String(dades.testimoni || ''));
  var reg = desat ? JSON.parse(desat) : null;
  cau.remove('imp:' + String(dades.testimoni || ''));
  if (!reg || reg.id !== String(dades.id) || reg.qui !== ctx.id || Date.now() > reg.exp) {
    throw errorApp_('TESTIMONI', 'La confirmació ha caducat o no correspon a aquesta còpia. Torneu-ho a començar.');
  }
  if (String(dades.frase || '').trim().toUpperCase() !== fraseImportacio_()) {
    throw errorApp_('DADES', 'Cal escriure exactament: ' + fraseImportacio_() + '. Torneu-ho a començar.');
  }
  var c = comprovaCopia_(dades.id);
  var previa = fesCopia_(ctx.nom, 'abans d\'importar');
  var migrat = false;
  try {
    ambBloqueig_(function () {
    FULLS_SUBSTITUITS_.forEach(function (n) {
      var f = full_(n);
      var caps = capcaleres_(f);
      if (f.getLastRow() > 1) f.getRange(2, 1, f.getLastRow() - 1, caps.length).clearContent();
      afegeixFiles_(n, c.dades[n]);
    });
    var cfg = {};
    c.dades.Config.forEach(function (r) { if (CONFIG_ENTORN_.indexOf(r.clau) < 0) cfg[r.clau] = r.valor; });
    desaConfig_(cfg);
    for (var e = c.esquema; e < VERSIO_ESQUEMA; e++) { MIGRACIONS_[e](); migrat = true; }
    desaConfig_({ esquema: String(VERSIO_ESQUEMA) });
    });
  } catch (e) {
    anotaError_('importaCopia', e);
    throw errorApp_('IMPORTACIO', 'La importació ha fallat a mitges. Per tornar a l\'estat anterior, importeu la còpia «' + previa.nom + '».');
  }
  CacheService.getScriptCache().remove('config');
  anotaAuditoria_(ctx.nom, 'importa una còpia', 'còpia ' + c.meta.versio + ' (esquema ' + c.esquema + ', ' + c.meta.data + ')' +
    (migrat ? ', migrada a l\'esquema ' + VERSIO_ESQUEMA : '') + '; còpia prèvia: ' + previa.nom);
  return { previa: previa.nom, migrat: migrat };
}

// ---- Esborrar l'historial (per començar de zero en producció) ----

var SEGONS_TESTIMONI_ESBORRAT_ = 60;

function fraseEsborrat_() { return NOM_APP.toUpperCase() + ' REINICIALITZA'; }

/** Registres que s'esborrarien segons l'abast: «practiques» (només DEMO) o «tot». */
function registresAEsborrar_(abast) {
  return llegeixFull_('Registre').filter(function (r) { return abast === 'tot' || r.mode === 'DEMO'; });
}

function preparaEsborrat_(ctx, dades) {
  var abast = dades.abast === 'tot' ? 'tot' : 'practiques';
  var fotos = dades.fotos !== false;
  var llista = registresAEsborrar_(abast);
  var testimoni = codiAleatori_(24, ALFABET_CODI_);
  CacheService.getScriptCache().put('esb:' + testimoni, JSON.stringify({ qui: ctx.id, abast: abast, fotos: fotos,
    exp: Date.now() + SEGONS_TESTIMONI_ESBORRAT_ * 1000 }), SEGONS_TESTIMONI_ESBORRAT_);
  return {
    abast: abast, fotos: fotos, registres: llista.length,
    reals: llista.filter(function (r) { return r.mode === 'REAL'; }).length,
    practiques: llista.filter(function (r) { return r.mode === 'DEMO'; }).length,
    ambFoto: llista.filter(function (r) { return r.fotoId; }).length,
    testimoni: testimoni, frase: fraseEsborrat_(), segons: SEGONS_TESTIMONI_ESBORRAT_
  };
}

/** Esborra l'historial (destructiu): testimoni d'un sol ús, frase escrita, còpia prèvia i auditoria. */
function esborraHistorial_(ctx, dades) {
  var cau = CacheService.getScriptCache();
  var desat = cau.get('esb:' + String(dades.testimoni || ''));
  var reg = desat ? JSON.parse(desat) : null;
  cau.remove('esb:' + String(dades.testimoni || ''));
  if (!reg || reg.qui !== ctx.id || Date.now() > reg.exp) {
    throw errorApp_('TESTIMONI', 'La confirmació ha caducat. Torneu-ho a començar.');
  }
  if (String(dades.frase || '').trim().toUpperCase() !== fraseEsborrat_()) {
    throw errorApp_('DADES', 'Cal escriure exactament: ' + fraseEsborrat_() + '. Torneu-ho a començar.');
  }
  var previa = fesCopia_(ctx.nom, 'abans d\'esborrar l\'historial');
  var resultat = ambBloqueig_(function () {
    var tots = llegeixFull_('Registre');
    var esborra = function (r) { return reg.abast === 'tot' || r.mode === 'DEMO'; };
    var queden = tots.filter(function (r) { return !esborra(r); });
    var fora = tots.filter(esborra);
    var f = full_('Registre');
    var caps = capcaleres_(f);
    if (f.getLastRow() > 1) f.getRange(2, 1, f.getLastRow() - 1, caps.length).clearContent();
    afegeixFiles_('Registre', queden.map(function (r) { var o = {}; caps.forEach(function (c) { o[c] = r[c]; }); return o; }));
    return { fora: fora, queden: queden.length };
  });
  var fotos = 0;
  if (reg.fotos) {
    var idCarpeta = llegeixConfig_().carpetaFotos;
    resultat.fora.forEach(function (r) {
      if (!r.fotoId) return;
      try {
        var fitxer = DriveApp.getFileById(r.fotoId);
        var pares = fitxer.getParents();
        var dins = false;
        while (pares.hasNext()) if (pares.next().getId() === idCarpeta) dins = true;
        if (dins) { fitxer.setTrashed(true); fotos++; }
      } catch (e) { /* ja no hi és */ }
    });
  }
  anotaAuditoria_(ctx.nom, 'esborra l\'historial', (reg.abast === 'tot' ? 'tot' : 'pràctiques') + ': ' + resultat.fora.length +
    ' registres, ' + fotos + ' fotos a la paperera; còpia prèvia: ' + previa.nom);
  return { esborrats: resultat.fora.length, queden: resultat.queden, fotos: fotos, previa: previa.nom };
}
