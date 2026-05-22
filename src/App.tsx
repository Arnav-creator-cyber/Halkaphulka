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
    if (queryRole === "customer" || queryRole === "admin" || queryRole === "kitchen") {
      return queryRole;
    }
    return "customer";
  });

  // Keep query params in sync with active portal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (role === "customer") {
      params.delete("role");
    } else {
      params.set("role", role);
    }
    const newQueryString = params.toString();
    const newUrl = `${window.location.pathname}${newQueryString ? `?${newQueryString}` : ""}`;
    window.history.replaceState({ path: newUrl }, "", newUrl);
  }, [role]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Allow custom Apps Script Web App URL persistence
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem("halka_gas_url") || "";
  });

  const handleUpdateGasUrl = (url: string) => {
    setGasUrl(url);
    localStorage.setItem("halka_gas_url", url);
  };

  // Helper to fetch settings from sheets / local backend
  const fetchSettings = async () => {
    try {
      let data: Settings;
      
      if (gasUrl) {
        // Query dynamic Google Apps Script if configured by user
        const res = await fetch(`${gasUrl}?type=settings`);
        data = await res.json();
      } else {
        // Fallback to Express backend simulation
        const res = await fetch("/api/gsheets?type=settings");
        if (!res.ok) throw new Error("Local server settings error");
        data = await res.json();
      }

      setSettings(data);
    } catch (err: any) {
      console.warn("Could not query live sheet settings, falling back to local simulation:", err);
      // In case server is loading, fetch from local as fallback
      try {
        const res = await fetch("/api/gsheets?type=settings");
        const data = await res.json();
        setSettings(data);
      } catch (e) {
        setLoadError("Could not initialize kitchen settings registry.");
      }
    }
  };

  // Helper to fetch orders
  const fetchOrders = async () => {
    try {
      let data: Order[];

      if (gasUrl) {
        const res = await fetch(gasUrl);
        data = await res.json();
      } else {
        const res = await fetch("/api/gsheets");
        if (!res.ok) throw new Error("Local server orders error");
        data = await res.json();
      }

      // Safeguard array shape
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Could not load Orders array, fetching local simulation details:", err);
      try {
        const res = await fetch("/api/gsheets");
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Local database fetch failed too:", e);
      }
    }
  };

  const handleUpdateOrderStatus = async (rowIndex: number, status: string) => {
    try {
      if (gasUrl) {
        // Trigger App Script status updater directly
        await fetch(`${gasUrl}?type=updateStatus&rowIndex=${rowIndex}&status=${encodeURIComponent(status)}`);
      } else {
        // Trigger simulated local Google Sheets updater
        await fetch(`/api/gsheets?type=updateStatus&rowIndex=${rowIndex}&status=${encodeURIComponent(status)}`);
      }
      // Re-fetch orders instantly from Sheets as the ONLY source of truth
      await fetchOrders();
    } catch (err) {
      console.error("Status synchronization fail:", err);
      throw err;
    }
  };

  // Upstream settings POST
  const handleSaveSettings = async (revisedSettings: Settings): Promise<boolean> => {
    try {
      if (gasUrl) {
        // Post directly to Gas Apps Script Web app
        await fetch(gasUrl, {
          method: "POST",
          mode: "no-cors", 
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: "settings",
            settings: revisedSettings
          })
        });
      }

      // Synchronize in local database server regardless (so both local simulation and remote stay fully mirrored)
      const res = await fetch("/api/gsheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "settings",
          settings: revisedSettings
        })
      });

      if (res.ok) {
        setSettings(revisedSettings);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Saving settings failed:", e);
      return false;
    }
  };

  // Run on mount
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchOrders()]);
      setIsLoading(false);
    }
    init();
  }, [gasUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF6EE] flex flex-col items-center justify-center p-6 text-[#1B3A2D]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1B3A2D] border-t-[#E8860A] mb-4"></div>
        <h2 className="text-lg font-serif italic text-stone-600">Loading Halka Phulka Kitchen...</h2>
        <p className="text-xs text-stone-400 mt-1">Booting real-time single source of truth database sync</p>
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div className="min-h-screen bg-[#FBF6EE] flex flex-col items-center justify-center p-6 text-center text-[#1B3A2D]">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 font-bold text-3xl">⚠️</div>
        <h2 className="text-xl font-bold font-serif">Setup / Load Failure</h2>
        <p className="text-sm text-stone-500 max-w-sm mt-2">
          {loadError || "Settings could not be initialized. Please restart development server."}
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

  return (
    <div className="w-full min-h-screen bg-[#FBF6EE]">
      
      {/* Dynamic Multi-Portal Testing bar on Top */}
      <div className="w-full bg-[#E8860A] text-white py-2 px-4 shadow sticky top-0 z-50 border-b border-[#1B3A2D]/10">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1.5 text-xs">
          <span className="font-extrabold flex items-center gap-1.5 shrink-0 select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            🇮🇳 Live Testing Environment Switcher
          </span>

          {/* Selector group */}
          <div className="flex bg-black/15 p-0.5 rounded-lg border border-white/10 shrink-0 font-bold">
            <button
              onClick={() => setRole("customer")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all text-[11px] font-black cursor-pointer ${role === "customer" ? "bg-white text-[#1B3A2D] shadow" : "text-white/80 hover:text-white"}`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Customer App
            </button>
            <button
              onClick={() => setRole("admin")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all text-[11px] font-black cursor-pointer ${role === "admin" ? "bg-white text-[#1B3A2D] shadow" : "text-white/80 hover:text-white"}`}
            >
              <Key className="w-3.5 h-3.5" /> Owner Admin
            </button>
            <button
              onClick={() => setRole("kitchen")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all text-[11px] font-black cursor-pointer ${role === "kitchen" ? "bg-white text-[#1B3A2D] shadow" : "text-white/80 hover:text-white"}`}
            >
              <ChefHat className="w-3.5 h-3.5" /> Kitchen Screen
            </button>
          </div>
        </div>
      </div>

      {/* Role explanation bar */}
      <div className="bg-stone-100 text-[#1B3A2D] text-[10px] py-1 border-b border-stone-200">
        <div className="max-w-xl mx-auto px-4 flex justify-between items-center font-bold">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#E8860A]" /> 
            {role === "customer" && "Viewing Customer Application (index.html equivalent)"}
            {role === "admin" && "Viewing Admin Control Board (admin.html equivalent)"}
            {role === "kitchen" && "Viewing Kitchen Display Monitor (dashboard.html equivalent)"}
          </span>
          <span className="text-stone-400 italic">Self-Syncs instantly in multi-portal loop</span>
        </div>
      </div>

      {/* Frame view loaders */}
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
