import { LoginScreen } from "@payments/common";
import { fetchCashiers, loginWithPin, resolveTenantId } from "../../lib/api";
import { useAuthStore } from "../../store/auth";

export const PAY_ROLES = ["CASHIER", "ADMIN"] as const;

export default function PayLoginScreen() {
  const login = useAuthStore((state) => state.login);
  return (
    <LoginScreen
      title="MobiWare Payments"
      subtitle="Terminal de caja y pagos"
      operatorsAriaLabel="Cajeros autorizados"
      accentColor="retail"
      allowedRoles={[...PAY_ROLES]}
      tenantId={resolveTenantId()}
      fetchCashiers={fetchCashiers}
      loginWithPin={loginWithPin}
      onLoginSuccess={login}
    />
  );
}
