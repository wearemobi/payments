# M.O.B.I.™ Payments Satellite (`pay.mobiware.app`)

Terminal satélite transversal de Pagos y Caja conforme a [`ADR-008`](../wiki/productos/facturacion-electronica/specs/adr/ADR-008-item-order-master-and-payments-satellite.md) y [`SPEC-WPAY1`](../wiki/productos/facturacion-electronica/specs/payments/SPEC-WPAY1.md).

## Estructura
- `packages/common`: Componentes UI `shadcn` base-nova (`@payments/common`), cliente `openapi-fetch`, auth/PIN y temas.
- `apps/pay`: Satélite Cloudflare Worker / Vite SPA desplegado en `pay.mobiware.app`.

## Despliegue

`apps/pay` se publica como **Worker con Static Assets** (`wrangler deploy`). El
`wrangler.jsonc` declara `routes[].custom_domain: true`, de modo que el deploy crea
el registro DNS proxied de `pay.mobiware.app` automáticamente.

```bash
pnpm --filter @payments/pay run build
pnpm deploy:pay        # build + wrangler deploy

# Verificación
curl -I https://pay.mobiware.app
npx wrangler deployments list --name ware-pay
```

> No usar `wrangler pages deploy`: el proyecto no es Pages y los dominios
> personalizados de Pages no son declarativos vía `wrangler.jsonc`.
