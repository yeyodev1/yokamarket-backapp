# CLAUDE.md

API de YOKA Market (tienda de comida saludable, Guayaquil): catálogo, pedidos y pagos con Payphone.

## Comandos

- `pnpm dev` — ts-node-dev en :8100 (necesita `.env`, ver `.env.example`)
- `pnpm build` — tsc → `dist/`. Única verificación; no hay tests ni linter.
- `pnpm seed [--force]` — carga el catálogo del PDF (`src/data/catalog.ts`). Sin `--force` no toca una base que ya tiene categorías. El arranque normal también siembra si la base está vacía.

## Stack

Express 5 + TypeScript (CommonJS) + Mongoose (Atlas, base `yokamarket`). Vercel: `api/index.ts` es la función; `vercel.json` reescribe todo a `/api`. JWT para el panel admin. Resend opcional para avisar pedidos pagados.

## Flujo de pago (Payphone "Botón de pago por redirección")

1. `POST /api/orders` → se recalculan precios desde Mongo, se crea el pedido `pending` con un `clientTransactionId` único y se llama a `POST pay.payphonetodoesposible.com/api/button/Prepare`. Se responde `{ code, payUrl }`.
2. El front manda al cliente a `payUrl`. Payphone vuelve a `FRONTEND_URL/pay-response?id=&clientTransactionId=` (o a `cancellationUrl`, que es la misma ruta con `cancelled=1`).
3. El front llama `POST /api/payments/confirm { id, clientTransactionId }` → `POST .../api/button/V2/Confirm`. Si `statusCode === 3` y el monto cuadra → `paid`; si cobró pero no cuadra → `review`; si no → `failed`. Idempotente.
4. Payphone reversa solo si no se confirma en 5 min: el Confirm siempre va en el servidor, nunca se confía en el query string.

Montos en centavos. `PAYPHONE_TAX_RATE` (0 por defecto) desglosa el IVA incluido si la tienda lo necesita.

## Arquitectura

Routes → Controllers (sin lógica) → Services (lógica + Payphone) → Models. Solo `src/config/env.ts` lee `process.env`. Errores con `throw new CustomError("mensaje en español", status)`; el handler global responde `{ message }`. Respuestas desnudas; paginación `{ items, total, page, pages }`.

## Convenciones

Comillas dobles, punto y coma, 2 espacios. Archivos `x.controller.ts`, `x.service.ts`, `x.model.ts`, `x.routes.ts`. Identificadores en inglés; dominio, mensajes y comentarios en español. Comentarios explican el porqué.
