/**
 * panel.js — Medicació assistida · panell de supervisors i administradors.
 * Tot es fa per l'API: ningú no obre la Hoja de càlcul.
 * Copyright (c) 2026 xjav-dev · SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.12.0 · 2026-11-19
 */
(function () {
  'use strict';
  var C = window.Comu, h = C.h;
  var CLAU = C.clauServidor('meda_panel'); // separada per servidor
  var DIES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DIES_CURT = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var TIPUS_PAS = { retirada: 'Quitar el anterior (obligatorio confirmar)', zona: 'Elegir zona', info: 'Instrucción', temporitzador: 'Temporizador', foto: 'Foto' };

  var desat = C.magatzem.json(CLAU, null);
  var st = { testimoni: desat && desat.testimoni, jo: desat && desat.jo, vista: 'inici', cfg: null, correu: '' };
  var arrel = document.getElementById('panel');

  /** Avís d'ús (el mateix text que AVISO.md). Si canvia, cal incrementar AVIS_VERSIO_ al servidor. */
  var AVIS = [
    'Medicación asistida es software libre para uso privado y familiar. No es un producto sanitario y no sustituye al médico, al farmacéutico ni al prospecto del medicamento.',
    'No da consejos médicos ni calcula dosis: solo recuerda y registra lo que configura la familia. Compruebe que días, horas, zonas y pasos coinciden con la prescripción y el prospecto.',
    'Los recordatorios y avisos pueden fallar (teléfono apagado o sin conexión, alarma desactivada, fallos de Google, Telegram o del correo). No la use como única medida de seguridad.',
    'Ante una dosis olvidada, un error o una duda, consulte el prospecto, al farmacéutico o al médico. En una urgencia, llame al 112.',
    'Cada instalación es independiente: quien la instala es responsable de ella y de los datos de salud que guarda, que quedan en su propia cuenta de Google. Los autores no reciben ni tratan ningún dato.',
    'No está vinculada a ningún fabricante ni medicamento.',
    'Se ofrece «tal cual», sin garantía ni responsabilidad, según los artículos 7 y 8 de la licencia EUPL-1.2. © 2026 xjav-dev.'
  ];

  function mostraAvis(obligatori) {
    return new Promise(function (resol) {
      var fons = h('div', { class: 'modal-fons', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aviso de uso' });
      var accepta = boto(obligatori ? 'He leído el aviso y lo acepto' : 'Cerrar', null, 'primari');
      accepta.onclick = async function () {
        if (!obligatori) { fons.remove(); resol(true); return; }
        accepta.disabled = true;
        try { await crida('apiAcceptaAvis', {}); fons.remove(); resol(true); } catch (e) { errorA(e); accepta.disabled = false; }
      };
      fons.appendChild(h('div', { class: 'modal avis-us' },
        h('h2', {}, '⚠️ Aviso de uso'),
        AVIS.map(function (t) { return h('p', {}, t); }),
        h('div', { class: 'modal-accions' },
          obligatori ? boto('Salir', function () { fons.remove(); surtLocal(); resol(false); }, '') : null, accepta)));
      document.body.appendChild(fons);
      accepta.focus();
    });
  }

  function esAdmin() { return st.jo && st.jo.rol === 'administrador'; }

  async function crida(op, dades) {
    try { return await C.api(op, dades, st.testimoni); }
    catch (e) {
      if (e.codi === 'SENSE_USUARI') { surtLocal(); throw e; }
      throw e;
    }
  }

  function surtLocal() { C.magatzem.del(CLAU); st.testimoni = null; st.jo = null; st.cfg = null; render(); }

  // ---------- Elements comuns ----------
  function avis(text, tipus) {
    var t = h('div', { class: 'toast ' + (tipus || 'ok'), role: 'status' }, text);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, tipus === 'error' ? 6000 : 3500);
  }
  var ERRORS = {
    XARXA: 'Sin conexión con el servidor.', CODI_INVALID: 'Código incorrecto o caducado.', LIMIT: 'Demasiados intentos. Espere unos minutos.',
    SENSE_PERMIS: 'No tiene permiso para hacer esto.', OCUPAT: 'El sistema está ocupado. Vuelva a probar.',
    TESTIMONI: 'La confirmación ha caducado o no es válida. Cierre y vuelva a empezar.'
  };
  function textError(e) { return ERRORS[e.codi] || e.message || 'Error'; }
  function errorA(e) { avis(textError(e), 'error'); }

  function boto(text, accio, classe, extra) {
    return h('button', Object.assign({ type: 'button', class: 'btn ' + (classe || ''), onclick: accio }, extra || {}), text);
  }

  /** Executa una acció amb el botó desactivat mentre dura. */
  function ambEspera(btn, fn) {
    return async function () {
      btn.disabled = true;
      try { await fn(); } catch (e) { errorA(e); } finally { btn.disabled = false; }
    };
  }

  function modal(titol, contingut, accions) {
    var fons = h('div', { class: 'modal-fons', role: 'dialog', 'aria-modal': 'true', 'aria-label': titol });
    var tanca = function () { fons.remove(); };
    var caixa = h('div', { class: 'modal' }, h('h2', {}, titol), contingut,
      h('div', { class: 'modal-accions' }, (accions || []).map(function (a) {
        var b = boto(a.text, null, a.classe || '');
        b.addEventListener('click', async function () {
          if (!a.accio) { tanca(); return; }
          b.disabled = true;
          try { var r = await a.accio(); if (r !== false) tanca(); } catch (e) { errorA(e); } finally { b.disabled = false; }
        });
        return b;
      })));
    fons.appendChild(caixa);
    fons.addEventListener('click', function (ev) { if (ev.target === fons) tanca(); });
    document.body.appendChild(fons);
    var primer = caixa.querySelector('input, select, textarea, button');
    if (primer) primer.focus();
    return tanca;
  }

  function camp(etiqueta, input, ajuda) {
    return h('label', { class: 'camp' }, h('span', { class: 'camp-etiqueta' }, etiqueta), input, ajuda ? h('span', { class: 'ajuda' }, ajuda) : null);
  }
  function casella(etiqueta, marcat, extra) {
    var c = h('input', Object.assign({ type: 'checkbox' }, extra || {})); c.checked = !!marcat;
    return { el: h('label', { class: 'casella' }, c, ' ', etiqueta), input: c };
  }

  function dataHumana(clau) {
    var d = C.deClau(clau); if (!d) return '—';
    return DIES[d.getDay() === 0 ? 7 : d.getDay()].toLowerCase() + ' ' + C.dos(d.getDate()) + '/' + C.dos(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + C.dos(d.getHours()) + ':' + C.dos(d.getMinutes());
  }
  function horari(dies, hora) {
    var noms = String(dies || '').split(',').filter(Boolean).map(function (n) { return DIES[+n].toLowerCase(); });
    var t = noms.length > 1 ? noms.slice(0, -1).join(', ') + ' y ' + noms[noms.length - 1] : noms.join('');
    return t + ' a las ' + hora;
  }

  function insignia(r) {
    var mapa = {
      completat: ['ok', '✅ Hecho'], 'en curs': ['pendent', '⏳ Empezado'], pendent: ['pendent', '⏳ Pendiente'], 'no fet': ['mal', '❌ No hecho'],
      abandonat: ['sortida', '↩️ Salió sin terminar']
    };
    var m = mapa[r.estat] || ['', r.estat];
    var extra = r.estat !== 'completat' && r.alertat ? ' · 🔴 alerta' : r.estat !== 'completat' && r.avisat ? ' · ⚠️ avisado' : '';
    return h('span', { class: 'insignia ' + m[0] }, m[1] + extra);
  }

  // ---------- Servidor ----------
  function urlBase(fitxer) { return location.origin + location.pathname.replace(/[^/]*$/, '') + fitxer + '?' + C.paramServidor(); }

  /** Primer cop (o enllaç sense ?s=): cal l'adreça /exec del servidor d'Apps Script. */
  function pantallaServidor(error) {
    C.buida(arrel);
    var camp = h('input', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off' });
    var form = h('form', { class: 'entrada' },
      h('h1', {}, 'Medicación asistida'),
      h('p', {}, 'Abra el enlace del panel que le han enviado (lleva la dirección del servidor). Si es usted quien ha instalado el servidor, pegue aquí la dirección de la aplicación web de Apps Script (acaba en /exec):'),
      camp,
      error ? h('p', { class: 'error', role: 'alert' }, error) : null,
      h('button', { type: 'submit', class: 'btn primari' }, 'Guardar en este navegador'),
      h('p', { class: 'ajuda' }, 'La dirección se guarda solo en este navegador y no aparece en la web pública.'));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = camp.value.trim();
      var url; try { url = new URL(text); } catch (e) { url = null; }
      var srv = url && url.searchParams.get('s') ? C.llegeixServidor(url.searchParams.get('s'), url.searchParams.get('d')) : C.llegeixServidor(text);
      if (!srv) { pantallaServidor('No es una dirección válida de Apps Script (https://script.google.com/…/exec).'); return; }
      C.desaServidor(srv);
      location.replace(location.pathname + '?' + C.paramServidor());
    });
    arrel.appendChild(form);
    camp.focus();
  }

  /** Bloc amb un enllaç per compartir: camp, botó de copiar i QR. */
  function blocEnllac(text, titol) {
    var camp = h('input', { type: 'text', readonly: true, value: text });
    return h('div', { class: 'instal' },
      h('div', {}, titol ? h('p', {}, titol) : null, camp, boto('Copiar enlace', function () { copia(text, camp); }, 'petit')),
      qr(text));
  }

  // ---------- Accés ----------
  function pantallaEntrada(pas, error) {
    C.buida(arrel);
    var correu = h('input', { type: 'email', autocomplete: 'email', value: st.correu || '', required: true });
    var codi = h('input', { type: 'text', autocomplete: 'one-time-code', placeholder: 'XXXX-XXXX', class: 'codi', maxlength: '9' });
    var form = h('form', { class: 'entrada' },
      h('h1', {}, 'Medicación asistida'),
      h('p', {}, 'Panel de la familia'),
      pas === 'codi'
        ? [h('p', {}, 'Si ' + st.correu + ' está dado de alta, le hemos enviado un código por email (y por Telegram si lo tiene vinculado). Caduca en 15 minutos.'),
          camp('Código', codi)]
        : camp('Su email', correu),
      error ? h('p', { class: 'error', role: 'alert' }, error) : null,
      h('button', { type: 'submit', class: 'btn primari' }, pas === 'codi' ? 'Entrar' : 'Enviarme un código'),
      pas === 'codi' ? boto('Usar otro email', function () { pantallaEntrada(''); }, 'enllac') : null);
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var b = form.querySelector('button[type=submit]'); b.disabled = true;
      try {
        if (pas === 'codi') {
          var r = await C.api('apiEntra', { correu: st.correu, codi: codi.value });
          st.testimoni = r.testimoni; st.jo = r.jo;
          C.magatzem.set(CLAU, JSON.stringify({ testimoni: r.testimoni, jo: r.jo }));
          st.vista = 'inici'; render();
        } else {
          st.correu = correu.value.trim().toLowerCase();
          if (!st.correu) return;
          await C.api('apiDemanaCodi', { correu: st.correu });
          pantallaEntrada('codi');
        }
      } catch (e) {
        pantallaEntrada(pas, textError(e));
      } finally { b.disabled = false; }
    });
    arrel.appendChild(form);
    (pas === 'codi' ? codi : correu).focus();
  }

  // ---------- Estructura ----------
  var VISTES = [
    { id: 'inici', nom: 'Inicio' }, { id: 'historial', nom: 'Historial' }, { id: 'medicacio', nom: 'Medicación', admin: true },
    { id: 'persones', nom: 'Personas' }, { id: 'dispositiu', nom: 'Teléfonos' },
    { id: 'ajustos', nom: 'Ajustes', admin: true }, { id: 'copies', nom: 'Copias', admin: true }, { id: 'registre', nom: 'Registro', admin: true }
  ];

  async function render() {
    if (!C.urlApi()) { pantallaServidor(); return; }
    if (!st.testimoni) { pantallaEntrada(''); return; }
    C.buida(arrel);
    var contingut = h('main', { class: 'contingut', id: 'contingut' }, h('p', { class: 'carregant' }, 'Cargando…'));
    var nav = h('nav', { class: 'pestanyes', 'aria-label': 'Secciones' }, VISTES.filter(function (v) { return !v.admin || esAdmin(); }).map(function (v) {
      return h('button', { type: 'button', class: 'pestanya' + (st.vista === v.id ? ' activa' : ''), 'aria-current': st.vista === v.id ? 'page' : null,
        onclick: function () { st.vista = v.id; render(); } }, v.nom);
    }));
    var franja = h('div', { id: 'franja' });
    arrel.appendChild(franja);
    arrel.appendChild(h('header', { class: 'capcalera' },
      h('div', {}, h('strong', {}, 'Medicación asistida'), h('span', { class: 'qui' }, ' · ' + (st.jo ? st.jo.nom + (esAdmin() ? ' (administrador)' : '') : ''))),
      boto('Salir', async function () { try { await crida('apiSurt', {}); } catch (e) { /* igualment */ } surtLocal(); }, 'petit')));
    arrel.appendChild(nav);
    arrel.appendChild(contingut);
    var peuText = h('span', {}, 'Medicación asistida');
    var peu = h('footer', { class: 'peu' }, peuText, ' · ',
      h('button', { type: 'button', class: 'btn enllac petit', onclick: function () { mostraAvis(false); } }, 'Aviso de uso'),
      ' · © 2026 xjav-dev · EUPL-1.2');
    arrel.appendChild(peu);
    try {
      if (!st.avisAcceptat) {
        var jo = await crida('apiJo', {});
        if (jo.avisPendent && !(await mostraAvis(true))) return;
        st.avisAcceptat = true;
      }
      st.cfg = await crida('apiConfig', {});
      peuText.textContent = 'Medicación asistida · versión web ' + C.versioWeb + ' · servidor ' + st.cfg.config.versio;
      if (st.cfg.config.entorn !== 'produccio') franja.appendChild(h('div', { class: 'franja-entorn' }, 'Entorno de desarrollo'));
      if (st.cfg.config.estat === 'DEMO') franja.appendChild(h('div', { class: 'franja-demo' }, 'MODO PRÁCTICA: el teléfono está en modo práctica'));
      await ({ inici: vistaInici, historial: vistaHistorial, medicacio: vistaMedicacio, persones: vistaPersones,
        dispositiu: vistaDispositiu, ajustos: vistaAjustos, copies: vistaCopies, registre: vistaRegistre }[st.vista] || vistaInici)(C.buida(contingut));
    } catch (e) {
      if (e.codi !== 'SENSE_USUARI') { C.buida(contingut).appendChild(h('p', { class: 'error' }, e.message || 'Error')); }
    }
  }

  // ---------- Inici ----------
  async function vistaInici(cont) {
    var r = await crida('apiResum', {});
    var cfg = st.cfg.config;
    var estat = h('section', { class: 'targeta ' + (r.estat === 'ACTIU' ? 'actiu' : 'demo') },
      h('h2', {}, r.estat === 'ACTIU' ? 'Sistema ACTIVO' : 'Modo PRÁCTICA'),
      h('p', {}, r.estat === 'ACTIU'
        ? 'Los cambios cuentan de verdad desde el ' + dataHumana(r.dataInici) + '. Se envían avisos si se retrasa.'
        : 'El teléfono muestra la franja «PRÁCTICA». Lo que haga se guarda aparte y no hay avisos de retraso.'),
      esAdmin() ? (r.estat === 'ACTIU'
        ? boto('Volver a modo práctica', function () { canviaEstat('DEMO'); }, 'secundari')
        : boto('Pasar a ACTIVO', function () { canviaEstat('ACTIU'); }, 'primari')) : null);
    cont.appendChild(estat);
    cont.appendChild(targetaAraMateix());
    r.medicaments.forEach(function (m) {
      var linies = [h('h2', {}, m.nom), h('p', { class: 'suau' }, 'Cambio: ' + horari(m.dies, m.hora))];
      if (m.pendent) {
        var tard = m.minutsRetard;
        linies.push(h('p', { class: 'estat ' + (tard >= 30 ? 'mal' : 'pendent') },
          tard >= 0 ? '⏳ Pendiente el de ' + dataHumana(m.pendent) + ' (' + tard + ' min de retraso)' : '⏳ Toca a las ' + m.pendent.slice(11)));
      }
      if (m.darrer) {
        linies.push(h('p', {}, '✅ Último: ' + dataHumana(m.darrer.fi) + ' · zona ' + m.darrer.zona + (m.darrer.nomZona ? ' (' + m.darrer.nomZona + ')' : '') +
          (m.darrer.anteriorRetirat === 'no portava' ? ' · ⚠️ dijo que no llevaba parche' : '')));
      }
      if (m.propera) linies.push(h('p', {}, '📅 Próximo: ' + dataHumana(m.propera)));
      cont.appendChild(h('section', { class: 'targeta' }, linies));
    });
    var llista = h('ul', { class: 'llista' });
    r.recents.forEach(function (x) {
      llista.appendChild(h('li', {}, insignia(x), ' ', dataHumana(x.fi || x.dataProgramada),
        x.tipus === 'caiguda' ? ' · parche caído' : '', x.zona ? ' · zona ' + x.zona : '',
        x.teFoto ? h('button', { type: 'button', class: 'btn petit', onclick: function () { veuFoto(x); } }, '📷 Foto') : null));
    });
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Actividad reciente' + (r.estat === 'DEMO' ? ' (real)' : '')),
      r.recents.length ? llista : h('p', { class: 'suau' }, 'Todavía no hay cambios reales registrados.')));
    cont.appendChild(boto('Actualizar', function () { render(); }, 'secundari'));
    if (cfg.estat === 'DEMO' && esAdmin()) {
      cont.appendChild(h('p', { class: 'suau' }, 'Las prácticas se ven en Historial → Prácticas.'));
    }
  }

  /** «Ahora mismo»: per on va el telèfon de la usuària; s'actualitza cada 10 s mentre es veu. */
  function targetaAraMateix() {
    var caixa = h('section', { class: 'targeta ara', 'aria-live': 'polite' }, h('h2', {}, '👀 Ahora mismo'), h('p', { class: 'suau' }, 'Cargando…'));
    var pinta = async function () {
      if (!document.body.contains(caixa) && caixa.dataset.vist) return false;
      caixa.dataset.vist = '1';
      var llista;
      try { llista = await crida('apiSeguiment', {}); } catch (e) { return true; }
      while (caixa.childNodes.length > 1) caixa.removeChild(caixa.lastChild);
      if (!llista.length) caixa.appendChild(h('p', { class: 'suau' }, 'No está haciendo ningún cambio (nada en los últimos 30 minutos).'));
      llista.forEach(function (p) {
        var fa = p.segons < 90 ? 'hace ' + p.segons + ' s' : 'hace ' + Math.round(p.segons / 60) + ' min';
        var que = p.fase === 'acabat' ? '✅ ha terminado' : p.fase === 'sortit' ? '↩️ ha salido sin terminar' : 'paso ' + p.pas + ' de ' + p.total;
        caixa.appendChild(h('p', {}, h('strong', {}, p.dispositiu), ': ' + que + (p.mode === 'DEMO' ? ' (práctica)' : '') +
          (p.tipus === 'caiguda' ? ' · parche caído' : '') + ' · ' + fa));
        if (p.fase === 'pas' && p.titol) caixa.appendChild(h('p', { class: 'suau' }, '«' + p.titol + '»'));
      });
      return true;
    };
    pinta();
    var t = setInterval(async function () {
      if (st.vista !== 'inici' || !document.body.contains(caixa)) { clearInterval(t); return; }
      if (document.visibilityState === 'visible') await pinta();
    }, 10000);
    return caixa;
  }

  function canviaEstat(nou) {
    if (nou === 'ACTIU') {
      var ara = new Date();
      var data = h('input', { type: 'datetime-local', value: C.clau(ara).replace(' ', 'T') });
      // Pegat que porta ara: perquè el primer canvi real vagi a la zona següent i no torni a començar per la A.
      var meds = st.cfg.medicaments.filter(function (m) { return m.actiu !== false && (m.zones || []).some(function (z) { return z.activa !== false; }); });
      var tries = meds.map(function (m) {
        var sel = h('select', {}, h('option', { value: '' }, 'No lo registro'),
          m.zones.filter(function (z) { return z.activa !== false; }).map(function (z) { return h('option', { value: z.codi }, 'Zona ' + z.codi + ' · ' + z.nom_es); }));
        return { med: m, sel: sel };
      });
      var dataParxe = h('input', { type: 'datetime-local', value: C.clau(ara).replace(' ', 'T') });
      modal('Pasar a ACTIVO', h('div', {},
        h('p', {}, 'Desde ese momento los cambios cuentan de verdad, se envían avisos de retraso y la práctica desaparece del teléfono.'),
        camp('Empieza a contar desde', data),
        tries.length ? h('fieldset', { class: 'parxe-actual' }, h('legend', {}, 'Parche que lleva puesto ahora'),
          tries.map(function (t) { return camp(meds.length > 1 ? t.med.nom_es : 'Zona', t.sel); }),
          camp('Se lo puso el', dataParxe),
          h('p', { class: 'ajuda' }, 'Así el primer cambio real irá a la zona siguiente (si lleva la A, a la B) y no repetirá esa zona en los días configurados. Queda en el historial como «Parche inicial».')) : null,
        h('p', { class: 'ajuda' }, 'Antes, compruebe que la alarma del iPhone suena los mismos días y a la misma hora que la medicación.')),
      [{ text: 'Cancelar' }, { text: 'Pasar a ACTIVO', classe: 'primari', accio: async function () {
        var parxes = tries.filter(function (t) { return t.sel.value; }).map(function (t) { return { medicament: t.med.id, zona: t.sel.value }; });
        st.cfg = await crida('apiDesaEstat', { estat: 'ACTIU', dataInici: data.value.replace('T', ' '),
          parxes: parxes, dataParxe: parxes.length ? dataParxe.value.replace('T', ' ') : '' });
        avis('Sistema activo.'); render();
      } }]);
    } else {
      modal('Volver a modo práctica', h('p', {}, 'El teléfono volverá a mostrar la franja «PRÁCTICA» y se pararán los avisos de retraso.'),
        [{ text: 'Cancelar' }, { text: 'Volver a práctica', classe: 'primari', accio: async function () {
          st.cfg = await crida('apiDesaEstat', { estat: 'DEMO' }); avis('Modo práctica.'); render();
        } }]);
    }
  }

  async function veuFoto(reg) {
    var img = h('img', { class: 'foto-gran', alt: 'Foto del parche' });
    var tanca = modal('Foto · ' + dataHumana(reg.fi), h('div', {}, h('p', { class: 'carregant' }, 'Cargando foto…'), img), [{ text: 'Cerrar' }]);
    try {
      var f = await crida('apiFoto', { id: reg.id });
      img.src = 'data:' + f.mime + ';base64,' + f.b64;
      img.previousSibling.remove();
    } catch (e) { errorA(e); tanca(); }
  }

  // ---------- Historial ----------
  async function vistaHistorial(cont) {
    var avui = new Date();
    var fa = new Date(avui.getTime() - 60 * 86400000);
    st.hist = st.hist || { mode: 'REAL', des: C.clau(fa).slice(0, 10), fins: C.clau(avui).slice(0, 10) };
    var mode = h('select', {}, h('option', { value: 'REAL' }, 'Cambios reales'), h('option', { value: 'DEMO' }, 'Prácticas'));
    mode.value = st.hist.mode;
    var des = h('input', { type: 'date', value: st.hist.des });
    var fins = h('input', { type: 'date', value: st.hist.fins });
    var resultat = h('div', {});
    // Filtres: per defecte només els canvis de parche (els reemplaçaments). La resta, en activar-los.
    st.filtres = st.filtres || { canvis: true, sortides: false, avisos: false };
    var fC = casella('Cambios de parche', st.filtres.canvis), fS = casella('Salidas sin terminar', st.filtres.sortides),
      fA = casella('Pendientes y no realizados', st.filtres.avisos);
    var passaFiltre = function (x) {
      if (x.estat === 'completat') return st.filtres.canvis;
      if (x.estat === 'abandonat') return st.filtres.sortides;
      return st.filtres.avisos;
    };
    var totes = [];
    var pinta = function () {
      st.filtres = { canvis: fC.input.checked, sortides: fS.input.checked, avisos: fA.input.checked };
      var files = totes.filter(passaFiltre);
      st.histFiles = files;
      C.buida(resultat);
      var amagades = totes.length - files.length;
      if (amagades) resultat.appendChild(h('p', { class: 'ajuda' }, amagades + ' registro(s) ocultos por los filtros.'));
      if (!files.length) { resultat.appendChild(h('p', { class: 'suau' }, 'No hay registros que mostrar.')); return; }
      var taula = h('table', { class: 'taula' }, h('thead', {}, h('tr', {},
        ['Previsto', 'Hecho', 'Estado', 'Tipo', 'Anterior quitado', 'Zona', 'Foto', 'Lugar'].map(function (t) { return h('th', { scope: 'col' }, t); }))));
      var tbody = h('tbody', {});
      files.forEach(function (x) {
        tbody.appendChild(h('tr', {},
          h('td', { 'data-et': 'Previsto' }, x.dataProgramada ? dataHumana(x.dataProgramada) : '—'),
          h('td', { 'data-et': 'Hecho' }, x.fi ? dataHumana(x.fi) : '—'),
          h('td', { 'data-et': 'Estado' }, insignia(x)),
          h('td', { 'data-et': 'Tipo' }, x.tipus === 'caiguda' ? 'Parche caído' : x.tipus === 'inicial' ? 'Parche inicial (panel)' : x.tipus === 'sortida' ? 'Salida · ' + String(x.notes || '').replace(/^pas (\d+) de (\d+)/, 'paso $1 de $2').replace('pegat caigut', 'parche caído') : 'Programado'),
          h('td', { 'data-et': 'Anterior quitado' }, x.anteriorRetirat === 'si' ? 'Sí' : x.anteriorRetirat === 'no portava' ? '⚠️ No llevaba' : x.anteriorRetirat === 'caiguda' ? '(se cayó)' : '—'),
          h('td', { 'data-et': 'Zona' }, x.zona ? x.zona + ' · ' + x.nomZona : '—'),
          h('td', { 'data-et': 'Foto' }, x.teFoto ? boto('📷 Ver', function () { veuFoto(x); }, 'petit') : (x.senseFotoMotiu ? 'Sin foto: ' + x.senseFotoMotiu : '—')),
          h('td', { 'data-et': 'Lugar' }, enllacMapa(x))));
      });
      taula.appendChild(tbody);
      resultat.appendChild(h('div', { class: 'taula-scroll' }, taula));
    };
    var carrega = async function () {
      st.hist = { mode: mode.value, des: des.value, fins: fins.value };
      C.buida(resultat).appendChild(h('p', { class: 'carregant' }, 'Cargando…'));
      totes = await crida('apiHistorial', st.hist);
      pinta();
    };
    [fC, fS, fA].forEach(function (f) { f.input.onchange = pinta; });
    var bCarrega = boto('Ver', null, 'primari');
    bCarrega.onclick = ambEspera(bCarrega, carrega);
    var bImprimeix = boto('🖨 Imprimir diario', null, 'secundari');
    bImprimeix.onclick = ambEspera(bImprimeix, async function () { await carrega(); imprimeixDiari(); });
    cont.appendChild(h('section', { class: 'filtres' }, camp('Ver', mode), camp('Desde', des), camp('Hasta', fins), bCarrega, bImprimeix));
    cont.appendChild(h('fieldset', { class: 'filtres-tipus' }, h('legend', {}, 'Mostrar'), fC.el, fS.el, fA.el));
    cont.appendChild(resultat);
    await carrega();
  }

  /** Enllaç al mapa (OpenStreetMap) de la ubicació GPS del registre. */
  function enllacMapa(x) {
    var lat = Number(x.lat), lon = Number(x.lon);
    if (x.lat === '' || !isFinite(lat) || !isFinite(lon)) return '—';
    var url = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=18/' + lat + '/' + lon;
    return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, '📍 Mapa' + (x.precisioGps ? ' (±' + x.precisioGps + ' m)' : ''));
  }

  function imprimeixDiari() {
    var files = (st.histFiles || []).slice().reverse();
    var vell = document.getElementById('impressio'); if (vell) vell.remove();
    var taula = h('table', {}, h('thead', {}, h('tr', {}, ['Nº', '¿Se quitó el anterior?', 'Día de aplicación', 'Hora', 'Zona', 'Estado'].map(function (t) { return h('th', {}, t); }))));
    var tb = h('tbody', {});
    files.forEach(function (x, i) {
      var d = C.deClau(x.fi || x.dataProgramada);
      tb.appendChild(h('tr', {}, h('td', {}, String(i + 1)),
        h('td', {}, x.anteriorRetirat === 'si' ? '✓' : x.anteriorRetirat === 'no portava' ? 'No llevaba' : x.anteriorRetirat === 'caiguda' ? 'Se cayó' : ''),
        h('td', {}, d ? DIES[d.getDay() === 0 ? 7 : d.getDay()] + ' ' + C.dos(d.getDate()) + '/' + C.dos(d.getMonth() + 1) + '/' + d.getFullYear() : ''),
        h('td', {}, d ? C.dos(d.getHours()) + ':' + C.dos(d.getMinutes()) : ''),
        h('td', {}, x.zona || ''),
        h('td', {}, { completat: 'Hecho', 'no fet': 'No hecho', pendent: 'Pendiente', 'en curs': 'Empezado', abandonat: 'Salió sin terminar (' + String(x.notes || '').replace(/^pas (\d+) de (\d+).*/, 'paso $1 de $2') + ')' }[x.estat] || x.estat)));
    });
    taula.appendChild(tb);
    document.body.appendChild(h('section', { id: 'impressio' },
      h('h1', {}, 'Diario de aplicación del parche' + (st.hist.mode === 'DEMO' ? ' (prácticas)' : '')),
      h('p', {}, (st.cfg.config.nomUsuaria || '') + ' · del ' + st.hist.des.split('-').reverse().join('/') + ' al ' + st.hist.fins.split('-').reverse().join('/')),
      taula));
    window.print();
  }

  // ---------- Medicació ----------
  async function vistaMedicacio(cont) {
    var meds = st.cfg.medicaments;
    meds.forEach(function (m) { cont.appendChild(editorMedicament(m)); });
    cont.appendChild(editorFrases());
    cont.appendChild(boto('+ Añadir otro medicamento', function () {
      cont.insertBefore(editorMedicament({
        nom_es: '', nom_ca: '', actiu: true, dies: '1', hora: '10:00', margeAvisMin: 30, margeAlertaMin: 120,
        diesRepeticioZona: 0, maxDiesEntreCanvis: 0, zones: [],
        passos: [{ tipus: 'info', text_es: 'Tómese la medicación.', text_ca: 'Preneu-vos la medicació.' }]
      }), cont.lastChild);
    }, 'secundari'));
  }

  /** Text de l'app de la usuària (textos-app.js), per a les frases i les zones. */
  function textApp(idioma, clau, v) {
    var t = ((window.TEXTOS_APP || {})[idioma] || {})[clau] || '';
    return String(t).replace(/\{(\w+)\}/g, function (x, k) { return v && v[k] !== undefined ? v[k] : x; });
  }

  var FRASES = [
    ['practicaNoPosar', 'Aviso en la práctica (antes de cada paso de colocación)'],
    ['jaPot', 'Final del temporizador (después del bip)'],
    ['noPortavaConfirma', 'Pregunta si de verdad no llevaba parche'],
    ['sortirConfirma', 'Pregunta al salir sin terminar'],
    ['caigudaConfirma', 'Pregunta de «se me ha caído el parche»'],
    ['caigudaRetirada', 'Primer paso cuando se ha caído el parche']
  ];

  /** Gravacions de les frases fixes de l'app (comunes a tots els medicaments). */
  function editorFrases() {
    var actuals = st.cfg.config.audiosFrases || {};
    var f = { es: Object.assign({}, actuals.es), ca: Object.assign({}, actuals.ca) };
    var desa = boto('Guardar frases', null, 'primari');
    desa.onclick = ambEspera(desa, async function () {
      st.cfg = await crida('apiDesaFrases', { frases: f });
      avis('Guardado.');
      render();
    });
    var n = Object.keys(f.es).length + Object.keys(f.ca).length;
    return h('section', { class: 'targeta editor' },
      h('details', {}, h('summary', {}, 'Frases de la app (' + n + ' grabadas)'),
        h('p', { class: 'ajuda' }, 'Son frases que la app dice fuera de los pasos. Si no tienen grabación, las dice la voz del teléfono. La felicitación final siempre la dice el teléfono (cambia cada vez).'),
        h('div', { class: 'passos' }, FRASES.map(function (x) {
          var clau = x[0];
          var controls = function (idioma) {
            return controlsAudio({}, f[idioma], idioma, function () { return textApp(idioma, clau); },
              { clau: clau, nom: 'frase_' + clau + '_' + idioma, recorda: 'Grabación subida. Pulse «Guardar frases» para usarla.', recordaTreu: 'Pulse «Guardar frases» para quitarla.' });
          };
          return h('div', { class: 'pas' },
            h('div', { class: 'pas-cap' }, h('strong', {}, x[1])),
            h('div', { class: 'graella' },
              h('div', {}, h('p', {}, '«' + textApp('es', clau) + '»'), controls('es')),
              h('div', {}, h('p', {}, '«' + textApp('ca', clau) + '»'), controls('ca'))));
        })),
        h('div', { class: 'barra-accions' }, desa)));
  }

  function editorMedicament(original) {
    var m = JSON.parse(JSON.stringify(original));
    var caixa = h('section', { class: 'targeta editor' });
    var dibuixa = function () {
      C.buida(caixa);
      var nomEs = h('input', { type: 'text', value: m.nom_es || '' });
      var nomCa = h('input', { type: 'text', value: m.nom_ca || '' });
      var actiu = casella('Activo', m.actiu !== false);
      var dies = String(m.dies || '').split(',').map(Number);
      var caselles = [1, 2, 3, 4, 5, 6, 7].map(function (n) { return casella(DIES[n], dies.indexOf(n) > -1); });
      var hora = h('input', { type: 'time', value: m.hora || '10:00' });
      var avisMin = h('input', { type: 'number', min: '5', max: '720', value: m.margeAvisMin });
      var alertaMin = h('input', { type: 'number', min: '5', max: '1440', value: m.margeAlertaMin });
      var rep = h('input', { type: 'number', min: '0', max: '60', value: m.diesRepeticioZona || 0 });
      var maxD = h('input', { type: 'number', min: '0', max: '30', value: m.maxDiesEntreCanvis || 0 });

      caixa.appendChild(h('h2', {}, m.id ? (m.nom_es || m.nom_ca) : 'Nuevo medicamento'));
      caixa.appendChild(h('div', { class: 'graella' }, camp('Nombre (castellano)', nomEs), camp('Nom (català)', nomCa)));
      caixa.appendChild(actiu.el);
      caixa.appendChild(h('fieldset', {}, h('legend', {}, 'Días fijos de cambio'), h('div', { class: 'dies' }, caselles.map(function (c) { return c.el; }))));
      caixa.appendChild(h('div', { class: 'graella' },
        camp('Hora fija', hora),
        camp('Primer aviso si no se ha hecho (min)', avisMin),
        camp('Alerta fuerte (min)', alertaMin),
        camp('Días sin repetir zona', rep, '0 = sin regla'),
        camp('Máximo de días entre cambios', maxD, 'Avisa si los días elegidos se separan más. 0 = sin control')));

      // Zones
      if (m.zones && m.zones.length) {
        var tz = h('table', { class: 'taula compacta' }, h('thead', {}, h('tr', {}, ['Zona', 'Nombre (castellano)', 'Nom (català)', 'Activa'].map(function (t) { return h('th', {}, t); }))));
        var tbz = h('tbody', {});
        m.zones.forEach(function (z) {
          var ie = h('input', { type: 'text', value: z.nom_es || '' }); ie.oninput = function () { z.nom_es = ie.value; };
          var ic = h('input', { type: 'text', value: z.nom_ca || '' }); ic.oninput = function () { z.nom_ca = ic.value; };
          var ia = h('input', { type: 'checkbox', 'aria-label': 'Zona ' + z.codi + ' activa' }); ia.checked = z.activa !== false; ia.onchange = function () { z.activa = ia.checked; };
          tbz.appendChild(h('tr', {}, h('td', {}, h('strong', {}, z.codi)), h('td', {}, ie), h('td', {}, ic), h('td', {}, ia)));
          var textZona = function (idioma) {
            return function () { return textApp(idioma, 'zonaToca', { codi: z.codi, nom: (idioma === 'ca' ? z.nom_ca : z.nom_es) || z.nom_es || '' }); };
          };
          tbz.appendChild(h('tr', { class: 'fila-audio' }, h('td', {}),
            h('td', {}, controlsAudio(m, z, 'es', textZona('es'), { nom: (m.nom_es || 'med') + '_zona' + z.codi + '_es' })),
            h('td', {}, controlsAudio(m, z, 'ca', textZona('ca'), { nom: (m.nom_es || 'med') + '_zona' + z.codi + '_ca' })), h('td', {})));
        });
        tz.appendChild(tbz);
        caixa.appendChild(h('details', {}, h('summary', {}, 'Zonas del cuerpo (A–H)'),
          h('p', { class: 'ajuda' }, 'Compruebe que los nombres coinciden con el folleto. Si la usuaria no puede llegar a la espalda, desactive esas zonas (hacen falta al menos 5 activas para no repetir en 14 días).'),
          h('p', { class: 'ajuda' }, 'La app dice qué zona toca justo después del paso de la zona. Puede grabarlo por zona (por ejemplo «Hoy le toca la zona A, …»), o importarlo con «Importar grabaciones…» con archivos llamados Zona_A, Zona_B…'),
          h('div', { class: 'taula-scroll' }, tz)));
      }

      // Recull el que s'ha escrit abans de tornar a dibuixar (afegir, moure o treure passos).
      var recull = function () {
        m.nom_es = nomEs.value; m.nom_ca = nomCa.value; m.actiu = actiu.input.checked;
        m.dies = caselles.map(function (c, k) { return c.input.checked ? k + 1 : 0; }).filter(Boolean).join(',');
        m.hora = hora.value; m.margeAvisMin = +avisMin.value; m.margeAlertaMin = +alertaMin.value;
        m.diesRepeticioZona = +rep.value; m.maxDiesEntreCanvis = +maxD.value;
      };
      var redibuixa = function () { recull(); dibuixa(); var d = caixa.querySelector('details.passos-det'); if (d) d.open = true; };

      // Passos
      var llistaPassos = h('div', { class: 'passos' });
      m.passos.forEach(function (p, i) { llistaPassos.appendChild(editorPas(m, p, i, redibuixa)); });
      caixa.appendChild(h('details', { class: 'passos-det', open: !m.id }, h('summary', {}, 'Pasos que verá y oirá la usuaria (' + m.passos.length + ')'), llistaPassos,
        boto('+ Añadir paso', function () { m.passos.push({ tipus: 'info', text_es: '', text_ca: '' }); redibuixa(); }, 'secundari'),
        boto('📥 Importar grabaciones…', function () { importaGravacions(m, function () { recull(); desa.click(); }); }, 'secundari')));

      var desa = boto('Guardar cambios', null, 'primari');
      desa.onclick = ambEspera(desa, async function () {
        var dades = Object.assign({}, m, {
          nom_es: nomEs.value, nom_ca: nomCa.value, actiu: actiu.input.checked,
          dies: caselles.map(function (c, k) { return c.input.checked ? k + 1 : 0; }).filter(Boolean),
          hora: hora.value, margeAvisMin: +avisMin.value, margeAlertaMin: +alertaMin.value,
          diesRepeticioZona: +rep.value, maxDiesEntreCanvis: +maxD.value
        });
        var canviHorari = String(original.dies) !== dades.dies.join(',') || original.hora !== dades.hora;
        var r = await crida('apiDesaMedicament', dades);
        st.cfg = r;
        avis('Guardado.');
        var missatges = [];
        if ((r.avisos || []).indexOf('SEPARACIO') > -1) missatges.push('⚠️ Entre dos de los días elegidos hay más días que el máximo indicado.');
        if (canviHorari && m.id) missatges.push('📱 Ha cambiado los días o la hora: cambie también la alarma del iPhone. El nuevo horario cuenta a partir de ahora.');
        if (missatges.length) modal('Atención', h('div', {}, missatges.map(function (t) { return h('p', {}, t); })), [{ text: 'Entendido', classe: 'primari' }]);
        render();
      });
      caixa.appendChild(h('div', { class: 'barra-accions' }, desa));
    };
    dibuixa();
    return caixa;
  }

  function editorPas(m, p, i, redibuixa) {
    var tipus = h('select', {}, Object.keys(TIPUS_PAS).map(function (t) { return h('option', { value: t }, TIPUS_PAS[t]); }));
    tipus.value = p.tipus; tipus.onchange = function () { p.tipus = tipus.value; if (p.tipus === 'temporitzador' && !p.segons) p.segons = 15; redibuixa(); };
    var es = h('textarea', { rows: '3' }); es.value = p.text_es || ''; es.oninput = function () { p.text_es = es.value; };
    var ca = h('textarea', { rows: '3' }); ca.value = p.text_ca || ''; ca.oninput = function () { p.text_ca = ca.value; };
    var col = casella('Paso de colocación (en la práctica avisa de no ponerse nada)', p.colocacio);
    col.input.onchange = function () { p.colocacio = col.input.checked; };
    var segons = null;
    if (p.tipus === 'temporitzador') {
      segons = h('input', { type: 'number', min: '1', max: '600', value: p.segons || 15 });
      segons.oninput = function () { p.segons = +segons.value; };
    }
    var mou = function (d) { var j = i + d; if (j < 0 || j >= m.passos.length) return; var x = m.passos[i]; m.passos[i] = m.passos[j]; m.passos[j] = x; redibuixa(); };
    return h('div', { class: 'pas' },
      h('div', { class: 'pas-cap' }, h('strong', {}, 'Paso ' + (i + 1)), tipus,
        boto('↑', function () { mou(-1); }, 'petit', { 'aria-label': 'Subir paso' }),
        boto('↓', function () { mou(1); }, 'petit', { 'aria-label': 'Bajar paso' }),
        boto('✕', function () { if (confirm('¿Quitar el paso ' + (i + 1) + '?')) { m.passos.splice(i, 1); redibuixa(); } }, 'petit perill', { 'aria-label': 'Quitar paso' })),
      segons ? camp('Segundos', segons) : null,
      col.el,
      h('div', { class: 'graella' },
        h('div', {}, camp('Texto en castellano', es), controlsAudio(m, p, 'es', function () { return es.value; })),
        h('div', {}, camp('Text en català', ca), controlsAudio(m, p, 'ca', function () { return ca.value; }))));
  }

  // ---------- Àudio: provar la veu, gravar, pujar ----------
  // opc (opcional): { clau: propietat on va l'ID, nom: nom del fitxer a Drive, recorda: missatge després de pujar }
  function controlsAudio(m, p, idioma, text, opc) {
    opc = opc || {};
    var clau = opc.clau || 'audio_' + idioma;
    var estat = h('span', { class: 'ajuda' }, p[clau] ? '🎙 Con grabación propia' : 'Voz del teléfono');
    var cont = h('div', { class: 'audio' });
    var provaVeu = boto('▶ Probar voz', function () {
      if (!('speechSynthesis' in window)) { avis('Este navegador no tiene voz.', 'error'); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text()); u.lang = idioma === 'ca' ? 'ca-ES' : 'es-ES'; u.rate = 0.9;
      speechSynthesis.speak(u);
    }, 'petit');
    var grava = boto('🎙 Grabar', null, 'petit');
    var gravador = null, trossos = [];
    grava.onclick = async function () {
      if (gravador) { gravador.stop(); return; }
      if (!window.MediaRecorder) { avis('Este navegador no puede grabar. Use «Subir archivo».', 'error'); return; }
      try {
        var flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        var tipus = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
        gravador = new MediaRecorder(flux, tipus ? { mimeType: tipus } : undefined);
        trossos = [];
        gravador.ondataavailable = function (ev) { if (ev.data.size) trossos.push(ev.data); };
        gravador.onstop = async function () {
          flux.getTracks().forEach(function (t) { t.stop(); });
          var mime = gravador.mimeType || tipus || 'audio/mp4';
          gravador = null; grava.textContent = '🎙 Grabar';
          await pujaAudio(new Blob(trossos, { type: mime }), mime);
        };
        gravador.start();
        grava.textContent = '⏹ Parar';
        if (/webm/.test(gravador.mimeType || '')) avis('Este navegador graba en un formato que puede no sonar en el iPhone. Mejor grabe desde el iPhone (Safari).', 'error');
      } catch (e) { avis('No se ha podido usar el micrófono.', 'error'); }
    };
    var fitxer = h('input', { type: 'file', accept: 'audio/*', hidden: true });
    fitxer.onchange = function () { if (fitxer.files[0]) pujaAudio(fitxer.files[0], fitxer.files[0].type || 'audio/mp4'); };
    var puja = boto('📁 Subir archivo', function () { fitxer.click(); }, 'petit');
    var escolta = p[clau] ? boto('▶ Escuchar grabación', async function () {
      try { var d = await crida('apiAudio', { id: p[clau] }); new Audio('data:' + d.mime + ';base64,' + d.b64).play(); } catch (e) { errorA(e); }
    }, 'petit') : null;
    var treu = p[clau] ? boto('✕ Quitar grabación', function () { p[clau] = ''; refresca(); avis(opc.recordaTreu || 'Recuerde guardar los cambios.'); }, 'petit') : null;

    async function pujaAudio(blob, mime) {
      if (blob.size > 2 * 1024 * 1024) { avis('El audio es demasiado largo (máx. 2 MB).', 'error'); return; }
      var b64 = await llegeixB64(blob);
      try {
        var r = await crida('apiDesaAudio', { b64: b64, mime: mimeAudio(mime, blob.name), nom: opc.nom || (m.nom_es || 'med') + '_pas' + (p.id || '') + '_' + idioma });
        p[clau] = r.id; refresca(); avis(opc.recorda || 'Grabación subida. Pulse «Guardar cambios» para usarla.');
      } catch (e) { errorA(e); }
    }
    function refresca() { var nou = controlsAudio(m, p, idioma, text, opc); cont.replaceWith(nou); }
    cont.appendChild(h('div', { class: 'audio-botons' }, provaVeu, grava, puja, escolta, treu, fitxer));
    cont.appendChild(estat);
    return cont;
  }

  function llegeixB64(blob) {
    return new Promise(function (ok, ko) {
      var lector = new FileReader();
      lector.onload = function () { ok(String(lector.result).split(',')[1]); };
      lector.onerror = ko; lector.readAsDataURL(blob);
    });
  }

  /** Tipus d'àudio que l'iPhone reprodueix bé (els .m4a de Notas de voz es marquen com audio/mp4). */
  function mimeAudio(tipus, nom) {
    tipus = String(tipus || '').split(';')[0];
    if (/m4a|mp4|aac/i.test(tipus) || /\.(m4a|mp4|aac)$/i.test(nom || '')) return 'audio/mp4';
    if (/mpeg|mp3/i.test(tipus) || /\.mp3$/i.test(nom || '')) return 'audio/mpeg';
    return tipus || 'audio/mp4';
  }

  /** Zona d'un nom de fitxer: «Zona_A.m4a», «zona-b.mp3»… (només si el medicament té aquesta zona). */
  function zonaDeFitxer(nom, m) {
    var x = /zona[\s_-]*([a-h])(?![a-z])/i.exec(nom);
    return x ? (m.zones || []).filter(function (z) { return z.codi === x[1].toUpperCase(); })[0] || null : null;
  }

  /** Número de pas d'un nom de fitxer: «Paso_3.m4a», «pas 3», «03.m4a»… */
  function numeroDePas(nom) {
    var m = /(?:paso|pas|step)[\s_-]*0*(\d{1,2})/i.exec(nom) || /(?:^|\D)0*(\d{1,2})(?:\D*)\.\w+$/.exec(nom);
    return m ? Number(m[1]) : null;
  }

  /** Importar en bloc: tria idioma i fitxers, es relacionen amb els passos pel número i es desa tot. */
  function importaGravacions(m, enAcabar) {
    var idioma = h('select', {}, h('option', { value: 'es' }, 'Castellano'), h('option', { value: 'ca' }, 'Català'));
    var fitxers = h('input', { type: 'file', accept: 'audio/*,.m4a,.mp3', multiple: true });
    var previa = h('div', {});
    var relacions = [];
    fitxers.onchange = function () {
      relacions = Array.from(fitxers.files).map(function (f) {
        var zona = zonaDeFitxer(f.name, m);
        if (zona) return { fitxer: f, zona: zona, ordre: 100 + zona.codi.charCodeAt(0) };
        var n = numeroDePas(f.name);
        return { fitxer: f, pas: n && n <= m.passos.length ? n : null, ordre: n && n <= m.passos.length ? n : 999 };
      }).sort(function (a, b) { return a.ordre - b.ordre; });
      C.buida(previa).appendChild(h('ul', { class: 'llista' }, relacions.map(function (x) {
        var p = x.pas ? m.passos[x.pas - 1] : null;
        return h('li', {}, h('strong', {}, x.fitxer.name), ' → ',
          x.zona ? 'Zona ' + x.zona.codi + ' (' + (x.zona['nom_' + idioma.value] || x.zona.nom_es || '') + ')' :
          p ? 'Paso ' + x.pas + ': «' + String(p['text_' + idioma.value] || p.text_es || '').slice(0, 60) + '…»'
            : h('span', { class: 'error' }, 'no se sabe a qué paso va (el nombre debe llevar el número, p. ej. Paso_3, o la zona, p. ej. Zona_A)'),
          x.fitxer.size > 2 * 1024 * 1024 ? h('span', { class: 'error' }, ' · demasiado grande (máx. 2 MB)') : null);
      })));
    };
    idioma.onchange = function () { if (fitxers.files.length) fitxers.onchange(); };
    modal('Importar grabaciones', h('div', {},
      h('p', {}, 'Elija las grabaciones de los pasos (por ejemplo Paso_1.m4a … Paso_9.m4a) y, si quiere, de las zonas (Zona_A.m4a … Zona_H.m4a). Cada una va al paso con su número o a la zona con su letra.'),
      camp('Idioma de las grabaciones', idioma), camp('Archivos', fitxers), previa),
    [{ text: 'Cancelar' }, { text: 'Subir y guardar', classe: 'primari', accio: async function () {
      var bones = relacions.filter(function (x) { return (x.pas || x.zona) && x.fitxer.size <= 2 * 1024 * 1024; });
      if (!bones.length) { avis('No hay ninguna grabación que se pueda asignar a un paso o una zona.', 'error'); return false; }
      for (var i = 0; i < bones.length; i++) {
        avis('Subiendo ' + (i + 1) + ' de ' + bones.length + '…');
        var x = bones[i];
        var r = await crida('apiDesaAudio', { b64: await llegeixB64(x.fitxer), mime: mimeAudio(x.fitxer.type, x.fitxer.name),
          nom: (m.nom_es || 'med') + (x.zona ? '_zona' + x.zona.codi : '_pas' + x.pas) + '_' + idioma.value });
        (x.zona || m.passos[x.pas - 1])['audio_' + idioma.value] = r.id;
      }
      enAcabar();
    } }]);
  }

  // ---------- Persones ----------
  async function vistaPersones(cont) {
    var sups = st.cfg.supervisors;
    var cfg = st.cfg.config;
    cont.appendChild(h('p', { class: 'suau' }, 'Personas que reciben los avisos y pueden entrar en este panel.'));
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Enlace del panel para la familia'),
      blocEnllac(urlBase('panel.html'), 'Envíelo a las personas dadas de alta: lleva la dirección del servidor. Entrarán con su email y el código que reciban.')));
    sups.forEach(function (s) {
      var soc = st.jo && s.id === st.jo.id;
      var accions = [];
      if (soc || esAdmin()) {
        if (cfg.telegramConfigurat) accions.push(boto(s.teTelegram ? 'Volver a vincular Telegram' : 'Vincular Telegram', function () { vinculaTelegram(s); }, 'petit'));
        accions.push(boto('Enviar mensaje de prueba', async function () {
          try { var r = await crida('apiProvaMissatge', { id: s.id }); avis(r.enviats ? 'Enviado (' + r.enviats + ').' : 'No tiene ningún canal activo.', r.enviats ? 'ok' : 'error'); } catch (e) { errorA(e); }
        }, 'petit'));
      }
      if (esAdmin()) {
        accions.push(boto('Editar', function () { formSupervisor(s); }, 'petit'));
        accions.push(boto('Quitar', function () {
          modal('Quitar a ' + s.nom, h('p', {}, 'Dejará de recibir avisos y no podrá entrar en el panel.'),
            [{ text: 'Cancelar' }, { text: 'Quitar', classe: 'perill', accio: async function () { st.cfg = await crida('apiTreuSupervisor', { id: s.id }); avis('Quitado.'); render(); } }]);
        }, 'petit perill'));
      }
      cont.appendChild(h('section', { class: 'targeta persona' },
        h('h3', {}, s.nom + (soc ? ' (usted)' : '')),
        h('p', {}, s.correu + ' · ' + (s.rol === 'administrador' ? 'Administrador' : 'Supervisor')),
        h('p', {}, 'Avisos: ' + [s.perCorreu ? '✉️ email' : null, s.perTelegram ? (s.teTelegram ? '✈️ Telegram' : '✈️ Telegram (sin vincular)') : null].filter(Boolean).join(' + ') || 'ninguno'),
        h('div', { class: 'accions-fila' }, accions)));
    });
    if (!cfg.telegramConfigurat) cont.appendChild(h('p', { class: 'ajuda' }, 'Para recibir avisos por Telegram, un administrador debe configurar el bot en Ajustes.'));
    if (esAdmin()) cont.appendChild(boto('+ Añadir persona', function () { formSupervisor(null); }, 'primari'));
  }

  function formSupervisor(s) {
    s = s || { nom: '', correu: '', rol: 'supervisor', perCorreu: true, perTelegram: false };
    var nom = h('input', { type: 'text', value: s.nom });
    var correu = h('input', { type: 'email', value: s.correu });
    var rol = h('select', {}, h('option', { value: 'supervisor' }, 'Supervisor (ve y recibe avisos)'), h('option', { value: 'administrador' }, 'Administrador (también configura)'));
    rol.value = s.rol;
    var pc = casella('Avisos por email', s.perCorreu);
    var pt = casella('Avisos por Telegram', s.perTelegram);
    modal(s.id ? 'Editar persona' : 'Añadir persona', h('div', {}, camp('Nombre', nom), camp('Email (para entrar al panel)', correu), camp('Rol', rol), pc.el, pt.el),
      [{ text: 'Cancelar' }, { text: 'Guardar', classe: 'primari', accio: async function () {
        st.cfg = await crida('apiDesaSupervisor', { id: s.id, nom: nom.value, correu: correu.value, rol: rol.value, perCorreu: pc.input.checked, perTelegram: pt.input.checked });
        avis('Guardado.'); render();
      } }]);
  }

  async function vinculaTelegram(s) {
    var r = await crida('apiEnllacTelegram', { id: s.id });
    modal('Vincular Telegram', h('div', {},
      h('p', {}, '1. Abra este enlace en el teléfono de ' + s.nom + ' (con Telegram instalado) y pulse «Iniciar».'),
      h('p', {}, h('a', { href: r.enllac, target: '_blank', rel: 'noopener', class: 'enllac-gran' }, r.enllac)),
      h('p', {}, '2. Después pulse «Ya lo he hecho». El enlace vale 24 horas.')),
    [{ text: 'Cancelar' }, { text: 'Ya lo he hecho', classe: 'primari', accio: async function () {
      var x = await crida('apiComprovaTelegram', {});
      if (!x.vinculats) { avis('Todavía no ha llegado. Espere unos segundos y vuelva a probar.', 'error'); return false; }
      avis('Telegram vinculado.'); render();
    } }]);
  }

  // ---------- Telèfon ----------
  /** Codi QR (SVG) amb un text. Biblioteca qrcode-generator (MIT) a vendor/qrcode.js. */
  function qr(text) {
    var caixa = h('div', { class: 'qr', role: 'img', 'aria-label': 'Código QR: ' + text });
    if (typeof window.qrcode !== 'function') return caixa;
    var q = window.qrcode(0, 'M');
    q.addData(text); q.make();
    caixa.innerHTML = q.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
    return caixa;
  }

  async function copia(text, camp) {
    try { await navigator.clipboard.writeText(text); avis('Copiado.'); }
    catch (e) { if (camp) { camp.select(); document.execCommand('copy'); avis('Copiado.'); } }
  }

  var TIPUS_TEL = { usuaria: '👵 De la usuaria', suport: '🤝 De apoyo (siempre en práctica)' };

  async function vistaDispositiu(cont) {
    var urlApp = urlBase('index.html');
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Instalar la app en un iPhone'),
      blocEnllac(urlApp, 'Abra este enlace en Safari en el iPhone (o escanee el código con la cámara). Lleva la dirección de su servidor: no lo publique.'),
      h('ol', {},
        h('li', {}, 'Botón Compartir → «Añadir a pantalla de inicio».'),
        h('li', {}, 'Abra la app desde el icono (no desde Safari).'),
        h('li', {}, 'Escriba el código de vinculación de 6 cifras (aquí abajo).'),
        h('li', {}, 'En el teléfono de la usuaria: «Para la familia: alarma y voz», al pie de la app, para conectar la alarma del iPhone y elegir la voz.'))));

    var lliste = st.cfg.dispositius.map(function (d) {
      var accions = [];
      if (esAdmin()) {
        var tipus = h('select', { 'aria-label': 'Tipo de ' + d.nom },
          h('option', { value: 'usuaria' }, TIPUS_TEL.usuaria), h('option', { value: 'suport' }, TIPUS_TEL.suport));
        tipus.value = d.tipus;
        tipus.onchange = async function () {
          try { st.cfg = await crida('apiDesaDispositiu', { id: d.id, tipus: tipus.value }); avis('Guardado.'); render(); }
          catch (e) { errorA(e); tipus.value = d.tipus; }
        };
        accions.push(tipus);
        if (d.tipus === 'usuaria') accions.push(boto('Enlace para el atajo', function () { enllacAtall(d, urlApp); }, 'petit'));
        accions.push(boto('Desvincular', function () {
          modal('Desvincular ' + d.nom, h('p', {}, 'Ese teléfono dejará de funcionar hasta que se vuelva a vincular con un código nuevo.'),
            [{ text: 'Cancelar' }, { text: 'Desvincular', classe: 'perill', accio: async function () { st.cfg = await crida('apiDesvinculaDispositiu', { id: d.id }); avis('Desvinculado.'); render(); } }]);
        }, 'petit perill'));
      }
      return h('li', { class: 'telefon' }, h('strong', {}, d.nom), ' · ', esAdmin() ? null : TIPUS_TEL[d.tipus] + ' · ',
        'vinculado ' + dataHumana(d.creat) + ' · última conexión ' + dataHumana(d.darreraConnexio),
        h('div', { class: 'accions-fila' }, accions));
    });
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Teléfonos vinculados'),
      h('p', { class: 'ajuda' }, 'Los de la usuaria siguen el modo del sistema (práctica o activo). Los de apoyo están siempre en práctica: sirven para acompañarla por teléfono viendo los mismos pasos y en cuál está ella.'),
      lliste.length ? h('ul', { class: 'llista' }, lliste) : h('p', { class: 'suau' }, 'Ningún teléfono vinculado todavía.')));

    var nom = h('input', { type: 'text', value: esAdmin() ? 'iPhone de la usuaria' : 'iPhone de ' + (st.jo ? st.jo.nom : '') });
    var tipusNou = h('select', {}, h('option', { value: 'usuaria' }, TIPUS_TEL.usuaria), h('option', { value: 'suport' }, TIPUS_TEL.suport));
    tipusNou.onchange = function () { if (tipusNou.value === 'suport' && nom.value === 'iPhone de la usuaria') nom.value = 'iPhone de ' + (st.jo ? st.jo.nom : ''); };
    var codiCaixa = h('div', {});
    var genera = boto('Generar código de vinculación', null, 'primari');
    genera.onclick = ambEspera(genera, async function () {
      var r = await crida('apiCodiVinculacio', { nom: nom.value, tipus: esAdmin() ? tipusNou.value : 'suport' });
      var fi = Date.now() + r.minuts * 60000;
      var compte = h('p', { class: 'suau' });
      C.buida(codiCaixa).appendChild(h('div', { class: 'codi-vinculacio' }, r.codi.slice(0, 3) + ' ' + r.codi.slice(3)));
      codiCaixa.appendChild(h('p', { class: 'centrat' }, TIPUS_TEL[r.tipus]));
      codiCaixa.appendChild(compte);
      var t = setInterval(function () {
        var x = Math.max(0, Math.round((fi - Date.now()) / 1000));
        compte.textContent = x ? 'Escríbalo en la app. Caduca en ' + Math.floor(x / 60) + ':' + C.dos(x % 60) : 'Caducado. Genere otro.';
        if (!x || !document.body.contains(compte)) clearInterval(t);
      }, 1000);
    });
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Vincular un teléfono'),
      esAdmin() ? camp('Tipo', tipusNou) : h('p', { class: 'ajuda' }, 'Puede vincular su propio teléfono como teléfono de apoyo (siempre en práctica). El teléfono de la usuaria lo vincula un administrador.'),
      camp('Nombre del teléfono', nom), genera, codiCaixa));
  }

  async function enllacAtall(d, urlApp) {
    try {
      var r = await crida('apiEnllacDispositiu', { id: d.id });
      var enllac = urlApp + '#t=' + r.testimoni; // urlApp ja porta ?s=…
      var camp2 = h('textarea', { rows: '4', readonly: true }); camp2.value = enllac;
      modal('Enlace para el atajo del iPhone', h('div', {},
        h('p', {}, 'Normalmente no hace falta: en el iPhone de la usuaria, «Para la familia: alarma y voz» copia este enlace directamente. Úselo solo si lo prepara desde otro aparato.'),
        camp2,
        h('p', { class: 'ajuda' }, 'No lo comparta: quien lo tenga puede registrar cambios en nombre del teléfono. Si se pierde, desvincule el teléfono y vuelva a vincularlo.')),
      [{ text: 'Copiar', classe: 'primari', accio: async function () { await copia(enllac, camp2); return false; } }, { text: 'Cerrar' }]);
    } catch (e) { errorA(e); }
  }

  // ---------- Ajustos ----------
  async function vistaAjustos(cont) {
    var c = st.cfg.config;
    var idioma = h('select', {}, h('option', { value: 'es' }, 'Castellano'), h('option', { value: 'ca' }, 'Català')); idioma.value = c.idioma;
    var idiomaAvisos = h('select', {}, h('option', { value: 'es' }, 'Castellano'), h('option', { value: 'ca' }, 'Català')); idiomaAvisos.value = c.idiomaAvisos || 'es';
    var nom = h('input', { type: 'text', value: c.nomUsuaria || '', placeholder: 'Ej.: Mamá, María…' });
    var practiques = casella('Avisar también de las prácticas', c.notificarPractiques === 'si');
    var gps = casella('Guardar la ubicación (GPS) donde se pone el parche', c.guardaUbicacio);
    var url = h('input', { type: 'url', value: c.urlPanel || urlBase('panel.html') });
    var token = h('input', { type: 'password', autocomplete: 'off', placeholder: c.telegramConfigurat ? 'Configurado (@' + c.telegramBot + '). Déjelo vacío para no cambiarlo.' : '123456789:AA…' });
    var desa = boto('Guardar ajustes', null, 'primari');
    desa.onclick = ambEspera(desa, async function () {
      var dades = { idioma: idioma.value, idiomaAvisos: idiomaAvisos.value, nomUsuaria: nom.value, notificarPractiques: practiques.input.checked, guardaUbicacio: gps.input.checked, urlPanel: url.value };
      if (token.value.trim()) dades.telegramToken = token.value.trim();
      st.cfg = await crida('apiDesaConfig', dades);
      avis('Ajustes guardados.'); render();
    });
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'General'),
      camp('Idioma del teléfono de la usuaria (por defecto)', idioma, 'Textos y voz de la app. La usuaria también puede cambiarlo desde la app.'),
      camp('Idioma de los avisos a la familia', idiomaAvisos),
      camp('Cómo llamarla en los avisos', nom),
      practiques.el,
      gps.el,
      h('span', { class: 'ajuda' }, 'El iPhone pedirá permiso de ubicación la primera vez. La ubicación solo se ve en el Historial (enlace al mapa).'),
      camp('Dirección de este panel', url, 'Se incluye en los emails con el código de acceso.')));
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Bot de Telegram'),
      h('ol', { class: 'ajuda' },
        h('li', {}, 'En Telegram, hable con @BotFather y envíe /newbot.'),
        h('li', {}, 'Elija un nombre y un usuario acabado en «bot».'),
        h('li', {}, 'Copie aquí el código (token) que le da BotFather y guarde.')),
      camp('Token del bot', token),
      c.telegramConfigurat ? boto('Quitar el bot', function () {
        modal('Quitar el bot', h('p', {}, 'Dejarán de llegar avisos por Telegram.'), [{ text: 'Cancelar' }, { text: 'Quitar', classe: 'perill', accio: async function () {
          st.cfg = await crida('apiDesaConfig', { telegramToken: '' }); avis('Bot quitado.'); render();
        } }]);
      }, 'petit perill') : null));
    cont.appendChild(h('div', { class: 'barra-accions' }, desa));
    var srv = C.servidor();
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Servidor'),
      h('p', {}, 'Este navegador usa el servidor …' + (srv ? srv.id.slice(-10) : '') + (srv && srv.d ? ' (' + srv.d + ')' : '') + '. La dirección no está en la web pública: viaja en los enlaces que se reparten.'),
      boto('Usar otro servidor en este navegador', function () {
        modal('Cambiar de servidor', h('p', {}, 'Se olvidará la dirección guardada y tendrá que abrir otro enlace o pegar otra dirección. Su sesión en este servidor seguirá guardada.'),
          [{ text: 'Cancelar' }, { text: 'Cambiar', classe: 'perill', accio: function () { C.magatzem.del('meda_servidor'); location.replace(location.pathname); } }]);
      }, 'petit')));
    cont.appendChild(h('p', { class: 'suau' }, 'Versión ' + c.versio + ' · entorno ' + c.entorn));
  }

  // ---------- Còpies de seguretat ----------
  var MOTIUS = { manual: 'Manual', 'abans d\'importar': 'Antes de restaurar', 'abans de migrar': 'Antes de migrar',
    'abans d\'esborrar l\'historial': 'Antes de borrar el historial' };

  async function vistaCopies(cont) {
    var fes = boto('Hacer una copia ahora', null, 'primari');
    fes.onclick = ambEspera(fes, async function () {
      var r = await crida('apiFesCopia', {});
      avis('Copia hecha: ' + r.nom); render();
    });
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Copias de seguridad'),
      h('p', {}, 'Guarda la medicación, el historial, los ajustes, las personas y los teléfonos en una Hoja nueva de Drive (carpeta «Còpies medicació»).'),
      h('p', { class: 'ajuda' }, 'Las fotos y las grabaciones no se duplican: siguen en sus carpetas de Drive. Las copias contienen datos de salud: no las comparta. No se borra ninguna automáticamente.'),
      fes));
    cont.appendChild(targetaEsborrat());
    var copies = await crida('apiCopies', {});
    if (!copies.length) { cont.appendChild(h('p', { class: 'suau' }, 'Todavía no hay ninguna copia.')); return; }
    var taula = h('table', { class: 'taula' }, h('thead', {}, h('tr', {},
      ['Fecha', 'Motivo', 'Quién', 'Versión', 'Registros', ''].map(function (t) { return h('th', { scope: 'col' }, t); }))));
    var tb = h('tbody', {});
    copies.forEach(function (c) {
      tb.appendChild(h('tr', {},
        h('td', { 'data-et': 'Fecha' }, dataHumana(c.data)),
        h('td', { 'data-et': 'Motivo' }, MOTIUS[c.motiu] || c.motiu),
        h('td', { 'data-et': 'Quién' }, c.autor || '—'),
        h('td', { 'data-et': 'Versión' }, c.versio + ' (esquema ' + c.esquema + ')'),
        h('td', { 'data-et': 'Registros' }, String((c.files || {}).Registre || 0)),
        h('td', { 'data-et': '' }, boto('Restaurar…', function () { restaura(c); }, 'petit'))));
    });
    taula.appendChild(tb);
    cont.appendChild(h('section', { class: 'targeta' }, h('h2', {}, 'Copias guardadas'), h('div', { class: 'taula-scroll' }, taula)));
  }

  /** Empezar de cero: borrar las prácticas o todo el historial (con copia previa, frase y 60 s). */
  function targetaEsborrat() {
    var abast = h('select', {}, h('option', { value: 'practiques' }, 'Solo las prácticas'), h('option', { value: 'tot' }, 'Todo el historial (reales y prácticas)'));
    var fotos = casella('Mover también sus fotos a la papelera de Drive', true);
    var prepara = boto('Preparar el borrado…', null, 'perill');
    prepara.onclick = ambEspera(prepara, async function () {
      var r = await crida('apiPreparaEsborrat', { abast: abast.value, fotos: fotos.input.checked });
      var frase = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'characters' });
      var compte = h('p', { class: 'suau' });
      var fi = Date.now() + r.segons * 1000;
      var t = setInterval(function () {
        var x = Math.max(0, Math.round((fi - Date.now()) / 1000));
        compte.textContent = x ? 'Tiene ' + x + ' segundos para confirmar.' : 'Ha caducado: cierre y vuelva a empezar.';
        if (!x || !document.body.contains(compte)) clearInterval(t);
      }, 500);
      modal('Borrar el historial', h('div', {},
        h('p', {}, 'Se borrarán ' + r.registres + ' registros (' + r.reals + ' reales y ' + r.practiques + ' prácticas)' +
          (r.fotos ? ' y ' + r.ambFoto + ' fotos irán a la papelera de Drive (30 días para recuperarlas).' : '. Las fotos se quedan en Drive.')),
        h('p', {}, 'Antes se hará una copia de seguridad automática: desde «Copias guardadas» se puede volver atrás. Las personas, los teléfonos, la medicación y el registro de cambios no se tocan.'),
        camp('Para confirmar, escriba: ' + r.frase, frase), compte),
      [{ text: 'Cancelar' }, { text: 'Borrar', classe: 'perill', accio: async function () {
        var x = await crida('apiEsborraHistorial', { testimoni: r.testimoni, frase: frase.value });
        avis(x.esborrats + ' registros borrados. Copia previa: ' + x.previa); render();
      } }]);
    });
    return h('section', { class: 'targeta perill-zona' }, h('h2', {}, '🧹 Empezar de cero (borrar historial)'),
      h('p', {}, 'Para pasar a producción después de las pruebas. Borra los cambios registrados; no toca la configuración.'),
      camp('Qué borrar', abast), fotos.el, prepara);
  }

  async function restaura(copia) {
    var r;
    try { r = await crida('apiPreparaImportacio', { id: copia.id }); }
    catch (e) {
      modal('No se puede restaurar esta copia', h('p', { class: 'error' }, e.message), [{ text: 'Entendido', classe: 'primari' }]);
      return;
    }
    var s = r.resum;
    var NOMS = { Medicaments: 'Medicación', Registre: 'Historial de cambios', Config: 'Ajustes (sin bot ni carpetas)' };
    var frase = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'characters' });
    var compte = h('p', { class: 'suau' });
    var fi = Date.now() + r.segons * 1000;
    var t = setInterval(function () {
      var x = Math.max(0, Math.round((fi - Date.now()) / 1000));
      compte.textContent = x ? 'Tiene ' + x + ' segundos para confirmar.' : 'Ha caducado: cierre y vuelva a empezar.';
      if (!x || !document.body.contains(compte)) clearInterval(t);
    }, 500);
    modal('Restaurar la copia', h('div', {},
      h('p', {}, 'Copia del ' + dataHumana(s.dataCopia) + (s.autorCopia ? ' (' + s.autorCopia + ')' : '') + ': versión ' + s.versioCopia + ', esquema ' + s.esquemaCopia + '.'),
      h('p', {}, 'Ahora: versión ' + s.versioActual + ', esquema ' + s.esquemaActual + '. ' +
        (s.accio === 'directa' ? 'Se importará directamente.' : 'Se importará y se migrará del esquema ' + s.esquemaCopia + ' al ' + s.esquemaActual + '.')),
      h('ul', {}, s.fulls.map(function (f) {
        return h('li', {}, (NOMS[f.nom] || f.nom) + ': ahora ' + f.filesAra + ' filas → quedarán ' + f.filesCopia + '.');
      })),
      h('p', {}, 'Se conservan las personas, los teléfonos vinculados y el registro de cambios. Antes se hará una copia automática del estado actual.'),
      camp('Para confirmar, escriba: ' + r.frase, frase), compte),
    [{ text: 'Cancelar' }, { text: 'Restaurar', classe: 'perill', accio: async function () {
      var x = await crida('apiImporta', { id: copia.id, testimoni: r.testimoni, frase: frase.value });
      avis('Copia restaurada. Copia previa: ' + x.previa); render();
    } }]);
  }

  // ---------- Registre ----------
  async function vistaRegistre(cont) {
    var files = await crida('apiAuditoria', {});
    var taula = h('table', { class: 'taula' }, h('thead', {}, h('tr', {}, ['Fecha', 'Quién', 'Qué', 'Detalle'].map(function (t) { return h('th', {}, t); }))));
    var tb = h('tbody', {});
    files.forEach(function (a) {
      tb.appendChild(h('tr', {}, h('td', { 'data-et': 'Fecha' }, a.data), h('td', { 'data-et': 'Quién' }, a.qui), h('td', { 'data-et': 'Qué' }, a.accio), h('td', { 'data-et': 'Detalle' }, a.detall)));
    });
    taula.appendChild(tb);
    cont.appendChild(h('div', { class: 'taula-scroll' }, taula));
  }

  window.addEventListener('afterprint', function () { var x = document.getElementById('impressio'); if (x) x.remove(); });
  render();
})();
