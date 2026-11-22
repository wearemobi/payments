import { Search } from "lucide-react";
import { Badge, Button, Card, Input, cn } from "@payments/common";
import type { Business, Order, UnpaidOrderOrigin } from "../../lib/api";
import { formatScaledMoney } from "../../lib/quantity";

interface Props {
  orders: Order[];
  selectedOrderId: string | null;
  onSelect: (order: Order) => void;
  search: string;
  onSearchChange: (value: string) => void;
  origin: UnpaidOrderOrigin;
  onOriginChange: (origin: UnpaidOrderOrigin) => void;
  businesses: Business[];
  activeBusinessId: string;
  onBusinessChange: (id: string) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

const ORIGIN_TABS: { value: UnpaidOrderOrigin; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "KITCHEN", label: "Cocina" },
  { value: "RETAIL", label: "Tienda" },
];

function channelLabel(order: Order): string {
  const type = (order.order_type ?? "").toUpperCase();
  const channel = (order.source_channel ?? "").toUpperCase();
  return channel || type || "—";
}

function channelVariant(order: Order): "default" | "secondary" | "accent" | "outline" {
  const type = (order.order_type ?? "").toUpperCase();
  if (["DINE_IN", "TAKEAWAY", "DELIVERY"].includes(type)) return "accent";
  if (["WHATSAPP", "INSTAGRAM", "ECOMMERCE"].includes(type)) return "secondary";
  return "outline";
}

function waitMinutes(order: Order): number | null {
  const created = order.created_at;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 60000));
}

export default function OrderQueuePanel({
  orders,
  selectedOrderId,
  onSelect,
  search,
  onSearchChange,
  origin,
  onOriginChange,
  businesses,
  activeBusinessId,
  onBusinessChange,
  loading,
  error,
  onRetry,
}: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Órdenes por cobrar</h2>
          <Badge variant="outline" className="font-mono text-[11px]">
            {orders.length}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ORIGIN_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onOriginChange(tab.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                origin === tab.value
                  ? "bg-accent-brand text-accent-brand-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar #ORD o cliente…"
              aria-label="Buscar orden"
              className="pl-9"
            />
          </div>
          {businesses.length > 1 && (
            <select
              aria-label="Filtrar por negocio"
              value={activeBusinessId}
              onChange={(e) => onBusinessChange(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-medium"
            >
              <option value="">Todos los negocios</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && <p className="p-3 text-sm text-muted-foreground">Cargando órdenes…</p>}
        {!loading && error && (
          <div className="flex flex-col gap-2 p-3">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry} className="self-start">Reintentar</Button>
          </div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm font-medium">No hay órdenes pendientes</p>
            <p className="text-xs text-muted-foreground">Las órdenes UNPAID aparecerán aquí.</p>
          </div>
        )}
        {!loading && !error && orders.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Órdenes pendientes de cobro">
            {orders.map((order) => {
              const id = order.id ?? "";
              const selected = id === selectedOrderId;
              const wait = waitMinutes(order);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelect(order)}
                    className={cn(
                      "flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-accent-brand bg-accent-brand-soft"
                        : "border-border bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-sm font-semibold">
                          {order.display_id || `#${id.slice(0, 8)}`}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {order.customer_name || "Consumidor Final"}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold">
                        {formatScaledMoney(order.total_amount ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={channelVariant(order)} className="text-[10px]">
                        {channelLabel(order)}
                      </Badge>
                      {order.status && (
                        <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
                      )}
                      {wait !== null && (
                        <span className="ml-auto text-[11px] text-muted-foreground">{wait} min</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
