/**
 * cos.js — Medicació assistida · il·lustració amable d'una persona (de davant o d'esquena)
 * amb el pegat dibuixat només a la zona que toca. Dibuix propi.
 * Davant: A–D (l'esquerra del dibuix és el costat dret de la persona). Esquena: E–H.
 * Copyright (c) 2026 xjav-dev · SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var PELL = '#F3CBA8', OMBRA = '#E2AE88', CONTORN = '#9C6B52', CABELL = '#D9D9E0', CABELL_FOSC = '#B9B9C4';

  /** Centre del pegat de cada zona i vista on es veu. */
  var ZONES = {
    A: { vista: 'davant', x: 222, y: 238, escala: 0.68 },
    B: { vista: 'davant', x: 78, y: 238, escala: 0.68 },
    C: { vista: 'davant', x: 122, y: 218, escala: 1 },
    D: { vista: 'davant', x: 178, y: 218, escala: 1 },
    E: { vista: 'esquena', x: 118, y: 216, escala: 1 },
    F: { vista: 'esquena', x: 182, y: 216, escala: 1 },
    G: { vista: 'esquena', x: 124, y: 282, escala: 1 },
    H: { vista: 'esquena', x: 176, y: 282, escala: 1 }
  };

  function el(nom, attrs, fills) {
    var e = document.createElementNS(NS, nom);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (fills || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }

  var BRAC = 'M80,194 C62,203 55,240 57,282 L59,330 L93,330 L95,282 C97,246 99,220 97,204 Z';
  var TORS = 'M88,192 C100,178 125,172 150,172 C175,172 200,178 212,192 C223,215 223,262 219,330 L81,330 C77,262 77,215 88,192 Z';

  function mirall(d) {
    return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, function (m, x, y) { return (300 - Number(x)) + ',' + y; });
  }

  function cosBase(svg, esquena) {
    var linia = { stroke: CONTORN, 'stroke-width': '2.5', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    var g = el('g', {});
    g.appendChild(el('path', Object.assign({ d: TORS, fill: PELL }, linia)));
    g.appendChild(el('rect', Object.assign({ x: 134, y: 136, width: 32, height: 44, rx: 12, fill: PELL }, linia)));
    if (!esquena) {
      // Cara
      g.appendChild(el('circle', Object.assign({ cx: 106, cy: 108, r: 9, fill: PELL }, linia)));
      g.appendChild(el('circle', Object.assign({ cx: 194, cy: 108, r: 9, fill: PELL }, linia)));
      [[112, 84, 20], [128, 66, 22], [150, 60, 24], [172, 66, 22], [188, 84, 20], [108, 106, 13], [192, 106, 13]].forEach(function (c) {
        g.appendChild(el('circle', { cx: c[0], cy: c[1], r: c[2], fill: CABELL }));
      });
      g.appendChild(el('circle', Object.assign({ cx: 150, cy: 106, r: 42, fill: PELL }, linia)));
      [[132, 72, 13], [151, 67, 14], [170, 73, 12]].forEach(function (c) { g.appendChild(el('circle', { cx: c[0], cy: c[1], r: c[2], fill: CABELL })); });
      g.appendChild(el('circle', { cx: 127, cy: 122, r: 8, fill: '#F29C9C', opacity: '0.45' }));
      g.appendChild(el('circle', { cx: 173, cy: 122, r: 8, fill: '#F29C9C', opacity: '0.45' }));
      var ulls = { stroke: '#4a3a33', 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' };
      g.appendChild(el('path', Object.assign({ d: 'M130,106 q6,-6 12,0' }, ulls)));
      g.appendChild(el('path', Object.assign({ d: 'M158,106 q6,-6 12,0' }, ulls)));
      var ulleres = { stroke: '#6E6E80', 'stroke-width': '2.5', fill: 'none' };
      g.appendChild(el('circle', Object.assign({ cx: 136, cy: 105, r: 11 }, ulleres)));
      g.appendChild(el('circle', Object.assign({ cx: 164, cy: 105, r: 11 }, ulleres)));
      g.appendChild(el('path', Object.assign({ d: 'M147,104 q3,-3 6,0' }, ulleres)));
      g.appendChild(el('path', { d: 'M138,127 q12,11 24,0', stroke: '#B3524A', 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' }));
      // Samarreta de tirants (deixa el pit de dalt a la vista)
      g.appendChild(el('path', Object.assign({ d: 'M83,262 C112,252 188,252 217,262 L219,330 L81,330 Z', fill: '#B9A7D9' }, linia)));
    } else {
      // Clatell, monyo i esquena nua
      g.appendChild(el('circle', Object.assign({ cx: 106, cy: 108, r: 9, fill: PELL }, linia)));
      g.appendChild(el('circle', Object.assign({ cx: 194, cy: 108, r: 9, fill: PELL }, linia)));
      g.appendChild(el('circle', { cx: 150, cy: 60, r: 19, fill: CABELL_FOSC }));
      g.appendChild(el('circle', { cx: 150, cy: 102, r: 45, fill: CABELL }));
      g.appendChild(el('path', { d: 'M120,92 q30,-20 60,0 M118,110 q32,-18 64,0', stroke: CABELL_FOSC, 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' }));
      g.appendChild(el('path', { d: 'M150,196 L150,300', stroke: OMBRA, 'stroke-width': '3', 'stroke-linecap': 'round' }));
      g.appendChild(el('path', { d: 'M108,206 q14,22 30,14 M192,206 q-14,22 -30,14', stroke: OMBRA, 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' }));
      g.appendChild(el('path', Object.assign({ d: 'M81,306 L219,306 L219,330 L81,330 Z', fill: '#7F9CC5' }, linia)));
    }
    // Els braços, al davant del tronc
    g.appendChild(el('path', Object.assign({ d: BRAC, fill: PELL }, linia)));
    g.appendChild(el('path', Object.assign({ d: mirall(BRAC), fill: PELL }, linia)));
    svg.appendChild(g);
  }

  /** Pegat blanc amb la coberta beix a sota, un cercle que batega i la lletra de la zona. */
  function pegat(svg, z, codi) {
    var g = el('g', { transform: 'translate(' + z.x + ',' + z.y + ') scale(' + z.escala + ')' });
    g.appendChild(el('circle', { class: 'pegat-pols', r: 34, fill: 'none', stroke: '#DA7E45', 'stroke-width': '5' }));
    g.appendChild(el('ellipse', { rx: 24, ry: 18, fill: '#E9D2AE', stroke: '#C2A276', 'stroke-width': '2' }));
    g.appendChild(el('rect', { x: -12, y: -12, width: 24, height: 24, rx: 4, fill: '#FFFFFF', stroke: '#BDBDBD', 'stroke-width': '1.5' }));
    var x = z.x > 150 ? 34 : -34;
    g.appendChild(el('circle', { cx: x, cy: -30, r: 15, fill: '#B35F2C' }));
    g.appendChild(el('text', { x: x, y: -24, 'text-anchor': 'middle', 'font-size': '18', 'font-weight': '700', fill: '#fff' }, [codi]));
    svg.appendChild(g);
  }

  /**
   * opcions: {codi, etiquetes: {davant, darrere}, descripcio}
   * Retorna el dibuix de la vista on és la zona, amb el pegat només en aquesta zona.
   */
  function dibuixa(opcions) {
    var z = ZONES[opcions.codi];
    var esquena = !!z && z.vista === 'esquena';
    var svg = el('svg', { viewBox: '0 0 300 360', class: 'cos', role: 'img', 'aria-label': opcions.descripcio || '' });
    svg.appendChild(el('rect', { x: 0, y: 0, width: 300, height: 330, rx: 28, fill: '#EAF4F5' }));
    cosBase(svg, esquena);
    if (z) pegat(svg, z, opcions.codi);
    var et = opcions.etiquetes || {};
    svg.appendChild(el('text', { x: 150, y: 352, 'text-anchor': 'middle', class: 'cos-etiqueta' }, [esquena ? (et.darrere || '') : (et.davant || '')]));
    return svg;
  }

  window.Cos = { dibuixa: dibuixa, ZONES: ZONES };
})();
