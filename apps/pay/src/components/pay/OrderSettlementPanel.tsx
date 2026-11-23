import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input } from "@payments/common";
import {
  fetchCustomers,
  getCurrentEmissionPoint,
  newIdempotencyKey,
  resolveTenantId,
  submitOrderCheckout,
  type Customer,
  type Order,
  type OrderCheckoutRequest,
  type OrderItem,
} from "../../lib/api";
import { formatScaledMoney, fromScaled, parseMoneyInput } from "../../lib/quantity";
import { useAuthStore } from "../../store/auth";
import ReceiptDialog, { type ReceiptData } from "./ReceiptDialog";

type DocumentType = "01" | "03";
type PaymentMethod = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "TRANSFER";

interface PaymentRow {
  id: string;
  method: PaymentMethod;
  amountInput: string;
  reference: string;
}

interface Props {
  order: Order | null;
  items: OrderItem[];
  itemsLoading: boolean;
  onSettled: () => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "CREDIT_CARD", label: "Tarjeta crédito" },
  { value: "DEBIT_CARD", label: "Tarjeta débito" },
  { value: "TRANSFER", label: "Transferencia" },
];

function mkRow(method: PaymentMethod = "CASH", amountInput = ""): PaymentRow {
  return { id: `p-${Date.now()}-${Math.random().toString(16).slice(2)}`, method, amountInput, reference: "" };
}

export function computeTotals(orderTotal: number, tipScaled: number, payments: { method: PaymentMethod; amount: number }[]) {
  const requiredAmount = orderTotal + tipScaled;
  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
  const cashPaid = payments.filter((p) => p.method === "CASH").reduce((a, p) => a + p.amount, 0);
  const nonCashPaid = totalPaid - cashPaid;
  const changeDue = Math.max(0, cashPaid - Math.max(0, requiredAmount - nonCashPaid));
  const remaining = Math.max(0, requiredAmount - totalPaid);
  return { requiredAmount, totalPaid, changeDue, remaining };
}

export default function OrderSettlementPanel({ order, items, itemsLoading, onSettled }: Props) {
  const activeBusinessId = useAuthStore((s) => s.businessId);
  const [documentType, setDocumentType] = useState<DocumentType>("01");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tipPercent, setTipPercent] = useState<0 | 10 | null>(0);
  const [tipInput, setTipInput] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([mkRow("CASH")]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const orderTotal = order?.total_amount ?? 0;

  useEffect(() => {
    setDocumentType("01");
    setCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setTipPercent(0);
    setTipInput("");
    setPayments([mkRow("CASH", fromScaled(orderTotal).toFixed(2))]);
    setError("");
    setReceipt(null);
  }, [order?.id, orderTotal]);

  useEffect(() => {
    if (documentType !== "03") return;
    const term = customerSearch.trim();
    if (term.length < 2) { setCustomerResults([]); return; }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchCustomers(term).then((r) => { if (!cancelled) setCustomerResults(r); }).catch(() => {});
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [customerSearch, documentType]);

  const tipScaled = useMemo(() => {
    if (tipPercent !== null) return Math.round((orderTotal * tipPercent) / 100);
    return parseMoneyInput(tipInput) ?? 0;
  }, [tipPercent, tipInput, orderTotal]);

  const parsedPayments = useMemo(() => payments.map((p) => ({
    ...p,
    amount: parseMoneyInput(p.amountInput) ?? 0,
  })), [payments]);

  const totals = useMemo(() => computeTotals(orderTotal, tipScaled, parsedPayments.map((p) => ({ method: p.method, amount: p.amount }))), [orderTotal, tipScaled, parsedPayments]);

  const canSubmit = !!order && !submitting && !itemsLoading && items.length > 0 &&
    totals.remaining === 0 &&
    parsedPayments.every((p) => p.amount > 0) &&
    (documentType === "01" || (!!customer && !!(customer.tax_id ?? "").trim()));

  function updatePayment(id: string, patch: Partial<PaymentRow>) {
    setPayments((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removePayment(id: string) {
    setPayments((rows) => rows.length > 1 ? rows.filter((r) => r.id !== id) : rows);
  }
  function addPayment() {
    setPayments((rows) => [...rows, mkRow("CASH", fromScaled(totals.remaining).toFixed(2))]);
  }

  async function handleSubmit() {
    if (!canSubmit || !order?.id) return;
    setSubmitting(true);
    setError("");
    try {
      const payload: OrderCheckoutRequest = {
        document_type: documentType,
        emission_point: getCurrentEmissionPoint(activeBusinessId),
        payments: parsedPayments.map((p) => {
          const row: any = { payment_method: p.method, amount: fromScaled(p.amount) };
          if (p.reference.trim()) row.reference = p.reference.trim();
          return row;
        }) as any,
        tip_amount: fromScaled(tipScaled).toFixed(4) as any,
      };
      if (documentType === "03" && customer) {
        (payload as any).customer = {
          customer_id: String(customer.id),
          name: customer.legal_name ?? "",
          tax_id: customer.tax_id ?? "",
          document_type: "36",
        };
      }
      const key = newIdempotencyKey();
      const response = await submitOrderCheckout(order.id, payload, key);
      setReceipt({
        orderId: response.order_id ?? order.id,
        displayId: response.display_id ?? order.display_id,
        folio: response.folio_number,
        generationCode: response.fiscal_document?.generation_code,
        mhStatus: response.fiscal_document?.mh_status,
        controlNumber: (response.fiscal_document as any)?.control_number,
        totalPaid: response.total_paid ? Math.round(Number(response.total_paid) * 10000) : totals.totalPaid,
        changeDue: response.change_amount ? Math.round(Number(response.change_amount) * 10000) : totals.changeDue,
        tipAmount: tipScaled,
        requiredAmount: totals.requiredAmount,
        paymentMethod: parsedPayments.map((p) => METHODS.find((m) => m.value === p.method)?.label ?? p.method).join(" + "),
        documentType,
        customerName: customer?.legal_name,
        customerTaxId: customer?.tax_id,
        issuedAt: new Date().toISOString(),
        subtotal: orderTotal,
        items: items.map((it) => ({
          description: it.name ?? it.sku ?? "Ítem",
          quantity: it.quantity ?? 0,
          unitPrice: it.unit_price ?? 0,
          lineTotal: it.line_total ?? Math.round(((it.quantity ?? 0) * (it.unit_price ?? 0)) / 10000),
        })),
        tenantId: resolveTenantId(),
        emissionPoint: getCurrentEmissionPoint(activeBusinessId),
        operatorName: useAuthStore.getState().operatorName,
      });
      onSettled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo liquidar la orden.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!order) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <CreditCard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">Selecciona una orden</p>
        <p className="text-xs text-muted-foreground">El detalle y liquidación aparecerán aquí.</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Liquidación {order.display_id ?? `#${(order.id ?? "").slice(0, 8)}`}</h2>
            <Badge variant="outline">{formatScaledMoney(orderTotal)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{order.customer_name || "Consumidor Final"}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ítems</h3>
              {itemsLoading ? (
                <p className="text-xs text-muted-foreground">Cargando ítems…</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((it, idx) => (
                    <li key={it.id ?? idx} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">{it.name ?? it.sku ?? "Ítem"} <span className="text-muted-foreground">x{fromScaled(it.quantity ?? 0)}</span></span>
                      <span className="font-mono">{formatScaledMoney(it.line_total ?? Math.round(((it.quantity ?? 0) * (it.unit_price ?? 0)) / 10000))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={documentType === "01" ? "default" : "outline"} onClick={() => setDocumentType("01")}>01 · CF</Button>
                <Button type="button" variant={documentType === "03" ? "default" : "outline"} onClick={() => setDocumentType("03")}>03 · CCF</Button>
              </div>
              {documentType === "03" && (
                <div className="flex flex-col gap-2">
                  <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Buscar cliente por nombre/NIT…" aria-label="Buscar cliente fiscal" />
                  {customer && <p className="text-xs text-muted-foreground">Seleccionado: <span className="font-medium text-foreground">{customer.legal_name}</span> {customer.tax_id ? `(${customer.tax_id})` : ""}</p>}
                  {customerResults.length > 0 && (
                    <ul className="flex max-h-32 flex-col overflow-y-auto rounded-lg border border-border">
                      {customerResults.map((c) => (
                        <li key={String(c.id)}>
                          <button type="button" className="flex w-full flex-col px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { setCustomer(c); setCustomerResults([]); setCustomerSearch(c.legal_name ?? ""); }}>
                            <span className="font-medium">{c.legal_name}</span>
                            <span className="text-muted-foreground">{c.tax_id || "Sin NIT"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propina</h3>
              <div className="flex flex-wrap gap-2">
                {[0, 10].map((pct) => (
                  <Button key={pct} type="button" size="sm" variant={tipPercent === pct ? "default" : "outline"} onClick={() => { setTipPercent(pct as 0 | 10); setTipInput(""); }}>
                    {pct}%
                  </Button>
                ))}
                <Input
                  className="w-28"
                  value={tipPercent === null ? tipInput : ""}
                  onChange={(e) => { setTipPercent(null); setTipInput(e.target.value); }}
                  placeholder="Manual"
                  aria-label="Propina manual"
                  inputMode="decimal"
                />
              </div>
              <p className="text-xs text-muted-foreground">Propina: {formatScaledMoney(tipScaled)}</p>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagos</h3>
                <Button type="button" variant="outline" size="xs" onClick={addPayment}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Agregar</Button>
              </div>
              <div className="flex flex-col gap-2">
                {payments.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 rounded-lg border border-border p-2">
                    <select className="col-span-4 h-9 rounded-md border border-border bg-background px-2 text-xs" aria-label={`Método pago ${idx + 1}`} value={p.method} onChange={(e) => updatePayment(p.id, { method: e.target.value as PaymentMethod })}>
                      {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <Input className="col-span-3" aria-label={`Monto pago ${idx + 1}`} value={p.amountInput} onChange={(e) => updatePayment(p.id, { amountInput: e.target.value })} inputMode="decimal" placeholder="0.00" />
                    <Input className="col-span-4" aria-label={`Referencia pago ${idx + 1}`} value={p.reference} onChange={(e) => updatePayment(p.id, { reference: e.target.value })} placeholder="Ref / Auth" />
                    <Button type="button" variant="ghost" size="xs" className="col-span-1 px-0" onClick={() => removePayment(p.id)} aria-label={`Eliminar pago ${idx + 1}`} disabled={payments.length === 1}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">Subtotal orden</span><span className="text-right font-mono">{formatScaledMoney(orderTotal)}</span>
            <span className="text-muted-foreground">Propina</span><span className="text-right font-mono">{formatScaledMoney(tipScaled)}</span>
            <span className="font-medium">Total a cobrar</span><span className="text-right font-mono font-semibold">{formatScaledMoney(totals.requiredAmount)}</span>
            <span className="text-muted-foreground">Total pagado</span><span className="text-right font-mono">{formatScaledMoney(totals.totalPaid)}</span>
            <span className="text-muted-foreground">Cambio</span><span className="text-right font-mono text-emerald-600 dark:text-emerald-400">{formatScaledMoney(totals.changeDue)}</span>
            {totals.remaining > 0 && <><span className="text-destructive">Falta</span><span className="text-right font-mono text-destructive">{formatScaledMoney(totals.remaining)}</span></>}
          </div>
          <Button variant="accent" className="w-full" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
            Cobrar y Emitir DTE
          </Button>
        </div>
      </Card>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
