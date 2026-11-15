/**
 * 85_Registre.gs — Medicació assistida
 *
 * Registre d'auditoria (qui canvia què) i d'errors.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */

function anotaAuditoria_(qui, accio, detall) {
  try {
    ambBloqueig_(function () {
      afegeixFila_('Auditoria', { data: araText_(), qui: qui || '', accio: accio, detall: String(detall || '').slice(0, 2000) });
    });
  } catch (e) { console.error('auditoria: ' + e); }
}

function anotaError_(operacio, e) {
  console.error(operacio + ': ' + (e && e.stack || e));
  try {
    ambBloqueig_(function () {
      afegeixFila_('Errors', {
        data: araText_(), operacio: operacio, missatge: String(e && e.message || e).slice(0, 500),
        pila: String(e && e.stack || '').slice(0, 1500)
      });
    });
  } catch (x) { console.error('registre d\'errors: ' + x); }
}
