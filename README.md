# Photo Studio OS v1.3 — AI Photography Director Suite

Estudio fotográfico web, offline-first y listo para GitHub Pages para diseñar prompts profesionales de fotografía IA.


## Seguridad

- Proyecto estático.
- CSS y JS externos.
- CSP sin `unsafe-inline`.
- API keys solo en `sessionStorage`.
- Validación adult-only para evitar menores.
- Tests E2E básicos con Playwright.

## Uso local

Abre `index.html` directamente o sirve la carpeta con:

```bash
python -m http.server 8080
```

## Tests

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

## GitHub Pages

Sube el contenido de esta carpeta a la raíz del repositorio y activa GitHub Pages desde `Settings → Pages`.
