/**
 * 24_Canvis.gs — Medicació assistida
 *
 * Lògica de negoci: medicaments, estat per a l'app, inici i final d'un canvi,
 * fotos i àudios a Drive, revisió de retards i dades del panell.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.8.0 · 2026-11-16
 */

// ---- Medicaments ----

function llegeixJson_(text, defecte) {
  try { var v = JSON.parse(text); return v === null || v === undefined ? defecte : v; } catch (e) { return defecte; }
}

function normalitzaMed_(r) {
  return {
    id: r.id, nom_es: r.nom_es, nom_ca: r.nom_ca, actiu: r.actiu === 'si',
    dies: r.dies, hora: r.hora,
    margeAvisMin: Number(r.margeAvisMin) || 30, margeAlertaMin: Number(r.margeAlertaMin) || 120,
    diesRepeticioZona: Number(r.diesRepeticioZona) || 0, maxDiesEntreCanvis: Number(r.maxDiesEntreCanvis) || 0,
    passos: llegeixJson_(r.passos, []), zones: llegeixJson_(r.zones, []), vigentDes: r.vigentDes
  };
}

function medicaments_(nomesActius) {
  return llegeixFull_('Medicaments').map(normalitzaMed_).filter(function (m) { return !nomesActius || m.actiu; });
}

function medicament_(id) {
  var r = cercaPerId_('Medicaments', id);
  return r ? normalitzaMed_(r) : null;
}

function registresDe_(medId, mode) {
  return llegeixFull_('Registre').filter(function (r) {
    return r.medicament === medId && (!mode || r.mode === mode);
  });
}

function nomMed_(med, idioma) { return med['nom_' + idioma] || med.nom_es; }

function nomZona_(med, codi, idioma) {
  var z = med.zones.filter(function (x) { return x.codi === codi; })[0];
  return z ? (z['nom_' + idioma] || z.nom_es) : codi;
}

function dataHumana_(clau, idioma) {
  var d = deClau_(clau);
  if (!d) return '';
  return nomDia_(idioma, diaIso_(d)) + ' ' + dosXifres_(d.getDate()) + '/' + dosXifres_(d.getMonth() + 1) + ' ' +
    dosXifres_(d.getHours()) + ':' + dosXifres_(d.getMinutes());
}

function modeActual_(cfg) { return cfg.estat === 'ACTIU' ? 'REAL' : 'DEMO'; }

/** Mode d'un dispositiu: els de suport sempre van en pràctica. */
function modeDispositiu_(cfg, ctx) { return ctx && ctx.tipus === 'suport' ? 'DEMO' : modeActual_(cfg); }

/** Canvis programats fets seguits, des del més recent fins al primer que no es va fer. */
function ratxa_(reals) {
  var prog = reals.filter(function (r) {
    return r.tipus === 'programat' && (r.estat === 'completat' || r.estat === 'no fet');
  }).sort(function (a, b) { return a.dataProgramada < b.dataProgramada ? 1 : -1; });
  var n = 0;
  for (var i = 0; i < prog.length && prog[i].estat === 'completat'; i++) n++;
  return n;
}

// ---- App de la usuària ----

function estatApp_(ctx, d) {
  var cfg = llegeixConfig_();
  // La usuària pot triar l'idioma al seu telèfon; si no, el que ha posat l'administrador.
  var idiomaSistema = cfg.idioma === 'ca' ? 'ca' : 'es';
  var idioma = d && (d.idioma === 'ca' || d.idioma === 'es') ? d.idioma : idiomaSistema;
  var ara = new Date();
  var suport = ctx.tipus === 'suport';
  var actiu = cfg.estat === 'ACTIU' && !suport;
  var meds = medicaments_(true).map(function (m) {
    var reals = registresDe_(m.id, 'REAL');
    var cal = estatCalendari_(m, cfg.dataInici, reals, ara, MINUTS_ANTICIPACIO);
    var fets = reals.filter(function (r) { return r.estat === 'completat'; })
      .sort(function (a, b) { return a.fi < b.fi ? 1 : -1; });
    return {
      id: m.id, nom: nomMed_(m, idioma), dies: m.dies, hora: m.hora,
      pendent: actiu ? cal.pendent : null,
      minutsRetard: cal.minutsRetard,
      propera: cal.propera,
      darrer: fets.length ? { fi: fets[0].fi, zona: fets[0].zona } : null,
      ratxa: ratxa_(reals),
      passos: m.passos.map(function (p) {
        return { id: p.id, tipus: p.tipus, segons: Number(p.segons) || 0, colocacio: !!p.colocacio,
          text: p['text_' + idioma] || p.text_es, audio: p['audio_' + idioma] || '' };
      }),
      zones: m.zones.filter(function (z) { return z.activa !== false; }).map(function (z) {
        return { codi: z.codi, nom: z['nom_' + idioma] || z.nom_es };
      })
    };
  });
  return {
    estat: actiu ? 'ACTIU' : 'DEMO', estatSistema: cfg.estat === 'ACTIU' ? 'ACTIU' : 'DEMO',
    idioma: idioma, idiomaSistema: idiomaSistema, ara: clau_(ara), araMs: ara.getTime(),
    guardaUbicacio: cfg.guardaUbicacio !== 'no' && !suport,
    dispositiu: { nom: ctx.nom, tipus: suport ? 'suport' : 'usuaria' },
    seguiment: suport ? progressos_() : null,
    medicaments: meds
  };
}

function iniciaCanvi_(ctx, dades) {
  var cfg = llegeixConfig_();
  var med = medicament_(dades.medicament);
  if (!med || !med.actiu) throw errorApp_('DADES', 'Medicament desconegut.');
  var tipus = dades.tipus === 'caiguda' ? 'caiguda' : 'programat';
  var mode = modeDispositiu_(cfg, ctx);
  var ara = new Date();
  var reals = registresDe_(med.id, 'REAL');
  var dataProgramada = '';
  if (mode === 'REAL' && tipus === 'programat') {
    dataProgramada = estatCalendari_(med, cfg.dataInici, reals, ara, MINUTS_ANTICIPACIO).pendent || '';
    if (!dataProgramada) throw errorApp_('SENSE_PENDENT', 'Ara no toca cap canvi.');
    ambBloqueig_(function () {
      var fila = llegeixFull_('Registre').filter(function (r) {
        return r.medicament === med.id && r.mode === 'REAL' && r.tipus === 'programat' && r.dataProgramada === dataProgramada;
      })[0];
      if (fila) { if (!fila.inici) actualitzaPerId_('Registre', fila.id, { inici: araText_() }); }
      else {
        afegeixFila_('Registre', { id: nouId_('r'), medicament: med.id, mode: 'REAL', tipus: 'programat',
          dataProgramada: dataProgramada, inici: araText_(), estat: 'en curs', dispositiu: ctx.id });
      }
    });
  }
  // Les zones es calculen amb els canvis del mateix mode: en pràctica compten les pràctiques, en real els reals.
  var perZones = mode === 'REAL' ? reals : registresDe_(med.id, 'DEMO');
  var sug = suggereixZona_(med.zones, perZones, ara, med.diesRepeticioZona);
  return { mode: mode, tipus: tipus, dataProgramada: dataProgramada, araMs: ara.getTime(),
    zonaSuggerida: sug.suggerida, capZonaDisponible: sug.capDisponible, zones: sug.zones,
    diesRepeticioZona: med.diesRepeticioZona };
}

function completaCanvi_(ctx, dades) {
  var cfg = llegeixConfig_();
  var idioma = cfg.idiomaAvisos || 'es';
  var med = medicament_(dades.medicament);
  if (!med) throw errorApp_('DADES', 'Medicament desconegut.');
  var tipus = dades.tipus === 'caiguda' ? 'caiguda' : 'programat';
  var mode = dades.mode === 'REAL' && ctx.tipus !== 'suport' ? 'REAL' : 'DEMO';
  var idClient = String(dades.idClient || '').replace(/[^\w-]/g, '').slice(0, 40);
  if (!idClient) throw errorApp_('DADES', 'Falta l\'identificador del canvi.');
  var te = function (t) { return med.passos.some(function (p) { return p.tipus === t; }); };
  var anterior = '';
  if (tipus === 'caiguda') anterior = 'caiguda';
  else if (te('retirada')) {
    if (['si', 'no portava'].indexOf(dades.anteriorRetirat) < 0) throw errorApp_('DADES', 'Falta confirmar la retirada de l\'anterior.');
    anterior = dades.anteriorRetirat;
  }
  var codis = med.zones.map(function (z) { return z.codi; });
  if (te('zona') ? codis.indexOf(dades.zona) < 0 : dades.zona) throw errorApp_('DADES', 'Zona no vàlida.');
  var foto = null;
  var motiu = String(dades.senseFotoMotiu || '').slice(0, 200);
  if (dades.foto) {
    var b64 = String(dades.foto).replace(/^data:image\/\w+;base64,/, '');
    if (b64.length > MIDA_MAXIMA_FITXER) throw errorApp_('DADES', 'La foto és massa gran.');
    foto = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg');
  } else if (te('foto') && !motiu) {
    throw errorApp_('DADES', 'Falta la foto o el motiu.');
  }

  var gps = cfg.guardaUbicacio !== 'no' ? ubicacio_(dades) : null;
  var resultat = ambBloqueig_(function () {
    var tots = llegeixFull_('Registre');
    var repetit = tots.filter(function (r) { return r.idClient === idClient; })[0];
    if (repetit) return { repetit: true, registre: repetit };
    var dataProgramada = tipus === 'programat' && mode === 'REAL' ? String(dades.dataProgramada || '') : '';
    var existent = dataProgramada ? tots.filter(function (r) {
      return r.medicament === med.id && r.mode === 'REAL' && r.tipus === 'programat' && r.dataProgramada === dataProgramada;
    })[0] : null;
    var fi = araText_();
    var fotoId = '';
    if (foto) {
      foto.setName(fi.replace(/[: ]/g, '-') + '_' + mode + '_' + (dades.zona || '') + '.jpg');
      fotoId = carpeta_('carpetaFotos', 'Fotos medicació').createFile(foto).getId();
    }
    var canvis = {
      medicament: med.id, mode: mode, tipus: tipus, dataProgramada: dataProgramada,
      inici: (existent && existent.inici) || String(dades.inici || fi).slice(0, 19), fi: fi, estat: 'completat',
      anteriorRetirat: anterior, zona: dades.zona || '', fotoId: fotoId, senseFotoMotiu: foto ? '' : motiu,
      lat: gps ? gps.lat : '', lon: gps ? gps.lon : '', precisioGps: gps ? gps.precisio : '',
      dispositiu: ctx.id, idClient: idClient
    };
    if (existent && existent.estat !== 'completat') return { registre: actualitzaPerId_('Registre', existent.id, canvis) };
    canvis.id = nouId_('r');
    return { registre: afegeixFila_('Registre', canvis) };
  });

  // Les pràctiques dels telèfons de suport no s'avisen (són per acompanyar per telèfon).
  if (!resultat.repetit && (mode === 'REAL' || (cfg.notificarPractiques === 'si' && ctx.tipus !== 'suport'))) {
    var r = resultat.registre;
    var nom = cfg.nomUsuaria || text_(idioma, 'laUsuaria');
    var valors = {
      nom: nom, med: nomMed_(med, idioma), quan: dataHumana_(r.fi, idioma),
      prog: r.dataProgramada ? dataHumana_(r.dataProgramada, idioma) : '—',
      zona: r.zona, nomZona: nomZona_(med, r.zona, idioma),
      anterior: anterior ? text_(idioma, anterior === 'no portava' ? 'anteriorNo' : 'anteriorSi') : '—'
    };
    var text = (mode === 'DEMO' ? text_(idioma, 'practica') : '') +
      text_(idioma, tipus === 'caiguda' ? 'completatExtra' : 'completat', valors);
    if (!foto && motiu) text += '\n' + text_(idioma, 'senseFoto', { motiu: motiu });
    notifica_(text, { foto: foto });
  }
  return { fi: resultat.registre.fi, zona: resultat.registre.zona, repetit: !!resultat.repetit,
    ratxa: mode === 'REAL' && tipus === 'programat' ? ratxa_(registresDe_(med.id, 'REAL')) : 0 };
}

/** Ubicació GPS validada (o null): latitud, longitud i precisió en metres. */
function ubicacio_(d) {
  var lat = Number(d.lat), lon = Number(d.lon), prec = Number(d.precisio);
  if (d.lat === '' || d.lat === undefined || d.lat === null || !isFinite(lat) || !isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: lat.toFixed(6), lon: lon.toFixed(6), precisio: isFinite(prec) && prec >= 0 && prec < 100000 ? String(Math.round(prec)) : '' };
}

// ---- Sortides sense acabar ----

/** Desa que la usuària ha sortit de l'assistent sense acabar el canvi. Els telèfons de suport no ho desen. */
function registraSortida_(ctx, d) {
  if (ctx.tipus === 'suport') return { desat: false };
  var cfg = llegeixConfig_();
  var med = medicament_(d.medicament);
  if (!med) throw errorApp_('DADES', 'Medicament desconegut.');
  var idClient = String(d.idClient || '').replace(/[^\w-]/g, '').slice(0, 40);
  if (!idClient) throw errorApp_('DADES', 'Falta l\'identificador.');
  var mode = d.mode === 'REAL' ? 'REAL' : 'DEMO';
  var pas = Math.max(0, Math.min(99, Number(d.pas) || 0)), total = Math.max(0, Math.min(99, Number(d.total) || 0));
  var caiguda = d.tipus === 'caiguda';
  var r = ambBloqueig_(function () {
    var repetit = llegeixFull_('Registre').filter(function (x) { return x.idClient === idClient; })[0];
    if (repetit) return null;
    return afegeixFila_('Registre', {
      id: nouId_('r'), medicament: med.id, mode: mode, tipus: 'sortida',
      dataProgramada: mode === 'REAL' && !caiguda ? String(d.dataProgramada || '').slice(0, 16) : '',
      inici: String(d.inici || '').slice(0, 19), fi: araText_(), estat: 'abandonat', dispositiu: ctx.id, idClient: idClient,
      notes: 'pas ' + pas + ' de ' + total + (caiguda ? ' · pegat caigut' : '')
    });
  });
  if (r && mode === 'REAL') {
    var idioma = cfg.idiomaAvisos || 'es';
    notifica_(text_(idioma, 'sortida', { nom: cfg.nomUsuaria || text_(idioma, 'laUsuaria'), med: nomMed_(med, idioma), pas: pas, total: total }));
  }
  return { desat: !!r };
}

// ---- Seguiment en directe (per acompanyar per telèfon) ----

/** Desa per on va el canvi al telèfon de la usuària. Els telèfons de suport no informen. */
function desaProgres_(ctx, d) {
  if (ctx.tipus === 'suport') return { desat: false };
  var fase = ['pas', 'acabat', 'sortit'].indexOf(d.fase) > -1 ? d.fase : 'pas';
  var p = {
    dispositiu: ctx.nom, medicament: String(d.medicament || '').slice(0, 40), mode: d.mode === 'REAL' ? 'REAL' : 'DEMO',
    tipus: d.tipus === 'caiguda' ? 'caiguda' : 'programat', pas: Math.max(0, Math.min(99, Number(d.pas) || 0)),
    total: Math.max(0, Math.min(99, Number(d.total) || 0)), titol: netejaText_(d.titol, 90), fase: fase, quan: Date.now()
  };
  CacheService.getScriptCache().put('prog:' + ctx.id, JSON.stringify(p), SEGONS_PROGRES);
  return { desat: true };
}

/** Per on va cada telèfon de la usuària (només els que han fet alguna cosa en els darrers 30 min). */
function progressos_() {
  var cau = CacheService.getScriptCache();
  var ara = Date.now();
  return llegeixFull_('Dispositius').filter(function (d) { return d.actiu === 'si' && d.tipus !== 'suport'; })
    .map(function (d) {
      var p = llegeixJson_(cau.get('prog:' + d.id), null);
      if (!p) return null;
      p.segons = Math.round((ara - p.quan) / 1000);
      delete p.quan;
      return p;
    }).filter(Boolean);
}

// ---- Fitxers a Drive ----

function carpeta_(clau, nom) {
  var id = llegeixConfig_()[clau];
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* s'ha esborrat: se'n crea una altra */ } }
  var pares = DriveApp.getFileById(llibre_().getId()).getParents();
  var pare = pares.hasNext() ? pares.next() : DriveApp.getRootFolder();
  var c = pare.createFolder(nom);
  var canvi = {}; canvi[clau] = c.getId();
  desaConfig_(canvi);
  return c;
}

/** Llegeix un fitxer només si és dins de la carpeta indicada (mai un fitxer qualsevol de Drive). */
function fitxerDeCarpeta_(clau, id) {
  var idCarpeta = llegeixConfig_()[clau];
  if (!id || !idCarpeta) throw errorApp_('NO_TROBAT', 'Fitxer no trobat.');
  var f;
  try { f = DriveApp.getFileById(String(id)); } catch (e) { throw errorApp_('NO_TROBAT', 'Fitxer no trobat.'); }
  var pares = f.getParents();
  while (pares.hasNext()) if (pares.next().getId() === idCarpeta) {
    var blob = f.getBlob();
    return { mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) };
  }
  throw errorApp_('NO_TROBAT', 'Fitxer no trobat.');
}

function desaAudio_(b64, mime, nom) {
  b64 = String(b64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!b64 || b64.length > MIDA_MAXIMA_FITXER) throw errorApp_('DADES', 'Àudio buit o massa gran.');
  mime = /^audio\/[\w.+-]+$/.test(String(mime || '').split(';')[0]) ? String(mime).split(';')[0] : 'audio/mp4';
  if (/x-m4a|m4a|aac/i.test(mime)) mime = 'audio/mp4'; // l'iPhone els reprodueix com a MP4/AAC
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, nom);
  return carpeta_('carpetaAudios', 'Àudios medicació').createFile(blob).getId();
}

// ---- Revisió de retards (activador) ----

function revisaRetards_() {
  var cfg = llegeixConfig_();
  if (cfg.estat !== 'ACTIU') return 0;
  var idioma = cfg.idiomaAvisos || 'es';
  var nom = cfg.nomUsuaria || text_(idioma, 'laUsuaria');
  var ara = new Date();
  var enviats = 0;
  medicaments_(true).forEach(function (med) {
    var pendents = [];
    ambBloqueig_(function () {
      var reals = registresDe_(med.id, 'REAL');
      var cal = estatCalendari_(med, cfg.dataInici, reals, ara, 0);
      var perClau = {};
      reals.forEach(function (r) { if (r.tipus === 'programat') perClau[r.dataProgramada] = r; });
      cal.anteriorsNoFets.forEach(function (clau) {
        var r = perClau[clau];
        if (r && r.estat === 'no fet') return;
        if (r) actualitzaPerId_('Registre', r.id, { estat: 'no fet' });
        else afegeixFila_('Registre', { id: nouId_('r'), medicament: med.id, mode: 'REAL', tipus: 'programat', dataProgramada: clau, estat: 'no fet' });
        pendents.push({ clau: 'noFet', prog: clau });
      });
      if (cal.pendent && cal.minutsRetard >= med.margeAvisMin) {
        var r = perClau[cal.pendent];
        var nivell = cal.minutsRetard >= med.margeAlertaMin ? 'alertat' : 'avisat';
        if (!r) {
          r = afegeixFila_('Registre', { id: nouId_('r'), medicament: med.id, mode: 'REAL', tipus: 'programat',
            dataProgramada: cal.pendent, estat: 'pendent' });
        }
        if (!r[nivell]) {
          var c = {}; c[nivell] = araText_();
          if (nivell === 'alertat' && !r.avisat) c.avisat = c.alertat;
          actualitzaPerId_('Registre', r.id, c);
          pendents.push({ clau: nivell === 'alertat' ? 'alerta' : 'pendent', prog: cal.pendent, min: cal.minutsRetard });
        }
      }
    });
    pendents.forEach(function (p) {
      var d = deClau_(p.prog);
      var hora = dosXifres_(d.getHours()) + ':' + dosXifres_(d.getMinutes());
      notifica_(text_(idioma, p.clau, { nom: nom, med: nomMed_(med, idioma), hora: hora, min: p.min,
        dia: nomDia_(idioma, diaIso_(d)) + ' ' + dosXifres_(d.getDate()) + '/' + dosXifres_(d.getMonth() + 1) }));
      enviats++;
    });
  });
  return enviats;
}

// ---- Panell ----

function registrePublic_(r, med, idioma) {
  return {
    id: r.id, medicament: r.medicament, nomMed: med ? nomMed_(med, idioma) : r.medicament, mode: r.mode, tipus: r.tipus,
    dataProgramada: r.dataProgramada, inici: r.inici, fi: r.fi, estat: r.estat, anteriorRetirat: r.anteriorRetirat,
    zona: r.zona, nomZona: med && r.zona ? nomZona_(med, r.zona, idioma) : '', teFoto: !!r.fotoId,
    senseFotoMotiu: r.senseFotoMotiu, avisat: r.avisat, alertat: r.alertat, notes: r.notes,
    lat: r.lat || '', lon: r.lon || '', precisioGps: r.precisioGps || ''
  };
}

function resum_() {
  var cfg = llegeixConfig_();
  var ara = new Date();
  var meds = medicaments_(false);
  var perId = {}; meds.forEach(function (m) { perId[m.id] = m; });
  var tots = llegeixFull_('Registre');
  var estatMeds = meds.filter(function (m) { return m.actiu; }).map(function (m) {
    var reals = tots.filter(function (r) { return r.medicament === m.id && r.mode === 'REAL'; });
    var cal = estatCalendari_(m, cfg.dataInici, reals, ara, 0);
    var fets = reals.filter(function (r) { return r.estat === 'completat'; }).sort(function (a, b) { return a.fi < b.fi ? 1 : -1; });
    return { id: m.id, nom: m.nom_es, dies: m.dies, hora: m.hora,
      pendent: cfg.estat === 'ACTIU' ? cal.pendent : null, minutsRetard: cal.minutsRetard, propera: cal.propera,
      darrer: fets.length ? registrePublic_(fets[0], m, 'es') : null };
  });
  var recents = tots.filter(function (r) { return r.mode === 'REAL'; })
    .sort(function (a, b) { return (a.fi || a.dataProgramada) < (b.fi || b.dataProgramada) ? 1 : -1; })
    .slice(0, 6).map(function (r) { return registrePublic_(r, perId[r.medicament], 'es'); });
  return { estat: cfg.estat === 'ACTIU' ? 'ACTIU' : 'DEMO', dataInici: cfg.dataInici, ara: clau_(ara),
    medicaments: estatMeds, recents: recents };
}

function historial_(dades) {
  var meds = {}; medicaments_(false).forEach(function (m) { meds[m.id] = m; });
  var mode = dades.mode === 'DEMO' ? 'DEMO' : 'REAL';
  var des = String(dades.des || '0000'), fins = String(dades.fins || '9999') + ' 99';
  return llegeixFull_('Registre').filter(function (r) {
    var quan = r.fi || r.dataProgramada;
    return r.mode === mode && quan >= des && quan <= fins;
  }).sort(function (a, b) { return (a.fi || a.dataProgramada) < (b.fi || b.dataProgramada) ? 1 : -1; })
    .slice(0, 1000).map(function (r) { return registrePublic_(r, meds[r.medicament], 'es'); });
}
