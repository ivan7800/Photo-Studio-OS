# Photo Studio OS v2.0 — AI Photography Director Suite

Aplicación web estática y local-first para diseñar sesiones fotográficas y prompts de imagen, organizar presets/resultados y usar asistentes IA mediante claves aportadas por el usuario.

## Novedades v2.0

- Interfaz de aplicación con Dashboard, Studio, AI Studio, Producción, Biblioteca y Settings.
- Output persistente/sticky en escritorio para trabajar sin perder el prompt final.
- API Keys desplazadas a Settings.
- Notificaciones no bloqueantes para acciones de uso frecuente.
- PWA instalable con manifest, iconos y service worker de shell.
- Mantiene el flujo local-first y compatibilidad con GitHub Pages/subcarpeta mediante rutas relativas.
- Preserva compatibilidad con los datos `psos20*` con migración automática desde `psos14*` de versiones anteriores para no perder presets, historial, pipeline ni resultados.

## Ejecutar localmente

```bash
python -m http.server 8080
```

Abre `http://localhost:8080/`. Para PWA/service worker no abras directamente `index.html` con `file://`.

## Publicar en GitHub Pages

Sube el contenido del proyecto a la rama publicada por Pages. No requiere build ni backend para la interfaz. El `manifest.webmanifest`, el service worker y los assets usan rutas relativas.

## IA remota y privacidad

Las claves se guardan en `sessionStorage`, no en el repositorio. Cuando usas OpenAI, Anthropic o Gemini, el prompt se envía directamente a ese proveedor desde el navegador. Para uso público/comercial, un backend/proxy de claves ofrece un modelo de seguridad superior.

## Offline

El service worker cachea el shell local de la aplicación. La interfaz y los datos locales pueden abrirse offline después de una primera carga correcta; las APIs remotas y la generación de imagen siguen requiriendo conexión.

## Tests

```bash
npm install
npm test
node --check assets/app.js
```

Los tests Playwright requieren navegadores instalados en el entorno.
