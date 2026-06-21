# Photo Studio OS v1.5 — AI Photography Director Suite

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


## Estado v1.5

Esta es la versión recomendada para GitHub Pages. El proyecto está preparado como estudio fotográfico general, con ropa contextual por tipo de sujeto y sin presentar el producto como un nicho de un solo perfil.

### Límites conocidos

- Para un producto comercial 10/10, lo ideal sería añadir backend/proxy para proteger API keys.
- La prueba final en iPhone Safari y Android Chrome debe hacerse en dispositivo real.
- Los tests E2E cubren smoke y flujo masculino básico; se pueden ampliar con regresión visual.
