# Photo Studio OS v1.4 — AI Photography Director Suite

Estudio fotográfico web, offline-first y listo para GitHub Pages para diseñar prompts profesionales de fotografía IA.

## Enfoque v1.4

La app mantiene la identidad general de **Photo Studio OS** y añade una capa importante de coherencia UX: **ropa contextual según el tipo de sujeto**.

Cuando eliges un sujeto femenino, masculino, no binario, corporativo, artista o senior, la app adapta automáticamente:

- Categorías de ropa visibles.
- Opciones de outfit.
- Calzado.
- Joyería y complementos.
- Legwear / calcetería.
- Texto de ayuda contextual.

Así se evita el problema de seleccionar “modelo masculino adulto” y encontrar solo vestidos, lencería o medias como opciones principales.

## Áreas cubiertas

- Portrait
- Fashion
- Editorial
- Lifestyle
- Beauty
- Menswear
- Corporate portrait
- Commercial
- Sportswear
- Resort / swim
- Senior Photography como especialidad interna
- Pipeline, analítica, A/B testing y biblioteca de resultados

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
