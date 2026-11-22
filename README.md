# M.O.B.I.™ Payments Satellite (`pay.mobiware.app`)

Terminal satélite transversal de Pagos y Caja conforme a [`ADR-008`](../wiki/productos/facturacion-electronica/specs/adr/ADR-008-item-order-master-and-payments-satellite.md) y [`SPEC-WPAY1`](../wiki/productos/facturacion-electronica/specs/payments/SPEC-WPAY1.md).

## Estructura
- `packages/common`: Componentes UI `shadcn` base-nova (`@payments/common`), cliente `openapi-fetch`, auth/PIN y temas.
- `apps/pay`: Satélite Cloudflare Worker / Vite SPA desplegado en `pay.mobiware.app`.
