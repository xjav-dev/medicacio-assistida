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
 * Versió: 0.9.1 · 2026-11-16
 */

/** @type {Array<{versio: string, data: string, resum: string, migracio: string, canvis: Object<string, string[]>}>} */
const HISTORIAL = [
  {
    "versio": "0.9.1",
    "data": "2026-11-16",
    "resum": "Es retiren de la web pública les gravacions dels passos de la 0.9.0.",
    "migracio": "No (esquema 3)",
    "canvis": {
      "Eliminat": [
        "Gravacions de web/audios/es/ i el seu ús com a veu per defecte. Eren veu sintètica d'un servei les condicions del qual no permeten repartir l'àudio com a fitxer solt; també s'han tret de l'historial del repositori. Les gravacions es pugen al Drive de cada família des del panell (Pasos → «Importar grabaciones…»)."
      ]
    }
  },
  {
    "versio": "0.9.0",
    "data": "2026-11-16",
    "resum": "Els passos per defecte tenen veu gravada en castellà inclosa a la web.",
    "migracio": "No (esquema 3)",
    "canvis": {
      "Afegit": [
        "Gravacions dels 9 passos per defecte en castellà a web/audios/es/. Si un pas no té gravació pròpia i el seu text és el per defecte, l'app fa servir la de la web (en canviar el text, torna a la veu del telèfon). Les gravacions pròpies del panell tenen prioritat."
      ],
      "Corregit": [
        "En el pas de la zona amb gravació, la veu del telèfon diu la zona en acabar l'àudio (abans no es deia)."
      ]
    }
  },
  {
    "versio": "0.8.0",
    "data": "2026-11-16",
    "resum": "Bip en acabar els cronòmetres, ubicació GPS del pegat, canvi d'idioma des de l'app i importació en bloc de les gravacions dels passos.",
    "migracio": "Sí (migra_2_a_3, esquema 2 → 3: columnes lat, lon i precisioGps a Registre)",
    "canvis": {
      "Afegit": [
        "Bip suau (dues notes curtes) en acabar els temporitzadors de 15 i 30 s, abans de la veu.",
        "Ubicació GPS on es posa el pegat: es demana en començar el canvi i es desa en acabar (latitud, longitud i precisió). A l'historial del panell, columna «Lugar» amb enllaç al mapa. Es pot desactivar a Ajustes («Guardar la ubicación…»). Mai als telèfons de suport.",
        "Botons «Castellano / Català» a l'inici de l'app: la usuaria pot canviar l'idioma (es desa al telèfon; l'idioma de l'administrador queda com a valor per defecte).",
        "Panell → Medicación → Pasos: «📥 Importar grabaciones…» puja diversos àudios de cop i els assigna al pas pel nom del fitxer (Paso_1, pas-2, step3…)."
      ],
      "Canviat": [
        "Els àudios .m4a s'accepten amb el tipus audio/mp4 (el que reprodueix l'iPhone)."
      ]
    }
  },
  {
    "versio": "0.7.0",
    "data": "2026-11-15",
    "resum": "Les sortides sense acabar queden a l'historial, filtres a l'historial, esborrat de l'historial per passar a producció, tria de veu, zones viables a la vista i menú a la Hoja.",
    "migracio": "No (esquema 2; nous valors tipus «sortida» i estat «abandonat» a Registre)",
    "canvis": {
      "Afegit": [
        "Sortir de l'assistent sense acabar queda a l'historial (pas on es va sortir) i, en ús real, s'avisa la família. Es desa a la cua si no hi ha connexió.",
        "Filtres de l'historial del panell: per defecte només els canvis de pegat; «Salidas sin terminar» i «Pendientes y no realizados» en activar-los. La impressió del diari segueix els filtres.",
        "«Empezar de cero» (Copias): esborrar les pràctiques o tot l'historial, amb còpia prèvia, frase «MEDICACIÓ ASSISTIDA REINICIALITZA», testimoni de 60 s, fotos a la paperera de Drive (opcional) i auditoria.",
        "Pas de la zona: «Zonas posibles hoy» i, en triar-ne una altra, les viables separades de les usades fa poc (amb la data d'ús i la data en què tornen a estar lliures).",
        "Pantalla «Para la familia: alarma y voz» de l'app: tria de veu i velocitat del telèfon, amb prova.",
        "Menú «Medicación asistida» a la Hoja: instal·lar o actualitzar, còpia de seguretat, adreça de l'aplicació web i passar a producció."
      ],
      "Canviat": [
        "En pràctica, la zona proposada té en compte les pràctiques anteriors (en real, només els canvis reals).",
        "La veu del telèfon es tria per qualitat (premium, millorada, d'Espanya) i es pot fixar per telèfon."
      ]
    }
  },
  {
    "versio": "0.6.0",
    "data": "2026-11-15",
    "resum": "L'adreça del servidor ja no és a la web pública: viatja en els enllaços i QR que reparteix la família i es desa a cada dispositiu.",
    "migracio": "No (esquema 2)",
    "canvis": {
      "Afegit": [
        "Enllaços amb el servidor (?s=…): el de l'app i el seu QR (Teléfonos), el del panell per a la família amb QR (Personas), el de la drecera i el dels correus.",
        "Pantalla inicial del panell per enganxar l'adreça /exec la primera vegada; opció «Usar otro servidor» a Ajustes.",
        "A l'app, si no hi ha servidor: «Abra el enlace o escanee el código QR» i opció per enganxar l'enllaç.",
        "Compatibilitat amb comptes de Google Workspace (adreces /a/macros/domini/…)."
      ],
      "Canviat": [
        "config.js queda buit per defecte (es pot fixar una adreça si es vol).",
        "Les dades desades al dispositiu (sessió, estat, cua) van separades per servidor.",
        "El manifest ja no fixa start_url: la icona de la pantalla d'inici conserva l'enllaç amb el servidor."
      ],
      "Seguretat": [
        "Només s'accepten adreces de script.google.com: un enllaç no pot enviar les dades a un altre lloc."
      ]
    }
  },
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
