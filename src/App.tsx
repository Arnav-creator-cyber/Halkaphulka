import { useState, useEffect } from "react";
import { Settings, Order } from "./types";
import CustomerPortal from "./components/CustomerPortal";
import AdminPortal from "./components/AdminPortal";
import KitchenPortal from "./components/KitchenPortal";
import { ShoppingBag, Key, ChefHat, Info } from "lucide-react";

export default function App() {
  const [role, setRole] = useState<"customer" | "admin" | "kitchen">(() => {
    const params = new URLSearchParams(window.location.search);
    const queryRole = params.get("role");

    if (
      queryRole === "customer" ||
      queryRole === "admin" ||
      queryRole === "kitchen"
    ) {
      return queryRole;
    }

    return "customer";
  });

  // Keep query params synced
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (role === "customer") {
      params.delete("role");
    } else {
      params.set("role", role);
    }

    const newQueryString = params.toString();

    const newUrl = `${window.location.pathname}${
      newQueryString ? `?${newQueryString}` : ""
    }`;

    window.history.replaceState({ path: newUrl }, "", newUrl);
  }, [role]);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // =========================================
  // GOOGLE APPS SCRIPT WEB APP URL
  // =========================================

  const GAS_URL =
    "https://script.google.com/macros/s/AKfycbyN2Tx35ORs7ZI0Bqj2l_hQAd4WuTCQfpZNz6aIvQuV_FJ1u7FVbGHZ7l1LM_12iKHn/exec";

  // Optional persistence only
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem("halka_gas_url") || GAS_URL;
  });

  const handleUpdateGasUrl = (url: string) => {
    setGasUrl(url);
    localStorage.setItem("halka_gas_url", url);
  };

  // =========================================
  // FETCH SETTINGS
  // =========================================

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${gasUrl}?type=settings`);

      if (!res.ok) {
        throw new Error("Settings fetch failed");
      }

      const data: Settings = await res.json();

      setSettings(data);
      setLoadError(null);

    } catch (err) {
      console.error("Settings fetch error:", err);

      setLoadError(
        "Could not initialize kitchen settings registry."
      );
    }
  };

  // =========================================
  // FETCH ORDERS
  // =========================================

  const fetchOrders = async () => {
    try {
      const res = await fetch(gasUrl);

      if (!res.ok) {
        throw new Error("Orders fetch failed");
      }

      const data: Order[] = await res.json();

      setOrders(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error("Orders fetch failed:", err);
      setOrders([]);
    }
  };

  // =========================================
  // UPDATE ORDER STATUS
  // =========================================

  const handleUpdateOrderStatus = async (
    rowIndex: number,
    status: string
  ) => {
    try {
      await fetch(
        `${gasUrl}?type=updateStatus&rowIndex=${rowIndex}&status=${encodeURIComponent(
          status
        )}`
      );

      // Always re-fetch from Sheets
      await fetchOrders();

    } catch (err) {
      console.error("Status synchronization fail:", err);
      throw err;
    }
  };

  // =========================================
  // SAVE SETTINGS
  // =========================================

  const handleSaveSettings = async (
    revisedSettings: Settings
  ): Promise<boolean> => {
    try {
      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "settings",
          settings: revisedSettings,
        }),
      });

      setSettings(revisedSettings);

      return true;

    } catch (e) {
      console.error("Saving settings failed:", e);
      return false;
    }
  };

  // =========================================
  // INITIAL LOAD
  // =========================================

  useEffect(() => {
    async function init() {
      setIsLoading(true);

      await Promise.all([
        fetchSettings(),
        fetchOrders()
      ]);

      setIsLoading(false);
    }

    init();
  }, [gasUrl]);

  // =========================================
  // LOADING SCREEN
  // =========================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF6EE] flex flex-col items-center justify-center p-6 text-[#1B3A2D]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1B3A2D] border-t-[#E8860A] mb-4"></div>

        <h2 className="text-lg font-serif italic text-stone-600">
          Loading Halka Phulka Kitchen...
        </h2>

        <p className="text-xs text-stone-400 mt-1">
          Booting real-time single source of truth database sync
        </p>
      </div>
    );
  }

  // =========================================
  // ERROR SCREEN
  // =========================================

  if (loadError || !settings) {
    return (
      <div className="min-h-screen bg-[#FBF6EE] flex flex-col items-center justify-center p-6 text-center text-[#1B3A2D]">

        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 font-bold text-3xl">
          ⚠️
        </div>

        <h2 className="text-xl font-bold font-serif">
          Setup / Load Failure
        </h2>

        <p className="text-sm text-stone-500 max-w-sm mt-2">
          {loadError ||
            "Settings could not be initialized."}
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-[#1B3A2D] hover:bg-emerald-950 text-white font-bold py-2 px-6 rounded-lg text-xs"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // =========================================
  // MAIN APP
  // =========================================

  return (
    <div className="w-full min-h-screen bg-[#FBF6EE]">

      {/* Top portal switcher */}
      <div className="w-full bg-[#E8860A] text-white py-2 px-4 shadow sticky top-0 z-50 border-b border-[#1B3A2D]/10">

        <div className="max-w-xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1.5 text-xs">

          <span className="font-extrabold flex items-center gap-1.5 shrink-0 select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            🇮🇳 Live Testing Environment Switcher
          </span>

          <div className="flex bg-black/15 p-0.5 rounded-lg border border-white/10 shrink-0 font-bold">

            <button
              onClick={() => setRole("customer")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all text-[11px] font-black cursor-pointer ${
                role === "customer"
                  ? "bg-white text-[#1B3A2D] shadow"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Customer App
            </button>

            <button
              onClick={() => setRole("admin")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all text-[11px] font-black cursor-pointer ${
                role === "admin"
                  ? "bg-white text-[#1B3A2D] shadow"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              Owner Admin
            </button>

            <button
              onClick={() => setRole("kitchen")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all text-[11px] font-black cursor-pointer ${
                role === "kitchen"
                  ? "bg-white text-[#1B3A2D] shadow"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              Kitchen Screen
            </button>

          </div>
        </div>
      </div>

      {/* Role description */}
      <div className="bg-stone-100 text-[#1B3A2D] text-[10px] py-1 border-b border-stone-200">

        <div className="max-w-xl mx-auto px-4 flex justify-between items-center font-bold">

          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#E8860A]" />

            {role === "customer" &&
              "Viewing Customer Application"}

            {role === "admin" &&
              "Viewing Admin Control Board"}

            {role === "kitchen" &&
              "Viewing Kitchen Display Monitor"}
          </span>

          <span className="text-stone-400 italic">
            Self-Syncs instantly in multi-portal loop
          </span>

        </div>
      </div>

      {/* Portal rendering */}
      <div className="relative">

        {role === "customer" && (
          <CustomerPortal
            settings={settings}
            onRefreshSettings={fetchSettings}
            gasUrl={gasUrl}
          />
        )}

        {role === "admin" && (
          <AdminPortal
            settings={settings}
            orders={orders}
            onSaveSettings={handleSaveSettings}
            onRefreshSettings={fetchSettings}
            onRefreshOrders={fetchOrders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            gasUrl={gasUrl}
            onUpdateGasUrl={handleUpdateGasUrl}
          />
        )}

        {role === "kitchen" && (
          <KitchenPortal
            orders={orders}
            onRefreshOrders={fetchOrders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        )}

      </div>
    </div>
  );
}
