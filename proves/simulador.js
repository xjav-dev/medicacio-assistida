'use strict';
/**
 * simulador.js — carrega els .gs en un context de Node amb serveis d'Apps Script
 * simulats en memòria (Hoja, caché, propietats, Drive, correu, Telegram, activadors).
 * Només per a proves: no forma part de l'aplicació.
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

process.env.TZ = 'Europe/Madrid';

function creaEntorn(opcions) {
  opcions = opcions || {};
  const estat = { correus: [], telegram: [], activadors: [], alertes: [], propietari: 'propietari@exemple.cat', usuariActiu: '' };
  const toBytes = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
  const fromBytes = (arr) => Buffer.from(arr.map((b) => b & 0xff));
  const textDe = (v) => (Array.isArray(v) ? fromBytes(v) : Buffer.from(String(v), 'utf8'));

  // ---- Hoja de càlcul ----
  function creaFull(nom) {
    const f = { nom, dades: [], congelades: 0 };
    const ample = () => f.dades.reduce((m, r) => Math.max(m, r.length), 0);
    const assegura = (fila, col) => {
      while (f.dades.length < fila) f.dades.push([]);
      for (const r of f.dades) while (r.length < col) r.push('');
    };
    const rang = (fila, col, nf, nc) => ({
      getValues: () => { const s = []; for (let i = 0; i < nf; i++) { const r = []; for (let j = 0; j < nc; j++) r.push(((f.dades[fila - 1 + i] || [])[col - 1 + j]) ?? ''); s.push(r); } return s; },
      setValues: (v) => { assegura(fila + nf - 1, col + nc - 1); for (let i = 0; i < nf; i++) for (let j = 0; j < nc; j++) f.dades[fila - 1 + i][col - 1 + j] = v[i][j]; return rang(fila, col, nf, nc); },
      setValue: (v) => { assegura(fila, col); f.dades[fila - 1][col - 1] = v; return rang(fila, col, 1, 1); },
      setNumberFormat: function () { return this; },
      clearContent: function () {
        for (let i = 0; i < nf; i++) for (let j = 0; j < nc; j++) if (f.dades[fila - 1 + i]) f.dades[fila - 1 + i][col - 1 + j] = '';
        while (f.dades.length && f.dades[f.dades.length - 1].join('') === '') f.dades.pop();
        return this;
      }
    });
    return {
      getName: () => nom,
      getDataRange: () => rang(1, 1, f.dades.length, ample()),
      getRange: (a, b, c, d) => rang(a, b, c || 1, d || 1),
      getLastRow: () => f.dades.length,
      getLastColumn: () => ample(),
      getMaxRows: () => Math.max(1000, f.dades.length),
      appendRow: (fila) => { f.dades.push(fila.map(String)); },
      deleteRow: (i) => { f.dades.splice(i - 1, 1); },
      setFrozenRows: () => {},
      _f: f
    };
  }
  const llibres = new Map();
  function creaLlibre(id) {
    const fulls = [creaFull('Full 1')];
    const l = {
      getId: () => id,
      getSheetByName: (n) => fulls.find((x) => x.getName() === n) || null,
      insertSheet: (n) => { const x = creaFull(n); fulls.push(x); return x; },
      getSheets: () => fulls.slice(),
      deleteSheet: (x) => { fulls.splice(fulls.indexOf(x), 1); }
    };
    llibres.set(id, l);
    return l;
  }
  const llibre = creaLlibre('llibre1');

  // ---- Caché i propietats ----
  const cau = new Map();
  const props = new Map();
  const CacheService = { getScriptCache: () => ({
    get: (k) => (cau.has(k) ? cau.get(k) : null), put: (k, v) => { cau.set(k, String(v)); }, remove: (k) => { cau.delete(k); }
  }) };
  const PropertiesService = { getScriptProperties: () => ({
    getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); },
    deleteProperty: (k) => { props.delete(k); }
  }) };

  // ---- Drive ----
  const fitxers = new Map();
  let nId = 0;
  function creaCarpeta(nom) {
    const id = 'carpeta' + (++nId);
    const c = { getId: () => id, getName: () => nom,
      createFolder: (n) => creaCarpeta(n),
      createFile: (blob) => { const fid = 'fitxer' + String(++nId).padStart(20, '0'); /* llarg com els ID de Drive */ fitxers.set(fid, { blob, pare: id }); return { getId: () => fid }; },
      getFiles: () => iter([...fitxers.entries()].filter(([k, v]) => v.pare === id && llibres.has(k)).map(([k]) => DriveApp.getFileById(k))) };
    fitxers.set(id, { carpeta: c });
    return c;
  }
  const arrel = creaCarpeta('arrel');
  const DriveApp = {
    getRootFolder: () => arrel,
    getFolderById: (id) => { const x = fitxers.get(id); if (!x || !x.carpeta) throw new Error('no trobat'); return x.carpeta; },
    getFileById: (id) => {
      if (id === 'llibre1') return { getParents: () => iter([arrel]) };
      if (llibres.has(id)) {
        const meta = fitxers.get(id);
        return { getId: () => id, getName: () => meta.nom, getDescription: () => meta.desc || '', setDescription: (d) => { meta.desc = d; },
          moveTo: (c) => { meta.pare = c.getId(); }, getParents: () => iter(meta.pare ? [fitxers.get(meta.pare).carpeta] : [arrel]) };
      }
      const x = fitxers.get(id); if (!x || !x.blob) throw new Error('no trobat');
      return { getBlob: () => x.blob, getParents: () => iter([fitxers.get(x.pare).carpeta]), setTrashed: (v) => { x.paperera = !!v; } };
    }
  };
  function iter(llista) { let i = 0; return { hasNext: () => i < llista.length, next: () => llista[i++] }; }

  function newBlob(dades, tipus, nom) {
    const buf = textDe(dades);
    let n = nom || '';
    return { getBytes: () => toBytes(buf), getContentType: () => tipus || 'application/octet-stream',
      getDataAsString: () => buf.toString('utf8'), setName: function (x) { n = x; return this; }, getName: () => n,
      copyBlob: function () { return this; } };
  }

  const Utilities = {
    Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'sha256' },
    getUuid: () => crypto.randomUUID(),
    computeDigest: (alg, v) => toBytes(crypto.createHash('sha256').update(textDe(v)).digest()),
    computeHmacSha256Signature: (v, k) => toBytes(crypto.createHmac('sha256', textDe(k)).update(textDe(v)).digest()),
    base64EncodeWebSafe: (v) => textDe(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64DecodeWebSafe: (s) => toBytes(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
    base64Encode: (v) => textDe(v).toString('base64'),
    base64Decode: (s) => toBytes(Buffer.from(s, 'base64')),
    newBlob,
    formatDate: (d, tz, patro) => {
      const p = (n) => String(n).padStart(2, '0');
      return patro.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
        .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()));
    }
  };

  const context = {
    console: opcions.silenci ? { log() {}, error() {} } : console,
    JSON, Math, Date, Object, Array, String, Number, Error, RegExp, isFinite, Buffer,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => llibre, flush: () => {},
      getUi: () => ({
        createMenu: (nom) => { const m = { nom, items: [], addItem: (t, f) => { m.items.push(f); return m; }, addSeparator: () => m, addToUi: () => { estat.menu = m; } }; return m; },
        alert: (titol, text) => { estat.alertes.push({ titol, text }); return 'YES'; },
        ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' }, Button: { YES: 'YES', NO: 'NO' }
      }),
      create: (nom) => { const id = 'llibre' + (++nId); fitxers.set(id, { nom }); return creaLlibre(id); },
      openById: (id) => { if (!llibres.has(id)) throw new Error('no trobat'); return llibres.get(id); }
    },
    CacheService, PropertiesService, DriveApp, Utilities,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Session: {
      getScriptTimeZone: () => 'Europe/Madrid',
      getActiveUser: () => ({ getEmail: () => estat.usuariActiu }),
      getEffectiveUser: () => ({ getEmail: () => estat.propietari })
    },
    MailApp: { sendEmail: (o) => estat.correus.push(o) },
    UrlFetchApp: { fetch: (url, o) => {
      const metode = url.split('/').pop();
      estat.telegram.push({ metode, payload: o.payload });
      let result = true;
      if (metode === 'getMe') result = { username: 'prova_bot' };
      if (metode === 'getUpdates') result = estat.updates || [];
      return { getContentText: () => JSON.stringify({ ok: true, result }), getResponseCode: () => 200 };
    } },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/AKfycbPROVA/exec' }),
      getProjectTriggers: () => estat.activadors.map((a) => ({ getUniqueId: () => a.id, getHandlerFunction: () => a.fn })),
      newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => estat.activadors.push({ id: 'act' + estat.activadors.length, fn }) }) }) })
    },
    ContentService: {
      MimeType: { JSON: 'json', TEXT: 'text' },
      createTextOutput: (t) => ({ text: t, setMimeType: function () { return this; } })
    }
  };
  vm.createContext(context);
  const src = path.join(__dirname, '..', 'src');
  const codi = fs.readdirSync(src).filter((f) => f.endsWith('.gs')).sort()
    .map((f) => fs.readFileSync(path.join(src, f), 'utf8')).join('\n;\n');
  vm.runInContext(codi, context, { filename: 'src.gs' });

  /** Fa una petició com ho faria el navegador. */
  function post(op, dades, testimoni) {
    const r = context.doPost({ postData: { contents: JSON.stringify({ op, dades, testimoni }) } });
    return JSON.parse(r.text);
  }
  return { context, estat, post, llibre, llibres, cau, props, fitxers };
}

module.exports = { creaEntorn };
