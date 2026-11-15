/**
 * 96_Historial.gs — Medicació assistida
 *
 * Historial de versions per a la pantalla del backend.
 * FITXER GENERAT a partir de CANVIS.md: no s'edita a mà.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.5.2 · 2026-11-15
 */

/** @type {Array<{versio: string, data: string, resum: string, migracio: string, canvis: Object<string, string[]>}>} */
const HISTORIAL = [
  {
    "versio": "0.5.2",
    "data": "2026-11-15",
    "resum": "Fitxer LICENSE perquè GitHub reconegui la llicència EUPL-1.2.",
    "migracio": "No (esquema 2)",
    "canvis": {
      "Afegit": [
        "LICENSE amb el text oficial de l'EUPL-1.2 (el mateix que LLICENCIA.txt, sense la nota inicial)."
      ]
    }
  },
  {
    "versio": "0.5.1",
    "data": "2026-11-15",
    "resum": "Projecte publicat a GitHub amb la web desplegada automàticament a GitHub Pages i proves automàtiques.",
    "migracio": "No (esquema 2)",
    "canvis": {
      "Afegit": [
        "[intern] Flux de GitHub Actions que publica la carpeta web/ a GitHub Pages a cada canvi.",
        "[intern] Flux de GitHub Actions que executa les proves de seguretat i de lògica.",
        "Adreces de la web publicada al README i al manual."
      ]
    }
  },
  {
    "versio": "0.5.0",
    "data": "2026-11-15",
    "resum": "Telèfons de suport sempre en pràctica, seguiment en directe, enllaç i QR de l'app, i instruccions de l'alarma dins de l'app.",
    "migracio": "Sí (migra_1_a_2, esquema 1 → 2)",
    "canvis": {
      "Afegit": [
        "Telèfons de suport: sempre en pràctica, per acompanyar la usuària per telèfon; les seves pràctiques no s'avisen.",
        "Seguiment en directe: el telèfon de la usuària diu per quin pas va; es veu a «Ahora mismo» del panell i al telèfon de suport, amb el botó «Ir a ese paso».",
        "Pestanya «Teléfonos» per a tothom: enllaç de l'app i codi QR per instal·lar-la; els supervisors poden vincular el seu telèfon com a telèfon de suport.",
        "Pantalla «Instrucciones de la alarma» a l'app de la usuària, amb l'horari i el botó per copiar l'enllaç per a Dreceres/Atajos.",
        "[intern] Biblioteca qrcode-generator (MIT) a web/vendor/."
      ],
      "Canviat": [
        "Els administradors trien el tipus de cada telèfon (de la usuària o de suport) i el poden canviar.",
        "[intern] Columna tipus al full Dispositius (esquema 2).",
        "Autoria de l'eina genera-historial.js: xjav-dev; ja es pot publicar (fora del .gitignore)."
      ]
    }
  },
  {
    "versio": "0.4.0",
    "data": "2026-11-15",
    "resum": "Preparada per publicar: autoria de xjav-dev, text oficial de la llicència, README i avís d'ús.",
    "migracio": "No (esquema 1; nova clau de Config «avisosAcceptats»)",
    "canvis": {
      "Afegit": [
        "Avís d'ús (AVISO.md, en castellà i català): no és un producte sanitari, els avisos poden fallar, responsabilitat de qui instal·la.",
        "El panell mostra l'avís el primer cop i cal acceptar-lo; queda a l'auditoria. Enllaç «Aviso de uso» al peu.",
        "README.md i .gitignore per publicar el projecte a GitHub."
      ],
      "Canviat": [
        "Autoria i copyright: xjav-dev (projecte personal) a totes les capçaleres.",
        "LLICENCIA.txt amb el text oficial complet de l'EUPL-1.2."
      ]
    }
  },
  {
    "versio": "0.3.0",
    "data": "2026-11-15",
    "resum": "Còpies de seguretat de les dades i restauració des del panell.",
    "migracio": "No (esquema 1)",
    "canvis": {
      "Afegit": [
        "Pestanya «Copias» del panell (administradors): fer una còpia ara, llista de còpies i restaurar-ne una.",
        "La restauració comprova aplicació, entorn, esquema i integritat abans de tocar res, demana escriure «MEDICACIÓ ASSISTIDA IMPORTA» amb un testimoni de 60 s i fa abans una còpia automàtica.",
        "Carpeta «Còpies medicació» creada a la instal·lació."
      ],
      "Canviat": [
        "Missatges d'error habituals del panell en castellà.",
        "[intern] Constant VERSIO_ESQUEMA i permís per crear fulls de càlcul (spreadsheets) en lloc de només el full actual."
      ]
    }
  },
  {
    "versio": "0.2.0",
    "data": "2026-11-15",
    "resum": "Sense nom comercial del medicament, il·lustració amable d'una sola zona i felicitacions variades amb ratxa.",
    "migracio": "No (esquema 1)",
    "canvis": {
      "Afegit": [
        "Felicitació diferent a cada canvi (no es repeteix la darrera), confeti i fites de canvis seguits (3, 5, 10, 20, 30, 50, 100).",
        "Ratxa de canvis seguits sense fallar a la pantalla d'inici i en acabar."
      ],
      "Canviat": [
        "El dibuix de la zona mostra només la vista que toca (de davant o d'esquena) amb el pegat dibuixat a la zona; il·lustració nova, més amable.",
        "Cap referència al nom comercial del medicament: el medicament per defecte es diu «Parche» / «Pegat» i els missatges són genèrics."
      ]
    }
  },
  {
    "versio": "0.1.0",
    "data": "2026-11-15",
    "resum": "Primera versió de desenvolupament: app del iPhone, panell de supervisors i avisos.",
    "migracio": "No (instal·lació inicial, esquema 1)",
    "canvis": {
      "Afegit": [
        "App de la usuària instal·lable al iPhone: assistent pas a pas en castellà o català, amb veu, temporitzadors, zona proposada i foto en directe.",
        "Confirmació obligatòria de la retirada del pegat anterior i botó «Se m'ha caigut el pegat».",
        "Mode pràctica (DEMO) que desapareix en passar a ACTIU.",
        "Panell de supervisors amb accés per codi: inici, historial amb fotos, impressió del diari, medicació i passos, àudios gravats, persones, dispositiu, ajustos i auditoria.",
        "Avisos per Telegram i correu: canvi fet, pendent, alerta i no realitzat.",
        "Cua sense connexió a l'app.",
        "Enllaç per a la drecera de l'iPhone (Atajos obre l'app ja vinculada en parar l'alarma)."
      ]
    }
  }
];
