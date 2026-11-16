/**
 * 30_Backend.gs — Medicació assistida
 *
 * Accions d'administració que fa el panell: estat DEMO/ACTIU, configuració
 * general, medicaments (dies, hora, passos, zones), supervisors i dispositius.
 * Totes validen les dades i deixen rastre a l'auditoria.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.10.0 · 2026-11-16
 */

function configPanel_() {
  var cfg = llegeixConfig_();
  return {
    config: {
      estat: cfg.estat === 'ACTIU' ? 'ACTIU' : 'DEMO', dataInici: cfg.dataInici, idioma: cfg.idioma,
      idiomaAvisos: cfg.idiomaAvisos, nomUsuaria: cfg.nomUsuaria, notificarPractiques: cfg.notificarPractiques,
      guardaUbicacio: cfg.guardaUbicacio !== 'no',
      telegramBot: cfg.telegramBot, telegramConfigurat: !!tokenTelegram_(), urlPanel: cfg.urlPanel,
      entorn: PropertiesService.getScriptProperties().getProperty('ENTORN') || 'desenvolupament',
      versio: VERSIO,
      audiosFrases: frasesGravades_(cfg)
    },
    medicaments: medicaments_(false),
    supervisors: llegeixFull_('Supervisors').filter(function (s) { return s.actiu === 'si'; }).map(function (s) {
      return { id: s.id, nom: s.nom, correu: s.correu, rol: s.rol, perCorreu: s.perCorreu === 'si',
        perTelegram: s.perTelegram === 'si', teTelegram: !!s.telegramChat };
    }),
    dispositius: llegeixFull_('Dispositius').filter(function (d) { return d.actiu === 'si'; }).map(function (d) {
      return { id: d.id, nom: d.nom, tipus: d.tipus === 'suport' ? 'suport' : 'usuaria', creat: d.creat, darreraConnexio: d.darreraConnexio };
    })
  };
}

function desaEstat_(ctx, dades) {
  var estat = dades.estat === 'ACTIU' ? 'ACTIU' : 'DEMO';
  var canvis = { estat: estat };
  if (estat === 'ACTIU') {
    var inici = dades.dataInici ? deClau_(dades.dataInici) : new Date();
    if (!inici) throw errorApp_('DADES', 'Data d\'inici no vàlida.');
    canvis.dataInici = clau_(inici);
  }
  ambBloqueig_(function () { desaConfig_(canvis); });
  anotaAuditoria_(ctx.nom, 'canvia l\'estat', estat + (canvis.dataInici ? ' des de ' + canvis.dataInici : ''));
  return configPanel_();
}

function desaConfigGeneral_(ctx, dades) {
  var canvis = {};
  if (dades.idioma !== undefined) canvis.idioma = dades.idioma === 'ca' ? 'ca' : 'es';
  if (dades.idiomaAvisos !== undefined) canvis.idiomaAvisos = dades.idiomaAvisos === 'ca' ? 'ca' : 'es';
  if (dades.nomUsuaria !== undefined) canvis.nomUsuaria = String(dades.nomUsuaria).trim().slice(0, 60);
  if (dades.notificarPractiques !== undefined) canvis.notificarPractiques = dades.notificarPractiques ? 'si' : 'no';
  if (dades.guardaUbicacio !== undefined) canvis.guardaUbicacio = dades.guardaUbicacio ? 'si' : 'no';
  if (dades.urlPanel !== undefined) {
    var u = String(dades.urlPanel).trim();
    if (u && !/^https:\/\/[^\s"<>]+$/.test(u)) throw errorApp_('DADES', 'L\'adreça del panell ha de començar per https://');
    canvis.urlPanel = u;
  }
  ambBloqueig_(function () { desaConfig_(canvis); });
  var detall = Object.keys(canvis).map(function (k) { return k + '=' + canvis[k]; }).join(', ');
  anotaAuditoria_(ctx.nom, 'canvia la configuració', detall);
  if (dades.telegramToken !== undefined) {
    var bot = desaTokenTelegram_(dades.telegramToken);
    anotaAuditoria_(ctx.nom, 'configura el bot de Telegram', bot || '(esborrat)');
  }
  return configPanel_();
}

/** Desa les gravacions de les frases fixes de l'app (només claus conegudes i ID de Drive). */
function desaFrases_(ctx, dades) {
  var nou = frasesGravades_({ audiosFrases: JSON.stringify(dades.frases || {}) });
  ambBloqueig_(function () { desaConfig_({ audiosFrases: JSON.stringify(nou) }); });
  anotaAuditoria_(ctx.nom, 'canvia les gravacions de les frases',
    'es: ' + Object.keys(nou.es).length + ', ca: ' + Object.keys(nou.ca).length);
  return configPanel_();
}

// ---- Medicaments ----

var TIPUS_PAS_ = ['retirada', 'zona', 'info', 'temporitzador', 'foto'];

function netejaText_(t, max) { return String(t === undefined || t === null ? '' : t).trim().slice(0, max || 600); }

function validaMedicament_(d) {
  var dies = (d.dies || []).map(Number).filter(function (n) { return n >= 1 && n <= 7; });
  dies = dies.filter(function (n, i) { return dies.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
  if (!netejaText_(d.nom_es) && !netejaText_(d.nom_ca)) throw errorApp_('DADES', 'Cal un nom per al medicament.');
  if (!dies.length) throw errorApp_('DADES', 'Cal triar almenys un dia.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.hora))) throw errorApp_('DADES', 'Hora no vàlida (HH:MM).');
  var enter = function (v, min, max, nom) {
    var n = Number(v);
    if (!isFinite(n) || n < min || n > max || Math.round(n) !== n) throw errorApp_('DADES', nom + ' ha de ser entre ' + min + ' i ' + max + '.');
    return n;
  };
  var avis = enter(d.margeAvisMin, 5, 720, 'El primer avís');
  var alerta = enter(d.margeAlertaMin, 5, 1440, 'L\'alerta');
  if (alerta <= avis) throw errorApp_('DADES', 'L\'alerta ha de ser posterior al primer avís.');
  var passos = (d.passos || []).map(function (p, i) {
    if (TIPUS_PAS_.indexOf(p.tipus) < 0) throw errorApp_('DADES', 'Tipus de pas desconegut: ' + p.tipus);
    var pas = {
      id: /^[\w-]{1,20}$/.test(p.id || '') ? p.id : 'p' + (i + 1) + codiAleatori_(4, 'abcdefghjkmnpqrstuvwxyz'),
      tipus: p.tipus, segons: p.tipus === 'temporitzador' ? enter(p.segons, 1, 600, 'El temporitzador') : 0,
      colocacio: !!p.colocacio, text_es: netejaText_(p.text_es), text_ca: netejaText_(p.text_ca),
      audio_es: /^[\w-]{10,80}$/.test(p.audio_es || '') ? p.audio_es : '',
      audio_ca: /^[\w-]{10,80}$/.test(p.audio_ca || '') ? p.audio_ca : ''
    };
    if (!pas.text_es && !pas.text_ca) throw errorApp_('DADES', 'El pas ' + (i + 1) + ' no té text.');
    return pas;
  });
  if (!passos.length) throw errorApp_('DADES', 'Cal almenys un pas.');
  ['retirada', 'zona', 'foto'].forEach(function (t) {
    if (passos.filter(function (p) { return p.tipus === t; }).length > 1) throw errorApp_('DADES', 'Només hi pot haver un pas de tipus «' + t + '».');
  });
  var codisVistos = {};
  var zones = (d.zones || []).map(function (z) {
    var codi = String(z.codi || '').toUpperCase();
    if (!/^[A-Z]$/.test(codi) || codisVistos[codi]) throw errorApp_('DADES', 'Codi de zona no vàlid o repetit: ' + codi);
    codisVistos[codi] = true;
    return { codi: codi, nom_es: netejaText_(z.nom_es, 80), nom_ca: netejaText_(z.nom_ca, 80), activa: z.activa !== false,
      audio_es: /^[\w-]{10,80}$/.test(z.audio_es || '') ? z.audio_es : '',
      audio_ca: /^[\w-]{10,80}$/.test(z.audio_ca || '') ? z.audio_ca : '' };
  });
  var diesRep = enter(d.diesRepeticioZona || 0, 0, 60, 'Els dies sense repetir zona');
  var teZona = passos.some(function (p) { return p.tipus === 'zona'; });
  if (teZona) {
    var actives = zones.filter(function (z) { return z.activa; }).length;
    var minim = zonesMinimes_(dies.join(','), diesRep);
    if (actives < minim) {
      throw errorApp_('DADES', 'Amb aquests dies i ' + diesRep + ' dies sense repetir calen almenys ' + minim +
        ' zones actives (n\'hi ha ' + actives + ').');
    }
  }
  return {
    nom_es: netejaText_(d.nom_es, 80), nom_ca: netejaText_(d.nom_ca, 80), actiu: d.actiu === false ? 'no' : 'si',
    dies: dies.join(','), hora: String(d.hora), margeAvisMin: avis, margeAlertaMin: alerta,
    diesRepeticioZona: diesRep, maxDiesEntreCanvis: enter(d.maxDiesEntreCanvis || 0, 0, 30, 'La separació màxima'),
    passos: JSON.stringify(passos), zones: JSON.stringify(zones)
  };
}

function desaMedicament_(ctx, dades) {
  var nou = validaMedicament_(dades);
  var avisos = validaDies_(nou.dies.split(','), nou.maxDiesEntreCanvis);
  var desat = ambBloqueig_(function () {
    var antic = dades.id ? cercaPerId_('Medicaments', dades.id) : null;
    if (dades.id && !antic) throw errorApp_('NO_TROBAT', 'Medicament no trobat.');
    if (!antic || antic.dies !== nou.dies || antic.hora !== nou.hora || antic.actiu !== nou.actiu) nou.vigentDes = clau_(new Date());
    if (antic) return actualitzaPerId_('Medicaments', antic.id, nou);
    nou.id = nouId_('m'); nou.creat = araText_();
    return afegeixFila_('Medicaments', nou);
  });
  anotaAuditoria_(ctx.nom, dades.id ? 'modifica el medicament' : 'crea el medicament',
    desat.nom_es + ': dies ' + desat.dies + ' a les ' + desat.hora + ', avís ' + desat.margeAvisMin + ' min, alerta ' + desat.margeAlertaMin + ' min');
  var r = configPanel_();
  r.avisos = avisos;
  return r;
}

// ---- Supervisors ----

function administradorsActius_(excepteId) {
  return llegeixFull_('Supervisors').filter(function (s) {
    return s.actiu === 'si' && s.rol === 'administrador' && s.id !== excepteId;
  }).length;
}

function desaSupervisor_(ctx, dades) {
  var nom = netejaText_(dades.nom, 60);
  var correu = netejaText_(dades.correu, 120).toLowerCase();
  if (!nom) throw errorApp_('DADES', 'Cal el nom.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correu)) throw errorApp_('DADES', 'Correu no vàlid.');
  var rol = dades.rol === 'administrador' ? 'administrador' : 'supervisor';
  var desat = ambBloqueig_(function () {
    var tots = llegeixFull_('Supervisors');
    var repetit = tots.filter(function (s) { return s.actiu === 'si' && s.correu === correu && s.id !== dades.id; })[0];
    if (repetit) throw errorApp_('DADES', 'Ja hi ha una persona amb aquest correu.');
    var canvis = { nom: nom, correu: correu, rol: rol, perCorreu: dades.perCorreu ? 'si' : 'no', perTelegram: dades.perTelegram ? 'si' : 'no' };
    if (dades.id) {
      var antic = cercaPerId_('Supervisors', dades.id);
      if (!antic || antic.actiu !== 'si') throw errorApp_('NO_TROBAT', 'Persona no trobada.');
      if (antic.rol === 'administrador' && rol !== 'administrador' && !administradorsActius_(antic.id)) {
        throw errorApp_('DADES', 'Ha de quedar almenys un administrador.');
      }
      if (antic.correu !== correu) canvis.versio = Number(antic.versio || 1) + 1;
      return actualitzaPerId_('Supervisors', antic.id, canvis);
    }
    canvis.id = nouId_('s'); canvis.actiu = 'si'; canvis.versio = 1; canvis.creat = araText_();
    return afegeixFila_('Supervisors', canvis);
  });
  anotaAuditoria_(ctx.nom, dades.id ? 'modifica la persona' : 'afegeix la persona', desat.nom + ' (' + desat.rol + ')');
  return configPanel_();
}

function treuSupervisor_(ctx, dades) {
  var tret = ambBloqueig_(function () {
    var s = cercaPerId_('Supervisors', dades.id);
    if (!s || s.actiu !== 'si') throw errorApp_('NO_TROBAT', 'Persona no trobada.');
    if (s.rol === 'administrador' && !administradorsActius_(s.id)) throw errorApp_('DADES', 'Ha de quedar almenys un administrador.');
    return actualitzaPerId_('Supervisors', s.id, { actiu: 'no', versio: Number(s.versio || 1) + 1, telegramChat: '' });
  });
  anotaAuditoria_(ctx.nom, 'treu la persona', tret.nom);
  return configPanel_();
}

/** Invalida totes les sessions obertes d'un supervisor (incrementa la versió). */
function tancaSessions_(id) {
  ambBloqueig_(function () {
    var s = cercaPerId_('Supervisors', id);
    if (s) actualitzaPerId_('Supervisors', id, { versio: Number(s.versio || 1) + 1 });
  });
}

// ---- Dispositius ----

function vinculaDispositiu_(dades) {
  var reg = consumeixCodiVinculacio_(dades.codi);
  var dis = ambBloqueig_(function () {
    return afegeixFila_('Dispositius', { id: nouId_('d'), nom: reg.nom || 'iPhone', tipus: reg.tipus || 'usuaria', actiu: 'si', versio: 1,
      creat: araText_(), darreraConnexio: araText_() });
  });
  anotaAuditoria_(reg.qui, 'vincula el dispositiu', dis.nom + ' (' + dis.tipus + ')');
  return { testimoni: testimoniDispositiu_(dis), nom: dis.nom, tipus: dis.tipus };
}

function desaDispositiu_(ctx, dades) {
  var tipus = TIPUS_DISPOSITIU_.indexOf(dades.tipus) > -1 ? dades.tipus : null;
  var nom = netejaText_(dades.nom, 40);
  var d = ambBloqueig_(function () {
    var x = cercaPerId_('Dispositius', dades.id);
    if (!x || x.actiu !== 'si') throw errorApp_('NO_TROBAT', 'Dispositiu no trobat.');
    var canvis = {};
    if (tipus) canvis.tipus = tipus;
    if (nom) canvis.nom = nom;
    return actualitzaPerId_('Dispositius', x.id, canvis);
  });
  anotaAuditoria_(ctx.nom, 'modifica el dispositiu', d.nom + ' (' + d.tipus + ')');
  return configPanel_();
}

function desvinculaDispositiu_(ctx, dades) {
  var d = ambBloqueig_(function () {
    var x = cercaPerId_('Dispositius', dades.id);
    if (!x || x.actiu !== 'si') throw errorApp_('NO_TROBAT', 'Dispositiu no trobat.');
    return actualitzaPerId_('Dispositius', x.id, { actiu: 'no', versio: Number(x.versio || 1) + 1 });
  });
  anotaAuditoria_(ctx.nom, 'desvincula el dispositiu', d.nom);
  return configPanel_();
}

// ---- Avís d'ús ----

/** Versió del text de l'avís d'ús del panell. Si el text canvia, s'incrementa i tothom l'ha de tornar a acceptar. */
var AVIS_VERSIO_ = 1;

function avisPendent_(ctx) {
  var mapa = llegeixJson_(llegeixConfig_().avisosAcceptats, {}) || {};
  return Number(mapa[ctx.id]) !== AVIS_VERSIO_;
}

function acceptaAvis_(ctx) {
  ambBloqueig_(function () {
    var mapa = llegeixJson_(llegeixConfig_().avisosAcceptats, {}) || {};
    mapa[ctx.id] = AVIS_VERSIO_;
    desaConfig_({ avisosAcceptats: JSON.stringify(mapa) });
  });
  anotaAuditoria_(ctx.nom, 'accepta l\'avís d\'ús', 'versió ' + AVIS_VERSIO_);
  return { avisPendent: false };
}

function auditoria_() {
  return llegeixFull_('Auditoria').reverse().slice(0, 300).map(function (a) {
    return { data: a.data, qui: a.qui, accio: a.accio, detall: a.detall };
  });
}
