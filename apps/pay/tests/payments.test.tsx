import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import OrderQueuePanel from "../src/components/pay/OrderQueuePanel";
import { computeTotals } from "../src/components/pay/OrderSettlementPanel";
import { fetchUnpaidOrders, matchesOrigin, submitOrderCheckout, type Order } from "../src/lib/api";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@payments/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@payments/common")>();
  return {
    ...actual,
    createApiClient: () => ({ GET: apiMock.get, POST: apiMock.post }),
    parseApiError: (_: unknown, fallback: string) => fallback,
    resolveTenantId: () => "tenant_test",
  };
});

vi.mock("../src/store/auth", () => ({
  useAuthStore: { getState: () => ({ token: "tok", logout: vi.fn() }) },
}));

describe("SPEC-WPAY1 payments satellite", () => {
  afterEach(() => {
    cleanup();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
  });

  it("filters UNPAID queue by origin", () => {
    const kitchen: Order = { id: "1", order_type: "DINE_IN", app_id: "ware-kitchen" } as any;
    const retail: Order = { id: "2", order_type: "WHATSAPP", app_id: "ware-retail" } as any;
    expect(matchesOrigin(kitchen, "KITCHEN")).toBe(true);
    expect(matchesOrigin(kitchen, "RETAIL")).toBe(false);
    expect(matchesOrigin(retail, "RETAIL")).toBe(true);
    expect(matchesOrigin(retail, "ALL")).toBe(true);
  });

  it("calculates mixed payments, tip and change in 10^-4 scale", () => {
    // order 35.5000, tip 3.5500 => required 39.0500 (390500)
    const totals = computeTotals(355000, 35500, [
      { method: "CASH", amount: 200000 },       // $20.00
      { method: "CREDIT_CARD", amount: 190500 }, // $19.05
    ]);
    expect(totals.requiredAmount).toBe(390500);
    expect(totals.totalPaid).toBe(390500);
    expect(totals.changeDue).toBe(0);
    expect(totals.remaining).toBe(0);

    const change = computeTotals(100000, 0, [{ method: "CASH", amount: 150000 }]);
    expect(change.changeDue).toBe(50000);
    expect(change.remaining).toBe(0);
  });

  it("requests UNPAID orders excluding cancelled and filters by business", async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { items: [
        { id: "o1", business_id: "b1", order_type: "DINE_IN", payment_status: "UNPAID" },
        { id: "o2", business_id: "b2", order_type: "DINE_IN", payment_status: "UNPAID" },
      ]},
      error: null,
    });
    const orders = await fetchUnpaidOrders({ businessId: "b1", origin: "KITCHEN" });
    expect(orders.map((o) => o.id)).toEqual(["o1", "o2"]); // API filtered by business; origin filter client-side
    expect(apiMock.get).toHaveBeenCalledWith("/v1/orders", expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({ payment_status: "UNPAID", exclude_cancelled: true, business: "b1" }),
      }),
    }));
  });

  it("submits checkout with Idempotency-Key to /v1/orders/{id}/checkout", async () => {
    apiMock.post.mockResolvedValueOnce({ data: { order_id: "o1", total_paid: "10.0000" }, error: null });
    await submitOrderCheckout("o1", { document_type: "01", payments: [{ payment_method: "CASH", amount: 10 }] } as any, "idem-1");
    expect(apiMock.post).toHaveBeenCalledWith("/v1/orders/{id}/checkout", expect.objectContaining({
      params: expect.objectContaining({
        path: { id: "o1" },
        header: expect.objectContaining({ "Idempotency-Key": "idem-1" }),
      }),
    }));
  });

  it("renders queue and allows selecting an UNPAID order", () => {
    const onSelect = vi.fn();
    render(
      <OrderQueuePanel
        orders={[
          { id: "o1", display_id: "#ORD-1", customer_name: "Ana", total_amount: 125000, order_type: "DINE_IN", source_channel: "KITCHEN", status: "READY", created_at: new Date().toISOString() } as any,
        ]}
        selectedOrderId={null}
        onSelect={onSelect}
        search=""
        onSearchChange={vi.fn()}
        origin="ALL"
        onOriginChange={vi.fn()}
        businesses={[]}
        activeBusinessId=""
        onBusinessChange={vi.fn()}
        loading={false}
        error=""
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("#ORD-1")).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /#ORD-1/i }));
    expect(onSelect).toHaveBeenCalled();
  });
});
