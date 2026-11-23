import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { SatelliteHeader, type SatelliteTheme } from "@payments/common";
import {
  fetchBusinesses,
  fetchCurrentShift,
  fetchOrderDetail,
  fetchUnpaidOrders,
  getCurrentEmissionPoint,
  resolveTenantId,
  type Business,
  type CashShift,
  type Order,
  type OrderItem,
  type UnpaidOrderOrigin,
} from "../../lib/api";
import DeviceSettingsDialog from "./DeviceSettingsDialog";
import ShiftDrawerDialog from "./ShiftDrawerDialog";
import { formatScaledMoney } from "../../lib/quantity";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { storedBusinessId, useAuthStore } from "../../store/auth";
import OrderQueuePanel from "./OrderQueuePanel";
import OrderSettlementPanel from "./OrderSettlementPanel";

type FontScale = "sm" | "base" | "lg";
const SCALE_KEY = "ware-pay.fontScale";

function readScale(): FontScale {
  try {
    const v = window.localStorage.getItem(SCALE_KEY);
    return v === "sm" || v === "lg" ? v : "base";
  } catch { return "base"; }
}
function scaleMultiplier(s: FontScale): number { return s === "sm" ? 0.92 : s === "lg" ? 1.1 : 1; }

interface Props { theme?: SatelliteTheme; onToggleTheme?: () => void; }

export default function PayScreen({ theme, onToggleTheme }: Props) {
  const operatorName = useAuthStore((s) => s.operatorName) || "Cajero";
  const logout = useAuthStore((s) => s.logout);
  const activeBusinessId = useAuthStore((s) => s.businessId);
  const setBusinessId = useAuthStore((s) => s.setBusinessId);

  const [fontScale, setFontScale] = useState<FontScale>(readScale);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<UnpaidOrderOrigin>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);
  const [emissionVersion, setEmissionVersion] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const emissionPoint = useMemo(() => getCurrentEmissionPoint(activeBusinessId), [activeBusinessId, emissionVersion]);

  useEffect(() => { try { window.localStorage.setItem(SCALE_KEY, fontScale); } catch {} }, [fontScale]);

  useEffect(() => {
    let cancelled = false;
    fetchBusinesses().then((list) => {
      if (cancelled) return;
      setBusinesses(list);
      const candidate =
        list.find((b) => b.id === activeBusinessId) ??
        list.find((b) => b.id === storedBusinessId(resolveTenantId())) ??
        list[0];
      if (candidate?.id && candidate.id !== activeBusinessId) setBusinessId(candidate.id);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const operatorId = useAuthStore.getState().operatorId;
    if (!operatorId) return;
    fetchCurrentShift(operatorId, emissionPoint)
      .then((s) => { if (!cancelled) setCurrentShift(s?.status === "OPEN" ? s : null); })
      .catch(() => { if (!cancelled) setCurrentShift(null); });
    return () => { cancelled = true; };
  }, [emissionPoint, emissionVersion]);

  const loadOrders = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchUnpaidOrders({ search: debouncedSearch, businessId: activeBusinessId || undefined, origin })
      .then((list) => { if (!cancelled) setOrders(list); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, activeBusinessId, origin]);

  useEffect(() => {
    const cancel = loadOrders();
    return cancel;
  }, [loadOrders, refreshToken]);

  useEffect(() => {
    if (!selectedId) { setDetailItems([]); return; }
    let cancelled = false;
    setItemsLoading(true);
    fetchOrderDetail(selectedId)
      .then((d) => { if (!cancelled) setDetailItems(d.items ?? []); })
      .catch(() => { if (!cancelled) setDetailItems([]); })
      .finally(() => { if (!cancelled) setItemsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const pendingTotal = orders.reduce((a, o) => a + (o.total_amount ?? 0), 0);

  function handleSettled() {
    setSelectedId(null);
    setDetailItems([]);
    setRefreshToken((t) => t + 1);
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <SatelliteHeader
        title="MobiWare Payments"
        subtitle="Terminal de caja y pagos"
        tenantId={resolveTenantId()}
        icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        metrics={[
          { label: "En cola", value: orders.length },
          { label: "Pendiente", value: formatScaledMoney(pendingTotal) },
        ]}
        operatorName={operatorName}
        controls={
          <>
            {businesses.length > 1 ? (
              <select
                aria-label="Negocio activo"
                value={activeBusinessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="h-7 rounded-lg border border-border bg-background px-2 text-xs font-medium"
              >
                <option value="">Todos</option>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : businesses.length === 1 ? (
              <span className="text-xs text-muted-foreground">{businesses[0]?.name}</span>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="h-7 rounded-lg border border-border bg-background px-2 text-xs font-mono font-medium hover:bg-muted"
              aria-label="Configurar caja"
              title="Configurar punto de emisión"
            >
              {emissionPoint}
            </button>
            <button
              type="button"
              onClick={() => setShiftOpen(true)}
              className={currentShift ? "h-7 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400" : "h-7 rounded-lg border border-border bg-background px-2 text-xs font-medium hover:bg-muted"}
              aria-label={currentShift ? "Turno abierto" : "Abrir caja"}
            >
              {currentShift ? "Turno Abierto" : "Abrir Caja"}
            </button>
            <div role="group" aria-label="Escala" className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
              {(["sm", "base", "lg"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setFontScale(s)} aria-pressed={fontScale === s}
                  className={fontScale === s ? "rounded-md bg-accent-brand px-2 py-1 font-bold text-accent-brand-foreground" : "rounded-md px-2 py-1 font-bold text-muted-foreground hover:bg-muted"}>
                  {s === "sm" ? "A-" : s === "lg" ? "A+" : "A"}
                </button>
              ))}
            </div>
          </>
        }
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={logout}
      />

      <main className="min-h-0 flex-1 p-3" style={{ zoom: scaleMultiplier(fontScale) }}>
        <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <OrderQueuePanel
            orders={orders}
            selectedOrderId={selectedId}
            onSelect={(o) => setSelectedId(o.id ?? null)}
            search={search}
            onSearchChange={setSearch}
            origin={origin}
            onOriginChange={setOrigin}
            businesses={businesses}
            activeBusinessId={activeBusinessId}
            onBusinessChange={setBusinessId}
            loading={loading}
            error={error}
            onRetry={() => setRefreshToken((t) => t + 1)}
          />
          <OrderSettlementPanel
            order={selectedOrder}
            items={detailItems}
            itemsLoading={itemsLoading}
            onSettled={handleSettled}
          />
        </div>
      </main>

      <DeviceSettingsDialog
        open={settingsOpen}
        businessId={activeBusinessId}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setEmissionVersion((v) => v + 1)}
        shiftOpen={!!currentShift}
      />

      <ShiftDrawerDialog
        open={shiftOpen}
        onClose={() => setShiftOpen(false)}
        onShiftChange={(s) => setCurrentShift(s?.status === "OPEN" ? s : null)}
      />
    </div>
  );
}
