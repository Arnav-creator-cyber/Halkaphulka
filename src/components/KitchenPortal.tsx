import { useState, useEffect } from "react";
import { 
  Flame, 
  ChefHat, 
  RefreshCw, 
  CheckCircle, 
  TrendingUp, 
  Clock, 
  HelpCircle,
  Truck,
  Coffee,
  CalendarCheck2
} from "lucide-react";
import { Order } from "../types";

interface KitchenPortalProps {
  orders: Order[];
  onRefreshOrders: () => Promise<void>;
  onUpdateOrderStatus: (rowIndex: number, status: string) => Promise<void>;
}

export default function KitchenPortal({ 
  orders, 
  onRefreshOrders, 
  onUpdateOrderStatus 
}: KitchenPortalProps) {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [updatingRowIndices, setUpdatingRowIndices] = useState<Record<number, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep ticking time every 10 seconds to update live wait times in the kitchen
  useEffect(() => {
    const handle = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(handle);
  }, []);

  const getElapsedTimeLabel = (timestamp?: string) => {
    if (!timestamp) return null;
    try {
      const orderDate = new Date(timestamp);
      const diffMs = currentTime.getTime() - orderDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return { text: "just now", color: "text-emerald-600 bg-emerald-100/50 border-emerald-200" };
      if (diffMins < 10) return { text: `${diffMins}m ago`, color: "text-emerald-700 bg-emerald-100/50 border-emerald-200 font-bold" };
      if (diffMins < 20) return { text: `${diffMins}m ago`, color: "text-amber-700 bg-amber-100/50 border-amber-200 font-extrabold" };
      return { text: `${diffMins}m delay! ⚠️`, color: "text-rose-700 bg-rose-100/50 border-rose-200 animate-pulse font-black" };
    } catch {
      return null;
    }
  };

  // Sound chime tracking for incoming dispatches
  const [lastSeenMaxRow, setLastSeenMaxRow] = useState<number>(() => {
    if (orders.length === 0) return 0;
    return Math.max(...orders.map(o => o.rowIndex));
  });

  const playKitchenChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime); // G5 note
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.12); // C5 note block
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.3);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start();
      osc1.stop(ctx.currentTime + 1.0);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 1.3);
    } catch (err) {
      console.warn("Audio bell context blocked or waiting user gesture:", err);
    }
  };

  useEffect(() => {
    if (orders.length === 0) return;
    const currentMax = Math.max(...orders.map(o => o.rowIndex));
    if (lastSeenMaxRow === 0) {
      setLastSeenMaxRow(currentMax);
      return;
    }
    
    // Chime if a higher row index is loaded!
    if (currentMax > lastSeenMaxRow) {
      playKitchenChime();
      setLastSeenMaxRow(currentMax);
    }
  }, [orders, lastSeenMaxRow]);

  // Auto-refresh orders every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshOrders().catch(console.error);
    }, 15000);
    return () => clearInterval(interval);
  }, [onRefreshOrders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshOrders();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusUpdate = async (rowIndex: number, newStatus: string) => {
    setUpdatingRowIndices(prev => ({ ...prev, [rowIndex]: true }));
    try {
      await onUpdateOrderStatus(rowIndex, newStatus);
    } catch (e) {
      console.error("Status transition failure:", e);
    } finally {
      setUpdatingRowIndices(prev => ({ ...prev, [rowIndex]: false }));
    }
  };

  // Safe delivery time urgency check
  const isSlotUrgent = (deliveryTime: string, status: string) => {
    if (status === "Done" || status === "Cancelled") return false;
    
    try {
      const match = deliveryTime.match(/(\d+):?(\d*)\s*(PM|AM)/i);
      if (!match) return false;

      const hourRaw = parseInt(match[1], 10);
      const minRaw = parseInt(match[2] || "0", 10);
      const isPM = match[3].toUpperCase() === "PM";
      
      let targetHour = hourRaw;
      if (isPM && hourRaw !== 12) targetHour += 12;
      if (!isPM && hourRaw === 12) targetHour = 0;

      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(targetHour, minRaw, 0, 0);

      const diffMs = targetTime.getTime() - now.getTime();
      const diffMins = diffMs / (1000 * 60);

      return diffMins >= -5 && diffMins <= 20;
    } catch {
      return false;
    }
  };

  // Category constants for aggregate Prep Widget
  const BREAD_WORDS = ["roti", "poori", "puri", "naan", "paratha", "bread", "chapati"];
  const SIDE_WORDS = ["raita", "pickle", "achaar", "fryum", "papad", "chutney", "salad", "dal", "chana", "lassi", "curd", "boondi"];

  // Compute aggregate totals of active items in kitchen
  const getPrepSummary = () => {
    const activeOrders = orders.filter(o => o.status !== "Done" && o.status !== "Cancelled");
    
    const summary: Record<string, { name: string; qty: number; category: "mains" | "breads" | "sides" }> = {};

    activeOrders.forEach(order => {
      // Split formatted order items text: e.g. "Dinner Thali x1, Mix Veg Curry (Half) x2"
      const itemsList = order.items.split(",");
      itemsList.forEach(rawItem => {
        const text = rawItem.trim();
        if (!text) return;

        // Parse format like "Dinner Thali x2" or "Chilly Paneer (Half) x1"
        const regexMultiplier = text.match(/(.+?)\s*x(\d+)/i);
        let name = text;
        let qty = 1;

        if (regexMultiplier) {
          name = regexMultiplier[1].trim();
          qty = parseInt(regexMultiplier[2], 10) || 1;
        }

        const nameLower = name.toLowerCase();
        let itemCategory: "mains" | "breads" | "sides" = "mains";

        if (BREAD_WORDS.some(w => nameLower.includes(w))) {
          itemCategory = "breads";
        } else if (SIDE_WORDS.some(w => nameLower.includes(w))) {
          itemCategory = "sides";
        }

        // Aggregate inside map
        if (summary[name]) {
          summary[name].qty += qty;
        } else {
          summary[name] = { name, qty, category: itemCategory };
        }
      });
    });

    return Object.values(summary);
  };

  const prepItems = getPrepSummary();

  // Header revenue metrics
  const activeOrdersAll = orders.filter(o => o.status !== "Done" && o.status !== "Cancelled");
  const urgentOrdersCount = activeOrdersAll.filter(o => isSlotUrgent(o.deliveryTime, o.status)).length;
  const doneOrdersCount = orders.filter(o => o.status === "Done").length;
  
  // Todays Done earnings
  const todaysEarning = orders
    .filter(o => o.status === "Done")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="min-h-screen bg-[#FBF6EE] pb-32 max-w-xl mx-auto border-x border-[#e5ddd0]/50 text-[#1B3A2D]">
      
      {/* Kitchen Screen top Bar */}
      <div className="bg-[#1B3A2D] text-[#FBF6EE] p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-[#E8860A]" />
          <div>
            <span className="text-[10px] bg-[#E8860A] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-widest font-mono">Screen LIVE</span>
            <h1 className="text-lg font-serif italic font-bold leading-tight mt-0.5">Halka Kitchen Dashboard</h1>
          </div>
        </div>

        {/* Refresh controllers */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-white/10 rounded-xl text-white transition disabled:opacity-40 flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span className="text-[10px] font-bold uppercase font-mono tracking-wider hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Grid Dashboard Header bar: Revenue, Active, Done, Urgent counters */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl border border-[#e5ddd0]/60 p-4 shadow-sm grid grid-cols-4 gap-2 text-center">
          <div className="border-r border-stone-100 last:border-0">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block">Done Sales</span>
            <span className="text-sm font-semibold text-stone-700 block mt-0.5 font-mono">₹{todaysEarning}</span>
          </div>
          <div className="border-r border-stone-100 last:border-0">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block">Preparing</span>
            <span className="text-base font-bold text-[#E8860A] block mt-0.5 font-mono">
              {orders.filter(o => o.status === "Preparing").length}
            </span>
          </div>
          <div className="border-r border-stone-100 last:border-0">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block">Active Log</span>
            <span className="text-base font-bold text-[#1B3A2D] block mt-0.5 font-mono">{activeOrdersAll.length} pending</span>
          </div>
          <div className="last:border-0">
            <span className="text-[9px] font-bold text-[#E8860A] uppercase tracking-widest block font-serif">⚠️ Urgent</span>
            <span className={`text-base font-black block mt-0.5 font-mono ${urgentOrdersCount > 0 ? "text-red-500 animate-pulse" : "text-stone-300"}`}>
              {urgentOrdersCount}
            </span>
          </div>
        </div>
      </div>

      {/* Prep Summary Widget section */}
      <div className="p-4 pt-3">
        <div className="bg-[#1B3A2D] border-b-4 border-[#E8860A] text-[#FBF6EE] p-5 rounded-2xl shadow-md space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/10">
            <h3 className="font-serif text-base italic font-semibold flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#E8860A] animate-pulse" />
              👨‍🍳 Active Kitchen Prep Aggregates
            </h3>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono font-bold">
              {prepItems.reduce((sum, item) => sum + item.qty, 0)} items pending
            </span>
          </div>

          {prepItems.length === 0 ? (
            <p className="text-center py-4 text-xs italic text-stone-400">All orders dispatched! Kitchen is idle.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
              
              {/* Category 1: MAINS */}
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#E8860A] uppercase tracking-wider block font-bold">🍲 Mains & Thalis</span>
                <div className="space-y-1">
                  {prepItems.filter(i => i.category === "mains").map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-[#cbc3b5]">{item.name}</span>
                      <span className={`font-mono text-sm font-bold ${item.qty >= 5 ? "text-red-400 font-extrabold" : "text-white"}`}>
                        x{item.qty}
                      </span>
                    </div>
                  ))}
                  {prepItems.filter(i => i.category === "mains").length === 0 && (
                    <span className="text-[10px] italic text-[#cbc3b5]/40">None pending</span>
                  )}
                </div>
              </div>

              {/* Category 2: BREADS */}
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#E8860A] uppercase tracking-wider block font-bold">🍞 Hot Roti / Poori</span>
                <div className="space-y-1">
                  {prepItems.filter(i => i.category === "breads").map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-[#cbc3b5]">{item.name}</span>
                      <span className={`font-mono text-sm font-bold ${item.qty >= 5 ? "text-red-400 font-extrabold" : "text-white"}`}>
                        x{item.qty}
                      </span>
                    </div>
                  ))}
                  {prepItems.filter(i => i.category === "breads").length === 0 && (
                    <span className="text-[10px] italic text-[#cbc3b5]/40">None pending</span>
                  )}
                </div>
              </div>

              {/* Category 3: SIDES */}
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#E8860A] uppercase tracking-wider block font-bold font-mono">🥛 Sides & Raita</span>
                <div className="space-y-1">
                  {prepItems.filter(i => i.category === "sides").map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-[#cbc3b5]">{item.name}</span>
                      <span className={`font-mono text-sm font-bold ${item.qty >= 5 ? "text-red-400 font-extrabold" : "text-white"}`}>
                        x{item.qty}
                      </span>
                    </div>
                  ))}
                  {prepItems.filter(i => i.category === "sides").length === 0 && (
                    <span className="text-[10px] italic text-[#cbc3b5]/40">None pending</span>
                  )}
                </div>
              </div>

            </div>
          )}
          <span className="text-[9px] text-stone-400 italic block border-t border-white/5 pt-1">
            * Items with quantities ≥ 5 highlight in red as priority indicators!
          </span>
        </div>
      </div>

      {/* Main Order Displays */}
      <div className="px-4 space-y-4">
        
        {/* Toggle Filters bar */}
        <div className="flex gap-1 border-b border-[#e5ddd0]/40 pb-2 overflow-x-auto scrollbar-none">
          {["All", "New", "Preparing", "Out for Delivery", "Done"].map(st => (
            <button
              key={st}
              onClick={() => setActiveFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border shrink-0 transition cursor-pointer ${activeFilter === st ? "bg-[#1B3A2D] text-white border-[#1B3A2D]" : "bg-white text-[#7a7060] border-[#e5ddd0]"}`}
            >
              {st === "All" ? "📋 All Orders" : st === "Out for Delivery" ? "🚗 Dispatch" : st} ({orders.filter(o => st === "All" ? true : o.status === st).length})
            </button>
          ))}
        </div>

        {/* Display individual lists */}
        <div className="space-y-3">
          {orders
            .filter(o => activeFilter === "All" ? true : o.status === activeFilter)
            .sort((a, b) => b.rowIndex - a.rowIndex) // Shows newest at top
            .map((order, index) => {
              const isUrgent = isSlotUrgent(order.deliveryTime, order.status);

              return (
                <div
                  key={order.rowIndex || index}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition relative ${isUrgent ? "border-red-500 ring-2 ring-red-100 animate-pulse shadow-md" : "border-[#e5ddd0]/50"} ${order.status === "Done" ? "opacity-55 scale-98" : ""} ${order.status === "Cancelled" ? "opacity-35 line-through" : ""}`}
                >
                  
                  {isUrgent && (
                    <span className="absolute top-2 right-2 bg-red-600 text-white font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider block">
                      ⚠️ Urgent Time Limit
                    </span>
                  )}

                  {/* Header info */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-stone-400 block pb-0.5">Kitchen Row #{order.rowIndex}</span>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded font-mono ${order.orderType === "delivery" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-700"}`}>
                          {order.orderType === "delivery" ? "🚀 Hand Out" : "🏪 Pickup"}
                        </span>
                        {(() => {
                          const elapsed = getElapsedTimeLabel(order.timestamp);
                          if (!elapsed || order.status === "Done" || order.status === "Cancelled") return null;
                          return (
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border leading-none ${elapsed.color}`}>
                              {elapsed.text}
                            </span>
                          );
                        })()}
                      </div>
                      
                      <h4 className="text-base font-bold text-[#1B3A2D] flex items-center gap-1.5">
                        {order.name}
                        {order.status === "Preparing" && <Coffee className="w-3.5 h-3.5 text-[#E8860A] animate-spin" />}
                      </h4>
                    </div>

                    <span className={`text-[10px] font-black font-mono uppercase px-2 py-0.5 rounded-full ${order.status === "New" ? "bg-amber-100 text-amber-700" : order.status === "Preparing" ? "bg-orange-100 text-orange-700" : order.status === "Out for Delivery" ? "bg-blue-100 text-blue-700 font-bold" : "bg-emerald-100 text-emerald-700"}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Order items and quantities */}
                  <div className="my-2 py-2 border-t border-b border-dashed border-stone-100 bg-[#FBF6EE]/30 p-2.5 rounded-xl">
                    <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wide block">Order Load</span>
                    <p className="font-extrabold text-stone-800 text-[13px] leading-snug mt-0.5">{order.items}</p>
                  </div>

                  {/* Footer metadata coordinates */}
                  <div className="flex justify-between items-center text-xs text-stone-500 font-bold pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#E8860A]" />
                      <span className="font-mono">Requested: <b className="text-[#1B3A2D]">{order.deliveryTime}</b></span>
                    </div>

                    <a
                      href={`tel:91${order.phone}`}
                      className="font-mono flex items-center gap-1 text-[#E8860A]"
                    >
                      📞 {order.phone}
                    </a>
                  </div>

                  {order.orderType === "delivery" && (
                    <div className="mt-2 text-[11px] font-bold text-stone-500 bg-stone-50 py-1 px-2 rounded-lg leading-tight flex items-start gap-1">
                      <span className="shrink-0 text-[#E8860A]">📍</span>
                      <span>Address: {order.address}</span>
                    </div>
                  )}

                  {/* Actions status transition steps */}
                  <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-stone-100">
                    <span className="text-[9.5px] uppercase font-bold text-stone-400 mr-auto flex items-center gap-1">
                      <CalendarCheck2 className="w-3.5 h-3.5" /> Tick Status:
                    </span>
                    
                    {["New", "Preparing", "Out for Delivery", "Done"].map(step => {
                      if (step === order.status) return null; // skip current
                      
                      const btnLabels: Record<string, string> = {
                        "New": "🟡 New",
                        "Preparing": "🟠 Prep",
                        "Out for Delivery": "🚗 Out Check",
                        "Done": "✅ Fulfill"
                      };

                      return (
                        <button
                          key={step}
                          disabled={updatingRowIndices[order.rowIndex]}
                          onClick={() => handleStatusUpdate(order.rowIndex, step)}
                          className={`text-[10px] font-bold py-1.5 px-2.5 rounded-lg border transition active:scale-95 disabled:opacity-40 cursor-pointer ${step === "Preparing" ? "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200" : step === "Out for Delivery" ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" : step === "Done" ? "bg-emerald-50 hover:bg-emerald-100 text-[#1B3A2D] border-emerald-200 font-black" : "bg-stone-50 text-stone-600 shadow-sm border-stone-200"}`}
                        >
                          {updatingRowIndices[order.rowIndex] ? "..." : btnLabels[step]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {orders.filter(o => activeFilter === "All" ? true : o.status === activeFilter).length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#e5ddd0]/60 text-stone-400 text-xs">
              <CheckCircle className="w-10 h-10 text-stone-200 mx-auto mb-2" />
              There are no orders in the "{activeFilter}" filter state portfolio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
