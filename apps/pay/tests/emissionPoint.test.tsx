import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_EMISSION_POINT, getEmissionPoint, setEmissionPoint } from "../src/lib/emissionPoint";

describe("SPEC-WPAY3 emission point", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to M001 when missing or invalid", () => {
    expect(getEmissionPoint("biz-1")).toBe(DEFAULT_EMISSION_POINT);
    localStorage.setItem("ware-pay.emissionPoint.biz-1", "bad");
    expect(getEmissionPoint("biz-1")).toBe("M001");
  });

  it("persists valid emission point per business", () => {
    expect(setEmissionPoint("biz-1", "p002")).toBe("P002");
    expect(getEmissionPoint("biz-1")).toBe("P002");
    expect(getEmissionPoint("biz-2")).toBe("M001");
  });

  it("rejects invalid format", () => {
    expect(() => setEmissionPoint("biz-1", "M-1")).toThrow(/4 caracteres alfanuméricos/);
  });
it("blocks save when shift is open in dialog", async () => {
  const { render, screen, fireEvent } = await import("@testing-library/react");
  const { default: DeviceSettingsDialog } = await import("../src/components/pay/DeviceSettingsDialog");
  render(<DeviceSettingsDialog open businessId="biz-1" onClose={() => {}} onSaved={() => {}} shiftOpen />);
  expect(screen.getByRole("button", { name: /Guardar/i })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Punto de emisión/i), { target: { value: "P002" } });
  expect(screen.getByText(/turno abierto/i)).toBeInTheDocument();
});
});
