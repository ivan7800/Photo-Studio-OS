# Security Policy — Photo Studio OS v1.3

## Modelo de seguridad

Photo Studio OS v1.3 es una aplicación frontend estática. No incluye backend ni servidor propio.

## API keys

- Las keys se guardan en `sessionStorage`, no en `localStorage`.
- Se eliminan al cerrar la sesión del navegador.
- Cuando se usa una función IA, la key se envía directamente al proveedor elegido: OpenAI, Anthropic o Gemini.
- Para uso público se recomienda usar keys con límite de gasto y rotación frecuente.

## Recomendación para producto comercial

La arquitectura más segura sería:

```text
Frontend estático → Backend/proxy serverless → Proveedor IA
```

Las keys deberían estar en variables de entorno del backend, nunca expuestas al navegador.

## CSP

La app usa CSP sin `unsafe-inline`:

- JS externo en `assets/app.js`.
- CSS externo en `assets/styles.css`.
- Sin handlers inline tipo `onclick`.

## Adult-only

La app bloquea edades menores de 18 y términos relacionados con menores. El objetivo es fotografía profesional de sujetos adultos.
