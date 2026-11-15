# Medicación asistida

Ayuda privada y familiar para que una persona mayor que vive sola cambie un
parche transdérmico en días y horas fijos, y para que su familia sepa si se ha
hecho bien.

> ⚠️ **No es un producto sanitario.** Lea el [aviso de uso](AVISO.md) antes de
> instalarla.

## Qué incluye

- **App para el iPhone** (`web/index.html`): web que se añade a la pantalla de
  inicio, sin App Store. Asistente paso a paso con voz (castellano o catalán),
  temporizadores, zona del cuerpo propuesta sin repetir en 14 días, foto con la
  cámara en directo, modo práctica y felicitaciones.
- **Panel de la familia** (`web/panel.html`): avisos, historial con fotos,
  impresión del diario, configuración, personas, teléfono, copias de seguridad.
- **Servidor** (`src/`): Google Apps Script vinculado a una Hoja de cálculo de
  su propia cuenta. Avisos por Telegram y correo, y alerta si el cambio se retrasa.

Cada familia instala su propia copia en su cuenta de Google: los datos nunca
salen de ella.

## Direcciones

- Panel de la familia: <https://xjav-dev.github.io/medicacio-assistida/panel.html>
- App del iPhone: <https://xjav-dev.github.io/medicacio-assistida/index.html>

Estas direcciones son de esta instalación. Quien haga su propia copia tendrá las suyas
y deberá poner la URL de su Apps Script en `web/config.js`.

## Instalación

Vea [MANUAL.md](MANUAL.md): servidor en Apps Script, web en GitHub Pages, iPhone,
alarma y Atajos, y paso de práctica a uso real.

## Pruebas

```
node proves/executa-seguretat.js
node proves/executa-logica.js
node proves/servidor-proves.js   # http://localhost:8765 con el servidor simulado
```

Incluye teléfonos de apoyo (siempre en práctica) para acompañar a la usuaria por
teléfono viendo en qué paso va, y el enlace y el código QR de la app en el panel.

## Licencia

© 2026 xjav-dev. Software libre bajo la
[Licencia Pública de la Unión Europea v. 1.2 (EUPL-1.2)](LLICENCIA.txt).
Puede usarla, estudiarla, modificarla y compartirla; si distribuye una versión
modificada, o la ofrece como servicio en red, debe publicar sus cambios con la
misma licencia u otra compatible.

Incluye [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
© Kazuhiko Arase, con licencia MIT (`web/vendor/qrcode.js`). «QR Code» es marca
registrada de DENSO WAVE INCORPORATED.

---

**Català:** ajuda privada i familiar per canviar un pegat transdèrmic en dies i
hores fixos, amb avisos a la família. No és un producte sanitari: llegiu
l'[avís d'ús](AVISO.md). Instal·lació a [MANUAL.md](MANUAL.md). © 2026 xjav-dev ·
EUPL-1.2.
