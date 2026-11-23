import {
  createApiClient,
  fetchCashiers as commonFetchCashiers,
  loginWithPin as commonLoginWithPin,
  parseApiError,
  resolveTenantId as commonResolveTenantId,
  type Cashier,
  type PinLoginResponse,
  type paths,
} from "@payments/common";
import { useAuthStore } from "../store/auth";
import { getEmissionPoint as getStoredEmissionPoint } from "./emissionPoint";

export const TENANT_STORAGE_KEY = "ware-pay.tenant";

export function resolveTenantId(): string {
  return commonResolveTenantId(TENANT_STORAGE_KEY);
}

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.MODE === "development" ? "" : "https://api.mobiware.app");

export const api = createApiClient({
  resolveTenantId,
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().logout(),
  baseUrl: API_BASE_URL,
});

export type { Cashier, PinLoginResponse };

export type Customer = NonNullable<
  paths["/v1/customers"]["get"]["responses"]["200"]["content"]["application/json"]["items"]
>[number];

type OrdersListPayload =
  paths["/v1/orders"]["get"]["responses"]["200"]["content"]["application/json"];

export type Order = NonNullable<OrdersListPayload["items"]>[number];

type OrderDetailPayload =
  paths["/v1/orders/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type OrderDetailResponse = OrderDetailPayload;
export type OrderItem = NonNullable<OrderDetailPayload["items"]>[number];

export type OrderCheckoutRequest =
  paths["/v1/orders/{id}/checkout"]["post"]["requestBody"]["content"]["application/json"];

export type OrderCheckoutResponse =
  paths["/v1/orders/{id}/checkout"]["post"]["responses"]["200"]["content"]["application/json"];

export interface Business {
  id?: string;
  tenant_id?: string;
  name?: string;
  display_prefix?: string;
  status?: "ACTIVE" | "INACTIVE";
  created_at?: string;
  updated_at?: string;
}

export type UnpaidOrderOrigin = "ALL" | "KITCHEN" | "RETAIL";

export interface UnpaidOrdersFilter {
  search?: string;
  businessId?: string | null;
  origin?: UnpaidOrderOrigin;
}

const KITCHEN_TYPES = new Set(["DINE_IN", "TAKEAWAY", "DELIVERY"]);
const RETAIL_TYPES = new Set(["ECOMMERCE", "WHATSAPP", "INSTAGRAM", "POS", "CALL_CENTER"]);

export function matchesOrigin(order: Order, origin: UnpaidOrderOrigin): boolean {
  if (origin === "ALL") return true;
  const type = String(order.order_type ?? "").toUpperCase();
  const appId = String((order as unknown as { app_id?: string }).app_id ?? "").toLowerCase();
  if (origin === "KITCHEN") {
    return appId === "ware-kitchen" || KITCHEN_TYPES.has(type);
  }
  return appId === "ware-retail" || RETAIL_TYPES.has(type);
}

export async function fetchCashiers(): Promise<Cashier[]> {
  return commonFetchCashiers(api, resolveTenantId());
}

export async function loginWithPin(username: string, pin: string): Promise<PinLoginResponse> {
  return commonLoginWithPin(api, resolveTenantId(), username, pin);
}

export async function fetchCustomers(search: string): Promise<Customer[]> {
  const term = search.trim();
  if (term.length < 2) return [];
  const { data, error } = await api.GET("/v1/customers", {
    params: {
      header: { "X-Tenant-Id": resolveTenantId() },
      query: { search: term, size: 8, sort: "legal_name,asc" },
    },
  });
  if (error || !data) {
    throw new Error(parseApiError(error, "No fue posible buscar clientes."));
  }
  return data.items ?? (data as any).customers ?? [];
}

export async function fetchUnpaidOrders(filter: UnpaidOrdersFilter = {}): Promise<Order[]> {
  const term = (filter.search ?? "").trim();
  const business = (filter.businessId ?? "").trim();
  const { data, error } = await api.GET("/v1/orders", {
    params: {
      header: { "X-Tenant-Id": resolveTenantId() },
      query: {
        payment_status: "UNPAID",
        exclude_cancelled: true,
        page: 1,
        size: 100,
        ...(business ? { business } : {}),
        ...(term ? { search: term } : {}),
      } as any,
    },
  });
  if (error || !data) {
    throw new Error(parseApiError(error, "No se pudieron cargar las órdenes pendientes de cobro."));
  }
  const items = data.items ?? [];
  const origin = filter.origin ?? "ALL";
  return items.filter((order) => matchesOrigin(order, origin));
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetailResponse> {
  const { data, error } = await api.GET("/v1/orders/{id}", {
    params: {
      header: { "X-Tenant-Id": resolveTenantId() },
      path: { id: orderId },
    },
  });
  if (error || !data) {
    throw new Error(parseApiError(error, "No se pudo cargar el detalle de la orden."));
  }
  return data;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function submitOrderCheckout(
  orderId: string,
  payload: OrderCheckoutRequest,
  idempotencyKey: string,
): Promise<OrderCheckoutResponse> {
  const { data, error } = await api.POST("/v1/orders/{id}/checkout", {
    params: {
      header: {
        "X-Tenant-Id": resolveTenantId(),
        "Idempotency-Key": idempotencyKey,
      },
      path: { id: orderId },
    },
    body: payload,
  });
  if (error || !data) {
    throw new Error(parseApiError(error, "No se pudo liquidar la orden."));
  }
  return data;
}

/** GET /v1/orders/businesses (the OpenAPI document only types POST today). */
export async function fetchBusinesses(): Promise<Business[]> {
  const { data, error } = await (api as any).GET("/v1/orders/businesses", {
    params: { header: { "X-Tenant-Id": resolveTenantId() } },
  });
  if (error) {
    throw new Error(parseApiError(error, "No se pudieron cargar los negocios."));
  }
  if (Array.isArray(data)) return data as Business[];
  if (Array.isArray((data as any)?.items)) return (data as any).items as Business[];
  return [];
}

export type Product = NonNullable<
  paths["/v1/inventory/products"]["get"]["responses"]["200"]["content"]["application/json"]["items"]
>[number];
export type CheckoutRequest = any;
export type CheckoutResponse = any;

/** @deprecated Use getCurrentEmissionPoint(). */
export const EMISSION_POINT = "M001";

export function getCurrentEmissionPoint(businessId?: string): string {
  return getStoredEmissionPoint(businessId ?? "");
}
export const WAREHOUSE_ID = "WH-MAIN";
export const RETAIL_APP_ID = "ware-retail";
export function newOrderIdempotencyKey() { return newIdempotencyKey(); }
export async function fetchProducts() { return [] as Product[]; }
export async function fetchProductBySku() { return null; }
export async function submitCheckout() { throw new Error("Not supported in payments satellite"); }
export async function fetchPendingRetailOrders(search?: string, businessId?: string | null) {
  return fetchUnpaidOrders({ search, businessId, origin: "RETAIL" });
}
