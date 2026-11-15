/**
 * 23_Notificacions.gs — Medicació assistida
 *
 * Enviament d'avisos als supervisors per Telegram i correu, i vinculació dels
 * xats de Telegram (per sondeig amb getUpdates, sense webhook).
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */

function tokenTelegram_() {
  return PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN') || '';
}

function telegramApi_(metode, payload, token) {
  token = token || tokenTelegram_();
  if (!token) return null;
  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + metode, {
    method: 'post', payload: payload || {}, muteHttpExceptions: true
  });
  var dades = {};
  try { dades = JSON.parse(resp.getContentText()); } catch (e) { dades = { ok: false, description: 'resposta no vàlida' }; }
  if (!dades.ok) throw errorApp_('TELEGRAM', 'Telegram: ' + (dades.description || resp.getResponseCode()));
  return dades.result;
}

function enviaTelegram_(chat, text, foto) {
  if (foto) return telegramApi_('sendPhoto', { chat_id: String(chat), caption: text.slice(0, 1000), photo: foto.copyBlob() });
  return telegramApi_('sendMessage', { chat_id: String(chat), text: text });
}

function escapaHtml_(t) {
  return String(t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
  });
}

function enviaCorreu_(adreca, assumpte, text, foto) {
  var opcions = {
    to: adreca, subject: assumpte, body: text, name: NOM_APP,
    htmlBody: '<div style="font-family:sans-serif;font-size:16px;line-height:1.5">' +
      escapaHtml_(text).replace(/\n/g, '<br>') + (foto ? '<br><br><img src="cid:foto" style="max-width:100%">' : '') + '</div>'
  };
  if (foto) opcions.inlineImages = { foto: foto.copyBlob() };
  MailApp.sendEmail(opcions);
}

/** Envia un avís a tots els supervisors actius pels seus canals. No llança errors. */
function notifica_(text, opcions) {
  opcions = opcions || {};
  var cfg = llegeixConfig_();
  var idioma = cfg.idiomaAvisos || 'es';
  var assumpte = opcions.assumpte || text_(idioma, 'assumpteAvis', { estat: text.split('\n')[0].slice(0, 80) });
  var enviats = 0;
  var sups = opcions.nomesId ? [cercaPerId_('Supervisors', opcions.nomesId)].filter(Boolean)
    : llegeixFull_('Supervisors').filter(function (s) { return s.actiu === 'si'; });
  sups.forEach(function (s) {
    if (s.perTelegram === 'si' && s.telegramChat && tokenTelegram_()) {
      try { enviaTelegram_(s.telegramChat, text, opcions.foto); enviats++; } catch (e) { anotaError_('telegram ' + s.nom, e); }
    }
    if (s.perCorreu === 'si' && s.correu) {
      try { enviaCorreu_(s.correu, assumpte, text, opcions.foto); enviats++; } catch (e) { anotaError_('correu ' + s.nom, e); }
    }
  });
  return enviats;
}

/** Enllaç t.me per vincular el Telegram d'un supervisor (vàlid 1 dia). */
function enllacTelegram_(idSupervisor) {
  var bot = llegeixConfig_().telegramBot;
  if (!bot || !tokenTelegram_()) throw errorApp_('SENSE_TELEGRAM', 'Encara no s\'ha configurat el bot de Telegram.');
  var codi = codiAleatori_(16, 'abcdefghijkmnpqrstuvwxyz23456789');
  CacheService.getScriptCache().put('tg:' + codi, idSupervisor, 86400);
  return 'https://t.me/' + bot + '?start=' + codi;
}

/** Llegeix els missatges pendents del bot i vincula els xats que han fet /start codi. */
function processaTelegram_() {
  if (!tokenTelegram_()) return 0;
  var props = PropertiesService.getScriptProperties();
  var offset = Number(props.getProperty('TELEGRAM_OFFSET') || 0);
  var updates = telegramApi_('getUpdates', { offset: String(offset), timeout: '0' }) || [];
  var vinculats = 0;
  var idioma = llegeixConfig_().idiomaAvisos || 'es';
  updates.forEach(function (u) {
    offset = Math.max(offset, u.update_id + 1);
    var m = u.message;
    if (!m || !m.text || !m.chat) return;
    var p = /^\/start\s+([a-z0-9]{16})$/.exec(String(m.text).trim());
    if (!p) return;
    var cau = CacheService.getScriptCache();
    var idSup = cau.get('tg:' + p[1]);
    if (!idSup) { try { enviaTelegram_(m.chat.id, text_(idioma, 'telegramDesconegut')); } catch (e) { /* res */ } return; }
    cau.remove('tg:' + p[1]);
    var sup = ambBloqueig_(function () {
      return actualitzaPerId_('Supervisors', idSup, { telegramChat: String(m.chat.id), perTelegram: 'si' });
    });
    if (sup) {
      vinculats++;
      anotaAuditoria_('Telegram', 'vincula Telegram', sup.nom);
      try { enviaTelegram_(m.chat.id, text_(idioma, 'telegramVinculat', { nom: sup.nom })); } catch (e) { /* res */ }
    }
  });
  props.setProperty('TELEGRAM_OFFSET', String(offset));
  return vinculats;
}

/** Valida i desa el testimoni del bot. Retorna el nom d'usuari del bot. */
function desaTokenTelegram_(token) {
  token = String(token || '').trim();
  if (!token) {
    PropertiesService.getScriptProperties().deleteProperty('TELEGRAM_TOKEN');
    desaConfig_({ telegramBot: '' });
    return '';
  }
  if (!/^\d+:[\w-]{30,}$/.test(token)) throw errorApp_('DADES', 'El testimoni del bot no té el format correcte.');
  var jo = telegramApi_('getMe', {}, token);
  PropertiesService.getScriptProperties().setProperty('TELEGRAM_TOKEN', token);
  PropertiesService.getScriptProperties().deleteProperty('TELEGRAM_OFFSET');
  desaConfig_({ telegramBot: jo.username });
  return jo.username;
}
