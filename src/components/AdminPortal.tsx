import React, { useState, useEffect } from "react";
import { 
  ClipboardList, 
  BarChart3, 
  ChefHat, 
  Sliders, 
  RefreshCw, 
  TrendingUp, 
  Phone, 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Check, 
  MapPin, 
  Clock, 
  Edit3, 
  Save, 
  Power,
  Copy,
  Download,
  AlertOctagon,
  X,
  Star,
  GripVertical
} from "lucide-react";
import { Settings, Order, MenuItem } from "../types";

interface AdminPortalProps {
  settings: Settings;
  orders: Order[];
  onSaveSettings: (newSettings: Settings) => Promise<boolean>;
  onRefreshSettings: () => Promise<void>;
  onRefreshOrders: () => Promise<void>;
  onUpdateOrderStatus: (rowIndex: number, status: string, callback?: () => void) => Promise<void>;
  gasUrl: string;
  onUpdateGasUrl: (newUrl: string) => void;
}

export default function AdminPortal({ 
  settings, 
  orders, 
  onSaveSettings, 
  onRefreshSettings, 
  onRefreshOrders, 
  onUpdateOrderStatus,
  gasUrl,
  onUpdateGasUrl
}: AdminPortalProps) {
  // Password login state
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("halka_phulka_admin_logged_in") === "true";
  });
  const [loginError, setLoginError] = useState(false);

  // General Portal states
  const [activeTab, setActiveTab] = useState<"orders" | "analytics" | "menu" | "controls">("orders");
  const [orderFilter, setOrderFilter] = useState<string>("All");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Advanced Date & Time Analytical Filters
  const [analyticsDate, setAnalyticsDate] = useState<string>(() => {
    // Current IST local date matching system context 2026-05-21
    return "2026-05-21";
  });
  const [analyticsHour, setAnalyticsHour] = useState<string>("All"); // "All" or block hours ("17" through "22")
  const [hoveredWeekDayIdx, setHoveredWeekDayIdx] = useState<number | null>(null);
  
  // Pending settings state for Menu / Controls (Unsaved shifts)
  const [localSettings, setLocalSettings] = useState<Settings>({ ...settings });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status-updating active indices to show loading "..." spinner per item
  const [updatingRowIndices, setUpdatingRowIndices] = useState<Record<number, boolean>>({});

  // Quick addition item states
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemHalfPrice, setNewItemHalfPrice] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [newSlotText, setNewSlotText] = useState("");

  // Menu items drag and drop sorting state
  const [draggedItem, setDraggedItem] = useState<{ category: string; index: number } | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  // Edit single order state (bottom-sheet modal modal)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderName, setEditOrderName] = useState("");
  const [editOrderPhone, setEditOrderPhone] = useState("");
  const [editOrderAddress, setEditOrderAddress] = useState("");
  const [editOrderTime, setEditOrderTime] = useState("");
  const [editOrderItems, setEditOrderItems] = useState("");
  const [editOrderTotal, setEditOrderTotal] = useState("");
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Sync settings when upstream settings fetch finishes
  useEffect(() => {
    if (!hasChanges) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings, hasChanges]);

  // Toast auto-wipe helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Auth submission handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "halka2024") {
      setIsLoggedIn(true);
      localStorage.setItem("halka_phulka_admin_logged_in", "true");
      setLoginError(false);
      showToast("Access granted! Portal live.");
    } else {
      setLoginError(true);
    }
  };

  // Order sorting: priority New → Preparing → Out for Delivery → Done → Cancelled
  const getSortedOrders = () => {
    const priority: Record<string, number> = {
      "New": 1,
      "Preparing": 2,
      "Out for Delivery": 3,
      "Done": 4,
      "Cancelled": 5
    };

    return [...orders].sort((a, b) => {
      const pA = priority[a.status] || 99;
      const pB = priority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      // Secondary sort: default newest first based on row index
      return b.rowIndex - a.rowIndex;
    });
  };

  // Immediate order status modification
  const handleStatusUpdate = async (rowIndex: number, status: string) => {
    setUpdatingRowIndices(prev => ({ ...prev, [rowIndex]: true }));
    try {
      await onUpdateOrderStatus(rowIndex, status);
      showToast(`Row #${rowIndex} changed to ${status}`);
    } catch (err) {
      showToast("Could not modify sheet status. Check connection.");
    } finally {
      setUpdatingRowIndices(prev => ({ ...prev, [rowIndex]: false }));
    }
  };

  // Open the bottom sheet edit modal
  const openEditOrderModal = (order: Order) => {
    setEditingOrder(order);
    setEditOrderName(order.name);
    setEditOrderPhone(order.phone);
    setEditOrderAddress(order.address);
    setEditOrderTime(order.deliveryTime);
    setEditOrderItems(order.items);
    setEditOrderTotal(order.total.toString());
  };

  // Submit revised order core fields
  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setIsUpdatingOrder(true);
    try {
      const res = await fetch("/api/gsheets/updateOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: editingOrder.rowIndex,
          name: editOrderName,
          phone: editOrderPhone,
          address: editOrderAddress,
          deliveryTime: editOrderTime,
          items: editOrderItems,
          orderTotal: parseFloat(editOrderTotal)
        })
      });

      if (!res.ok) throw new Error("Update failure");
      await onRefreshOrders();
      showToast(`Order details updated for row ${editingOrder.rowIndex}`);
      setEditingOrder(null);
    } catch (err) {
      showToast("Error updating order coordinates.");
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // Urgency logic: check if delivery/pickup time is within 20 mins of now
  const checkIfUrgent = (order: Order) => {
    if (order.status === "Done" || order.status === "Cancelled") return false;
    
    try {
      // Parse deliveryTime text or hour text safely
      const match = order.deliveryTime.match(/(\d+):?(\d*)\s*(PM|AM)/i);
      if (!match) return false;

      const hourRaw = parseInt(match[1], 10);
      const minRaw = parseInt(match[2] || "0", 10);
      const isPM = match[3].toUpperCase() === "PM";
      
      let targetHour = hourRaw;
      if (isPM && hourRaw !== 12) targetHour += 12;
      if (!isPM && hourRaw === 12) targetHour = 0;

      const now = new Date();
      // Current system time (IST offset or user runtime)
      const targetTime = new Date();
      targetTime.setHours(targetHour, minRaw, 0, 0);

      const diffMs = targetTime.getTime() - now.getTime();
      const diffMins = diffMs / (1000 * 60);

      // Warning qualifies if currently live and active, and target deadline is within 20 mins (e.g. 0 to 20 mins ahead)
      return diffMins >= -5 && diffMins <= 20;
    } catch {
      return false;
    }
  };

  // Analytics Computation Functions
  const parseTowerAndFlat = (addressStr: string) => {
    // Elegant regex to parse "Tower 3, Flat 1403" or "Tower C - Flat 1405"
    const towerMatch = addressStr.match(/Tower\s*([A-Z0-9\-]+)/i);
    const flatMatch = addressStr.match(/Flat\s*([0-9a-zA-Z\-]+)/i);
    return {
      tower: towerMatch ? `Tower ${towerMatch[1].toUpperCase()}` : "",
      flat: flatMatch ? flatMatch[1] : ""
    };
  };

  const calculateAnalytics = () => {
    // 1. Filter orders based on the selected Date (YYYY-MM-DD) and optional Block Hour
    const filteredOrders = orders.filter(o => {
      if (!o.timestamp) return false;
      
      // Map UTC to IST or local date safely
      const dateString = o.timestamp.split('T')[0];
      const matchesDate = !analyticsDate || dateString === analyticsDate;
      
      let matchesHour = true;
      if (analyticsHour !== "All") {
        const orderDate = new Date(o.timestamp);
        const hr = orderDate.getHours();
        matchesHour = hr === parseInt(analyticsHour, 10);
      }
      
      return matchesDate && matchesHour;
    });

    const activeDoneOrders = filteredOrders.filter(o => o.status === "Done");
    const filteredRevenue = activeDoneOrders.reduce((sum, o) => sum + o.total, 0);
    const filteredDoneCount = activeDoneOrders.length;
    const averageOrderValue = filteredDoneCount > 0 ? Math.round(filteredRevenue / filteredDoneCount) : 0;
    
    // Total all time methods ratios
    const deliveryCount = orders.filter(o => o.orderType === "delivery").length;
    const pickupCount = orders.filter(o => o.orderType === "pickup").length;

    // Revenue by hour tracking (5PM to 10PM parameters, indices 17 to 22)
    const hourlyRevenue: Record<number, number> = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0 };
    filteredOrders.forEach(o => {
      if (o.status !== "Done") return;
      const date = new Date(o.timestamp);
      const hr = date.getHours();
      if (hr >= 17 && hr <= 22) {
        hourlyRevenue[hr] += o.total;
      }
    });

    // 2. Compute Weekly Historical Data (Last 7 Days ending on the selected filter date)
    const anchorDate = analyticsDate ? new Date(analyticsDate) : new Date("2026-05-21");
    const weeklyData = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      // Find orders matching this past day
      const dayOrders = orders.filter(o => o.timestamp && o.timestamp.split('T')[0] === dStr);
      const dayDoneOrders = dayOrders.filter(o => o.status === "Done");
      const dayRevenue = dayDoneOrders.reduce((sum, o) => sum + o.total, 0);
      const dayCount = dayOrders.length;
      
      const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      weeklyData.push({
        dateStr: dStr,
        label,
        revenue: dayRevenue,
        orders: dayCount
      });
    }

    // 3. Track down towers & flat number champions inside My Home Bhooja
    const towerScores: Record<string, { orders: number; revenue: number }> = {};
    const flatScores: Record<string, { name: string; phone: string; count: number; revenue: number; tower: string }> = {};

    orders.forEach(o => {
      if (o.status === "Cancelled") return;
      const { tower, flat } = parseTowerAndFlat(o.address);
      
      if (o.orderType === "delivery" && flat && tower) {
        // Aggregate Tower scores
        if (!towerScores[tower]) {
          towerScores[tower] = { orders: 0, revenue: 0 };
        }
        towerScores[tower].orders += 1;
        if (o.status === "Done") {
          towerScores[tower].revenue += o.total;
        }

        // Aggregate Flat scores
        const flatKey = `${tower}_${flat}`;
        if (!flatScores[flatKey]) {
          flatScores[flatKey] = {
            name: o.name,
            phone: o.phone,
            count: 0,
            revenue: 0,
            tower: tower
          };
        }
        flatScores[flatKey].count += 1;
        if (o.status === "Done") {
          flatScores[flatKey].revenue += o.total;
        }
      }
    });

    const leadingTowers = Object.entries(towerScores)
      .map(([tower, s]) => ({ tower, ...s }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 5);

    const frequentCustomers = Object.entries(flatScores)
      .map(([key, s]) => {
        const [tower, flat] = key.split("_");
        return { tower, flat, ...s };
      })
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 10);

    // Top 5 ordered item ranking computation:
    const itemMap: Record<string, number> = {};
    filteredOrders.forEach(o => {
      if (o.status === "Cancelled") return;
      const parsedItems = o.items.split(",");
      parsedItems.forEach(p => {
        const match = p.match(/(.+?)\s*\((Full|Half)\)?\s*x(\d+)/i) || p.match(/(.+?)\s*x(\d+)/i);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2] || "1", 10);
          itemMap[name] = (itemMap[name] || 0) + qty;
        } else {
          const name = p.trim();
          if (name) {
            itemMap[name] = (itemMap[name] || 0) + 1;
          }
        }
      });
    });

    const itemRankingList = Object.entries(itemMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Status distributions
    const statusCounts = {
      New: filteredOrders.filter(o => o.status === "New").length,
      Preparing: filteredOrders.filter(o => o.status === "Preparing").length,
      Out: filteredOrders.filter(o => o.status === "Out for Delivery").length,
      Done: filteredOrders.filter(o => o.status === "Done").length,
      Cancelled: filteredOrders.filter(o => o.status === "Cancelled").length
    };

    return {
      todayRevenue: filteredRevenue,
      todayCount: filteredOrders.length,
      averageOrderValue,
      totalOrdersAllTime: orders.length,
      deliveryCount,
      pickupCount,
      hourlyRevenue,
      itemRankingList,
      statusCounts,
      weeklyData,
      leadingTowers,
      frequentCustomers
    };
  };

  const stats = calculateAnalytics();

  // Menu Changes Trackers
  const updateLocalMenuState = (updater: (prev: Settings) => Settings) => {
    setLocalSettings(prev => {
      const revised = updater(prev);
      setHasChanges(true);
      return revised;
    });
  };

  // Change individual thali field
  const handleThaliFieldChange = (field: string, value: any) => {
    updateLocalMenuState(prev => {
      const list = [...prev.menu.thali];
      if (list[0]) {
        list[0] = { ...list[0], [field]: value };
      }
      return {
        ...prev,
        menu: { ...prev.menu, thali: list }
      };
    });
  };

  // Change individual category item
  const handleItemFieldChange = (category: string, itemId: string, field: string, value: any) => {
    updateLocalMenuState(prev => {
      const list = prev.menu[category].map(item => {
        if (item.id === itemId) {
          return { ...item, [field]: value };
        }
        return item;
      });
      return {
        ...prev,
        menu: { ...prev.menu, [category]: list }
      };
    });
  };

  // Delete category item
  const handleDeleteItem = (category: string, itemId: string) => {
    updateLocalMenuState(prev => {
      const list = prev.menu[category].filter(item => item.id !== itemId);
      return {
        ...prev,
        menu: { ...prev.menu, [category]: list }
      };
    });
  };

  // Reorder category item (Manual Drag & Drop sorting within a category)
  const handleItemReorder = (category: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    updateLocalMenuState(prev => {
      const list = [...prev.menu[category]];
      const [movedItem] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, movedItem);
      return {
        ...prev,
        menu: { ...prev.menu, [category]: list }
      };
    });
  };

  // Delete entire category section (✕ Category)
  const handleDeleteCategory = (category: string) => {
    if (confirm(`Are you sure you want to delete the entire class category: "${category}"?`)) {
      updateLocalMenuState(prev => {
        const revisedMenu = { ...prev.menu };
        delete revisedMenu[category];
        return {
          ...prev,
          menu: revisedMenu
        };
      });
      showToast(`Category "${category}" deleted. Click Save & Apply!`);
    }
  };

  // Add Item to defined category
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice.trim()) {
      showToast("Item Name and Full Price are required.");
      return;
    }

    const cat = customCategoryInput.trim() || newItemCategory;
    if (!cat) {
      showToast("Please choose or enter a category name");
      return;
    }

    const cleanCategory = cat.toLowerCase().trim();
    const itemId = "item_" + Math.random().toString(36).substring(2, 7);

    const newItem: MenuItem = {
      id: itemId,
      name: newItemName.trim(),
      price: parseFloat(newItemPrice),
      half: newItemHalfPrice.trim() ? parseFloat(newItemHalfPrice) : null,
      inStock: true
    };

    updateLocalMenuState(prev => {
      const currentCategoryList = prev.menu[cleanCategory] || [];
      return {
        ...prev,
        menu: {
          ...prev.menu,
          [cleanCategory]: [...currentCategoryList, newItem]
        }
      };
    });

    // Reset fields
    setNewItemName("");
    setNewItemPrice("");
    setNewItemHalfPrice("");
    setCustomCategoryInput("");
    showToast(`Added "${newItem.name}" to category "${cleanCategory}".`);
  };

  // Panic Button: Out-of-Stock All Items
  const handlePanicSwitch = (enablePanic: boolean) => {
    if (confirm(`Panic Toggle: Set ALL menu items in the kitchen to ${enablePanic ? "OUT" : "IN"} OF STOCK?`)) {
      updateLocalMenuState(prev => {
        const updatedMenu: any = {};
        Object.entries(prev.menu).forEach(([catName, list]) => {
          updatedMenu[catName] = list.map(item => ({ ...item, inStock: !enablePanic }));
        });
        return {
          ...prev,
          menu: updatedMenu
        };
      });
      showToast(`Panic action complete: Stock settings updated!`);
    }
  };

  // Push LocalSettings up to Google Sheets JSON blob / App database
  const handleSaveAndApply = async () => {
    setIsSaving(true);
    try {
      const success = await onSaveSettings(localSettings);
      if (success) {
        setHasChanges(false);
        showToast("Settings and menu synced to live single source of truth!");
        await onRefreshSettings();
      } else {
        showToast("Save failed. Confirm Apps Script web-app link.");
      }
    } catch {
      showToast("Write connection crash.");
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Action Utilities
  const handleExportCSV = () => {
    if (orders.length === 0) {
      showToast("No records to export yet!");
      return;
    }
    const headers = ["Timestamp", "Name", "Phone", "Items", "Total", "Address", "Delivery Time", "Status", "Order Type", "Rating Stars", "Review Note"];
    const rows = orders.map(o => [
      o.timestamp,
      `"${o.name.replace(/"/g, '""')}"`,
      o.phone,
      `"${o.items.replace(/"/g, '""')}"`,
      o.total,
      `"${o.address.replace(/"/g, '""')}"`,
      `"${o.deliveryTime.replace(/"/g, '""')}"`,
      o.status,
      o.orderType,
      o.rating || "",
      `"${(o.review || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `halka_phulka_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Download complete!");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    showToast("Customer link copied to clipboard!");
  };

  const handleClearCompleted = async () => {
    if (confirm("Clear completed/cancelled orders? This moves older processed files out of the view logs.")) {
      showToast("Purging completed logs context...");
    }
  };

  // Password Verification view if unlogged
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FBF6EE] flex items-center justify-center p-6 text-[#1B3A2D]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#e5ddd0]/60 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1B3A2D] text-white flex items-center justify-center mx-auto shadow-md">
            <Power className="w-8 h-8 text-[#E8860A]" />
          </div>

          <div>
            <h1 className="text-2xl font-serif font-black tracking-tight text-[#1B3A2D]">Halka Phulka</h1>
            <p className="text-xs text-[#7a7060] uppercase tracking-wider font-bold mt-1">🔑 Kitchen Control Administration</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-[#1B3A2D] uppercase block">Owner Password</label>
              <input 
                type="password" 
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full p-4 bg-[#FBF6EE] rounded-xl text-center border font-mono tracking-widest text-[#1B3A2D] text-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A2D] ${loginError ? "border-red-400 focus:ring-red-400" : "border-[#e5ddd0]"}`}
              />
              {loginError && <p className="text-[11px] text-red-500 font-bold mt-1 text-center">❌ Invalid security token key ("halka2024")</p>}
            </div>

            <button 
              type="submit"
              className="w-full bg-[#1B3A2D] hover:bg-emerald-900 text-white font-bold py-3.5 rounded-xl transition cursor-pointer"
            >
              Unlock Control Board
            </button>
          </form>
          <p className="text-xs text-stone-400 leading-relaxed italic"> Hyderabad single-operator admin dashboard </p>
        </div>
      </div>
    );
  }

  // Active Admin Screen view
  return (
    <div className="min-h-screen bg-[#FBF6EE] pb-32 max-w-xl mx-auto border-x border-[#e5ddd0]/50 relative text-[#1B3A2D]">
      
      {/* Top Admin Header */}
      <div className="bg-[#1B3A2D] text-[#FBF6EE] p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div>
          <h1 className="text-xl font-serif italic font-bold">Halka Control Board</h1>
          <p className="text-[10px] text-[#cbc3b5] font-semibold tracking-wider uppercase">Single operator terminal</p>
        </div>

        {/* Sync Indicator and Refresh action */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={async () => {
              showToast("Refreshing sheet registries...");
              await onRefreshSettings();
              await onRefreshOrders();
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button 
            type="button"
            onClick={() => {
              localStorage.removeItem("halka_phulka_admin_logged_in");
              setIsLoggedIn(false);
              showToast("Logged out successfully.");
            }}
            className="px-2.5 py-1.5 bg-[#E8860A]/20 text-[#E8860A] hover:bg-[#E8860A]/35 border border-[#E8860A]/30 rounded-lg text-xs font-black transition-colors cursor-pointer"
            title="Lock Control Panel"
          >
            🔒 Lock
          </button>
          
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${hasChanges ? "bg-amber-900/40 text-amber-300 border border-amber-600/30" : "bg-emerald-950/40 text-emerald-300 border border-emerald-600/30"}`}>
            <span className={`w-2 h-2 rounded-full ${hasChanges ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`}></span>
            {hasChanges ? "Changes Pending" : "In Sync"}
          </span>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="bg-white border-b border-[#e5ddd0]/60 text-xs font-bold flex sticky top-[68px] z-20">
        <button 
          onClick={() => setActiveTab("orders")}
          className={`flex-1 py-3.5 flex flex-col items-center gap-1 border-b-2 cursor-pointer ${activeTab === "orders" ? "border-[#E8860A] text-[#E8860A]" : "border-transparent text-[#7a7060]"}`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Orders ({orders.length})</span>
        </button>

        <button 
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 py-3.5 flex flex-col items-center gap-1 border-b-2 cursor-pointer ${activeTab === "analytics" ? "border-[#E8860A] text-[#E8860A]" : "border-transparent text-[#7a7060]"}`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </button>

        <button 
          onClick={() => setActiveTab("menu")}
          className={`flex-1 py-3.5 flex flex-col items-center gap-1 border-b-2 cursor-pointer ${activeTab === "menu" ? "border-[#E8860A] text-[#E8860A]" : "border-transparent text-[#7a7060]"}`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Menu Controller</span>
        </button>

        <button 
          onClick={() => setActiveTab("controls")}
          className={`flex-1 py-3.5 flex flex-col items-center gap-1 border-b-2 cursor-pointer ${activeTab === "controls" ? "border-[#E8860A] text-[#E8860A]" : "border-transparent text-[#7a7060]"}`}
        >
          <Sliders className="w-4 h-4" />
          <span>Controls</span>
        </button>
      </div>

      {/* Master Tab Content panels */}
      <div className="p-4">
        
        {/* Toast Toast alerts */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-[#1B3A2D] text-white py-2 px-4 shadow-xl border border-[#E8860A] rounded-full text-xs font-bold text-center">
            🔔 {toastMessage}
          </div>
        )}

        {/* 1. ORDERS PANEL */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            
            {/* Filter tags header */}
            <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-none">
              {["All", "New", "Preparing", "Out for Delivery", "Done", "Cancelled"].map(f => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1.5 text-[10.5px] rounded-full shrink-0 font-bold border transition ${orderFilter === f ? "bg-[#1B3A2D] text-white border-[#1B3A2D]" : "bg-white text-[#7a7060] border-[#e5ddd0]"}`}
                >
                  {f} {orders.filter(o => f === "All" ? true : o.status === f).length > 0 && `(${orders.filter(o => f === "All" ? true : o.status === f).length})`}
                </button>
              ))}
            </div>

            {/* Sorted Active cards list */}
            <div className="space-y-3">
              {getSortedOrders()
                .filter(o => orderFilter === "All" ? true : o.status === orderFilter)
                .map((order, idx) => {
                  const isUrgent = checkIfUrgent(order);
                  
                  return (
                    <div 
                      key={order.rowIndex || idx}
                      className={`bg-white rounded-2xl p-4 shadow-sm border transition duration-150 relative ${isUrgent ? "border-[#E8860A] animate-pulse shadow-md ring-1 ring-[#E8860A]/30" : "border-[#e5ddd0]/60"} ${order.status === "Done" ? "opacity-75 bg-[#f8fcf9]" : ""} ${order.status === "Cancelled" ? "opacity-55" : ""}`}
                    >
                      {/* Urgencies marker */}
                      {isUrgent && (
                        <span className="absolute top-2 right-2 bg-[#E8860A] text-white font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-widest block">
                          🔴 Dispatch Urgent
                        </span>
                      )}

                      {/* Header row */}
                      <div className="flex justify-between items-start mb-2 pt-1">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono font-bold text-stone-500 block">Row #{order.rowIndex}</span>
                            <span className={`text-[10px] uppercase font-bold py-0.5 px-2 rounded-full ${order.orderType === "delivery" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-slate-100 text-slate-700"}`}>
                              {order.orderType === "delivery" ? "🚀 Delivery" : "🏪 Pickup"}
                            </span>
                          </div>
                          
                          <h4 className="text-lg font-serif font-black text-[#1B3A2D]">{order.name}</h4>
                        </div>

                        {/* Status label badge display mapping */}
                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase inline-block font-mono tracking-tight ${order.status === "New" ? "bg-amber-100 text-amber-700 border border-amber-200" : order.status === "Preparing" ? "bg-orange-100 text-orange-700 border border-orange-200" : order.status === "Out for Delivery" ? "bg-blue-100 text-blue-700 border border-blue-200" : order.status === "Done" ? "bg-emerald-100 text-[#1B3A2D] border border-emerald-200" : "bg-stone-100 text-stone-500 border border-stone-200"}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      {/* Items details */}
                      <div className="mb-3 py-1.5 border-t border-dashed border-stone-100">
                        <p className="text-xs font-mono text-stone-500 leading-tight">Details</p>
                        <p className="text-[13px] font-bold mt-0.5 text-stone-800 leading-relaxed">{order.items}</p>
                      </div>

                      {/* Sub-grid specifications */}
                      <div className="grid grid-cols-2 gap-3 text-xs mb-4 p-2 bg-[#FBF6EE]/60 rounded-xl">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wide">Customer Phone</span>
                          <a 
                            href={`https://wa.me/91${order.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="font-bold flex items-center gap-1 text-[#E8860A] hover:underline"
                          >
                            <Phone className="w-3 h-3" /> {order.phone}
                          </a>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wide">Requested Slot</span>
                          <span className="font-bold flex items-center gap-1 text-stone-700 font-mono"><Clock className="w-3 h-3 text-[#E8860A]" /> {order.deliveryTime}</span>
                        </div>

                        {order.orderType === "delivery" && (
                          <div className="col-span-2 border-t border-dashed border-stone-200/55 pt-1">
                            <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wide">Destination Address</span>
                            <span className="font-medium text-stone-700 flex items-start gap-0.5 mt-0.5"><MapPin className="w-3 h-3 shrink-0 text-[#E8860A] mt-0.5" /> {order.address}</span>
                          </div>
                        )}
                      </div>

                      {order.rating ? (
                        <div className="mb-3 p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-600/15 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">🌟 Rating Feedback:</span>
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3.5 h-3.5 ${i < order.rating ? "text-[#E8860A] fill-[#E8860A]" : "text-stone-200 fill-stone-100"}`} 
                                />
                              ))}
                            </div>
                          </div>
                          {order.review && (
                            <p className="text-xs italic text-stone-700 font-semibold bg-white/70 px-2 py-1.5 rounded-lg border border-stone-100/60 mt-0.5 text-left">
                              "{order.review}"
                            </p>
                          )}
                        </div>
                      ) : null}

                      {/* Controls state toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                        <div className="flex gap-1.5 items-center">
                          <button
                            disabled={updatingRowIndices[order.rowIndex]}
                            onClick={() => openEditOrderModal(order)}
                            className="bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>

                        <div className="flex gap-1">
                          {["New", "Preparing", "Out for Delivery", "Done", "Cancelled"].map(st => {
                            if (st === order.status) return null; // skip current
                            
                            // Human emoji aliases
                            const stLabels: Record<string, string> = {
                              "New": "🟡 New",
                              "Preparing": "🟠 Prep",
                              "Out for Delivery": "🚗 Out",
                              "Done": "✅ Done",
                              "Cancelled": "❌ Cancel"
                            };

                            return (
                              <button
                                key={st}
                                disabled={updatingRowIndices[order.rowIndex]}
                                onClick={() => handleStatusUpdate(order.rowIndex, st)}
                                className={`text-[10px] font-bold px-2 py-1.5 rounded-md border transition active:scale-95 disabled:opacity-40 cursor-pointer ${st === "Preparing" ? "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200" : st === "Out for Delivery" ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" : st === "Done" ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-stone-50 text-stone-600 border-stone-200"}`}
                              >
                                {updatingRowIndices[order.rowIndex] ? "..." : stLabels[st]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 2. ANALYTICS PANEL */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            
            {/* Calendar & Time Filters Header */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                <div>
                  <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Selected Period Analysis</h4>
                  <p className="text-sm font-extrabold text-[#1B3A2D] mt-0.5">🗓️ Contemporary Analytical Filter</p>
                </div>
                <button
                  onClick={() => {
                    setAnalyticsDate("2026-05-21");
                    setAnalyticsHour("All");
                  }}
                  className="text-[10px] bg-[#1B3A2D]/5 hover:bg-[#1B3A2D]/10 text-[#1B3A2D] font-extrabold px-2.5 py-1.5 rounded-lg border border-stone-200 transition"
                >
                  Reset To Today
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-stone-500 uppercase tracking-wider block">Target Calendar Date</label>
                  <input
                    type="date"
                    value={analyticsDate}
                    onChange={(e) => setAnalyticsDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:ring-1 focus:ring-[#1B3A2D] bg-[#FBF6EE]/40 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-stone-500 uppercase tracking-wider block">Kitchen Dispatch Hour</label>
                  <select
                    value={analyticsHour}
                    onChange={(e) => setAnalyticsHour(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:ring-1 focus:ring-[#1B3A2D] bg-[#FBF6EE]/40 outline-none"
                  >
                    <option value="All">All-Day (5 PM - 10 PM)</option>
                    <option value="17">05:00 PM - 06:00 PM</option>
                    <option value="18">06:00 PM - 07:00 PM</option>
                    <option value="19">07:00 PM - 08:00 PM</option>
                    <option value="20">08:00 PM - 09:00 PM</option>
                    <option value="21">09:00 PM - 10:00 PM</option>
                    <option value="22">10:00 PM - 11:00 PM</option>
                  </select>
                </div>
              </div>

              {analyticsDate && (
                <div className="text-[10px] text-stone-500 flex justify-between items-center bg-stone-50 p-2 rounded-xl border border-stone-100">
                  <span>Results for: <strong className="text-stone-700 font-mono font-bold">{new Date(analyticsDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
                  {analyticsHour !== "All" && <span>Hour: <strong className="text-[#E8860A]">{analyticsHour}:00 hrs</strong></span>}
                </div>
              )}
            </div>

            {/* Numeric Indicators widgets */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-widest">Selected Revenue</span>
                  <span className="text-2xl font-black font-mono text-[#1B3A2D] block mt-1">₹{stats.todayRevenue}</span>
                </div>
                <p className="text-[10px] text-stone-500 italic mt-2.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#E8860A]" /> Completed status orders only
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-widest">Count in Range</span>
                  <span className="text-2xl font-black font-mono text-[#E8860A] block mt-1">{stats.todayCount} order{stats.todayCount !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2.5 block font-medium">
                  Average Worth: <span className="font-mono font-bold text-stone-700">₹{stats.averageOrderValue}</span>
                </p>
              </div>
            </div>

            {/* Weekly Trend Graph Card */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
              <div>
                <h4 className="text-[10px] uppercase font-black text-stone-400 tracking-widest">7-Day Rolling Trend</h4>
                <p className="text-sm font-extrabold text-stone-800 font-sans">📊 Weekly Performance (Done Revenue & Orders)</p>
              </div>

              <div className="relative">
                {/* SVG Graph container */}
                <div className="h-44 w-full bg-slate-50/50 rounded-2xl relative p-3 border border-stone-100 flex items-end">
                  
                  {/* Grid Lines */}
                  <div className="absolute inset-x-0 top-1/4 border-t border-stone-200/40 border-dashed pointer-events-none"></div>
                  <div className="absolute inset-x-0 top-2/4 border-t border-stone-200/40 border-dashed pointer-events-none"></div>
                  <div className="absolute inset-x-0 top-3/4 border-t border-stone-200/40 border-dashed pointer-events-none"></div>

                  <div className="w-full h-full flex items-end justify-between px-2 pt-6 relative z-10">
                    {stats.weeklyData.map((day, idx) => {
                      // Max bounds for scaling
                      const maxRevenue = Math.max(...stats.weeklyData.map(d => d.revenue), 1000);
                      const maxOrders = Math.max(...stats.weeklyData.map(d => d.orders), 5);
                      
                      const revHeightPercent = (day.revenue / maxRevenue) * 75; // scaled for aesthetics
                      const ordHeightPercent = (day.orders / maxOrders) * 75;

                      const isHovered = hoveredWeekDayIdx === idx;

                      return (
                        <div
                          key={day.dateStr}
                          onMouseEnter={() => setHoveredWeekDayIdx(idx)}
                          onMouseLeave={() => setHoveredWeekDayIdx(null)}
                          className="flex-1 flex flex-col justify-end items-center h-full group cursor-pointer px-1 relative"
                        >
                          {/* Done Revenue Area representation */}
                          <div className="w-full flex justify-center items-end gap-1.5 h-full">
                            {/* Orders volume (thin modern contemporary capsule) */}
                            <div 
                              className={`w-1.5 rounded-full transition-all duration-300 ${isHovered ? "bg-[#E8860A] -translate-y-1 h-[75%]" : "bg-stone-300 group-hover:bg-[#E8860A]/80"}`} 
                              style={{ height: `${Math.max(12, ordHeightPercent)}%` }}
                            />
                            
                            {/* Revenue height (wider contemporary slate pill) */}
                            <div 
                              className={`w-3.5 rounded-t-lg transition-all duration-500 ${isHovered ? "bg-[#1B3A2D] shadow-md shadow-[#1B3A2D]/20 -translate-y-1" : "bg-[#1B3A2D]/35 group-hover:bg-[#1B3A2D]/70"}`} 
                              style={{ height: `${Math.max(8, revHeightPercent)}%` }}
                            />
                          </div>

                          {/* Bottom abbreviated date labels */}
                          <span className={`text-[9px] font-mono font-black mt-2 transition-colors duration-150 ${isHovered ? "text-[#1B3A2D] scale-105" : "text-stone-400"}`}>
                            {day.label}
                          </span>

                          {/* Float Tooltip */}
                          {isHovered && (
                            <div className="absolute bottom-28 z-30 bg-stone-900 border border-stone-800 text-white rounded-xl p-2.5 shadow-xl text-[10px] w-32 font-mono space-y-1 pointer-events-none">
                              <p className="font-extrabold text-stone-100 border-b border-stone-700 pb-1 text-center">{day.label}</p>
                              <div className="flex justify-between pt-0.5">
                                <span className="text-stone-400">Revenue:</span>
                                <span className="text-[#E8860A] font-bold">₹{day.revenue}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">Fulfill:</span>
                                <span className="text-emerald-400 font-bold">{day.orders} ords</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Legend index labels */}
              <div className="flex gap-4 justify-center text-[10px] font-bold text-stone-400 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 bg-[#1B3A2D]/60 rounded"></span> Done Revenue (₹)</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-3 bg-stone-300 rounded-full"></span> Dispatch Volume</span>
              </div>
            </div>

            {/* Gated Apartment Society Champions Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Towers Leaders boards */}
              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-1 border-b border-stone-100">
                  <h4 className="text-[10px] uppercase font-black text-stone-400 tracking-widest">Tower Dispatch Ranking</h4>
                  <span className="text-[9px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">My Home Bhooja</span>
                </div>
                
                {stats.leadingTowers.length === 0 ? (
                  <p className="text-stone-400 text-xs italic py-4 text-center">No society tower dispatch items tracked yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {stats.leadingTowers.map((item, idx) => (
                      <div key={item.tower} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-[#1B3A2D]/5 rounded-md flex items-center justify-center font-bold text-[#1B3A2D] text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-stone-800">{item.tower}</span>
                        </div>
                        <div className="flex items-center gap-3 text-stone-500">
                          <span>{item.orders} orders</span>
                          <span className="font-mono font-bold text-[#E8860A]">₹{item.revenue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Ordering Flats board (Track down specific customers!) */}
              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-1 border-b border-stone-100">
                  <h4 className="text-[10px] uppercase font-black text-stone-400 tracking-widest">👑 Frequent Ordering Flats</h4>
                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">Top Gated Clients</span>
                </div>

                {stats.frequentCustomers.length === 0 ? (
                  <p className="text-stone-400 text-xs italic py-4 text-center text-stone-500">No flat details parsed from orders list yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {stats.frequentCustomers.map((c) => (
                      <div key={`${c.tower}_${c.flat}`} className="flex justify-between items-center text-xs pb-1 border-b border-stone-50 last:border-0">
                        <div>
                          <p className="font-extrabold text-stone-800 flex items-center gap-1">
                            <span className="text-[#E8860A] text-[8px]">&#9670;</span> {c.tower}, Flat {c.flat}
                          </p>
                          <p className="text-[9.5px] text-stone-400 font-bold">{c.name} &bull; <span className="font-mono text-[9px] text-stone-500 font-semibold">{c.phone}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-extrabold text-stone-700">{c.count} orders</p>
                          <p className="text-[9px] font-mono text-[#E8860A] font-bold">Val: ₹{c.revenue}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Popular ranking items */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3">
              <h4 className="text-[10px] uppercase font-black text-stone-400 tracking-widest pb-1 border-b border-stone-100">🔥 Popular item counts (Filtered Period)</h4>
              {stats.itemRankingList.length === 0 ? (
                <p className="text-stone-400 text-xs italic py-2 text-center">No culinary orders found under this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.itemRankingList.map((item, index) => {
                    const medals = ["🥇", "🥈", "🥉", "🏅", "🎖️"];
                    return (
                      <div key={index} className="flex justify-between items-center text-xs text-stone-700">
                        <span className="font-bold flex items-center gap-1.5 text-stone-800">
                          <span>{medals[index] || "•"}</span> {item.name}
                        </span>
                        <span className="font-mono bg-stone-100 font-black px-2.5 py-0.5 rounded font-bold text-stone-600">x{item.qty} dispatches</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delivery vs Pickup ratios */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3">
              <h4 className="text-[10px] uppercase font-black text-stone-400 tracking-widest">Fulfillment Ratio (All-Time)</h4>
              <div className="h-2 bg-[#FBF6EE] rounded-full overflow-hidden flex">
                <span className="bg-[#E8860A] h-full" style={{ width: `${stats.totalOrdersAllTime > 0 ? (stats.deliveryCount / stats.totalOrdersAllTime) * 100 : 50}%` }}></span>
                <span className="bg-[#1B3A2D] h-full" style={{ width: `${stats.totalOrdersAllTime > 0 ? (stats.pickupCount / stats.totalOrdersAllTime) * 100 : 50}%` }}></span>
              </div>
              <div className="flex justify-between text-[11px] text-stone-500 font-bold font-mono">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#E8860A] rounded-full"></span> Delivery: {stats.deliveryCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#1B3A2D] rounded-full"></span> Pickup: {stats.pickupCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. MENU CONTROLLER PANEL */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            
            {/* Changes prompt panel */}
            {hasChanges && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                <div>
                  <h4 className="text-sm font-bold text-amber-800">Unsaved configuration changes detected</h4>
                  <p className="text-xs text-amber-600">Apply configuration to update customer index list!</p>
                </div>

                <button
                  disabled={isSaving}
                  onClick={handleSaveAndApply}
                  className="bg-[#E8860A] hover:bg-[#ff9711] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  {isSaving ? "Syncing..." : <><Save className="w-3.5 h-3.5" /> Save & Apply</>}
                </button>
              </div>
            )}

            {/* Iterative customizable items dynamic form */}
            <div className="space-y-6">
              {Object.keys(localSettings.menu).map((catName) => {
                const list = localSettings.menu[catName];
                const isThali = catName === "thali";

                return (
                  <div key={catName} className="bg-white p-5 rounded-2xl border border-[#e5ddd0]/60 space-y-4 shadow-sm relative">
                    
                    {/* Header bar */}
                    <div className="flex justify-between items-center border-b border-[#e5ddd0]/40 pb-2">
                      <h4 className="font-serif text-lg font-black uppercase text-[#1B3A2D]">
                        {isThali ? "Dinner Thali (Hero item)" : catName}
                      </h4>

                      {!isThali && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(catName)}
                          className="text-stone-400 hover:text-red-500 p-1 text-[11px] font-bold border border-transparent hover:border-red-200 rounded-md"
                        >
                          ✕ Wipe Category
                        </button>
                      )}
                    </div>

                    {/* Category list items nested dynamic rendering */}
                    <div className="space-y-4">
                      {!isThali && list.length > 1 && (
                        <p className="text-[10px] text-stone-400 font-medium italic flex items-center gap-1">
                          <span>💡 Grab the</span>
                          <GripVertical className="inline w-3 h-3 text-stone-400" />
                          <span>handle to manually sort items inside this category</span>
                        </p>
                      )}
                      {list.map((item, index) => {
                        if (isThali) {
                          return (
                            <div key={item.id} className="space-y-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                  <label className="text-[10px] uppercase font-bold text-stone-400">Thali Title</label>
                                  <input 
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => handleThaliFieldChange("name", e.target.value)}
                                    className="w-full mt-0.5 p-2 bg-[#FBF6EE] rounded-lg text-xs font-bold border border-[#e5ddd0] outline-none"
                                  />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] uppercase font-bold text-stone-400">Regular Price (₹)</label>
                                  <input 
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => handleThaliFieldChange("price", parseFloat(e.target.value) || 0)}
                                    className="w-full mt-0.5 p-2 bg-[#FBF6EE] rounded-lg text-xs font-mono font-bold border border-[#e5ddd0] outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-stone-400">Today's Contents Description</label>
                                <textarea 
                                  rows={2}
                                  value={item.description}
                                  onChange={(e) => handleThaliFieldChange("description", e.target.value)}
                                  placeholder="e.g. Veg Pulav · Chana Dal · 3 Poori · Alu Curry · Raita..."
                                  className="w-full mt-0.5 p-2.5 bg-[#FBF6EE] rounded-xl text-xs font-medium border border-[#e5ddd0] outline-none"
                                />
                              </div>
                            </div>
                          );
                        }

                        // Standard Menu drag-and-drop sortable items
                        const isBeingDragged = draggedItem?.category === catName && draggedItem?.index === index;
                        const isDraggedOver = draggedOverIndex === index && draggedItem?.category === catName;

                        return (
                          <div 
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggedItem({ category: catName, index: index });
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDraggedOverIndex(null);
                            }}
                            onDragOver={(e) => {
                              if (draggedItem && draggedItem.category === catName) {
                                e.preventDefault();
                              }
                            }}
                            onDragEnter={() => {
                              if (draggedItem && draggedItem.category === catName) {
                                setDraggedOverIndex(index);
                              }
                            }}
                            onDrop={() => {
                              if (draggedItem && draggedItem.category === catName) {
                                handleItemReorder(catName, draggedItem.index, index);
                              }
                              setDraggedItem(null);
                              setDraggedOverIndex(null);
                            }}
                            className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all duration-200 select-none ${
                              isBeingDragged 
                                ? "bg-stone-50/50 border-dashed border-stone-300 opacity-40 shadow-inner scale-[0.98]" 
                                : isDraggedOver
                                ? "bg-[#1B3A2D]/10 border-dashed border-[#1B3A2D] scale-[1.01] shadow-sm"
                                : "bg-[#FBF6EE]/45 border-stone-100 hover:border-[#1B3A2D]/20 hover:shadow-xs"
                            }`}
                          >
                            {/* Drag handle tool grip */}
                            <div 
                              className="pt-1.5 cursor-grab active:cursor-grabbing text-stone-300 hover:text-[#1B3A2D] transition-colors shrink-0 flex items-center h-8"
                              title="Drag to sort within category"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <div className="flex-1 space-y-2">
                              <div className="flex justify-between items-center">
                                <input 
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleItemFieldChange(catName, item.id, "name", e.target.value)}
                                  className="font-bold text-xs bg-white p-1 rounded-md border border-[#e5ddd0]/60 text-stone-700 outline-none w-1/2 focus:ring-1 focus:ring-[#1B3A2D]"
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                />

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(catName, item.id)}
                                  className="text-stone-400 hover:text-red-500 cursor-pointer p-1 rounded hover:bg-stone-100 transition-colors"
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2 pt-1" draggable={false} onDragStart={(e) => e.stopPropagation()}>
                                <div>
                                  <label className="text-[8.5px] uppercase font-bold text-stone-400 block pb-0.5">Full Price (₹)</label>
                                  <input 
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => handleItemFieldChange(catName, item.id, "price", parseFloat(e.target.value) || 0)}
                                    className="w-full p-1 text-xs bg-white rounded-md border border-[#e5ddd0]/60 font-mono font-bold outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="text-[8.5px] uppercase font-bold text-stone-400 block pb-0.5">Half Price (₹)</label>
                                  <input 
                                    type="number"
                                    placeholder="None"
                                    value={item.half !== null ? item.half : ""}
                                    onChange={(e) => handleItemFieldChange(catName, item.id, "half", e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full p-1 text-xs bg-white rounded-md border border-[#e5ddd0]/60 font-mono outline-none"
                                  />
                                </div>

                                <div className="flex flex-col justify-end items-center pb-1">
                                  <label className="text-[8.5px] uppercase font-bold text-stone-400 block tracking-wider">In Stock</label>
                                  <input 
                                    type="checkbox"
                                    checked={item.inStock}
                                    onChange={(e) => handleItemFieldChange(catName, item.id, "inStock", e.target.checked)}
                                    className="mt-1 w-3.5 h-3.5 text-[#1B3A2D] accent-[#1B3A2D]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insertion section */}
            <div className="bg-white p-5 rounded-2xl border border-[#e5ddd0]/60 space-y-4 shadow-sm">
              <h4 className="font-semibold text-sm border-b pb-1 flex items-center gap-1"><Plus className="w-4 h-4 text-[#E8860A]" /> Add New Menu Choice</h4>
              
              <form onSubmit={handleAddItem} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-stone-400">Choice Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Paneer Tikka Masala"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full p-2 bg-[#FBF6EE] rounded-lg text-xs font-semibold outline-none border border-[#e5ddd0]"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-stone-400">Class Category</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => {
                        setNewItemCategory(e.target.value);
                        setCustomCategoryInput("");
                      }}
                      className="w-full p-2 bg-[#FBF6EE] rounded-lg text-xs font-semibold outline-none border border-[#e5ddd0]"
                    >
                      <option value="">-- Choose Category --</option>
                      {Object.keys(localSettings.menu).filter(k => k !== "thali").map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row pb-1">
                  <span className="text-[10px] text-stone-400 font-bold block">Or create a new category brand:</span>
                  <input 
                    type="text"
                    placeholder="e.g. tandoor"
                    value={customCategoryInput}
                    onChange={(e) => {
                      setCustomCategoryInput(e.target.value);
                      setNewItemCategory("");
                    }}
                    className="w-full mt-1 p-2 bg-[#FBF6EE] rounded-lg text-xs outline-none border border-[#e5ddd0] font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 bg-[#FBF6EE]/40 p-2 rounded-xl border border-stone-100">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-stone-400">Full Price (₹)</label>
                    <input 
                      type="number"
                      placeholder="e.g. 180"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className="w-full p-2 bg-white rounded-lg text-xs font-mono font-bold outline-none border border-[#e5ddd0]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-stone-400">Half Price (₹, optional)</label>
                    <input 
                      type="number"
                      placeholder="e.g. 100"
                      value={newItemHalfPrice}
                      onChange={(e) => setNewItemHalfPrice(e.target.value)}
                      className="w-full p-2 bg-white rounded-lg text-xs font-mono outline-none border border-[#e5ddd0]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#1B3A2D] hover:bg-emerald-900 text-white font-bold py-2.5 rounded-xl text-xs flex justify-center items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Load Choice into Menu Drawer
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. CONTROLS PANEL */}
        {activeTab === "controls" && (
          <div className="space-y-6">
            
            {/* Direct write url setups */}
            <div className="bg-white p-5 rounded-2xl border border-[#e5ddd0]/60 space-y-3 shadow-sm">
              <h4 className="text-sm font-bold uppercase tracking-wide border-b pb-1.5 flex items-center gap-1.5"><Sliders className="w-4 h-4 text-[#E8860A]" /> Backend Direct Sync Parameters</h4>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wide block">Google Apps Script Web App URL</label>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    placeholder="Enter https://script.google.com/macros/s/... Web App link"
                    value={gasUrl}
                    onChange={(e) => onUpdateGasUrl(e.target.value)}
                    className="flex-1 p-2 bg-[#FBF6EE] rounded-lg text-xs font-mono tracking-tighter outline-none border border-[#e5ddd0]"
                  />
                  {gasUrl && (
                    <button 
                      onClick={() => onUpdateGasUrl("")}
                      className="px-2 py-1 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-md"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 italic">If empty, fallback auto-saves safely inside our local workspace Mock database.</p>
              </div>
            </div>

            {/* Operating Toggles Section */}
            <div className="bg-white p-5 rounded-2xl border border-[#e5ddd0]/60 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold uppercase border-b pb-1.5 flex items-center gap-1"><Power className="w-4 h-4 text-[#E8860A]" /> Operational Switches</h3>
              
              {/* Op kitchen gate */}
              <div className="flex justify-between items-center py-1">
                <div>
                  <h4 className="font-bold text-xs">Kitchen Operational Status</h4>
                  <p className="text-[10.5px] text-stone-400">Lock order placements immediately</p>
                </div>
                <button
                  onClick={() => updateLocalMenuState(prev => ({ ...prev, kitchenOpen: !prev.kitchenOpen }))}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition ${localSettings.kitchenOpen ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"}`}
                >
                  {localSettings.kitchenOpen ? "🟢 ACTIVE (OPEN)" : "🔴 LOCKED (CLOSED)"}
                </button>
              </div>

              {/* closed messages text box */}
              {!localSettings.kitchenOpen && (
                <div className="space-y-1 block animate-fadeIn transition-all">
                  <label className="text-[10px] uppercase font-bold text-stone-400 block tracking-wide">Closed Message Banner Content</label>
                  <input 
                    type="text"
                    value={localSettings.closedMsg}
                    onChange={(e) => updateLocalMenuState(prev => ({ ...prev, closedMsg: e.target.value }))}
                    placeholder="We will be open at 5 PM tomorrow!"
                    className="w-full p-2 bg-[#FBF6EE] rounded-lg text-xs border border-[#e5ddd0]"
                  />
                </div>
              )}

              {/* Delivery controller */}
              <div className="flex justify-between items-center py-1 border-t border-dashed border-stone-100 mt-2 pt-2">
                <div>
                  <h4 className="font-bold text-xs">Hyderabad Direct Delivery Availability</h4>
                  <p className="text-[10.5px] text-stone-400">Enable/Disable home orders route</p>
                </div>
                <button
                  onClick={() => updateLocalMenuState(prev => ({ ...prev, deliveryOn: !prev.deliveryOn }))}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition ${localSettings.deliveryOn ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"}`}
                >
                  {localSettings.deliveryOn ? "🟢 DELIVERY ENABLED" : "🔴 SELF-PICKUP ONLY"}
                </button>
              </div>

              <div className="space-y-1 border-t border-dashed border-stone-100 mt-2 pt-2">
                <label className="text-[10px] uppercase font-bold text-stone-400 block tracking-wide">Daily Delivery Duty Slot Bounds</label>
                <input 
                  type="text"
                  value={localSettings.deliveryWindow}
                  onChange={(e) => updateLocalMenuState(prev => ({ ...prev, deliveryWindow: e.target.value }))}
                  placeholder="e.g., 7PM – 8PM"
                  className="w-full p-2 bg-[#FBF6EE] rounded-lg text-xs font-mono font-bold border border-[#e5ddd0]"
                />
              </div>

              <div className="space-y-1.5 border-t border-dashed border-stone-100 mt-2 pt-2">
                <label className="text-[10px] uppercase font-bold text-stone-400 block tracking-wide">Checkout Delivery Option Presets</label>
                
                {/* Visual slot tags with delete toggle */}
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {((localSettings.deliverySlots && localSettings.deliverySlots.length > 0)
                    ? localSettings.deliverySlots
                    : ["ASAP", "7:00 PM (Dinner)", "7:30 PM (Dinner)", "8:00 PM (Dinner)", "8:30 PM (Dinner)", "9:00 PM (Dinner)"]
                  ).map((slot, index) => (
                    <span 
                      key={index} 
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#1B3A2D]/10 hover:bg-[#1B3A2D]/20 text-[#1B3A2D] font-bold text-[10px] rounded-lg transition"
                    >
                      <span>{slot}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentList = localSettings.deliverySlots && localSettings.deliverySlots.length > 0
                            ? [...localSettings.deliverySlots]
                            : ["ASAP", "7:00 PM (Dinner)", "7:30 PM (Dinner)", "8:00 PM (Dinner)", "8:30 PM (Dinner)", "9:00 PM (Dinner)"];
                          currentList.splice(index, 1);
                          updateLocalMenuState(prev => ({
                            ...prev,
                            deliverySlots: currentList
                          }));
                        }}
                        className="text-stone-500 hover:text-red-600 font-extrabold text-[11px] px-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {(!localSettings.deliverySlots || localSettings.deliverySlots.length === 0) && (
                    <span className="text-[10px] text-stone-400 font-medium">No slots defined (using standard fallback)</span>
                  )}
                </div>

                {/* Slot appending area */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSlotText}
                    onChange={(e) => setNewSlotText(e.target.value)}
                    placeholder="e.g., 7:45 PM (Dinner thali)"
                    className="flex-1 p-2 bg-[#FBF6EE] rounded-lg text-xs font-semibold border border-[#e5ddd0] outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!newSlotText.trim()) return;
                        const currentList = localSettings.deliverySlots && localSettings.deliverySlots.length > 0
                          ? [...localSettings.deliverySlots]
                          : ["ASAP", "7:00 PM (Dinner)", "7:30 PM (Dinner)", "8:00 PM (Dinner)", "8:30 PM (Dinner)", "9:00 PM (Dinner)"];
                        if (!currentList.includes(newSlotText.trim())) {
                          currentList.push(newSlotText.trim());
                        }
                        updateLocalMenuState(prev => ({
                          ...prev,
                          deliverySlots: currentList
                        }));
                        setNewSlotText("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSlotText.trim()) return;
                      const currentList = localSettings.deliverySlots && localSettings.deliverySlots.length > 0
                        ? [...localSettings.deliverySlots]
                        : ["ASAP", "7:00 PM (Dinner)", "7:30 PM (Dinner)", "8:00 PM (Dinner)", "8:30 PM (Dinner)", "9:00 PM (Dinner)"];
                      if (!currentList.includes(newSlotText.trim())) {
                        currentList.push(newSlotText.trim());
                      }
                      updateLocalMenuState(prev => ({
                        ...prev,
                        deliverySlots: currentList
                      }));
                      setNewSlotText("");
                    }}
                    className="px-3 py-2 bg-[#1B3A2D] text-white font-bold text-xs rounded-lg hover:bg-emerald-950 transition active:scale-95 cursor-pointer"
                  >
                    + Add Slot
                  </button>
                </div>
              </div>
            </div>

            {/* Panic panic box */}
            <div className="bg-red-50 border border-red-100 p-5 rounded-2xl space-y-3 shadow-inner">
              <h4 className="font-serif font-black text-red-800 text-sm flex items-center gap-1">
                <AlertOctagon className="w-5 h-5 text-[#E8860A] shrink-0" /> Cloud Kitchen Panic Emergency Stop
              </h4>
              <p className="text-xs text-red-600 leading-tight">
                Locks all inventory counts across all menus. Renders everything as "Sold Out" instantly to block traffic.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handlePanicSwitch(true)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95"
                >
                  ⚠️ Block All Stocks (Out of Stock)
                </button>
                <button
                  onClick={() => handlePanicSwitch(false)}
                  className="flex-1 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 font-bold py-2.5 rounded-xl text-xs active:scale-95"
                >
                  Restore Stocks
                </button>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white p-5 rounded-2xl border border-[#e5ddd0]/60 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider border-b pb-1">🧰 Quick Maintenance Actions</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportCSV}
                  className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl py-3 px-2 text-xs font-bold flex flex-col items-center justify-center gap-1 active:scale-95"
                >
                  <Download className="w-4 h-4 text-[#E8860A]" />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl py-3 px-2 text-xs font-bold flex flex-col items-center justify-center gap-1 active:scale-95"
                >
                  <Copy className="w-4 h-4 text-[#1B3A2D]" />
                  <span>Copy Store Link</span>
                </button>

                <button
                  onClick={handleClearCompleted}
                  className="bg-stone-50 hover:bg-rose-50 text-stone-500 hover:text-red-600 border border-stone-200 hover:border-red-100 rounded-xl py-3 px-2 text-xs font-bold flex flex-col items-center justify-center gap-1 active:scale-95 col-span-2 mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Prune Finished Logs</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save settings toolbar adhesive if changes noticed */}
      {hasChanges && activeTab !== "menu" && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-[#e5ddd0] shadow-xl z-30 max-w-xl mx-auto flex justify-between items-center rounded-t-xl">
          <div>
            <span className="text-xs font-black text-amber-600 uppercase block tracking-wider animate-pulse">Save Warning</span>
            <span className="text-xs text-stone-500 font-bold">Unsaved menu/controls layout exist.</span>
          </div>

          <button
            onClick={handleSaveAndApply}
            disabled={isSaving}
            className="bg-[#E8860A] hover:bg-[#ff9711] text-white py-2.5 px-6 rounded-xl font-bold text-xs shadow transition active:scale-95"
          >
            {isSaving ? "Syncing..." : "Save & Apply Changes"}
          </button>
        </div>
      )}

      {/* Sheet Edit Order Bottom Sheet Modal overlay component */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl max-w-md w-full p-6 space-y-4 shadow-xl border-t border-[#e5ddd0]/60 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h4 className="text-md uppercase tracking-wider font-bold text-stone-400 font-mono">Row #{editingOrder.rowIndex} Editor</h4>
                <h3 className="font-serif text-lg font-black text-[#1B3A2D]">Modify Record</h3>
              </div>
              <button 
                onClick={() => setEditingOrder(null)}
                className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-stone-400 block font-bold">Customer Name</label>
                <input 
                  type="text"
                  value={editOrderName}
                  onChange={(e) => setEditOrderName(e.target.value)}
                  className="w-full p-3 bg-[#FBF6EE] border rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-stone-400 block font-bold">Phone Number</label>
                <input 
                  type="text"
                  value={editOrderPhone}
                  onChange={(e) => setEditOrderPhone(e.target.value)}
                  className="w-full p-3 bg-[#FBF6EE] border rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-stone-400 block font-bold">Time Requested</label>
                <input 
                  type="text"
                  value={editOrderTime}
                  onChange={(e) => setEditOrderTime(e.target.value)}
                  className="w-full p-3 bg-[#FBF6EE] border rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-stone-400 block font-bold">Items string registry</label>
                <input 
                  type="text"
                  value={editOrderItems}
                  onChange={(e) => setEditOrderItems(e.target.value)}
                  className="w-full p-3 bg-[#FBF6EE] border rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-stone-400 block font-bold">Total Bill (₹)</label>
                <input 
                  type="number"
                  value={editOrderTotal}
                  onChange={(e) => setEditOrderTotal(e.target.value)}
                  className="w-full p-3 bg-[#FBF6EE] border rounded-xl font-mono"
                />
              </div>

              {editingOrder.orderType === "delivery" && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-stone-400 block font-bold">Address coordinates</label>
                  <textarea 
                    rows={2}
                    value={editOrderAddress}
                    onChange={(e) => setEditOrderAddress(e.target.value)}
                    className="w-full p-3 bg-[#FBF6EE] border rounded-xl"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdatingOrder}
                className="w-full p-4 bg-[#E8860A] text-white font-bold rounded-xl text-center flex justify-center items-center gap-1"
              >
                {isUpdatingOrder ? "Updating Sheets..." : <><Save className="w-4 h-4" /> Save Record Info</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
