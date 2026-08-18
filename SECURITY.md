# Security Policy — Photo Studio OS v2.0

Photo Studio OS es una aplicación frontend estática. No publica claves en el repositorio ni dispone de backend propio.

## Claves de API

- Se guardan en `sessionStorage` durante la sesión del navegador.
- Se eliminan al borrar las claves o al terminar la sesión según el comportamiento del navegador.
- Se recomienda usar claves restringidas y con límites de gasto.
- Las peticiones salen directamente del navegador hacia el proveedor configurado.

## CSP

La aplicación usa una CSP que limita scripts/estilos al propio origen y conexiones a los endpoints de IA configurados.

## Alcance

La arquitectura actual es adecuada para uso personal/prosumer con claves propias. Para un SaaS público con claves gestionadas por el servicio, se recomienda un backend/proxy con autenticación, rate limiting, rotación de secretos y observabilidad.
