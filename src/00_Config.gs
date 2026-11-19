/**
 * 00_Config.gs — Medicació assistida
 *
 * Constants de l'aplicació: versió, esquema de dades i definició dels fulls.
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.12.0 · 2026-11-19
 */

var VERSIO = '0.12.0';
var CODI_APP = 'MEDA';
var NOM_APP = 'Medicació assistida';
/** Versió de l'esquema de dades (columnes dels fulls). Canvia només amb una migració. */
var VERSIO_ESQUEMA = 3;

/** Fulls de la base de dades i les seves capçaleres (l'ordre no importa: es llegeix per nom). */
var FULLS_ = {
  Config: ['clau', 'valor'],
  Supervisors: ['id', 'nom', 'correu', 'rol', 'perCorreu', 'perTelegram', 'telegramChat', 'actiu', 'versio', 'creat'],
  Dispositius: ['id', 'nom', 'tipus', 'actiu', 'versio', 'creat', 'darreraConnexio'],
  Medicaments: ['id', 'nom_es', 'nom_ca', 'actiu', 'dies', 'hora', 'margeAvisMin', 'margeAlertaMin',
    'diesRepeticioZona', 'maxDiesEntreCanvis', 'passos', 'zones', 'vigentDes', 'creat'],
  Registre: ['id', 'medicament', 'mode', 'tipus', 'dataProgramada', 'inici', 'fi', 'estat', 'anteriorRetirat',
    'zona', 'fotoId', 'senseFotoMotiu', 'dispositiu', 'avisat', 'alertat', 'idClient', 'notes', 'lat', 'lon', 'precisioGps'],
  Auditoria: ['data', 'qui', 'accio', 'detall'],
  Errors: ['data', 'operacio', 'missatge', 'pila']
};

/** Valors per defecte de la pestanya Config. */
var CONFIG_DEFECTE_ = {
  esquema: String(VERSIO_ESQUEMA),
  estat: 'DEMO',              // DEMO | ACTIU
  dataInici: '',              // AAAA-MM-DD HH:MM a partir de la qual compten els canvis reals
  idioma: 'es',               // idioma de l'app de la usuària: es | ca
  idiomaAvisos: 'es',         // idioma dels missatges als supervisors: es | ca
  nomUsuaria: '',             // com s'anomena als missatges («la mare», «Maria»…)
  notificarPractiques: 'si',  // si | no
  guardaUbicacio: 'si',       // si | no: desa la ubicació (GPS) on es posa el pegat
  telegramBot: '',            // nom d'usuari del bot (sense @)
  carpetaFotos: '',
  carpetaAudios: '',
  carpetaCopies: '',
  urlPanel: '',               // URL del panell, només per posar-la als correus
  avisosAcceptats: '{}',      // {idSupervisor: versió de l'avís d'ús acceptada}
  audiosFrases: '{}'          // {es: {clauFrase: idÀudio}, ca: {…}}: gravacions de les frases fixes de l'app
};

/** Frases fixes de l'app (claus de textos-app.js) que es poden gravar. */
var FRASES_GRAVABLES_ = ['practicaNoPosar', 'jaPot', 'noPortavaConfirma', 'sortirConfirma', 'caigudaConfirma', 'caigudaRetirada'];

/** Minuts abans de l'hora programada en què l'app ja ofereix el canvi. */
var MINUTS_ANTICIPACIO = 60;
/** Durada d'una sessió de supervisor (dies). */
var DIES_SESSIO = 60;
/** Validesa dels codis (minuts). */
var MINUTS_CODI_ENTRADA = 15;
var MINUTS_CODI_VINCULACIO = 10;
var INTENTS_MAXIMS_CODI = 5;
/** Mida màxima d'una foto o un àudio en base64 (caràcters). */
var MIDA_MAXIMA_FITXER = 3 * 1024 * 1024;
/** Tipus de dispositiu: el de la usuària segueix l'estat del sistema; els de suport sempre van en pràctica. */
var TIPUS_DISPOSITIU_ = ['usuaria', 'suport'];
/** Segons que es guarda el progrés en directe d'un canvi. */
var SEGONS_PROGRES = 1800;
