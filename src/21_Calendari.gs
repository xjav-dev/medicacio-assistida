/**
 * 21_Calendari.gs — Medicació assistida
 *
 * Càlcul pur del calendari: ocurrències dels dies i l'hora fixos, canvi pendent
 * i proper canvi. No toca fulls (es pot provar fora d'Apps Script).
 * Dies: 1 = dilluns … 7 = diumenge. Dates en text «AAAA-MM-DD HH:MM».
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */

function dosXifres_(n) { return (n < 10 ? '0' : '') + n; }

function clau_(d) {
  return d.getFullYear() + '-' + dosXifres_(d.getMonth() + 1) + '-' + dosXifres_(d.getDate()) + ' ' +
    dosXifres_(d.getHours()) + ':' + dosXifres_(d.getMinutes());
}

function deClau_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), 0, 0);
}

function diesDe_(med) {
  return String(med.dies || '').split(',').map(Number).filter(function (n) { return n >= 1 && n <= 7; })
    .sort(function (a, b) { return a - b; });
}

function horaDe_(med) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(med.hora || ''));
  return m ? { h: Number(m[1]), m: Number(m[2]) } : { h: 10, m: 0 };
}

function diaIso_(d) { var x = d.getDay(); return x === 0 ? 7 : x; }

/** Ocurrències programades (Date) entre desDe i finsA, ambdues incloses. */
function ocurrencies_(med, desDe, finsA) {
  var dies = diesDe_(med);
  var hora = horaDe_(med);
  var sortida = [];
  if (!dies.length) return sortida;
  var d = new Date(desDe.getFullYear(), desDe.getMonth(), desDe.getDate(), hora.h, hora.m, 0, 0);
  while (d <= finsA) {
    if (d >= desDe && dies.indexOf(diaIso_(d)) > -1) sortida.push(new Date(d.getTime()));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hora.h, hora.m, 0, 0);
  }
  return sortida;
}

/** Moment a partir del qual compten els canvis reals d'un medicament. */
function iniciValid_(med, dataInici) {
  var a = deClau_(dataInici);
  var b = deClau_(med.vigentDes);
  if (a && b) return a > b ? a : b;
  return a || b || new Date(2000, 0, 1);
}

/**
 * Estat del calendari d'un medicament.
 * registres: registres REAL del medicament ({tipus, dataProgramada, estat, fi, zona}).
 * Retorna {pendent: 'AAAA-MM-DD HH:MM'|null, minutsRetard, propera, anteriorsNoFets: [claus]}.
 */
function estatCalendari_(med, dataInici, registres, ara, anticipacioMin) {
  var inici = iniciValid_(med, dataInici);
  var fets = {};
  registres.forEach(function (r) {
    if (r.tipus === 'programat' && r.estat === 'completat') fets[r.dataProgramada] = true;
  });
  var desDe = new Date(Math.max(inici.getTime(), ara.getTime() - 8 * 86400000));
  var limit = new Date(ara.getTime() + (anticipacioMin || 0) * 60000);
  var passades = ocurrencies_(med, desDe, limit);
  var pendent = null;
  var anteriorsNoFets = [];
  if (passades.length) {
    var darrera = passades[passades.length - 1];
    if (!fets[clau_(darrera)]) pendent = clau_(darrera);
    passades.slice(0, -1).forEach(function (o) { if (!fets[clau_(o)]) anteriorsNoFets.push(clau_(o)); });
  }
  var desDeProp = pendent ? new Date(deClau_(pendent).getTime() + 60000) : new Date(Math.max(ara.getTime(), inici.getTime()));
  var seguents = ocurrencies_(med, desDeProp, new Date(desDeProp.getTime() + 15 * 86400000))
    .filter(function (o) { return !fets[clau_(o)]; });
  var minutsRetard = pendent ? Math.floor((ara.getTime() - deClau_(pendent).getTime()) / 60000) : 0;
  return {
    pendent: pendent,
    minutsRetard: minutsRetard,
    propera: seguents.length ? clau_(seguents[0]) : null,
    anteriorsNoFets: anteriorsNoFets
  };
}

/** Avisos sobre els dies triats: separació màxima entre canvis. */
function validaDies_(dies, maxDies) {
  dies = (dies || []).map(Number).filter(function (n) { return n >= 1 && n <= 7; }).sort(function (a, b) { return a - b; });
  var avisos = [];
  if (!dies.length) { avisos.push('SENSE_DIES'); return avisos; }
  if (maxDies) {
    for (var i = 0; i < dies.length; i++) {
      var seg = i + 1 < dies.length ? dies[i + 1] : dies[0] + 7;
      if (seg - dies[i] > Number(maxDies)) { avisos.push('SEPARACIO'); break; }
    }
  }
  return avisos;
}
