import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThermalReceiptPrint from "../src/components/pay/ThermalReceiptPrint";
import ShiftDrawerDialog from "../src/components/pay/ShiftDrawerDialog";

const shiftApi = vi.hoisted(() => ({
  fetchCurrentShift: vi.fn(),
  fetchShiftReport: vi.fn(),
  openShift: vi.fn(),
  recordShiftMovement: vi.fn(),
  closeShift: vi.fn(),
  getCurrentEmissionPoint: vi.fn(() => "M001"),
  resolveTenantId: vi.fn(() => "tenant_test"),
}));

vi.mock("../src/lib/api", () => ({
  ...shiftApi,
}));

vi.mock("../src/store/auth", () => ({
  useAuthStore: (selector: any) => selector({ operatorId: "op1", operatorName: "Cajero 1", businessId: "biz1" }),
}));

describe("SPEC-WPAY2 shifts and thermal receipt", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders thermal receipt with fiscal data and switches width", () => {
    const onWidth = vi.fn();
    render(
      <ThermalReceiptPrint
        width="80mm"
        onWidthChange={onWidth}
        data={{
          tenantId: "tenant_test",
          emissionPoint: "M001",
          operatorName: "Cajero 1",
          documentType: "01",
          controlNumber: "DTE-01-M001-00000001",
          generationCode: "ABC-123",
          mhStatus: "PROCESSED",
          paymentMethod: "Efectivo",
          items: [{ description: "Cafe", quantity: 10000, unitPrice: 25000, lineTotal: 25000 }],
          subtotal: 25000,
          tipAmount: 0,
          total: 25000,
          totalPaid: 30000,
          changeDue: 5000,
          issuedAt: "2026-11-22T10:00:00Z",
        }}
      />,
    );

    expect(screen.getByText(/DTE-01-M001-00000001/)).toBeInTheDocument();
    expect(screen.getAllByText(/ABC-123/).length).toBeGreaterThan(0);
    expect(screen.getByAltText(/QR verificación MH/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "58mm" }));
    expect(onWidth).toHaveBeenCalledWith("58mm");
  });

  it("opens and closes a shift with X/Z report flow", async () => {
    shiftApi.fetchCurrentShift.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "s1", status: "OPEN", emission_point: "M001", operator_id: "op1", opening_cash: 100000,
      cash_sales: 200000, cash_in: 0, cash_out: 0, expected_cash: 300000,
    }).mockResolvedValueOnce({
      id: "s1", status: "CLOSED", emission_point: "M001", operator_id: "op1", opening_cash: 100000,
      expected_cash: 300000, counted_cash: 300000, difference_cash: 0,
    });
    shiftApi.fetchShiftReport.mockResolvedValue({
      shift: { id: "s1", status: "OPEN", emission_point: "M001", operator_id: "op1", opening_cash: 100000, expected_cash: 300000 },
      movements: [],
      totals: { cash_sales: 200000, card_sales: 0, transfer_sales: 0, total_sales: 200000, cash_in: 0, cash_out: 0, expected_cash: 300000 },
    });
    shiftApi.openShift.mockResolvedValue({
      id: "s1", status: "OPEN", emission_point: "M001", operator_id: "op1", opening_cash: 100000, expected_cash: 100000,
    });
    shiftApi.closeShift.mockResolvedValue({
      shift: { id: "s1", status: "CLOSED", emission_point: "M001", operator_id: "op1", opening_cash: 100000, expected_cash: 300000, counted_cash: 300000, difference_cash: 0 },
      report: { shift: { id: "s1", status: "CLOSED", emission_point: "M001", operator_id: "op1", opening_cash: 100000 }, movements: [], totals: { expected_cash: 300000 } },
    });

    const onShiftChange = vi.fn();
    render(<ShiftDrawerDialog open onClose={vi.fn()} onShiftChange={onShiftChange} />);

    await screen.findByText(/Apertura de Turno/i);
    fireEvent.change(screen.getByLabelText(/Fondo inicial \(USD\)/i), { target: { value: "10.00" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir caja/i }));
    await waitFor(() => expect(shiftApi.openShift).toHaveBeenCalled());

    await screen.findByText(/Cierre Definitivo Z|Corte X \/ Cierre Z/i);
    fireEvent.change(screen.getByLabelText(/Efectivo contado \(USD\)/i), { target: { value: "30.00" } });
    fireEvent.click(screen.getByRole("button", { name: /Cerrar turno \(Z\)/i }));
    await waitFor(() => expect(shiftApi.closeShift).toHaveBeenCalledWith("s1", { counted_cash: 300000 }));
  });
});
