# Manual — Medicación asistida

Versión 0.6.0 · 2026-11-15

## 1. Qué es

- **App del iPhone** (`web/index.html`): guía a la usuaria paso a paso para cambiar
  el parche, con voz, temporizadores, zona del cuerpo propuesta y foto en directo.
- **Panel de la familia** (`web/panel.html`): avisos, historial con fotos y toda la
  configuración. Nadie abre la Hoja de cálculo: es solo la base de datos.
- **Servidor**: Apps Script vinculado a la Hoja. Envía los avisos por Telegram y email
  y revisa cada 5 minutos si un cambio se retrasa.

## 2. Puesta en marcha (una sola vez)

### 2.1 Servidor (Apps Script)

1. Con la cuenta de Google que será la propietaria, cree una Hoja de cálculo vacía
   (por ejemplo «Medicación asistida — datos») y su proyecto de Apps Script.
   Ponga su `scriptId` en `.clasp.json` y suba `src/`.
2. En el editor de Apps Script ejecute **`instalacio`** y acepte los permisos.
   Crea las pestañas, el secreto, el primer administrador (su email), el
   medicamento por defecto (lunes y viernes a las 10:00), las carpetas de fotos,
   audios y copias, y la revisión cada 5 minutos. Si venía de la versión 0.1 o 0.2,
   vuelva a ejecutarla: pedirá el permiso nuevo para crear las Hojas de copia y, si hace
   falta, migrará los datos al esquema nuevo (con una copia antes). Se puede volver a ejecutar sin riesgo.
3. Despliegue como **aplicación web**: *Ejecutar como*: **yo**; *Quién tiene
   acceso*: **cualquier usuario**. Copie la URL que acaba en `/exec`.
4. Cuando todo funcione con datos reales, ejecute **`passaAProduccio`** (quita la
   franja «Entorno de desarrollo» del panel).

### 2.2 Web (app y panel)

1. **No hace falta tocar `web/config.js`.** La dirección del servidor no se publica:
   viaja en los enlaces que reparte el panel (`?s=…`) y cada dispositivo la guarda.
2. El repositorio publica `web/` en GitHub Pages solo (flujo
   `.github/workflows/pages.yml`) cada vez que cambia algo de `web/`; en
   *Settings → Pages* la fuente es «GitHub Actions». La web no contiene datos:
   solo el código. Los datos solo se ven con un código de acceso.
3. Direcciones: `https://…/index.html` (iPhone) y `https://…/panel.html` (familia).

### 2.3 Primer acceso al panel

Abra `https://xjav-dev.github.io/medicacio-assistida/panel.html`. La primera vez
pide la dirección del servidor: pegue la URL `/exec` del paso 2.1 (se guarda solo
en ese navegador). Después escriba el email de la cuenta propietaria y entre con el
código que le llega por email (caduca en 15 minutos).

Para el resto de la familia, **Personas → Enlace del panel para la familia** da un
enlace (y un QR) que ya lleva el servidor. No lo publique.

1. **Ajustes**: cómo llamarla en los avisos, idioma del teléfono (castellano o
   catalán), idioma de los avisos y dirección del panel.
2. **Ajustes → Bot de Telegram**: en Telegram, hable con `@BotFather`, envíe
   `/newbot` y pegue el token.
3. **Personas**: añada a la familia (supervisor = ve y recibe avisos;
   administrador = también configura). Cada uno entra con su email y pulsa
   «Vincular Telegram».
4. **Medicación**: revise días y hora, los nombres de las zonas A–H (compárelos con
   el folleto) y los textos de cada paso. Con «Probar voz» se oye cómo sonará; con
   «Grabar» un familiar puede grabar su voz para cada paso (mejor desde el iPhone,
   en Safari). Si ella no llega a la espalda, desactive E–H; hacen falta al menos
   5 zonas activas.

### 2.4 El iPhone de la usuaria (y los de apoyo)

1. En el panel, **Teléfonos** muestra el enlace de la app y un **código QR**: en el
   iPhone, escanéelo con la cámara (o abra el enlace en Safari) → botón **Compartir**
   → **Añadir a pantalla de inicio**. Ábrala **desde el icono**, no desde Safari.
2. En **Teléfonos → Vincular un teléfono** elija el tipo y genere el código; escriba
   las 6 cifras en la app (valen 10 minutos y un solo uso).
   - **De la usuaria**: sigue el modo del sistema (práctica o activo). Solo lo
     vincula un administrador.
   - **De apoyo**: siempre en práctica, para acompañarla por teléfono. Cualquier
     supervisor puede vincular el suyo. Lo que se haga en él no se avisa.
3. La primera foto pedirá permiso para la cámara: pulse «Permitir».
4. Voz más natural: *Ajustes → Accesibilidad → Contenido leído → Voces*, elija
   Español (España) o Catalán y descargue una voz «mejorada» (Mónica, Jorge,
   Montserrat…).

### 2.5 Alarma y Atajos (el recordatorio)

Una web no puede hacer sonar alarmas; se usa la alarma del iPhone:

1. **Reloj → Alarmas → +**: la misma hora que la medicación, *Repetir* los dos días
   de cambio, *Etiqueta*: «Parche». Así suena hasta que ella la para.
2. En el iPhone de la usuaria, al pie de la app: **«Instrucciones de la alarma»**.
   Enseña el horario y estos pasos, y el botón **«Copiar enlace para Atajos»**
   (también está en el panel: **Teléfonos → Enlace para el atajo**).
3. **Atajos → Automatización → Nueva automatización → Alarma → «Se detiene»** →
   elija la alarma «Parche» → **Ejecutar inmediatamente** → acción **Abrir URLs** →
   pegue el enlace.

Al parar la alarma se abre la app ya vinculada, en Safari (el iPhone no deja abrir
el icono de la pantalla de inicio desde Atajos). El enlace es como una llave del
teléfono: no lo comparta. Si se pierde, desvincule el teléfono y vincúlelo de nuevo.

**Si cambia los días o la hora en el panel, cambie también la alarma.** El panel lo
recuerda al guardar.

## 3. Práctica y paso a uso real

- El sistema empieza en **modo PRÁCTICA**: franja amarilla «PRÁCTICA» en todas las
  pantallas, aviso de no ponerse ningún parche en los pasos de colocación, registros
  aparte (Historial → Prácticas) y sin avisos de retraso.
- Cuando ella lo domine: **Inicio → Pasar a ACTIVO** y elija desde cuándo cuenta.
  La práctica desaparece por completo del teléfono.
- Para repasar más adelante: **Volver a modo práctica**.

## 4. Uso diario

**La usuaria**: suena la alarma, la para y se abre la app con «Ahora toca cambiar el
parche» → **Empezar**. Cada paso se lee en voz alta y tiene «Repetir»:

1. Quitar el parche anterior (obligatorio: «Ya me lo he quitado» o «No llevaba
   ninguno»).
2. Zona propuesta: el dibujo muestra solo esa zona (de frente o de espaldas); puede elegir otra libre.
3. Piel limpia y seca.
4. Parche blanco (sobre pequeño) y presionar 15 s con temporizador.
5. Cubierta ovalada (sobre grande) y presionar 30 s.
6. Foto con la cámara en directo (no se puede elegir de la galería). Si no puede
   (zona de la espalda…), «No puedo hacer la foto» y elige el motivo.
7. Lavarse las manos.

Al terminar sale una felicitación distinta cada vez, con confeti, y la racha de cambios
seguidos sin fallar (con medallas a los 3, 5, 10, 20, 30, 50 y 100).

La app ofrece el cambio desde 60 minutos antes de la hora. Si **se le cae el
parche**: botón «Se me ha caído el parche»; no cambia los días fijos.

**La familia** recibe:

| Mensaje | Cuándo |
| --- | --- |
| ✅ cambio hecho (con foto) | Al terminar |
| 🩹 parche caído | Al terminar un cambio extra |
| ⚠️ pendiente | Primer aviso (30 min por defecto) |
| 🔴 alerta | Segundo aviso (120 min): conviene llamarla |
| ❌ no realizado | Llegó el siguiente cambio sin haber hecho el anterior |
| ⚠️ dice que no llevaba parche | Si marca que no llevaba ninguno puesto |

Qué hacer ante una dosis olvidada o un parche que estuvo más días de la cuenta lo
dicen el prospecto, el médico o el farmacéutico; la app solo lo registra y avisa.

**Sin conexión**: si al terminar no hay internet, el cambio queda guardado en el
teléfono y se envía solo al volver la conexión.

## 5. Acompañar por teléfono

1. Llame a la usuaria y abra la app en su **teléfono de apoyo** (franja «PRÁCTICA ·
   TELÉFONO DE APOYO»).
2. La tarjeta **«Qué está haciendo ahora»** dice en qué paso va ella (se actualiza
   cada 10 segundos). Lo mismo se ve en el panel, **Inicio → Ahora mismo**.
3. Pulse **Practicar**: verá las mismas pantallas que ella. Con **«Ir a ese paso»**
   se pone en el mismo paso y la puede guiar.

## 6. Panel

- **Inicio**: estado (práctica/activo), cambio pendiente, último y próximo, actividad.
- **Historial**: reales o prácticas por fechas; fotos; **Imprimir diario** (mismo
  formato que el diario en papel, para el médico).
- **Medicación** (administradores): días, hora, márgenes de aviso, zonas, pasos,
  voz y grabaciones. Se pueden añadir otros medicamentos.
- **Personas**: alta y baja, rol, canales, vincular Telegram, mensaje de prueba.
- **Teléfonos** (todos): enlace y QR de la app; vincular (los supervisores, solo de
  apoyo). Los administradores cambian el tipo, desvinculan y obtienen el enlace para el atajo.
- **Ajustes** (administradores) y **Registro**: quién cambió qué y cuándo.
- **Copias** (administradores): «Hacer una copia ahora» guarda medicación, historial,
  ajustes, personas y teléfonos en una Hoja nueva de la carpeta «Còpies medicació».
  «Restaurar…» enseña qué cambiará y pide escribir `MEDICACIÓ ASSISTIDA IMPORTA` en
  menos de 60 segundos; antes hace una copia del estado actual, por si hay que
  volver atrás. Las personas y los teléfonos vinculados no se tocan. Las fotos y
  grabaciones no se copian (siguen en Drive). Conviene hacer una copia antes de
  cambios grandes y de vez en cuando; no se borran solas.

Un cambio de días u hora vale a partir del momento de guardarlo.

## 7. Aviso de uso y licencia

La primera vez que cada persona entra en el panel tiene que leer y aceptar el
aviso de uso (`AVISO.md`): no es un producto sanitario y los avisos pueden fallar.
Queda anotado en el Registro y se puede releer desde el pie del panel.

© 2026 xjav-dev · Licencia EUPL-1.2 (`LLICENCIA.txt`). Para publicar el proyecto,
`.gitignore` deja fuera los `scriptId` (`.clasp*.json`). El código QR usa la
biblioteca qrcode-generator de Kazuhiko Arase (licencia MIT), en `web/vendor/`.

## 8. Privacidad

Datos de salud: la Hoja y las fotos quedan en el Drive de la cuenta propietaria, sin
compartir. Las fotos solo se ven en el panel con sesión y en los mensajes a la
familia (Telegram guarda copia de lo que recibe). Para quitar el acceso a alguien:
**Personas → Quitar** (sus sesiones dejan de valer al momento).

## 9. Pruebas (desarrollo)

- `node proves/executa-seguretat.js` — ninguna función es accesible sin pasar por los controles.
- `node proves/executa-logica.js` — calendario, zonas, seguridad y un recorrido completo.
- `node proves/servidor-proves.js` — sirve `web/` en `http://localhost:8765` con el
  servidor real simulado, para probar app y panel en el navegador.
