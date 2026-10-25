# ADR-08 · Lectura de avisos de compra por correo

Estado: Postergada a V2 · 24-10-2026 (propuesta 12-10-2026) · Brechas: G45

## Contexto

Los bancos chilenos envían un correo por cada compra con tarjeta. Leerlos daría captura automática, pero exige acceso al correo personal (consentimiento `lectura_correo`), un parser por banco y retención de datos crudos (D19).

## Decisión

**Fuera del MVP.** La captura se cubre con:

1. Captura manual y por chat (spec 005).
2. Importación periódica de cartolas y estados de cuenta (spec 003), que además concilia lo capturado.

Se reevalúa en V2 junto con Finanzas Abiertas (julio de 2027), que puede volver innecesaria la lectura de correos.

## Consecuencias

La cobertura de captura (KP1) depende de la disciplina diaria y de importar el estado de cuenta antes del cierre mensual. La spec 010 incluye ese paso en el cierre.

## Cómo verificar

KP1 ≥ 90 % en el cierre de diciembre medido contra el estado de cuenta.
