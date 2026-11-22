import { CheckCircle2, X } from "lucide-react";
import { Button } from "@payments/common";
import { formatScaledMoney } from "../../lib/quantity";

export interface ReceiptData {
  orderId?: string;
  displayId?: string;
  folio?: number;
  controlNumber?: string;
  generationCode?: string;
  mhStatus?: string;
  totalPaid: number;
  changeDue: number;
  tipAmount: number;
  requiredAmount: number;
  paymentMethod: string;
  documentType: "01" | "03";
  customerName?: string;
  issuedAt: string;
}

interface Props {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export default function ReceiptDialog({ receipt, onClose }: Props) {
  if (!receipt) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comprobante de pago"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            <h2 className="text-base font-bold">Pago registrado</h2>
          </div>
          <Button variant="ghost" size="xs" className="h-8 w-8 px-0" onClick={onClose} aria-label="Cerrar comprobante">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-col gap-3 p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Orden</span>
            <span className="font-mono text-right">{receipt.displayId ?? receipt.orderId ?? "—"}</span>
            <span className="text-muted-foreground">Documento</span>
            <span className="text-right">{receipt.documentType === "03" ? "03 · CCF" : "01 · CF"}</span>
            {receipt.customerName && <><span className="text-muted-foreground">Cliente</span><span className="text-right">{receipt.customerName}</span></>}
            <span className="text-muted-foreground">Pago</span>
            <span className="text-right">{receipt.paymentMethod}</span>
            <span className="text-muted-foreground">Total cobrado</span>
            <span className="text-right font-mono font-semibold">{formatScaledMoney(receipt.requiredAmount)}</span>
            <span className="text-muted-foreground">Pagado</span>
            <span className="text-right font-mono">{formatScaledMoney(receipt.totalPaid)}</span>
            {receipt.tipAmount > 0 && <><span className="text-muted-foreground">Propina</span><span className="text-right font-mono">{formatScaledMoney(receipt.tipAmount)}</span></>}
            {receipt.changeDue > 0 && <><span className="text-muted-foreground">Cambio</span><span className="text-right font-mono text-emerald-600 dark:text-emerald-400">{formatScaledMoney(receipt.changeDue)}</span></>}
            {typeof receipt.folio === "number" && <><span className="text-muted-foreground">Folio</span><span className="text-right font-mono">#{receipt.folio}</span></>}
            {receipt.controlNumber && <><span className="text-muted-foreground">Control</span><span className="text-right font-mono break-all">{receipt.controlNumber}</span></>}
            {receipt.generationCode && <><span className="text-muted-foreground">Generación</span><span className="text-right font-mono break-all">{receipt.generationCode}</span></>}
            {receipt.mhStatus && <><span className="text-muted-foreground">Estado MH</span><span className="text-right">{receipt.mhStatus}</span></>}
          </div>
          <p className="text-xs text-muted-foreground">Emitido: {new Date(receipt.issuedAt).toLocaleString("es-SV")}</p>
          <Button variant="accent" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
