/**
 * 22_Zones.gs — Medicació assistida
 *
 * Rotació de zones d'aplicació: proposa la zona usada fa més temps i bloqueja
 * les usades fa menys dels dies configurats. Càlcul pur.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */

/** Zones per defecte, com al fullet (A–D davant, E–H esquena). */
var ZONES_DEFECTE_ = [
  { codi: 'A', nom_es: 'Brazo izquierdo (parte de arriba)', nom_ca: 'Braç esquerre (part de dalt)', activa: true },
  { codi: 'B', nom_es: 'Brazo derecho (parte de arriba)', nom_ca: 'Braç dret (part de dalt)', activa: true },
  { codi: 'C', nom_es: 'Pecho, lado derecho', nom_ca: 'Pit, costat dret', activa: true },
  { codi: 'D', nom_es: 'Pecho, lado izquierdo', nom_ca: 'Pit, costat esquerre', activa: true },
  { codi: 'E', nom_es: 'Espalda arriba, lado izquierdo', nom_ca: 'Esquena a dalt, costat esquerre', activa: true },
  { codi: 'F', nom_es: 'Espalda arriba, lado derecho', nom_ca: 'Esquena a dalt, costat dret', activa: true },
  { codi: 'G', nom_es: 'Espalda abajo, lado izquierdo', nom_ca: 'Esquena a baix, costat esquerre', activa: true },
  { codi: 'H', nom_es: 'Espalda abajo, lado derecho', nom_ca: 'Esquena a baix, costat dret', activa: true }
];

function inicDia_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

/**
 * zones: llista {codi, activa}; registres: registres REAL ({estat, zona, fi}).
 * Retorna {suggerida, capDisponible, zones: [{codi, darrerUs, disponible}]}.
 */
function suggereixZona_(zones, registres, ara, diesRepeticio) {
  var dies = Number(diesRepeticio) || 0;
  var darrer = {};
  registres.forEach(function (r) {
    if (r.estat !== 'completat' || !r.zona || !r.fi) return;
    if (!darrer[r.zona] || r.fi > darrer[r.zona]) darrer[r.zona] = r.fi;
  });
  var actives = zones.filter(function (z) { return z.activa !== false && z.activa !== 'no'; });
  var estat = actives.map(function (z, i) {
    var d = darrer[z.codi] ? deClau_(darrer[z.codi]) : null;
    var diesPassats = d ? Math.round((inicDia_(ara) - inicDia_(d)) / 86400000) : null;
    return { codi: z.codi, ordre: i, darrerUs: darrer[z.codi] || '', disponible: d === null || diesPassats >= dies };
  });
  var ordena = function (a, b) {
    if (!a.darrerUs && !b.darrerUs) return a.ordre - b.ordre;
    if (!a.darrerUs) return -1;
    if (!b.darrerUs) return 1;
    return a.darrerUs < b.darrerUs ? -1 : a.darrerUs > b.darrerUs ? 1 : a.ordre - b.ordre;
  };
  var disponibles = estat.filter(function (z) { return z.disponible; }).sort(ordena);
  var totes = estat.slice().sort(ordena);
  return {
    suggerida: disponibles.length ? disponibles[0].codi : (totes.length ? totes[0].codi : null),
    capDisponible: !disponibles.length,
    zones: estat.map(function (z) { return { codi: z.codi, darrerUs: z.darrerUs, disponible: z.disponible }; })
  };
}

/** Nombre mínim de zones actives per complir la regla (cicle de canvis vs dies sense repetir). */
function zonesMinimes_(dies, diesRepeticio) {
  var n = String(dies || '').split(',').filter(Boolean).length;
  if (!n) return 1;
  return Math.ceil(Number(diesRepeticio || 0) * n / 7) + 1;
}
