/**
 * 40_Api.gs — Medicació assistida
 *
 * Punts d'entrada web (doGet, doPost) i operacions de l'API. Tota operació
 * passa per executa_, que identifica el testimoni i comprova el rol.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.7.0 · 2026-11-15
 */

/** Operacions que es poden cridar sense sessió (protegides per codis d'un sol ús). */
var OPERACIONS_PUBLIQUES_ = ['apiDemanaCodi', 'apiEntra', 'apiVinculaDispositiu'];

var D_ = ['dispositiu'];
var S_ = ['supervisor', 'administrador'];
var A_ = ['administrador'];

/** Rols que poden fer cada operació amb sessió. */
var ROLS_ = {
  apiEstatApp: D_, apiIniciaCanvi: D_, apiCompletaCanvi: D_, apiProgres: D_, apiRegistraSortida: D_,
  apiSeguiment: ['dispositiu', 'supervisor', 'administrador'],
  apiAudio: ['dispositiu', 'supervisor', 'administrador'],
  apiJo: S_, apiAcceptaAvis: S_, apiSurt: S_, apiResum: S_, apiHistorial: S_, apiFoto: S_, apiConfig: S_,
  apiEnllacTelegram: S_, apiComprovaTelegram: S_, apiProvaMissatge: S_,
  apiDesaEstat: A_, apiDesaConfig: A_, apiDesaMedicament: A_, apiDesaSupervisor: A_, apiTreuSupervisor: A_,
  apiCodiVinculacio: S_, apiDesaDispositiu: A_, apiEnllacDispositiu: A_, apiDesvinculaDispositiu: A_, apiDesaAudio: A_, apiAuditoria: A_,
  apiCopies: A_, apiFesCopia: A_, apiPreparaImportacio: A_, apiImporta: A_,
  apiPreparaEsborrat: A_, apiEsborraHistorial: A_
};

var PETICIO_ = null;
var MIDA_MAXIMA_PETICIO_ = 6 * 1024 * 1024;

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function paginaMinima_() {
  return ContentService.createTextOutput(NOM_APP + ' · servei actiu.').setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  return paginaMinima_();
}

function doPost(e) {
  var cos = e && e.postData && e.postData.contents;
  if (!cos || cos.length > MIDA_MAXIMA_PETICIO_) return resposta_({ ok: false, error: { codi: 'DADES', missatge: 'Petició no vàlida.' } });
  var p;
  try { p = JSON.parse(cos); } catch (x) { return resposta_({ ok: false, error: { codi: 'DADES', missatge: 'Petició no vàlida.' } }); }
  var op = p && typeof p.op === 'string' ? p.op : '';
  if (!Object.prototype.hasOwnProperty.call(RUTES_, op)) return resposta_({ ok: false, error: { codi: 'DADES', missatge: 'Operació desconeguda.' } });
  PETICIO_ = { op: op, testimoni: p.testimoni || '', dades: p.dades && typeof p.dades === 'object' ? p.dades : {} };
  try { return resposta_(RUTES_[op]()); } finally { PETICIO_ = null; }
}

/** Executa una operació: comprova que la petició és per a aquesta operació, la sessió i el rol. */
function executa_(nom, fn) {
  var p = PETICIO_;
  if (!p || p.op !== nom) return { ok: false, error: { codi: 'SENSE_USUARI', missatge: 'Cal iniciar sessió.' } };
  try {
    var ctx = null;
    if (OPERACIONS_PUBLIQUES_.indexOf(nom) < 0) {
      ctx = identifica_(p.testimoni);
      if (!ctx) throw errorApp_('SENSE_USUARI', 'Cal iniciar sessió.');
      if ((ROLS_[nom] || []).indexOf(ctx.rol) < 0) throw errorApp_('SENSE_PERMIS', 'No tens permís per fer això.');
    }
    return { ok: true, dades: fn(ctx, p.dades) };
  } catch (e) {
    if (!e.codi) anotaError_(nom, e);
    return { ok: false, error: { codi: e.codi || 'ERROR', missatge: e.codi ? e.message : 'Error intern. Torna-ho a provar.' } };
  }
}

// ---- Sense sessió ----

function apiDemanaCodi() {
  return executa_('apiDemanaCodi', function (ctx, d) {
    var r = creaCodiEntrada_(d.correu);
    if (r) {
      var cfg = llegeixConfig_();
      var idioma = cfg.idiomaAvisos || 'es';
      var text = text_(idioma, 'cosCodi', { codi: r.codi.slice(0, 4) + '-' + r.codi.slice(4), min: MINUTS_CODI_ENTRADA,
        url: cfg.urlPanel || '' });
      try { enviaCorreu_(r.sup.correu, text_(idioma, 'assumpteCodi'), text); } catch (e) { anotaError_('correu codi', e); }
      if (r.sup.telegramChat && tokenTelegram_()) { try { enviaTelegram_(r.sup.telegramChat, text); } catch (e) { anotaError_('telegram codi', e); } }
    }
    return { enviat: true };
  });
}

function apiEntra() {
  return executa_('apiEntra', function (ctx, d) {
    var s = comprovaCodiEntrada_(d.correu, d.codi);
    anotaAuditoria_(s.nom, 'entra al panell', '');
    return { testimoni: testimoniSupervisor_(s), jo: { id: s.id, nom: s.nom, rol: s.rol } };
  });
}

function apiVinculaDispositiu() {
  return executa_('apiVinculaDispositiu', function (ctx, d) { return vinculaDispositiu_(d); });
}

// ---- App de la usuària ----

function apiEstatApp() {
  return executa_('apiEstatApp', function (ctx) { return estatApp_(ctx); });
}

function apiIniciaCanvi() {
  return executa_('apiIniciaCanvi', function (ctx, d) { return iniciaCanvi_(ctx, d); });
}

function apiCompletaCanvi() {
  return executa_('apiCompletaCanvi', function (ctx, d) { return completaCanvi_(ctx, d); });
}

function apiRegistraSortida() {
  return executa_('apiRegistraSortida', function (ctx, d) { return registraSortida_(ctx, d); });
}

function apiProgres() {
  return executa_('apiProgres', function (ctx, d) { return desaProgres_(ctx, d); });
}

function apiSeguiment() {
  return executa_('apiSeguiment', function (ctx) {
    if (ctx.rol === 'dispositiu' && ctx.tipus !== 'suport') throw errorApp_('SENSE_PERMIS', 'Només els telèfons de suport.');
    return progressos_();
  });
}

function apiAudio() {
  return executa_('apiAudio', function (ctx, d) { return fitxerDeCarpeta_('carpetaAudios', d.id); });
}

// ---- Panell: supervisors ----

function apiJo() {
  return executa_('apiJo', function (ctx) {
    return { id: ctx.id, nom: ctx.nom, rol: ctx.rol, versio: VERSIO, avisPendent: avisPendent_(ctx), avisVersio: AVIS_VERSIO_ };
  });
}

function apiAcceptaAvis() {
  return executa_('apiAcceptaAvis', function (ctx) { return acceptaAvis_(ctx); });
}

function apiSurt() {
  return executa_('apiSurt', function (ctx) { tancaSessions_(ctx.id); return { fet: true }; });
}

function apiResum() {
  return executa_('apiResum', function () { return resum_(); });
}

function apiHistorial() {
  return executa_('apiHistorial', function (ctx, d) { return historial_(d); });
}

function apiFoto() {
  return executa_('apiFoto', function (ctx, d) {
    var r = cercaPerId_('Registre', d.id);
    if (!r || !r.fotoId) throw errorApp_('NO_TROBAT', 'Aquest registre no té foto.');
    return fitxerDeCarpeta_('carpetaFotos', r.fotoId);
  });
}

function apiConfig() {
  return executa_('apiConfig', function () { return configPanel_(); });
}

function apiEnllacTelegram() {
  return executa_('apiEnllacTelegram', function (ctx, d) {
    var id = ctx.rol === 'administrador' && d.id ? d.id : ctx.id;
    return { enllac: enllacTelegram_(id) };
  });
}

function apiComprovaTelegram() {
  return executa_('apiComprovaTelegram', function () { return { vinculats: processaTelegram_() }; });
}

function apiProvaMissatge() {
  return executa_('apiProvaMissatge', function (ctx, d) {
    var id = ctx.rol === 'administrador' && d.id ? d.id : ctx.id;
    var n = notifica_(text_(llegeixConfig_().idiomaAvisos || 'es', 'prova'), { nomesId: id });
    return { enviats: n };
  });
}

// ---- Panell: administradors ----

function apiDesaEstat() {
  return executa_('apiDesaEstat', function (ctx, d) { return desaEstat_(ctx, d); });
}

function apiDesaConfig() {
  return executa_('apiDesaConfig', function (ctx, d) { return desaConfigGeneral_(ctx, d); });
}

function apiDesaMedicament() {
  return executa_('apiDesaMedicament', function (ctx, d) { return desaMedicament_(ctx, d); });
}

function apiDesaSupervisor() {
  return executa_('apiDesaSupervisor', function (ctx, d) { return desaSupervisor_(ctx, d); });
}

function apiTreuSupervisor() {
  return executa_('apiTreuSupervisor', function (ctx, d) { return treuSupervisor_(ctx, d); });
}

function apiCodiVinculacio() {
  return executa_('apiCodiVinculacio', function (ctx, d) {
    var nom = netejaText_(d.nom, 40) || 'iPhone';
    // Un supervisor només pot vincular telèfons de suport (sempre en pràctica).
    var tipus = ctx.rol === 'administrador' && d.tipus !== 'suport' ? 'usuaria' : 'suport';
    anotaAuditoria_(ctx.nom, 'genera un codi de vinculació', nom + ' (' + tipus + ')');
    return { codi: creaCodiVinculacio_(nom, ctx.nom, tipus), minuts: MINUTS_CODI_VINCULACIO, tipus: tipus };
  });
}

function apiEnllacDispositiu() {
  return executa_('apiEnllacDispositiu', function (ctx, d) {
    var dis = cercaPerId_('Dispositius', d.id);
    if (!dis || dis.actiu !== 'si') throw errorApp_('NO_TROBAT', 'Dispositiu no trobat.');
    anotaAuditoria_(ctx.nom, 'consulta l\'enllaç de la drecera', dis.nom);
    return { testimoni: testimoniDispositiu_(dis) };
  });
}

function apiDesaDispositiu() {
  return executa_('apiDesaDispositiu', function (ctx, d) { return desaDispositiu_(ctx, d); });
}

function apiDesvinculaDispositiu() {
  return executa_('apiDesvinculaDispositiu', function (ctx, d) { return desvinculaDispositiu_(ctx, d); });
}

function apiDesaAudio() {
  return executa_('apiDesaAudio', function (ctx, d) {
    var id = desaAudio_(d.b64, d.mime, 'audio_' + netejaText_(d.nom, 40) + '_' + araText_().replace(/[: ]/g, '-'));
    anotaAuditoria_(ctx.nom, 'grava un àudio', d.nom || '');
    return { id: id };
  });
}

function apiAuditoria() {
  return executa_('apiAuditoria', function () { return auditoria_(); });
}

// ---- Còpies de seguretat ----

function apiCopies() {
  return executa_('apiCopies', function () { return llistaCopies_(); });
}

function apiFesCopia() {
  return executa_('apiFesCopia', function (ctx) { return fesCopia_(ctx.nom, 'manual'); });
}

function apiPreparaImportacio() {
  return executa_('apiPreparaImportacio', function (ctx, d) { return preparaImportacio_(ctx, d); });
}

function apiImporta() {
  return executa_('apiImporta', function (ctx, d) { return importaCopia_(ctx, d); });
}

function apiPreparaEsborrat() {
  return executa_('apiPreparaEsborrat', function (ctx, d) { return preparaEsborrat_(ctx, d); });
}

function apiEsborraHistorial() {
  return executa_('apiEsborraHistorial', function (ctx, d) { return esborraHistorial_(ctx, d); });
}

/** Taula d'operacions que accepta doPost (mai es crida una funció pel seu nom sense passar per aquí). */
var RUTES_ = {
  apiDemanaCodi: apiDemanaCodi, apiEntra: apiEntra, apiVinculaDispositiu: apiVinculaDispositiu,
  apiEstatApp: apiEstatApp, apiIniciaCanvi: apiIniciaCanvi, apiCompletaCanvi: apiCompletaCanvi, apiAudio: apiAudio,
  apiProgres: apiProgres, apiSeguiment: apiSeguiment, apiDesaDispositiu: apiDesaDispositiu,
  apiJo: apiJo, apiAcceptaAvis: apiAcceptaAvis, apiSurt: apiSurt, apiResum: apiResum, apiHistorial: apiHistorial, apiFoto: apiFoto, apiConfig: apiConfig,
  apiEnllacTelegram: apiEnllacTelegram, apiComprovaTelegram: apiComprovaTelegram, apiProvaMissatge: apiProvaMissatge,
  apiDesaEstat: apiDesaEstat, apiDesaConfig: apiDesaConfig, apiDesaMedicament: apiDesaMedicament,
  apiDesaSupervisor: apiDesaSupervisor, apiTreuSupervisor: apiTreuSupervisor, apiCodiVinculacio: apiCodiVinculacio,
  apiEnllacDispositiu: apiEnllacDispositiu, apiDesvinculaDispositiu: apiDesvinculaDispositiu, apiDesaAudio: apiDesaAudio, apiAuditoria: apiAuditoria,
  apiCopies: apiCopies, apiFesCopia: apiFesCopia, apiPreparaImportacio: apiPreparaImportacio, apiImporta: apiImporta,
  apiPreparaEsborrat: apiPreparaEsborrat, apiEsborraHistorial: apiEsborraHistorial, apiRegistraSortida: apiRegistraSortida
};
