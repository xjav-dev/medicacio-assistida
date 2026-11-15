/**
 * comu.js — Medicació assistida · utilitats compartides per l'app i el panell.
 * Copyright (c) 2026 xjav-dev · SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */
(function () {
  'use strict';

  /** Crida l'API d'Apps Script. Retorna dades o llança Error amb .codi. */
  async function api(op, dades, testimoni) {
    var url = (window.CONFIG || {}).URL_API;
    if (!url || url.indexOf('‹') > -1) { var e0 = new Error('Falta configurar URL_API a config.js'); e0.codi = 'CONFIG'; throw e0; }
    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ op: op, dades: dades || {}, testimoni: testimoni || '' })
      });
    } catch (x) { var e1 = new Error('Sin conexión'); e1.codi = 'XARXA'; throw e1; }
    var json;
    try { json = await resp.json(); } catch (x) { var e2 = new Error('Respuesta no válida del servidor'); e2.codi = 'XARXA'; throw e2; }
    if (!json.ok) { var e3 = new Error(json.error && json.error.missatge || 'Error'); e3.codi = json.error && json.error.codi; throw e3; }
    return json.dades;
  }

  /** Crea un element. Els fills de text s'afegeixen com a text (mai com a HTML). */
  function h(etiqueta, atributs) {
    var el = document.createElement(etiqueta);
    var a = atributs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    });
    for (var i = 2; i < arguments.length; i++) afegeix(el, arguments[i]);
    return el;
  }
  function afegeix(el, fill) {
    if (fill === null || fill === undefined || fill === false) return;
    if (Array.isArray(fill)) { fill.forEach(function (f) { afegeix(el, f); }); return; }
    el.appendChild(fill instanceof Node ? fill : document.createTextNode(String(fill)));
  }

  function buida(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  var magatzem = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* res */ } },
    json: function (k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v; } catch (e) { return def; } }
  };

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    return Array.from(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }

  /** «AAAA-MM-DD HH:MM[:SS]» → Date local. */
  function deClau(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function clau(d) {
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
  }

  window.Comu = { api: api, h: h, buida: buida, magatzem: magatzem, uuid: uuid, deClau: deClau, clau: clau, dos: dos };
})();
