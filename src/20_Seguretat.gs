/**
 * 20_Seguretat.gs — Medicació assistida
 *
 * Testimonis signats (HMAC), codis d'un sol ús per entrar al panell i per
 * vincular el dispositiu, i comprovacions d'origen (propietari, activador).
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.5.0 · 2026-11-15
 */

function errorApp_(codi, missatge) {
  var e = new Error(missatge || codi);
  e.codi = codi;
  return e;
}

// ---- Base64 i resums ----

function b64_(text) {
  return Utilities.base64EncodeWebSafe(text, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

function deB64_(text) {
  var p = String(text);
  while (p.length % 4) p += '=';
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(p)).getDataAsString('UTF-8');
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function sha256_(text) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}

function igualsSegur_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function octetsAleatoris_() {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid() + Date.now(), Utilities.Charset.UTF_8);
}

/** Codi aleatori de n caràcters de l'alfabet donat. */
function codiAleatori_(n, alfabet) {
  var o = octetsAleatoris_();
  var s = '';
  for (var i = 0; i < n; i++) s += alfabet.charAt((o[i] & 0xff) % alfabet.length);
  return s;
}

// ---- Testimonis signats ----

function secret_() {
  var s = PropertiesService.getScriptProperties().getProperty('SECRET_HMAC');
  if (!s) throw errorApp_('SENSE_INSTALLAR', 'Falta el secret. Cal executar instalacio().');
  return s;
}

function signa_(dades) {
  var cos = b64_(JSON.stringify(dades));
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(cos, secret_())).replace(/=+$/, '');
  return cos + '.' + sig;
}

/** Retorna el contingut d'un testimoni si la signatura és bona i no ha caducat; si no, null. */
function llegeixTestimoni_(testimoni) {
  if (!testimoni || typeof testimoni !== 'string' || testimoni.length > 2000) return null;
  var parts = testimoni.split('.');
  if (parts.length !== 2) return null;
  var esperada = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_())).replace(/=+$/, '');
  if (!igualsSegur_(esperada, parts[1])) return null;
  var dades;
  try { dades = JSON.parse(deB64_(parts[0])); } catch (e) { return null; }
  if (dades.exp && Date.now() > dades.exp) return null;
  return dades;
}

function testimoniSupervisor_(sup) {
  return signa_({ r: 'sup', id: sup.id, v: String(sup.versio), exp: Date.now() + DIES_SESSIO * 86400000 });
}

function testimoniDispositiu_(dis) {
  return signa_({ r: 'dis', id: dis.id, v: String(dis.versio) });
}

/** Identifica qui fa la petició. Retorna {rol, id, nom} o null. */
function identifica_(testimoni) {
  var d = llegeixTestimoni_(testimoni);
  if (!d) return null;
  if (d.r === 'sup') {
    var s = cercaPerId_('Supervisors', d.id);
    if (!s || s.actiu !== 'si' || String(s.versio) !== d.v) return null;
    return { rol: s.rol === 'administrador' ? 'administrador' : 'supervisor', id: s.id, nom: s.nom, correu: s.correu };
  }
  if (d.r === 'dis') {
    var di = cercaPerId_('Dispositius', d.id);
    if (!di || di.actiu !== 'si' || String(di.versio) !== d.v) return null;
    anotaConnexio_(di.id);
    return { rol: 'dispositiu', id: di.id, nom: di.nom, tipus: di.tipus === 'suport' ? 'suport' : 'usuaria' };
  }
  return null;
}

function anotaConnexio_(id) {
  var cau = CacheService.getScriptCache();
  if (cau.get('con:' + id)) return;
  cau.put('con:' + id, '1', 600);
  try { ambBloqueig_(function () { actualitzaPerId_('Dispositius', id, { darreraConnexio: araText_() }); }); } catch (e) { /* no és crític */ }
}

// ---- Codis d'un sol ús ----

var ALFABET_CODI_ = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Límit de peticions per clau (finestra en segons). Llança LIMIT si se supera. */
function limita_(clau, maxim, segons) {
  var cau = CacheService.getScriptCache();
  var n = Number(cau.get('lim:' + clau) || 0);
  if (n >= maxim) throw errorApp_('LIMIT', 'Massa intents. Espereu uns minuts.');
  cau.put('lim:' + clau, String(n + 1), segons);
}

/** Crea un codi d'entrada per a un supervisor actiu. Retorna {sup, codi} o null si el correu no és d'un supervisor. */
function creaCodiEntrada_(correu) {
  correu = String(correu || '').trim().toLowerCase();
  limita_('pet:' + correu, 5, 3600);
  var sup = llegeixFull_('Supervisors').filter(function (s) {
    return s.actiu === 'si' && String(s.correu).toLowerCase() === correu;
  })[0];
  if (!sup) return null;
  var codi = codiAleatori_(8, ALFABET_CODI_);
  var reg = { h: sha256_(codi), n: 0, exp: Date.now() + MINUTS_CODI_ENTRADA * 60000, id: sup.id };
  CacheService.getScriptCache().put('ent:' + correu, JSON.stringify(reg), MINUTS_CODI_ENTRADA * 60);
  return { sup: sup, codi: codi };
}

/** Comprova un codi d'entrada. Retorna el supervisor o llança CODI_INVALID. */
function comprovaCodiEntrada_(correu, codi) {
  correu = String(correu || '').trim().toLowerCase();
  codi = String(codi || '').replace(/[\s-]/g, '').toUpperCase();
  var cau = CacheService.getScriptCache();
  var desat = cau.get('ent:' + correu);
  var reg = desat ? JSON.parse(desat) : null;
  if (!reg || Date.now() > reg.exp) throw errorApp_('CODI_INVALID', 'Codi incorrecte o caducat.');
  if (!igualsSegur_(reg.h, sha256_(codi))) {
    reg.n++;
    if (reg.n >= INTENTS_MAXIMS_CODI) cau.remove('ent:' + correu);
    else cau.put('ent:' + correu, JSON.stringify(reg), Math.max(1, Math.round((reg.exp - Date.now()) / 1000)));
    throw errorApp_('CODI_INVALID', 'Codi incorrecte o caducat.');
  }
  cau.remove('ent:' + correu);
  var sup = cercaPerId_('Supervisors', reg.id);
  if (!sup || sup.actiu !== 'si') throw errorApp_('CODI_INVALID', 'Codi incorrecte o caducat.');
  return sup;
}

/** Crea un codi de 6 xifres per vincular un dispositiu. */
function creaCodiVinculacio_(nomDispositiu, qui, tipus) {
  var o = octetsAleatoris_();
  var num = ((o[0] & 0xff) * 65536 + (o[1] & 0xff) * 256 + (o[2] & 0xff)) % 1000000;
  var codi = ('00000' + num).slice(-6);
  CacheService.getScriptCache().put('vin:' + codi,
    JSON.stringify({ nom: nomDispositiu, qui: qui, tipus: tipus === 'suport' ? 'suport' : 'usuaria', exp: Date.now() + MINUTS_CODI_VINCULACIO * 60000 }),
    MINUTS_CODI_VINCULACIO * 60);
  return codi;
}

/** Consumeix un codi de vinculació. Retorna {nom, qui} o llança CODI_INVALID. */
function consumeixCodiVinculacio_(codi) {
  limita_('vinculacio', 20, 600);
  codi = String(codi || '').replace(/\D/g, '');
  var cau = CacheService.getScriptCache();
  var desat = codi.length === 6 ? cau.get('vin:' + codi) : null;
  if (!desat) throw errorApp_('CODI_INVALID', 'Codi incorrecte o caducat.');
  cau.remove('vin:' + codi);
  var reg = JSON.parse(desat);
  if (Date.now() > reg.exp) throw errorApp_('CODI_INVALID', 'Codi incorrecte o caducat.');
  return reg;
}

// ---- Origen de les crides que no venen de la web ----

/** Cert si l'executa el propietari des de l'editor (no un visitant anònim de la web). */
function esPropietari_() {
  var actiu = '';
  var efectiu = '';
  try { actiu = Session.getActiveUser().getEmail(); efectiu = Session.getEffectiveUser().getEmail(); } catch (e) { return false; }
  return !!actiu && actiu === efectiu;
}

/** Cert si l'esdeveniment ve d'un activador d'aquest projecte. */
function esActivadorPropi_(e) {
  if (!e || !e.triggerUid) return false;
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(e.triggerUid); });
}
