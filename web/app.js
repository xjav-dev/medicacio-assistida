/**
 * app.js — Medicació assistida · app de la usuària (web instal·lable a l'iPhone).
 * Pantalles: vinculació, inici, assistent pas a pas i final. Cua sense connexió.
 * Copyright (c) 2026 xjav-dev · SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.9.1 · 2026-11-16
 */
(function () {
  'use strict';
  var C = window.Comu, h = C.h;
  // Claus separades per servidor (l'adreça del servidor arriba a l'enllaç ?s=… i es desa al dispositiu).
  var CLAU_TESTIMONI = C.clauServidor('meda_testimoni'), CLAU_CUA = C.clauServidor('meda_cua'), CLAU_ESTAT = C.clauServidor('meda_estat');
  var arrel = document.getElementById('app');

  // La drecera de l'iPhone obre l'app a Safari amb «#t=testimoni»: es desa i s'esborra de l'adreça.
  var mHash = /[#&]t=([\w.-]+)/.exec(location.hash);
  if (mHash) {
    if (C.magatzem.get(CLAU_TESTIMONI) !== mHash[1]) { C.magatzem.set(CLAU_TESTIMONI, mHash[1]); C.magatzem.del(CLAU_ESTAT); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* res */ }
  }

  var st = {
    testimoni: C.magatzem.get(CLAU_TESTIMONI),
    estat: C.magatzem.json(CLAU_ESTAT, null),
    idioma: 'es',
    pantalla: 'carrega',
    avis: '',
    canvi: null,
    cuaMemoria: [],
    camera: 'environment',
    flux: null,
    wakeLock: null
  };
  if (st.estat && st.estat.idioma) st.idioma = st.estat.idioma;

  function T(k, v) {
    var t = (window.TEXTOS_APP[st.idioma] || window.TEXTOS_APP.es)[k];
    if (t === undefined) t = window.TEXTOS_APP.es[k] || k;
    return typeof t === 'string' ? t.replace(/\{(\w+)\}/g, function (m, x) { return v && v[x] !== undefined ? v[x] : m; }) : t;
  }

  // ---------------- Veu ----------------
  var Veu = {
    audios: {},
    actual: null,
    /** Veus del telèfon per a l'idioma, de més a menys qualitat (premium > millorada > d'Espanya > compacta). */
    disponibles: function () {
      if (!('speechSynthesis' in window)) return [];
      var pref = st.idioma === 'ca' ? 'ca' : 'es';
      var nota = function (v) {
        var id = (v.voiceURI || '') + ' ' + v.name;
        return (/premium/i.test(id) ? 40 : 0) + (/enhanced|mejorad|millorad/i.test(id) ? 30 : 0) +
          (/compact/i.test(id) ? -10 : 0) + (/[-_]ES$/i.test(v.lang) ? 5 : 0) + (v.localService ? 1 : 0);
      };
      return speechSynthesis.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(pref) === 0; })
        .sort(function (a, b) { return nota(b) - nota(a); });
    },
    /** La veu triada per la família en aquest telèfon (si encara hi és) o la millor disponible. */
    tria: function () {
      var veus = Veu.disponibles();
      var triada = C.magatzem.get('meda_veu');
      return veus.filter(function (v) { return v.voiceURI === triada; })[0] || veus[0] || null;
    },
    velocitat: function () { return Number(C.magatzem.get('meda_velocitat')) || 0.9; },
    ctx: null,
    /** Prepara el so (l'iPhone només el deixa activar en tocar un botó). */
    preparaSo: function () {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!Veu.ctx) Veu.ctx = new AC();
        if (Veu.ctx.state === 'suspended') Veu.ctx.resume();
      } catch (e) { /* sense so */ }
    },
    /** Bip suau de dues notes (sinusoidal, volum baix, entrada i sortida graduals). */
    bip: function () {
      var ctx = Veu.ctx;
      if (!ctx) return;
      try {
        [[660, 0], [880, 0.22]].forEach(function (n) {
          var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + n[1];
          o.type = 'sine'; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + 0.32);
        });
      } catch (e) { /* sense so */ }
    },
    tts: function (text, enAcabar) {
      if (!('speechSynthesis' in window) || !text) { if (enAcabar) enAcabar(); return; }
      var u = new SpeechSynthesisUtterance(text);
      u.lang = st.idioma === 'ca' ? 'ca-ES' : 'es-ES';
      var v = Veu.tria(); if (v) u.voice = v;
      u.rate = Veu.velocitat();
      if (enAcabar) u.onend = enAcabar;
      speechSynthesis.speak(u);
    },
    atura: function () {
      try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* res */ }
      if (Veu.actual) { try { Veu.actual.pause(); } catch (e) { /* res */ } Veu.actual = null; }
    },
    /** Llegeix un text: primer l'avís (si n'hi ha), després la gravació o la veu del telèfon. */
    parla: function (text, audioId, avisPrevi, afegit) {
      Veu.atura();
      var principal = function () {
        var a = audioId && Veu.audios[audioId];
        var tot = afegit ? text + '. ' + afegit : text;
        if (a) {
          Veu.actual = a;
          try { a.currentTime = 0; } catch (e) { /* res */ }
          // La gravació no diu la zona: la veu del telèfon l'afegeix en acabar.
          a.onended = afegit ? function () { if (Veu.actual === a) Veu.tts(afegit); } : null;
          var p = a.play(); if (p && p.catch) p.catch(function () { Veu.tts(tot); });
        } else Veu.tts(tot);
      };
      if (avisPrevi) Veu.tts(avisPrevi, principal); else principal();
    },
    precarrega: function (passos) {
      passos.forEach(function (p) {
        if (!p.audio || Veu.audios[p.audio]) return;
        C.api('apiAudio', { id: p.audio }, st.testimoni).then(function (d) {
          var a = new Audio('data:' + d.mime + ';base64,' + d.b64);
          a.preload = 'auto';
          Veu.audios[p.audio] = a;
        }).catch(function () { /* es farà servir la veu del telèfon */ });
      });
    }
  };
  if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { speechSynthesis.getVoices(); }; }

  // ---------------- Utilitats de pantalla ----------------
  function mostra(contingut) {
    C.buida(arrel);
    if (st.pantalla !== 'final') document.querySelectorAll('.confeti').forEach(function (x) { x.remove(); });
    var demo = st.pantalla !== 'vincula' && ((st.canvi && st.canvi.mode === 'DEMO') || (!st.canvi && st.estat && st.estat.estat === 'DEMO'));
    document.body.classList.toggle('mode-practica', !!demo);
    if (demo) arrel.appendChild(h('div', { class: 'franja-practica', role: 'note' }, esSuport() ? T('franjaSuport') : T('practica')));
    arrel.appendChild(contingut);
    window.scrollTo(0, 0);
  }

  function esSuport() { return !!(st.estat && st.estat.dispositiu && st.estat.dispositiu.tipus === 'suport'); }

  function boto(text, accio, classe, extra) {
    return h('button', Object.assign({ type: 'button', class: 'boto ' + (classe || 'primari'), onclick: accio }, extra || {}), text);
  }

  function quanHuma(clau) {
    var d = C.deClau(clau);
    if (!d) return '';
    var avui = new Date(); avui.setHours(0, 0, 0, 0);
    var dia = new Date(d.getTime()); dia.setHours(0, 0, 0, 0);
    var dif = Math.round((dia - avui) / 86400000);
    var hora = C.dos(d.getHours()) + ':' + C.dos(d.getMinutes());
    var nomDia = dif === 0 ? T('avui') : dif === 1 ? T('dema') :
      T('dies')[d.getDay() === 0 ? 7 : d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
    return nomDia + ' ' + T('aLes') + ' ' + hora;
  }

  function diaCurt(clau) {
    var d = C.deClau(clau);
    return d ? T('dies')[d.getDay() === 0 ? 7 : d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1) : '';
  }

  function horaDe(clau) { var d = C.deClau(clau); return d ? C.dos(d.getHours()) + ':' + C.dos(d.getMinutes()) : ''; }

  function confirma(text, siAccio, noAccio) {
    Veu.parla(text);
    mostra(h('main', { class: 'pantalla' },
      h('p', { class: 'text-gran' }, text),
      h('div', { class: 'botons' }, boto(T('si'), siAccio, 'primari'), boto(T('no'), noAccio, 'secundari'))));
  }

  // ---------------- Cua sense connexió ----------------
  function cua() { return C.magatzem.json(CLAU_CUA, []).concat(st.cuaMemoria); }
  function desaCua(llista) {
    if (!C.magatzem.set(CLAU_CUA, JSON.stringify(llista))) { st.cuaMemoria = llista; C.magatzem.del(CLAU_CUA); }
    else st.cuaMemoria = [];
  }

  /** Envia els canvis desats. Retorna {resultat: 'enviat' | 'xarxa' | 'error', darrera: resposta del darrer enviat}. */
  async function enviaCua() {
    var llista = cua();
    var resultat = 'enviat', darrera = null;
    while (llista.length) {
      // Cada element és {op, dades}; els de versions anteriors (només dades) són canvis acabats.
      var item = llista[0].op ? llista[0] : { op: 'apiCompletaCanvi', dades: llista[0] };
      try {
        var resposta = await C.api(item.op, item.dades, st.testimoni);
        if (item.op === 'apiCompletaCanvi') darrera = resposta;
        llista.shift(); desaCua(llista);
      }
      catch (e) {
        if (e.codi === 'XARXA' || e.codi === 'OCUPAT' || e.codi === 'SENSE_USUARI') { resultat = 'xarxa'; break; }
        llista.shift(); desaCua(llista); resultat = 'error';
      }
    }
    return { resultat: resultat, darrera: darrera };
  }

  // ---------------- Estat ----------------
  async function carregaEstat() {
    if (!st.testimoni) { st.pantalla = 'vincula'; render(); return; }
    try {
      await enviaCua();
      var e = await C.api('apiEstatApp', { idioma: C.magatzem.get('meda_idioma') || '' }, st.testimoni);
      st.estat = e; st.idioma = e.idioma || 'es'; st.avis = '';
      document.documentElement.lang = st.idioma;
      C.magatzem.set(CLAU_ESTAT, JSON.stringify(e));
    } catch (e) {
      if (e.codi === 'SENSE_USUARI') {
        C.magatzem.del(CLAU_TESTIMONI); C.magatzem.del(CLAU_ESTAT);
        st.testimoni = null; st.estat = null; st.pantalla = 'vincula'; render(); return;
      }
      st.avis = e.codi === 'XARXA' ? T('senseConnexio') : (e.message || T('error'));
    }
    if (st.pantalla === 'carrega' || st.pantalla === 'inici') { st.pantalla = 'inici'; render(); }
  }

  // ---------------- Pantalles ----------------
  function render() {
    if (st.pantalla === 'vincula') return pantallaVincula();
    if (st.pantalla === 'inici') return pantallaInici();
    if (st.pantalla === 'pas') return pantallaPas();
    if (st.pantalla === 'alarma') return pantallaAlarma();
    mostra(h('main', { class: 'pantalla centrat' }, h('p', { class: 'text-gran' }, T('carregant'))));
  }

  /** Sense servidor: cal obrir l'enllaç (o escanejar el QR) que dona la família, o enganxar-lo aquí. */
  function pantallaSenseServidor(error) {
    var camp = h('input', { class: 'camp-enllac', type: 'url', autocomplete: 'off', 'aria-label': T('enganxaEnllac') });
    mostra(h('main', { class: 'pantalla' },
      h('h1', {}, T('vinculaTitol')),
      h('p', { class: 'text-mitja' }, T('senseServidor')),
      h('details', { class: 'enganxa' }, h('summary', {}, T('enganxaEnllac')),
        camp,
        error ? h('p', { class: 'error', role: 'alert' }, error) : null,
        boto(T('desaEnllac'), function () {
          var text = camp.value.trim();
          var url;
          try { url = new URL(text); } catch (e) { url = null; }
          var srv = url && url.searchParams.get('s') ? C.llegeixServidor(url.searchParams.get('s'), url.searchParams.get('d')) : C.llegeixServidor(text);
          if (!srv) { pantallaSenseServidor(T('enllacMal')); return; }
          C.desaServidor(srv);
          var t = url && /[#&]t=([\w.-]+)/.exec(url.hash);
          location.replace(location.pathname + '?' + C.paramServidor() + (t ? '#t=' + t[1] : ''));
        }, 'secundari'))));
  }

  function pantallaVincula(error) {
    if (!C.urlApi()) { pantallaSenseServidor(); return; }
    var esIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    var installada = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    var camp = h('input', { class: 'camp-codi', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6',
      autocomplete: 'one-time-code', 'aria-label': T('vinculaText') });
    var fes = async function () {
      var codi = camp.value.replace(/\D/g, '');
      if (codi.length !== 6) return;
      try {
        var r = await C.api('apiVinculaDispositiu', { codi: codi });
        st.testimoni = r.testimoni; C.magatzem.set(CLAU_TESTIMONI, r.testimoni);
        st.pantalla = 'carrega'; render(); carregaEstat();
      } catch (e) { pantallaVincula(e.codi === 'XARXA' ? T('senseConnexio') : T('codiMal')); }
    };
    mostra(h('main', { class: 'pantalla' },
      h('h1', {}, T('vinculaTitol')),
      esIos && !installada ? h('p', { class: 'avis' }, T('instal')) : null,
      h('p', { class: 'text-mitja' }, T('vinculaText')),
      camp,
      error ? h('p', { class: 'error', role: 'alert' }, error) : null,
      h('div', { class: 'botons' }, boto(T('vincula'), fes))));
  }

  function pantallaInici() {
    var e = st.estat;
    var cos = h('main', { class: 'pantalla' }, h('h1', {}, T('titol')));
    if (st.avis) cos.appendChild(h('p', { class: 'avis', role: 'alert' }, st.avis));
    if (!e) { cos.appendChild(h('p', { class: 'text-gran' }, T('carregant'))); mostra(cos); return; }
    e.medicaments.forEach(function (m) {
      var targeta;
      if (e.estat === 'DEMO') {
        targeta = h('section', { class: 'targeta practica' },
          h('h2', {}, m.nom),
          h('p', { class: 'text-mitja' }, esSuport() ? T('suportExplica') : T('practicaExplica')),
          boto(T('practicar'), function () { comencaCanvi(m, 'programat'); }, 'primari gran'),
          boto(T('practicarCaiguda'), function () { comencaCanvi(m, 'caiguda'); }, 'secundari'));
      } else if (m.pendent) {
        targeta = h('section', { class: 'targeta toca' },
          h('h2', {}, T('tocaAra')),
          h('p', { class: 'text-mitja' }, m.minutsRetard < 0 ? T('tocaHora', { hora: horaDe(m.pendent) }) : T('retard')),
          boto(T('empezar'), function () { comencaCanvi(m, 'programat'); }, 'primari gran'));
      } else {
        targeta = h('section', { class: 'targeta be' },
          h('h2', {}, '✅ ' + T('totBe')),
          m.darrer ? h('p', { class: 'text-mitja' }, T('darrer', { quan: quanHuma(m.darrer.fi), zona: m.darrer.zona })) : null,
          m.ratxa >= 2 ? h('p', { class: 'ratxa' }, T('ratxa', { n: m.ratxa })) : null,
          m.propera ? h('p', { class: 'text-mitja' }, T('propera', { quan: quanHuma(m.propera) })) : null);
      }
      cos.appendChild(targeta);
      if (e.estat === 'ACTIU') {
        cos.appendChild(boto(T('caiguda'), function () {
          confirma(T('caigudaConfirma'), function () { comencaCanvi(m, 'caiguda'); }, function () { st.pantalla = 'inici'; render(); });
        }, 'secundari'));
      }
    });
    if (esSuport()) cos.appendChild(targetaSeguiment(e.seguiment || []));
    var pendents = cua().length;
    if (pendents) cos.appendChild(h('p', { class: 'avis' }, T('cuaPendent', { n: pendents })));
    cos.appendChild(boto(T('actualitzar'), function () { st.avis = ''; carregaEstat(); }, 'enllac'));
    cos.appendChild(triaIdioma());
    if (!esSuport()) cos.appendChild(boto(T('alarma'), function () { st.pantalla = 'alarma'; render(); }, 'enllac petit'));
    mostra(cos);
  }

  /** La usuària pot canviar l'idioma de l'app (es desa en aquest telèfon). */
  function triaIdioma() {
    var opcio = function (codi, nom) {
      return h('button', { type: 'button', class: 'boto-idioma' + (st.idioma === codi ? ' actiu' : ''), lang: codi,
        'aria-pressed': st.idioma === codi ? 'true' : 'false',
        onclick: function () {
          if (st.idioma === codi) return;
          C.magatzem.set('meda_idioma', codi);
          Veu.atura(); Veu.audios = {};
          st.idioma = codi; document.documentElement.lang = codi;
          render(); carregaEstat();
        } }, nom);
    };
    return h('div', { class: 'tria-idioma', role: 'group', 'aria-label': 'Idioma' }, '🌐 ', opcio('es', 'Castellano'), opcio('ca', 'Català'));
  }

  function fa(segons) { return segons < 90 ? T('faSegons', { n: segons }) : T('faMinuts', { n: Math.round(segons / 60) }); }

  /** Targeta del telèfon de suport: per on va la usuària. */
  function targetaSeguiment(llista) {
    var t = h('section', { class: 'targeta seguiment', 'aria-live': 'polite' }, h('h2', {}, '👀 ' + T('seguiment')));
    if (!llista.length) t.appendChild(h('p', { class: 'text-mitja' }, T('seguimentBuit')));
    llista.forEach(function (p) {
      var clau = p.fase === 'acabat' ? 'seguimentAcabat' : p.fase === 'sortit' ? 'seguimentSortit' : 'seguimentPas';
      t.appendChild(h('p', { class: 'text-mitja' }, T(clau, p) + (p.mode === 'DEMO' ? ' ' + T('practicaDeElla') : '') + ' · ' + fa(p.segons)));
      if (p.fase === 'pas' && p.titol) t.appendChild(h('p', { class: 'cita' }, '«' + p.titol + '»'));
    });
    return t;
  }

  // ---------------- Instruccions de l'alarma ----------------
  function pantallaAlarma() {
    var meds = (st.estat && st.estat.medicaments) || [];
    var enllac = location.origin + location.pathname + '?' + C.paramServidor() + '#t=' + st.testimoni;
    var resultat = h('p', { class: 'avis', role: 'status', hidden: true });
    var copia = boto(T('copiarEnllac'), async function () {
      resultat.hidden = false;
      try { await navigator.clipboard.writeText(enllac); C.buida(resultat).appendChild(document.createTextNode(T('copiat'))); }
      catch (e) {
        C.buida(resultat).appendChild(document.createTextNode(T('noCopiat') + ' '));
        resultat.appendChild(h('span', { class: 'enllac-copiable' }, enllac));
      }
    }, 'primari');
    var nomsDies = function (dies) {
      var noms = String(dies || '').split(',').filter(Boolean).map(function (n) { return T('dies')[+n]; });
      return noms.length > 1 ? noms.slice(0, -1).join(', ') + T('i') + noms[noms.length - 1] : noms.join('');
    };
    mostra(h('main', { class: 'pantalla instruccions' },
      h('h1', {}, T('alarmaTitol')),
      meds.map(function (m) { return h('p', { class: 'horari' }, '⏰ ' + T('alarmaHorari', { nom: m.nom, dies: nomsDies(m.dies), hora: m.hora })); }),
      h('ol', {}, T('alarmaPassos').map(function (t, i) { return h('li', {}, t, i === 1 ? copia : null, i === 1 ? resultat : null); })),
      h('p', { class: 'avis' }, T('alarmaNota')),
      seccioVeu(),
      boto(T('tornar'), function () { Veu.atura(); st.pantalla = 'inici'; render(); }, 'secundari')));
  }

  /** Per a la família: triar la veu i la velocitat d'aquest telèfon i provar-les. */
  function seccioVeu() {
    var veus = Veu.disponibles();
    var actual = Veu.tria();
    var tria = h('select', { class: 'camp-select', 'aria-label': T('veuTria') },
      veus.map(function (v) { return h('option', { value: v.voiceURI }, v.name + ' (' + v.lang + ')'); }));
    if (actual) tria.value = actual.voiceURI;
    tria.onchange = function () { C.magatzem.set('meda_veu', tria.value); };
    var vel = h('select', { class: 'camp-select', 'aria-label': T('veuVelocitat') },
      h('option', { value: '0.8' }, T('veuLenta')), h('option', { value: '0.9' }, T('veuNormal')), h('option', { value: '1' }, T('veuRapida')));
    vel.value = String(Veu.velocitat());
    vel.onchange = function () { C.magatzem.set('meda_velocitat', vel.value); };
    return h('section', { class: 'targeta' },
      h('h2', {}, '🔊 ' + T('veuTitol')),
      veus.length ? [h('label', { class: 'camp-etiqueta' }, T('veuTria')), tria, h('label', { class: 'camp-etiqueta' }, T('veuVelocitat')), vel,
        boto(T('veuProva'), function () { Veu.atura(); Veu.tts(T('veuFrase')); }, 'secundari')] : h('p', {}, T('veuCap')),
      h('p', { class: 'ajuda-app' }, T('veuConsell')));
  }

  // ---------------- Assistent ----------------
  async function comencaCanvi(med, tipus) {
    Veu.atura();
    st.pantalla = 'carrega'; render();
    try {
      var r = await C.api('apiIniciaCanvi', { medicament: med.id, tipus: tipus }, st.testimoni);
      var noms = {}; med.zones.forEach(function (z) { noms[z.codi] = z.nom; });
      st.canvi = {
        med: med, tipus: tipus, mode: r.mode, dataProgramada: r.dataProgramada, index: 0,
        desfas: r.araMs - Date.now(), inici: C.clau(new Date()), idClient: C.uuid(),
        zones: r.zones.filter(function (z) { return noms[z.codi]; }).map(function (z) { return Object.assign({ nom: noms[z.codi] }, z); }),
        zona: r.zonaSuggerida, capLliure: r.capZonaDisponible, triantZona: false, diesRepeticio: Number(r.diesRepeticioZona) || 0,
        anteriorRetirat: tipus === 'caiguda' ? '' : null, foto: null, motiu: '', subpas: ''
      };
      Veu.precarrega(med.passos);
      demanaWakeLock();
      demanaUbicacio();
      st.pantalla = 'pas'; render();
    } catch (e) {
      st.pantalla = 'inici';
      st.avis = e.codi === 'XARXA' ? T('senseConnexio') : (e.message || T('error'));
      if (e.codi === 'SENSE_PENDENT') { st.avis = ''; carregaEstat(); return; }
      render();
    }
  }

  /** Ubicació del canvi (si la família ho té activat). Es demana en començar i es fa servir en acabar. */
  function demanaUbicacio() {
    var c = st.canvi;
    if (!c || !st.estat || !st.estat.guardaUbicacio || esSuport() || !navigator.geolocation) return;
    c.ubicacio = new Promise(function (resol) {
      navigator.geolocation.getCurrentPosition(function (p) {
        resol({ lat: p.coords.latitude, lon: p.coords.longitude, precisio: p.coords.accuracy });
      }, function () { resol(null); }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 120000 });
    });
  }

  async function demanaWakeLock() {
    try { if (navigator.wakeLock) st.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* no és imprescindible */ }
  }
  function alliberaWakeLock() { try { if (st.wakeLock) st.wakeLock.release(); } catch (e) { /* res */ } st.wakeLock = null; }

  function aturaCamera() {
    if (st.flux) { st.flux.getTracks().forEach(function (t) { t.stop(); }); st.flux = null; }
  }

  function seguent() {
    aturaCamera();
    var c = st.canvi;
    c.subpas = ''; c.triantZona = false;
    if (c.index < c.med.passos.length - 1) { c.index++; render(); } else finalitza();
  }

  function surt() {
    confirma(T('sortirConfirma'), function () {
      informaProgres('sortit', '');
      aturaCamera(); Veu.atura(); alliberaWakeLock();
      var c = st.canvi;
      if (!esSuport()) {
        // La sortida queda a l'historial (es desa a la cua per si no hi ha connexió).
        desaCua(cua().concat([{ op: 'apiRegistraSortida', dades: {
          medicament: c.med.id, tipus: c.tipus, mode: c.mode, dataProgramada: c.dataProgramada,
          pas: c.index + 1, total: c.med.passos.length, inici: c.inici, idClient: 's' + c.idClient } }]));
        enviaCua().catch(function () { /* s'enviarà més tard */ });
      }
      st.canvi = null; st.pantalla = 'inici'; render();
    }, function () { render(); });
  }

  function pantallaPas() {
    var c = st.canvi;
    var p = c.med.passos[c.index];
    var text = p.tipus === 'retirada' && c.tipus === 'caiguda' ? T('caigudaRetirada') : p.text;
    var audio = p.tipus === 'retirada' && c.tipus === 'caiguda' ? '' : p.audio;
    var avisPractica = c.mode === 'DEMO' && p.colocacio ? T('practicaNoPosar') : '';
    var textZona = p.tipus === 'zona' && c.zona ? T('zonaToca', { codi: c.zona, nom: nomZona(c.zona) }) : '';

    var cos = h('main', { class: 'pantalla pas' },
      h('div', { class: 'barra-pas' },
        h('button', { type: 'button', class: 'boto-sortir', onclick: surt }, '✕ ' + T('sortir')),
        h('span', { class: 'progres' }, T('pas', { n: c.index + 1, total: c.med.passos.length }))),
      h('div', { class: 'barra-progres', 'aria-hidden': 'true' },
        h('div', { style: { width: Math.round(100 * (c.index + 1) / c.med.passos.length) + '%' } })),
      avisPractica ? h('p', { class: 'avis-practica', role: 'note' }, avisPractica) : null,
      h('p', { class: 'text-pas' }, text),
      h('button', { type: 'button', class: 'boto-repetir', onclick: function () { Veu.parla(text, audio, avisPractica, textZona); } }, '🔊 ' + T('repetir')));

    if (esSuport()) cos.insertBefore(barraSeguiment(), cos.children[1]);
    var zonaCos = h('div', { class: 'accions' });
    cos.appendChild(zonaCos);
    var dibuixa = {
      retirada: pasRetirada, zona: pasZona, info: pasInfo, temporitzador: pasTemporitzador, foto: pasFoto
    }[p.tipus] || pasInfo;
    dibuixa(zonaCos, p);
    mostra(cos);
    if (!c.subpas && !c.triantZona) {
      Veu.parla(text, audio, avisPractica, textZona);
      informaProgres('pas', text);
    }
  }

  /** El telèfon de la usuària diu per on va (perquè la família pugui acompanyar per telèfon). */
  function informaProgres(fase, text) {
    var c = st.canvi;
    if (!c || esSuport()) return;
    C.api('apiProgres', { medicament: c.med.nom, mode: c.mode, tipus: c.tipus, pas: c.index + 1, total: c.med.passos.length,
      titol: String(text || '').slice(0, 90), fase: fase }, st.testimoni).catch(function () { /* no és imprescindible */ });
  }

  /** Telèfon de suport: per on va ella i botó per anar al mateix pas. */
  function barraSeguiment() {
    var caixa = h('div', { class: 'barra-seguiment', 'aria-live': 'polite' });
    var pinta = function (llista) {
      C.buida(caixa);
      var p = (llista || []).filter(function (x) { return x.fase === 'pas'; })[0];
      if (!p) { caixa.appendChild(h('span', {}, T('seguimentBuit'))); return; }
      caixa.appendChild(h('span', {}, '👵 ' + T('ellaVa', p) + ' · ' + fa(p.segons)));
      if (p.pas - 1 !== st.canvi.index && p.pas <= st.canvi.med.passos.length) {
        caixa.appendChild(h('button', { type: 'button', class: 'boto-petit', onclick: function () {
          aturaCamera(); st.canvi.subpas = ''; st.canvi.triantZona = false; st.canvi.index = p.pas - 1; render();
        } }, T('anarPas')));
      }
    };
    pinta(st.estat && st.estat.seguiment);
    return caixa;
  }

  function nomZona(codi) {
    var z = st.canvi.zones.filter(function (x) { return x.codi === codi; })[0];
    return z ? z.nom : codi;
  }

  function pasInfo(cont) {
    cont.appendChild(boto(T('fet'), seguent, 'primari gran'));
  }

  function pasRetirada(cont) {
    var c = st.canvi;
    if (c.tipus === 'caiguda') { cont.appendChild(boto(T('comprovat'), seguent, 'primari gran')); return; }
    cont.appendChild(boto(T('jaTret'), function () { c.anteriorRetirat = 'si'; seguent(); }, 'primari gran'));
    cont.appendChild(boto(T('noPortava'), function () {
      confirma(T('noPortavaConfirma'), function () { c.anteriorRetirat = 'no portava'; seguent(); }, function () { render(); });
    }, 'secundari'));
  }

  function pasZona(cont) {
    var c = st.canvi;
    var svg = window.Cos.dibuixa({
      codi: c.zona,
      etiquetes: { davant: T('davant'), darrere: T('darrere') },
      descripcio: T('zonaToca', { codi: c.zona, nom: nomZona(c.zona) })
    });
    cont.appendChild(h('div', { class: 'cos-contenidor' }, svg));
    cont.appendChild(h('p', { class: 'zona-nom' }, T('zonaToca', { codi: c.zona, nom: nomZona(c.zona) })));
    if (c.capLliure) cont.appendChild(h('p', { class: 'avis' }, T('zonaCapLliure')));
    var lliures = c.zones.filter(function (z) { return z.disponible !== false; });
    var usades = c.zones.filter(function (z) { return z.disponible === false; });
    if (!c.triantZona && lliures.length) {
      cont.appendChild(h('p', { class: 'zones-possibles' }, '✅ ' + T('zonesPossibles') + ' ' + lliures.map(function (z) { return z.codi; }).join(' · ')));
    }
    if (c.triantZona) {
      // Zones viables (es poden triar) i, a part, les usades fa poc (bloquejades, amb la data en què tornen a estar lliures).
      cont.appendChild(h('p', { class: 'text-mitja' }, T('zonaTria')));
      var tria = function (z) { c.zona = z.codi; render(); Veu.parla(T('zonaToca', { codi: z.codi, nom: z.nom })); };
      cont.appendChild(h('h3', { class: 'titol-zones' }, '✅ ' + T('zonesLliures')));
      cont.appendChild(h('div', { class: 'llista-zones' }, lliures.map(function (z) {
        return h('button', { type: 'button', class: 'boto-zona' + (z.codi === c.zona ? ' triada' : ''), onclick: function () { tria(z); } },
          h('strong', {}, z.codi + ' · ' + z.nom), h('span', { class: 'zona-data' }, z.darrerUs ? T('zonaUsada', { quan: diaCurt(z.darrerUs) }) : T('zonaMai')));
      })));
      if (usades.length) {
        cont.appendChild(h('h3', { class: 'titol-zones' }, '⛔ ' + T('zonesUsades')));
        cont.appendChild(h('div', { class: 'llista-zones' }, usades.map(function (z) {
          var lliure = C.deClau(z.darrerUs); if (lliure) lliure.setDate(lliure.getDate() + c.diesRepeticio);
          return h('div', { class: 'boto-zona bloquejada', 'aria-disabled': 'true' },
            h('strong', {}, z.codi + ' · ' + z.nom),
            h('span', { class: 'zona-data' }, T('zonaUsada', { quan: diaCurt(z.darrerUs) }) + (lliure ? ' · ' + T('zonaLliureEl', { quan: diaCurt(C.clau(lliure)) }) : '')));
        })));
      }
    }
    cont.appendChild(boto(T('zonaDacord'), seguent, 'primari gran'));
    if (!c.triantZona && !c.capLliure) cont.appendChild(boto(T('zonaAltra'), function () { c.triantZona = true; render(); }, 'secundari'));
  }

  function pasTemporitzador(cont, p) {
    var c = st.canvi;
    var total = p.segons || 15;
    var restant = c.subpas === 'acabat' ? 0 : total;
    var xifra = h('div', { class: 'compte', role: 'timer', 'aria-live': 'polite' }, String(restant));
    var etiqueta = h('div', { class: 'compte-etiqueta' }, T('segons', { n: total }));
    var fet = boto(T('fet'), seguent, 'primari gran', { disabled: c.subpas !== 'acabat' });
    var comptar = boto(T('comptar'), function () {
      comptar.disabled = true;
      Veu.atura();
      Veu.preparaSo();
      var fi = Date.now() + total * 1000;
      var interval = setInterval(function () {
        if (!document.body.contains(xifra)) { clearInterval(interval); return; }
        restant = Math.max(0, Math.ceil((fi - Date.now()) / 1000));
        xifra.textContent = String(restant);
        if (restant <= 0) {
          clearInterval(interval);
          c.subpas = 'acabat';
          xifra.classList.add('acabat');
          fet.disabled = false;
          comptar.disabled = false;
          if (navigator.vibrate) navigator.vibrate(300);
          Veu.bip();
          setTimeout(function () { Veu.tts(T('jaPot')); }, 650);
        }
      }, 250);
    }, c.subpas === 'acabat' ? 'secundari' : 'primari gran');
    cont.appendChild(h('div', { class: 'compte-caixa' }, xifra, etiqueta));
    cont.appendChild(comptar);
    cont.appendChild(fet);
  }

  function pasFoto(cont) {
    var c = st.canvi;
    if (c.subpas === 'motiu') {
      cont.appendChild(h('p', { class: 'text-gran' }, T('motiuQuin')));
      [T('motiuEsquena'), T('motiuCamera'), T('motiuAltre')].forEach(function (m) {
        cont.appendChild(boto(m, function () { c.motiu = m; c.foto = null; seguent(); }, 'secundari'));
      });
      cont.appendChild(boto(T('tornar'), function () { c.subpas = ''; render(); }, 'enllac'));
      return;
    }
    if (c.subpas === 'revisa' && c.foto) {
      cont.appendChild(h('img', { class: 'foto-revisio', src: c.foto, alt: T('esVeuBe') }));
      cont.appendChild(h('p', { class: 'text-gran' }, T('esVeuBe')));
      cont.appendChild(boto(T('siEnviar'), function () { c.motiu = ''; seguent(); }, 'primari gran'));
      cont.appendChild(boto(T('repetirFoto'), function () { c.foto = null; c.subpas = 'camera'; render(); }, 'secundari'));
      return;
    }
    if (c.subpas === 'camera') {
      var video = h('video', { class: 'video-camera', autoplay: true, playsinline: true, muted: true });
      video.muted = true; video.setAttribute('playsinline', '');
      var error = h('p', { class: 'error', role: 'alert', hidden: true }, T('cameraError'));
      var fer = boto(T('ferFoto'), function () {
        if (!video.videoWidth) return;
        c.foto = capturaAmbMarca(video);
        aturaCamera(); c.subpas = 'revisa'; render();
      }, 'primari gran');
      cont.appendChild(h('div', { class: 'camera-caixa' }, video));
      cont.appendChild(error);
      cont.appendChild(fer);
      cont.appendChild(boto('🔄 ' + T('girarCamera'), function () {
        st.camera = st.camera === 'environment' ? 'user' : 'environment'; aturaCamera(); render();
      }, 'secundari'));
      cont.appendChild(boto(T('noFoto'), function () { aturaCamera(); c.subpas = 'motiu'; render(); }, 'enllac'));
      obreCamera(video).catch(function () { error.hidden = false; fer.disabled = true; });
      return;
    }
    cont.appendChild(boto('📷 ' + T('obrirCamera'), function () { c.subpas = 'camera'; render(); }, 'primari gran'));
    cont.appendChild(boto(T('noFoto'), function () { c.subpas = 'motiu'; render(); }, 'secundari'));
  }

  async function obreCamera(video) {
    aturaCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('sense càmera');
    st.flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: st.camera, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false
    });
    video.srcObject = st.flux;
    await video.play();
  }

  /** Fa la foto del vídeo en directe i hi imprimeix data, hora (del servidor) i zona. */
  function capturaAmbMarca(video) {
    var c = st.canvi;
    var escala = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    var w = Math.round(video.videoWidth * escala), alt = Math.round(video.videoHeight * escala);
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = alt;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, alt);
    var ara = new Date(Date.now() + (c.desfas || 0));
    var text = C.dos(ara.getDate()) + '/' + C.dos(ara.getMonth() + 1) + '/' + ara.getFullYear() + ' ' +
      C.dos(ara.getHours()) + ':' + C.dos(ara.getMinutes()) + (c.zona ? '  ·  Zona ' + c.zona : '') +
      (c.mode === 'DEMO' ? '  ·  ' + T('practica') : '');
    var banda = Math.max(36, Math.round(alt * 0.07));
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, alt - banda, w, banda);
    ctx.fillStyle = '#fff';
    ctx.font = Math.round(banda * 0.5) + 'px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, Math.round(banda * 0.4), alt - banda / 2);
    return canvas.toDataURL('image/jpeg', 0.75);
  }

  async function finalitza() {
    var c = st.canvi;
    Veu.atura(); alliberaWakeLock();
    st.pantalla = 'enviant';
    mostra(h('main', { class: 'pantalla centrat' }, h('p', { class: 'text-gran' }, T('enviant'))));
    var teZona = c.med.passos.some(function (p) { return p.tipus === 'zona'; });
    if (esSuport()) {
      // En el suport es pot saltar de pas: es completen les dades que falten perquè la pràctica es desi.
      if (c.anteriorRetirat === null) c.anteriorRetirat = 'si';
      if (!c.foto && !c.motiu) c.motiu = T('motiuSuport');
    }
    informaProgres('acabat', '');
    // Ubicació: s'espera com a molt 5 segons més; si no n'hi ha, el canvi es desa igualment.
    var gps = c.ubicacio ? await Promise.race([c.ubicacio, new Promise(function (r) { setTimeout(function () { r(null); }, 5000); })]) : null;
    var dades = {
      medicament: c.med.id, tipus: c.tipus, mode: c.mode, dataProgramada: c.dataProgramada, idClient: c.idClient,
      anteriorRetirat: c.anteriorRetirat || '', zona: teZona ? c.zona : '', inici: c.inici,
      foto: c.foto || '', senseFotoMotiu: c.foto ? '' : c.motiu,
      lat: gps ? gps.lat : '', lon: gps ? gps.lon : '', precisio: gps ? gps.precisio : ''
    };
    desaCua(cua().concat([{ op: 'apiCompletaCanvi', dades: dades }]));
    var r = await enviaCua();
    var titol, text, ratxa = 0, fita = '';
    if (r.resultat === 'enviat') {
      titol = felicitacio(c.mode === 'DEMO' ? 'felicitacionsPractica' : 'felicitacions');
      text = c.mode === 'DEMO' ? T('acabatPractica') : T('acabatText');
      ratxa = r.darrera && r.darrera.ratxa || 0;
      fita = (T('fites') || {})[ratxa] || '';
    } else if (r.resultat === 'xarxa') { titol = felicitacio('felicitacions'); text = T('guardatLocal'); }
    else { titol = T('error'); text = ''; }
    st.canvi = null;
    var sensEmoji = function (t) { return String(t).replace(/[^\p{L}\p{N}\s¡!¿?.,'’«»-]/gu, '').trim(); };
    Veu.tts([titol, fita, text].filter(Boolean).map(sensEmoji).join('. '));
    st.pantalla = 'final';
    mostra(h('main', { class: 'pantalla centrat final' },
      h('p', { class: 'text-enorme felicitacio' }, titol),
      fita ? h('p', { class: 'fita' }, fita) : null,
      ratxa >= 2 && !fita ? h('p', { class: 'ratxa' }, T('ratxa', { n: ratxa })) : null,
      text ? h('p', { class: 'text-gran' }, text) : null,
      boto(T('tornar'), function () { Veu.atura(); st.pantalla = 'inici'; render(); carregaEstat(); }, 'primari gran')));
    if (r.resultat !== 'error') confeti(fita ? 120 : 60);
  }

  /** Tria una felicitació a l'atzar, diferent de l'última que s'ha mostrat. */
  function felicitacio(clau) {
    var llista = T(clau);
    if (!Array.isArray(llista) || !llista.length) return T('acabat');
    var darrera = Number(C.magatzem.get('meda_felicitacio_' + clau));
    var i = Math.floor(Math.random() * llista.length);
    if (llista.length > 1 && i === darrera) i = (i + 1 + Math.floor(Math.random() * (llista.length - 1))) % llista.length;
    C.magatzem.set('meda_felicitacio_' + clau, String(i));
    return llista[i];
  }

  /** Pluja de confeti (no es mostra si el telèfon demana menys moviment). */
  function confeti(n) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#DA7E45', '#1C7981', '#F2B705', '#B9A7D9', '#E85D75', '#4CAF7A'];
    var capa = h('div', { class: 'confeti', 'aria-hidden': 'true' });
    for (var i = 0; i < n; i++) {
      capa.appendChild(h('i', { style: {
        left: Math.random() * 100 + '%', background: colors[i % colors.length],
        animationDelay: (Math.random() * 0.8) + 's', animationDuration: (2.2 + Math.random() * 1.6) + 's',
        transform: 'rotate(' + Math.round(Math.random() * 360) + 'deg)'
      } }));
    }
    document.body.appendChild(capa);
    setTimeout(function () { capa.remove(); }, 4500);
  }

  // ---------------- Inici ----------------
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && st.pantalla === 'inici') carregaEstat();
    if (document.visibilityState === 'visible' && st.wakeLock === null && st.pantalla === 'pas') demanaWakeLock();
  });
  window.addEventListener('online', function () { enviaCua().then(function () { if (st.pantalla === 'inici') carregaEstat(); }); });
  setInterval(function () { if (st.pantalla === 'inici' && document.visibilityState === 'visible') carregaEstat(); }, 5 * 60000);
  // Telèfon de suport: actualitza el seguiment cada 10 s (a l'inici i durant l'assistent).
  setInterval(function () {
    if (!esSuport() || document.visibilityState !== 'visible') return;
    if (st.pantalla === 'inici') { carregaEstat(); return; }
    if (st.pantalla === 'pas') {
      C.api('apiSeguiment', {}, st.testimoni).then(function (llista) {
        st.estat.seguiment = llista;
        var barra = document.querySelector('.barra-seguiment');
        if (barra) barra.replaceWith(barraSeguiment());
      }).catch(function () { /* res */ });
    }
  }, 10000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* res */ });

  st.pantalla = st.testimoni ? (st.estat ? 'inici' : 'carrega') : 'vincula';
  render();
  if (st.testimoni) carregaEstat();
})();
