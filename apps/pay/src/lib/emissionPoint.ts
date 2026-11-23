export const DEFAULT_EMISSION_POINT = "M001";
export const EMISSION_POINT_PATTERN = /^[A-Z0-9]{4}$/;

function storageKey(businessId: string): string {
  return `ware-pay.emissionPoint.${businessId}`;
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidEmissionPoint(value: string): boolean {
  return EMISSION_POINT_PATTERN.test(normalize(value));
}

export function getEmissionPoint(businessId: string): string {
  if (typeof window === "undefined" || !businessId) return DEFAULT_EMISSION_POINT;
  try {
    const stored = normalize(window.localStorage.getItem(storageKey(businessId)) ?? "");
    if (isValidEmissionPoint(stored)) return stored;
  } catch {
    // restricted storage
  }
  return DEFAULT_EMISSION_POINT;
}

export function setEmissionPoint(businessId: string, value: string): string {
  const normalized = normalize(value);
  if (!isValidEmissionPoint(normalized)) {
    throw new Error("El punto de emisión debe tener 4 caracteres alfanuméricos (ej. M001, P001).");
  }
  if (typeof window !== "undefined" && businessId) {
    try {
      window.localStorage.setItem(storageKey(businessId), normalized);
    } catch {
      // keep normalized in-memory behavior
    }
  }
  return normalized;
}
