/**
 * 80_Installador.gs — Medicació assistida
 *
 * Instal·lació idempotent (fulls, secret, primer administrador, medicament per
 * defecte, carpetes i activador) i l'activador de revisió cada 5 minuts.
 * instalacio() i passaAProduccio() només les pot executar el propietari des de l'editor.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.7.0 · 2026-11-15
 */

function instalacio() {
  if (!esPropietari_()) throw new Error('Només el propietari pot instal·lar, des de l\'editor d\'Apps Script.');
  var r = instalaNucli_();
  console.log('Instal·lació feta. ' + (r.fets.length ? 'Canvis: ' + r.fets.join('; ') : 'Ja estava tot instal·lat.'));
  console.log('Administrador: ' + r.correu + '. Entra al panell amb aquest correu.');
}

/** Feina de la instal·lació (idempotent). Retorna {fets, correu}. */
function instalaNucli_() {
  var correu = Session.getActiveUser().getEmail();
  var llibre = llibre_();
  var fets = [];

  // Instal·lació existent amb un esquema antic: primer còpia i migració (abans d'afegir columnes).
  if (llibre.getSheetByName('Config') && llibre.getSheetByName('Dispositius')) {
    migraSiCal_(correu).forEach(function (m) { fets.push('migració ' + m); });
  }

  Object.keys(FULLS_).forEach(function (nom) {
    var f = llibre.getSheetByName(nom);
    if (!f) { f = llibre.insertSheet(nom); fets.push('full ' + nom); }
    var caps = FULLS_[nom];
    var actuals = f.getLastColumn() ? capcaleres_(f) : [];
    var falten = caps.filter(function (c) { return actuals.indexOf(c) < 0; });
    if (falten.length) {
      f.getRange(1, actuals.length + 1, 1, falten.length).setValues([falten]);
      fets.push(nom + ': columnes ' + falten.join(', '));
    }
    f.setFrozenRows(1);
    f.getRange(1, 1, f.getMaxRows(), f.getLastColumn()).setNumberFormat('@');
  });
  llibre.getSheets().forEach(function (f) {
    if (!FULLS_[f.getName()] && f.getLastRow() === 0 && llibre.getSheets().length > 1) llibre.deleteSheet(f);
  });

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET_HMAC')) {
    props.setProperty('SECRET_HMAC', hex_(octetsAleatoris_()) + hex_(octetsAleatoris_()));
    fets.push('secret');
  }
  if (!props.getProperty('ENTORN')) props.setProperty('ENTORN', 'desenvolupament');

  var cfgActual = {};
  llegeixFull_('Config').forEach(function (r) { cfgActual[r.clau] = true; });
  var nous = {};
  Object.keys(CONFIG_DEFECTE_).forEach(function (k) { if (!cfgActual[k]) nous[k] = CONFIG_DEFECTE_[k]; });
  if (Object.keys(nous).length) { desaConfig_(nous); fets.push('config: ' + Object.keys(nous).join(', ')); }

  if (!llegeixFull_('Supervisors').some(function (s) { return s.actiu === 'si' && s.rol === 'administrador'; })) {
    afegeixFila_('Supervisors', { id: nouId_('s'), nom: 'Administrador', correu: correu.toLowerCase(), rol: 'administrador',
      perCorreu: 'si', perTelegram: 'no', telegramChat: '', actiu: 'si', versio: 1, creat: araText_() });
    fets.push('administrador ' + correu);
  }

  if (!llegeixFull_('Medicaments').length) {
    afegeixFila_('Medicaments', {
      id: nouId_('m'), nom_es: 'Parche', nom_ca: 'Pegat', actiu: 'si', dies: '1,5', hora: '10:00',
      margeAvisMin: 30, margeAlertaMin: 120, diesRepeticioZona: 14, maxDiesEntreCanvis: 4,
      passos: JSON.stringify(PASSOS_DEFECTE_), zones: JSON.stringify(ZONES_DEFECTE_),
      vigentDes: clau_(new Date()), creat: araText_()
    });
    fets.push('medicament per defecte (dilluns i divendres a les 10:00)');
  }

  carpeta_('carpetaFotos', 'Fotos medicació');
  carpeta_('carpetaAudios', 'Àudios medicació');
  carpeta_('carpetaCopies', 'Còpies medicació');

  var teActivador = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'activadorRevisio'; });
  if (!teActivador) { ScriptApp.newTrigger('activadorRevisio').timeBased().everyMinutes(5).create(); fets.push('activador cada 5 min'); }

  CacheService.getScriptCache().remove('config');
  anotaAuditoria_(correu, 'instal·lació', fets.join('; ') || 'sense canvis');
  return { fets: fets, correu: correu };
}

/** Marca aquesta instal·lació com a producció (treu la franja de desenvolupament del panell). */
function passaAProduccio() {
  if (!esPropietari_()) throw new Error('Només el propietari, des de l\'editor.');
  marcaProduccio_();
  console.log('Entorn: producció.');
}

function marcaProduccio_() {
  PropertiesService.getScriptProperties().setProperty('ENTORN', 'produccio');
  anotaAuditoria_(Session.getActiveUser().getEmail(), 'passa a producció', '');
}

// ---- Menú de la Hoja de càlcul (les mateixes accions que des de l'editor) ----

function onOpen(e) {
  SpreadsheetApp.getUi().createMenu('Medicación asistida')
    .addItem('Instalar o actualizar', 'menuInstala')
    .addItem('Hacer una copia de seguridad', 'menuCopia')
    .addItem('Dirección de la aplicación web', 'menuAdreca')
    .addSeparator()
    .addItem('Pasar a producción', 'menuProduccio')
    .addToUi();
}

function avisMenu_(titol, text) {
  SpreadsheetApp.getUi().alert(titol, text, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuInstala() {
  if (!esPropietari_()) { avisMenu_('Medicación asistida', 'No se ha podido identificar su cuenta.'); return; }
  var r = instalaNucli_();
  avisMenu_('Instalación hecha', (r.fets.length ? 'Cambios: ' + r.fets.join('; ') + '.' : 'Ya estaba todo instalado.') +
    '\n\nAdministrador: ' + r.correu + '. Entre en el panel con este email.\n\nRecuerde: si ha cambiado el código, publique una versión nueva en Implementar → Gestionar implementaciones.');
}

function menuCopia() {
  if (!esPropietari_()) { avisMenu_('Medicación asistida', 'No se ha podido identificar su cuenta.'); return; }
  var c = fesCopia_(Session.getActiveUser().getEmail(), 'manual');
  avisMenu_('Copia hecha', c.nom + '\n\nEstá en la carpeta «Còpies medicació», al lado de esta Hoja.');
}

function menuAdreca() {
  if (!esPropietari_()) { avisMenu_('Medicación asistida', 'No se ha podido identificar su cuenta.'); return; }
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  var panel = llegeixConfig_().urlPanel;
  avisMenu_('Dirección de la aplicación web',
    (url ? 'Dirección (/exec) del servidor:\n' + url + '\n\n' : 'Todavía no hay ninguna implementación como aplicación web.\n\n') +
    'Compruébela en Implementar → Gestionar implementaciones → Aplicación web. Es la que se pega la primera vez en el panel; ' +
    'no la publique.' + (panel ? '\n\nEnlace del panel guardado en Ajustes:\n' + panel : ''));
}

function menuProduccio() {
  if (!esPropietari_()) { avisMenu_('Medicación asistida', 'No se ha podido identificar su cuenta.'); return; }
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Pasar a producción', 'Se quitará la franja «Entorno de desarrollo» del panel. Si quiere empezar de cero, ' +
    'borre antes el historial de pruebas desde el panel (Copias → Empezar de cero). ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  marcaProduccio_();
  avisMenu_('Producción', 'Entorno: producción.');
}

/** Activador cada 5 minuts: avisos de retard i vinculació de Telegram. */
function activadorRevisio(e) {
  if (!esActivadorPropi_(e)) return;
  try { revisaRetards_(); } catch (x) { anotaError_('revisaRetards', x); }
  try { processaTelegram_(); } catch (x) { anotaError_('processaTelegram', x); }
}
