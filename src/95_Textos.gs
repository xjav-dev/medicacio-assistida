/**
 * 95_Textos.gs — Medicació assistida
 *
 * Textos del servidor en castellà i català: missatges als supervisors i passos
 * per defecte del pegat de dos canvis setmanals (els pot canviar un administrador al panell).
 *
 * Autoria: xjav-dev i Claude (Anthropic)
 * Copyright (c) 2026 xjav-dev
 * Llicència: EUPL-1.2 — vegeu LLICENCIA.txt
 * SPDX-License-Identifier: EUPL-1.2
 * Versió: 0.4.0 · 2026-11-15
 */

var TEXTOS_ = {
  es: {
    dies: ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    practica: '🧪 PRÁCTICA · ',
    completat: '✅ {nom}: hecho «{med}».\n🕒 {quan} (previsto {prog})\n📍 Zona {zona}: {nomZona}\n🩹 Parche anterior: {anterior}',
    completatExtra: '🩹 {nom}: se le había caído el parche y se ha puesto uno nuevo («{med}»).\n🕒 {quan}\n📍 Zona {zona}: {nomZona}',
    anteriorSi: 'retirado',
    anteriorNo: '⚠️ dice que NO llevaba ninguno puesto',
    senseFoto: '📷 Sin foto: {motiu}',
    pendent: '⚠️ {nom}: «{med}» de las {hora} sigue pendiente ({min} min de retraso).',
    alerta: '🔴 {nom}: «{med}» de las {hora} NO se ha hecho todavía ({min} min de retraso). Conviene llamarla.',
    noFet: '❌ {nom}: «{med}» del {dia} a las {hora} no se registró.',
    assumpteCodi: 'Código de acceso — Medicación asistida',
    cosCodi: 'Tu código para entrar en el panel es: {codi}\nCaduca en {min} minutos.\n{url}\nSi no lo has pedido tú, ignora este mensaje.',
    telegramVinculat: '✅ Listo, {nom}. Recibirás aquí los avisos de la medicación.',
    telegramDesconegut: 'Este enlace no es válido o ha caducado. Pide uno nuevo desde el panel.',
    prova: '🔔 Mensaje de prueba de Medicación asistida. Si lo lees, los avisos te llegarán bien.',
    assumpteAvis: 'Medicación asistida — {estat}',
    laUsuaria: 'La usuaria'
  },
  ca: {
    dies: ['', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'],
    practica: '🧪 PRÀCTICA · ',
    completat: '✅ {nom}: fet «{med}».\n🕒 {quan} (previst {prog})\n📍 Zona {zona}: {nomZona}\n🩹 Pegat anterior: {anterior}',
    completatExtra: '🩹 {nom}: li havia caigut el pegat i se n\'ha posat un de nou («{med}»).\n🕒 {quan}\n📍 Zona {zona}: {nomZona}',
    anteriorSi: 'retirat',
    anteriorNo: '⚠️ diu que NO en portava cap de posat',
    senseFoto: '📷 Sense foto: {motiu}',
    pendent: '⚠️ {nom}: «{med}» de les {hora} encara està pendent ({min} min de retard).',
    alerta: '🔴 {nom}: «{med}» de les {hora} encara NO s\'ha fet ({min} min de retard). Convé trucar-li.',
    noFet: '❌ {nom}: «{med}» del {dia} a les {hora} no es va registrar.',
    assumpteCodi: 'Codi d\'accés — Medicació assistida',
    cosCodi: 'El teu codi per entrar al panell és: {codi}\nCaduca d\'aquí a {min} minuts.\n{url}\nSi no l\'has demanat tu, ignora aquest missatge.',
    telegramVinculat: '✅ Fet, {nom}. Rebràs aquí els avisos de la medicació.',
    telegramDesconegut: 'Aquest enllaç no és vàlid o ha caducat. Demana\'n un de nou des del panell.',
    prova: '🔔 Missatge de prova de Medicació assistida. Si el llegeixes, els avisos t\'arribaran bé.',
    assumpteAvis: 'Medicació assistida — {estat}',
    laUsuaria: 'La usuària'
  }
};

/** Nom del dia de la setmana (1 = dilluns … 7 = diumenge). */
function nomDia_(idioma, n) {
  return (TEXTOS_[idioma] || TEXTOS_.es).dies[n] || '';
}

/** Text amb substitucions {clau}. */
function text_(idioma, clau, valors) {
  var t = (TEXTOS_[idioma] || TEXTOS_.es)[clau];
  if (t === undefined) t = TEXTOS_.es[clau] || clau;
  return String(t).replace(/\{(\w+)\}/g, function (m, k) {
    return valors && valors[k] !== undefined ? String(valors[k]) : m;
  });
}

/**
 * Passos per defecte d'un pegat transdèrmic amb coberta (fullet del medicament).
 * tipus: retirada | zona | info | temporitzador | foto. colocacio: en pràctica s'avisa de no posar-se res.
 */
var PASSOS_DEFECTE_ = [
  { id: 'p1', tipus: 'retirada', segons: 0, colocacio: false,
    text_es: 'Quítese el parche que lleva puesto, junto con la cubierta beige. Dóblelo por la mitad, con el lado que pega hacia dentro, y tírelo.',
    text_ca: 'Traieu-vos el pegat que porteu posat, juntament amb la coberta beix. Doblegueu-lo per la meitat, amb la cara que enganxa cap a dins, i llenceu-lo.' },
  { id: 'p2', tipus: 'zona', segons: 0, colocacio: false,
    text_es: 'Hoy le toca esta zona del cuerpo.',
    text_ca: 'Avui us toca aquesta zona del cos.' },
  { id: 'p3', tipus: 'info', segons: 0, colocacio: false,
    text_es: 'La piel de esa zona debe estar limpia y seca, sin pelo, sin cremas, sin cortes y sin rojeces.',
    text_ca: 'La pell d\'aquesta zona ha d\'estar neta i seca, sense pèl, sense cremes, sense talls i sense vermellors.' },
  { id: 'p4', tipus: 'info', segons: 0, colocacio: true,
    text_es: 'Abra con tijeras el sobre PEQUEÑO y saque el parche BLANCO rectangular. Quite una de las dos láminas sin tocar la parte que pega, póngalo sobre la piel y quite la otra lámina.',
    text_ca: 'Obriu amb unes tisores el sobre PETIT i traieu el pegat BLANC rectangular. Traieu una de les dues làmines sense tocar la part que enganxa, poseu-lo sobre la pell i traieu l\'altra làmina.' },
  { id: 'p5', tipus: 'temporitzador', segons: 15, colocacio: true,
    text_es: 'Apriete el parche contra la piel con la palma de la mano durante 15 segundos.',
    text_ca: 'Premeu el pegat contra la pell amb el palmell de la mà durant 15 segons.' },
  { id: 'p6', tipus: 'info', segons: 0, colocacio: true,
    text_es: 'Ahora abra el sobre GRANDE y saque la cubierta OVALADA de color beige. Quite la lámina pequeña, póngala encima del parche blanco, que quede todo tapado, y quite la otra lámina.',
    text_ca: 'Ara obriu el sobre GRAN i traieu la coberta OVALADA de color beix. Traieu la làmina petita, poseu-la damunt del pegat blanc, que quedi tot tapat, i traieu l\'altra làmina.' },
  { id: 'p7', tipus: 'temporitzador', segons: 30, colocacio: true,
    text_es: 'Apriete la cubierta con la palma de la mano durante 30 segundos. Repase bien los bordes.',
    text_ca: 'Premeu la coberta amb el palmell de la mà durant 30 segons. Repasseu bé les vores.' },
  { id: 'p8', tipus: 'foto', segons: 0, colocacio: false,
    text_es: 'Hágale una foto al parche puesto.',
    text_ca: 'Feu una foto del pegat posat.' },
  { id: 'p9', tipus: 'info', segons: 0, colocacio: false,
    text_es: 'Lávese las manos con agua y jabón.',
    text_ca: 'Renteu-vos les mans amb aigua i sabó.' }
];
