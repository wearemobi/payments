import { createAuthStore, type OperatorSession } from "@payments/common";

export type { OperatorSession };

export const BUSINESS_STORAGE_PREFIX = "ware-pay.businessId.";

export interface PayAuthState {
  token: string;
  tenantId: string;
  operatorId: string;
  operatorName: string;
  roles: string[];
  expiresAtUnix: number;
  login: (session: OperatorSession) => void;
  logout: () => void;
  /** Active orders.business of this terminal (SPEC-WPAY1/WRTL3). */
  businessId: string;
  setBusinessId: (businessId: string) => void;
}

const baseStore = createAuthStore("ware-pay.auth");

function readUrlBusinessId(): string {
  if (typeof window === "undefined") return "";
  try {
    return (new URLSearchParams(window.location.search).get("b") ?? "").trim();
  } catch {
    return "";
  }
}

baseStore.setState({
  businessId: readUrlBusinessId(),
  setBusinessId: (businessId: string) => {
    baseStore.setState({ businessId: businessId.trim() } as never);
    const tenantId = baseStore.getState().tenantId;
    if (!tenantId) return;
    try {
      if (businessId.trim()) {
        window.localStorage.setItem(`${BUSINESS_STORAGE_PREFIX}${tenantId}`, businessId.trim());
      } else {
        window.localStorage.removeItem(`${BUSINESS_STORAGE_PREFIX}${tenantId}`);
      }
    } catch {
      // restricted storage: keep in-memory selection only
    }
  },
} as never);

export function storedBusinessId(tenantId: string): string {
  if (!tenantId || typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(`${BUSINESS_STORAGE_PREFIX}${tenantId}`) ?? "").trim();
  } catch {
    return "";
  }
}

export const useAuthStore = baseStore as unknown as {
  <T>(selector: (state: PayAuthState) => T): T;
  getState: () => PayAuthState;
  setState: (partial: Partial<PayAuthState>) => void;
  subscribe: typeof baseStore.subscribe;
};
