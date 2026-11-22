import { useSatelliteTheme } from "@payments/common";
import { useAuthStore } from "./store/auth";
import LoginScreen from "./components/auth/LoginScreen";
import PayScreen from "./components/pay/PayScreen";

export default function App() {
  const token = useAuthStore((state) => state.token);
  const { theme, toggleTheme } = useSatelliteTheme("ware-pay.theme");

  if (!token) {
    return <LoginScreen />;
  }

  return <PayScreen theme={theme} onToggleTheme={toggleTheme} />;
}
