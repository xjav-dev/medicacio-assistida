# Especificaciones — Medicación asistida (`medicacio-assistida`, código `MEDA`)

Versión del documento: 0.7.0 · 2026-11-15

## 1. Objetivo

Ayudar a una persona mayor que vive sola a cambiar correctamente un parche
transdérmico (con cubierta adhesiva, dos cambios por semana) en dos días
fijos de la semana y a una hora fija, y que la familia (supervisores) sepa en
todo momento si se ha hecho bien.

El riesgo principal que la aplicación debe evitar es **llevar dos parches a la
vez** (sobredosis). Por eso el primer paso del cambio, «¿se ha quitado el parche
anterior?», es obligatorio y queda registrado.

## 2. Usuarios y roles

| Rol | Quién | Qué hace |
| --- | --- | --- |
| Usuaria | La persona mayor | Usa la app del iPhone: sigue el asistente, hace la foto. No configura nada. |
| Supervisor | Familiares | Reciben avisos (Telegram o email) y consultan el historial en el panel. |
| Administrador | Uno o dos familiares | Lo mismo que un supervisor y, además, toda la configuración. |

## 3. Piezas

1. **Backend**: Apps Script vinculado a una Hoja de cálculo (base de datos).
   Desplegado como aplicación web «ejecutar como yo», acceso «cualquier
   usuario». Expone una API JSON por `doPost`. Nadie abre la Hoja: todo se hace
   desde la web.
2. **App de la usuaria** (`web/index.html`): web instalable en la pantalla de
   inicio del iPhone (sin App Store), alojada en GitHub Pages.
3. **Panel de supervisores** (`web/panel.html`): misma web, otra dirección.
4. **Recordatorio**: alarma del Reloj del iPhone + automatización de Atajos que
   abre la app al parar la alarma (una web no puede hacer sonar alarmas).

## 4. Casos de uso

- **CU-01 Vincular el iPhone.** Un administrador genera un código de 6 cifras
  (válido 10 min, un solo uso, 5 intentos). Se escribe en la app ya instalada.
- **CU-02 Cambio programado.** En el día y hora fijos (la app lo ofrece desde
  60 min antes) la usuaria sigue el asistente: retirar el anterior → piel →
  zona → parche blanco (15 s) → cubierta ovalada (30 s) → foto → manos.
  Cada paso se lee en voz alta (grabación familiar o voz del iPhone) en
  castellano o catalán.
- **CU-03 Zona.** La app propone la zona A–H usada hace más tiempo y bloquea
  las usadas en los últimos 14 días (configurable).
- **CU-04 Foto en directo.** La cámara se abre dentro de la app; no se puede
  elegir una foto de la galería. Lleva impresa fecha, hora (del servidor) y
  zona. No se guarda en el carrete; se guarda en Drive. Si no puede hacerla
  (p. ej. zona de la espalda), pulsa «No puedo hacer la foto» y se avisa.
- **CU-05 Parche caído.** Botón en la pantalla principal. Hace un cambio extra
  sin mover los días fijos.
- **CU-06 Avisos.** Cada cambio terminado se comunica a los supervisores con la
  foto. Si a los X min (30 por defecto) no se ha hecho: «⚠️ pendiente»; a los
  Y min (120): «🔴 alerta». Si llega el siguiente cambio sin haber hecho el
  anterior: «❌ no realizado».
- **CU-07 Modo práctica (DEMO).** Desde el panel. Franja «PRÁCTICA» en todas
  las pantallas, aviso de no ponerse ningún parche, registros aparte, sin
  avisos de retraso. Al pasar a ACTIVO desaparece por completo de la app.
- **CU-08 Panel.** Acceso con código enviado por email (y Telegram si está
  vinculado). Inicio, historial con fotos, impresión del diario, medicación y
  pasos (ES/CA, prueba de voz, grabación de audios), personas, dispositivo,
  ajustes y registro de cambios.
- **CU-10 Copias de seguridad.** Un administrador hace una copia (Hoja nueva en la
  carpeta «Còpies medicació», nunca una copia del archivo con su script) y puede
  restaurar una. La restauración comprueba aplicación, entorno, esquema e
  integridad, pide escribir «MEDICACIÓ ASSISTIDA IMPORTA» en 60 s y antes hace una
  copia automática. Sustituye Medicación, Registro y los ajustes (no el bot ni las
  carpetas); conserva personas, teléfonos, auditoría y errores.
- **CU-11 Teléfonos de apoyo.** Además del teléfono de la usuaria (que sigue el
  modo del sistema), puede haber teléfonos de apoyo, siempre en PRÁCTICA, para
  acompañarla por teléfono. Lo que hacen no se avisa a la familia. Los vincula un
  administrador o el propio supervisor (solo de apoyo); el tipo se cambia desde el panel.
- **CU-12 Seguimiento en directo.** El teléfono de la usuaria informa del paso en
  que está (30 min en caché, sin guardar en la Hoja). Se ve en «Ahora mismo» del
  panel y en el teléfono de apoyo, que puede saltar al mismo paso.
- **CU-13 Distribución.** La pestaña «Teléfonos» (todos los supervisores) da el
  enlace de la app y su código QR.
- **CU-14 Instrucciones de la alarma** dentro de la app de la usuaria, con el
  horario y el botón para copiar el enlace para Atajos.
- **CU-15 Salidas.** Salir del asistente sin terminar crea un registro
  `tipus=sortida, estat=abandonat` con el paso; en uso real se avisa. No cambia
  el calendario ni la racha. Los teléfonos de apoyo no lo registran.
- **CU-16 Filtros del historial.** Por defecto solo los cambios hechos; salidas y
  pendientes/no realizados se muestran al activarlos.
- **CU-17 Empezar de cero.** Borrar prácticas o todo el historial (destructivo):
  copia previa, frase escrita, testimonio de 60 s, fotos a la papelera, auditoría.
- **CU-18 Menú de la Hoja** con las acciones de instalación (solo la cuenta que
  la abre y está identificada).
- **CU-09 Sin conexión.** Si al terminar no hay conexión, el cambio se guarda en
  el iPhone y se envía al recuperarla.

## 5. Modelo de datos (pestañas de la Hoja)

| Pestaña | Columnas |
| --- | --- |
| `Config` | clau, valor |
| `Supervisors` | id, nom, correu, rol, perCorreu, perTelegram, telegramChat, actiu, versio, creat |
| `Dispositius` | id, nom, tipus (usuaria / suport), actiu, versio, creat, darreraConnexio |
| `Medicaments` | id, nom_es, nom_ca, actiu, dies, hora, margeAvisMin, margeAlertaMin, diesRepeticioZona, maxDiesEntreCanvis, passos (JSON), zones (JSON), vigentDes, creat |
| `Registre` | id, medicament, mode, tipus, dataProgramada, inici, fi, estat, anteriorRetirat, zona, fotoId, senseFotoMotiu, dispositiu, avisat, alertat, idClient, notes |
| `Auditoria` | data, qui, accio, detall |
| `Errors` | data, operacio, missatge, pila |

Secretos en Script Properties: `SECRET_HMAC`, `TELEGRAM_TOKEN`,
`TELEGRAM_OFFSET`, `ENTORN`.

## 6. Decisiones de diseño (DD)

- **DD-001 Web instalable, no app de tienda.** Requisito: app privada sin App
  Store. Consecuencia: no hay alarmas propias; se usa la alarma del iPhone + Atajos.
- **DD-002 Frontend fuera de Apps Script.** Apps Script no puede servir una web
  instalable (manifest, service worker). El frontend está en GitHub Pages y
  habla con Apps Script por `fetch` (POST `text/plain`, sin preflight CORS).
- **DD-003 Exposición.** Despliegue con acceso «cualquier usuario» (anónimo).
  `doGet` solo devuelve una página mínima. Todas las operaciones pasan por
  `executa_`; sin sesión solo: `apiDemanaCodi`, `apiEntra`,
  `apiVinculaDispositiu`, protegidas por códigos de un solo uso con intentos
  limitados. El resto exige testimonio HMAC (caducidad, ámbito y versión
  revocable) del dispositivo o de un supervisor, y su rol.
  En la 0.5.0 hay 31 operaciones con sesión; el seguimiento lo consultan los
  supervisores y los teléfonos de apoyo, nunca el de la usuaria.
- **DD-004 Acceso de supervisores con código** (no enlace): el email lleva un
  código de 8 caracteres válido 15 min. Evita enviar tokens en enlaces que
  podrían apuntar a otra web.
- **DD-005 Proceso programado** `activadorRevisio` cada 5 min: avisos de
  retraso y vinculación de Telegram. Aprobado en el diseño (escalado de avisos).
- **DD-006 Telegram por sondeo** (`getUpdates`), no webhook: Apps Script
  responde con redirección y Telegram reintentaría los webhooks.
- **DD-007 Pasos y zonas como JSON** en la fila del medicamento: se editan
  enteros desde el panel; permite añadir otros medicamentos.
- **DD-008 Zonas mínimas.** Con 2 cambios/semana y 14 días sin repetir hacen
  falta al menos 5 zonas activas; el panel lo valida.
- **DD-009 Identidad visual.** Aplicación familiar, sin identidad corporativa.
  Letra del sistema, tamaños grandes y contraste alto.
- **DD-011 Apertura desde Atajos.** iOS no deja abrir una web de la pantalla de
  inicio desde Atajos, y Safari y el icono no comparten almacenamiento. El panel
  da un «enlace para el atajo» con el testimonio del teléfono en el fragmento
  (`#t=…`, no llega a ningún servidor); la app lo guarda y lo borra de la dirección.
  Solo administradores; se revoca desvinculando el teléfono.
- **DD-012 Vinculación con código de 6 cifras** escrito en la app ya instalada (no
  QR): por el mismo motivo de almacenamiento separado en iOS.
- **DD-013 Sin marcas.** Aplicación de uso privado: no aparece el nombre comercial
  del medicamento ni su imagen. El nombre por defecto es «Parche» / «Pegat».
- **DD-014 Una sola zona a la vista.** El dibujo (propio) muestra solo la vista de
  frente o de espaldas que corresponde, con el parche en la zona que toca.
- **DD-015 Gamificación suave.** Felicitación al azar distinta de la anterior,
  confeti (salvo si el iPhone pide menos movimiento), racha de cambios programados
  seguidos (se corta con un «no realizado») y medallas en 3, 5, 10, 20, 30, 50 y 100.
- **DD-016 Copias.** Se guardan Config, Supervisors, Dispositius, Medicaments y
  Registre con `_Metadades`; las fotos y audios no se duplican (quedan en Drive).
  No se borran automáticamente ni hay copias programadas. Requiere el permiso
  `spreadsheets` (crear y abrir otras Hojas). Solo se abren Hojas de la carpeta de copias.
- **DD-017 Licencia, autoría y aviso.** Proyecto personal de xjav-dev, con licencia
  EUPL-1.2 (texto oficial en `LLICENCIA.txt`). `AVISO.md` (castellano y catalán)
  deja claro que no es un producto sanitario. El panel muestra el aviso la primera
  vez y pide aceptarlo (versión del aviso por persona en `Config.avisosAcceptats`,
  sin cambio de esquema); queda en la auditoría. La app de la usuaria no lo muestra,
  para no confundirla.
- **DD-018 Esquema 2.** Columna `tipus` en `Dispositius`. `migra_1_a_2` la añade y
  marca los teléfonos existentes como de la usuaria; `instalacio()` la ejecuta sola
  con copia previa («abans de migrar»). Las copias de esquema 1 se importan y se migran.
- **DD-019 Código QR** con la biblioteca qrcode-generator (MIT), servida desde
  `web/vendor/` (sin dependencias externas en tiempo de ejecución).
- **DD-020 Servidor en el enlace.** La web pública (GitHub Pages) no contiene la
  dirección del Apps Script. Los enlaces que reparte el panel llevan `?s=<id>`
  (y `&d=<dominio>` en Workspace); el dispositivo lo guarda. Solo se aceptan
  direcciones de `script.google.com`. Las claves guardadas (sesión, estado, cola)
  llevan el sufijo del servidor, así un enlace de otro servidor no usa las sesiones
  de este. El manifest no fija `start_url` para que el icono de inicio conserve
  `?s=`; **pendiente de comprobar en un iPhone real** (si no se conservara, la app
  pide pegar el enlace). La misma web sirve a cualquier familia con su servidor.
- **DD-021 Voz.** Desde una web, el iPhone solo expone sus voces básicas: no las
  de Siri ni las descargadas (mejoradas/premium). Se elige la mejor disponible y la
  familia puede fijarla por teléfono; para una voz natural, la solución son las
  grabaciones de la familia (ya existentes por paso).
- **DD-010 Idiomas.** App de la usuaria en castellano o catalán (lo elige el
  administrador). Panel en castellano.

## 7. Privacidad

Datos de salud de una persona: la Hoja y las fotos quedan en el Drive del
propietario, sin compartir. Las fotos solo se ven desde el panel con sesión o en
los mensajes a supervisores. Telegram guarda copia de los mensajes enviados.

## 8. Criterios de aceptación

1. No se puede completar un cambio sin confirmar la retirada del anterior.
2. La zona propuesta nunca es una usada en los últimos 14 días si hay otra libre.
3. La foto solo puede venir de la cámara en directo.
4. Los supervisores reciben el resultado de cada cambio y los avisos de retraso.
5. En DEMO no hay avisos de retraso y los registros quedan aparte; en ACTIVO la
   app no muestra nada de la práctica.
6. Días, hora, márgenes, idioma, pasos, zonas, supervisores y dispositivo se
   cambian desde el panel, sin abrir la Hoja.
7. Ninguna operación de la API funciona sin el testimonio adecuado.
