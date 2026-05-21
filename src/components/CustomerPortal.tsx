import React, { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  MapPin, 
  Clock, 
  Phone, 
  User, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle,
  Sparkles,
  Info,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, MenuItem, CartItem } from "../types";

interface CustomerPortalProps {
  settings: Settings;
  onRefreshSettings: () => Promise<void>;
  gasUrl: string; // Dynamic Google Apps Script Web App URL if configured
}

export default function CustomerPortal({ settings, onRefreshSettings, gasUrl }: CustomerPortalProps) {
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [orderType, setOrderType] = useState<"delivery" | "pickup">(
    settings.deliveryOn ? "delivery" : "pickup"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Size preferences state to prevent size selection bugs when adding items
  // id_size storing "Full" or "Half" per item ID
  const [sizePrefs, setSizePrefs] = useState<Record<string, "Full" | "Half">>({});

  // Customer checkout Form fields
  const [customerName, setCustomerName] = useState(() => {
    return localStorage.getItem("halka_phulka_last_customer_name") || "";
  });
  const [phone, setPhone] = useState(() => {
    return localStorage.getItem("halka_phulka_last_phone") || "";
  });
  const [address, setAddress] = useState("");
  const [time, setTime] = useState("");

  // Ultra-localized target society address parameters
  const [selectedBlock, setSelectedBlock] = useState(() => {
    return localStorage.getItem("halka_phulka_last_selected_block") || "Tower 1";
  });
  const [flatNum, setFlatNum] = useState(() => {
    return localStorage.getItem("halka_phulka_last_flat_num") || "";
  });

  const [recentItems, setRecentItems] = useState<CartItem[]>([]);
  const [showToastMsg, setShowToastMsg] = useState<string | null>(null);

  // Load past order items on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("halka_phulka_last_cart_items");
      if (stored) {
        setRecentItems(Object.values(JSON.parse(stored)));
      }
    } catch (e) {
      console.warn("Could not read recent items", e);
    }
  }, []);

  const triggerToast = (msg: string) => {
    setShowToastMsg(msg);
    setTimeout(() => {
      setShowToastMsg(null);
    }, 3000);
  };

  // Handle auto-formatting block address with selected tower and flat
  useEffect(() => {
    if (orderType === "delivery") {
      if (flatNum.trim()) {
        setAddress(`${selectedBlock}, Flat ${flatNum.trim()}`);
      } else {
        setAddress("");
      }
    } else {
      setAddress("PICKUP");
    }
  }, [selectedBlock, flatNum, orderType]);
  
  // Checkout & loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderResponse, setLastOrderResponse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Interactive menu search & live order tracking states
  const [searchQuery, setSearchQuery] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);

  // Feedback rating and review states
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackReview, setFeedbackReview] = useState<string>("");
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);

  // Account-less order retrieval lookup states
  const [lookupPhone, setLookupPhone] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showLookupPanel, setShowLookupPanel] = useState(false);

  const handleOrderLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const cleanedSearch = lookupPhone.trim().replace(/[^0-9]/g, "");
    if (!cleanedSearch || cleanedSearch.length < 8) {
      setLookupError("Please enter a valid phone number (at least 8 digits).");
      return;
    }
    setIsLookingUp(true);
    try {
      const res = await fetch("/api/gsheets");
      if (!res.ok) {
        throw new Error("Failed to look up sheet database");
      }
      const list = await res.json();
      
      // Match phone numbers - clean up formatting or match direct digits
      const matched = list
        .filter((o: any) => {
          if (!o.phone) return false;
          const cleanedPhoneObj = o.phone.replace(/[^0-9]/g, "");
          return cleanedPhoneObj.includes(cleanedSearch) || cleanedSearch.includes(cleanedPhoneObj);
        })
        .sort((a: any, b: any) => b.rowIndex - a.rowIndex); // Latest order first

      if (matched.length > 0) {
        const found = matched[0];
        localStorage.setItem("halka_phulka_last_order_row", String(found.rowIndex));
        setTrackedOrder(found);
        setLookupPhone("");
        setShowLookupPanel(false);
      } else {
        setLookupError("No recent orders found matching this phone number.");
      }
    } catch (err) {
      setLookupError("Error fetching live database. Please try again.");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Load last placed order on mount & background poll (every 10 seconds)
  useEffect(() => {
    const rowStr = localStorage.getItem("halka_phulka_last_order_row");
    if (!rowStr) {
      setTrackedOrder(null);
      return;
    }
    const trackedRowIdx = parseInt(rowStr, 10);
    if (!trackedRowIdx) return;

    const fetchTrackedOrder = async () => {
      try {
        const res = await fetch("/api/gsheets");
        if (res.ok) {
          const list = await res.json();
          const found = list.find((o: any) => o.rowIndex === trackedRowIdx);
          if (found) {
            setTrackedOrder(found);
          }
        }
      } catch (err) {
        console.warn("Exception polling tracked order state:", err);
      }
    };

    fetchTrackedOrder();
    const interval = setInterval(fetchTrackedOrder, 10000);
    return () => clearInterval(interval);
  }, [lastOrderResponse]);

  // Sync feedback rating and review when active tracked order changes or updates
  useEffect(() => {
    if (trackedOrder) {
      if (trackedOrder.rating !== undefined && trackedOrder.rating !== null && trackedOrder.rating > 0) {
        setFeedbackRating(trackedOrder.rating);
        setFeedbackReview(trackedOrder.review || "");
      } else {
        // Fallback to local storage if available for this row
        try {
          const stored = localStorage.getItem(`halka_phulka_review_${trackedOrder.rowIndex}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            setFeedbackRating(parsed.rating || 0);
            setFeedbackReview(parsed.review || "");
          } else {
            setFeedbackRating(0);
            setFeedbackReview("");
          }
        } catch {
          setFeedbackRating(0);
          setFeedbackReview("");
        }
      }
    } else {
      setFeedbackRating(0);
      setFeedbackReview("");
    }
    setHoverRating(0);
  }, [trackedOrder?.rowIndex, trackedOrder?.rating, trackedOrder?.review]);

  // Submit feedback rating & review to backend
  const handleSubmitFeedback = async () => {
    if (!trackedOrder) return;
    if (feedbackRating === 0) {
      triggerToast("Please select a rating star!");
      return;
    }
    
    setIsSubmittingFeedback(true);
    try {
      const response = await fetch("/api/gsheets/rateOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: trackedOrder.rowIndex,
          rating: feedbackRating,
          review: feedbackReview,
        }),
      });

      if (response.ok) {
        // Optimistically update local active state
        setTrackedOrder((prev: any) => {
          if (!prev) return null;
          return { ...prev, rating: feedbackRating, review: feedbackReview };
        });
        
        // Save in local storage as a robust backup
        localStorage.setItem(`halka_phulka_review_${trackedOrder.rowIndex}`, JSON.stringify({
          rating: feedbackRating,
          review: feedbackReview,
          timestamp: new Date().toISOString()
        }));
        
        triggerToast("🎉 Thank you! Review submitted successfully.");
      } else {
        triggerToast("Could not submit review. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting rating:", err);
      triggerToast("Network error submitting review.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  
  // For scrolling to checkout
  const checkoutRef = useRef<HTMLDivElement>(null);

  // Sync state if settings flags change
  useEffect(() => {
    if (!settings.deliveryOn && orderType === "delivery") {
      setOrderType("pickup");
    }
  }, [settings.deliveryOn]);

  // Periodic settings sync (polling settings every 60 seconds silently)
  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshSettings().catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, [onRefreshSettings]);

  // Helper: toggle size for an item
  const toggleSize = (itemId: string) => {
    setSizePrefs(prev => ({
      ...prev,
      [itemId]: prev[itemId] === "Half" ? "Full" : "Half"
    }));
  };

  // Helper: add to cart
  const handleAdd = (item: MenuItem, category: string) => {
    const size = item.half !== null ? (sizePrefs[item.id] || "Full") : "Full";
    const key = `${item.id}_${size}`;
    const price = size === "Half" && item.half !== null ? item.half : item.price;
    
    setCart(prev => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          id: item.id,
          name: item.name,
          size,
          price,
          qty: existing ? existing.qty + 1 : 1,
          category
        }
      };
    });
  };

  // Helper: remove/decrement from cart
  const handleRemove = (item: MenuItem, sizeReq?: "Full" | "Half") => {
    const size = sizeReq || (item.half !== null ? (sizePrefs[item.id] || "Full") : "Full");
    const key = `${item.id}_${size}`;
    
    setCart(prev => {
      const existing = prev[key];
      if (!existing) return prev;
      
      const updated = { ...prev };
      if (existing.qty <= 1) {
        delete updated[key];
      } else {
        updated[key] = {
          ...existing,
          qty: existing.qty - 1
        };
      }
      return updated;
    });
  };

  // Get current quantity of a specific size in cart
  const getItemQty = (itemId: string, size: "Full" | "Half") => {
    const key = `${itemId}_${size}`;
    return cart[key]?.qty || 0;
  };

  // Subtotal and Totals computing
  const DELIVERY_CHARGE = 20;
  const cartList = Object.values(cart) as CartItem[];
  const cartCount = cartList.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cartList.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const deliveryChargeApplied = orderType === "delivery" ? DELIVERY_CHARGE : 0;
  const orderTotal = subtotal + deliveryChargeApplied;

  const scrollToCheckout = () => {
    checkoutRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Order submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    // Validations
    if (!customerName.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("Please enter your phone number");
      return;
    }
    if (orderType === "delivery" && (!flatNum.trim() || !address.trim())) {
      setErrorMessage("Please select your Tower and enter your Flat Number.");
      return;
    }
    if (!time.trim()) {
      setErrorMessage(`Please enter your desired ${orderType === "delivery" ? "delivery" : "pickup"} time`);
      return;
    }
    if (cartCount === 0) {
      setErrorMessage("Your cart is empty! Please select some items first.");
      return;
    }

    setIsSubmitting(true);

    const itemsPayload = cartList.map(item => ({
      name: item.name,
      size: item.size,
      qty: item.qty,
      price: item.price,
      total: item.price * item.qty
    }));

    const payload = {
      customer_name: customerName.trim(),
      phone: phone.trim(),
      address: orderType === "delivery" ? address.trim() : "PICKUP",
      delivery_time: time.trim(),
      order_type: orderType,
      items: itemsPayload,
      subtotal,
      delivery_charge: deliveryChargeApplied,
      order_total: orderTotal,
      timestamp: new Date().toISOString()
    };

    try {
      // First try sending order to our full-stack server webhook proxy (simulating n8n pipeline node + appending sheet)
      const response = await fetch("/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      const serverResult = await response.json();

      // If user has a real google apps script URL configured, we also post there as a fallback or parallel write
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
        } catch (gasErr) {
          console.warn("GAS Web App Direct Write skipped/failed:", gasErr);
        }
      }

      setLastOrderResponse({
        ...payload,
        rowIndex: serverResult.rowIndex || "Success"
      });

      // Save returning user details for extreme ease next time before clearing state
      localStorage.setItem("halka_phulka_last_customer_name", customerName.trim());
      localStorage.setItem("halka_phulka_last_phone", phone.trim());
      localStorage.setItem("halka_phulka_last_selected_block", selectedBlock);
      localStorage.setItem("halka_phulka_last_flat_num", flatNum.trim());
      localStorage.setItem("halka_phulka_last_cart_items", JSON.stringify(cart));
      
      // Update quick reorder list state dynamically
      setRecentItems(Object.values(cart));

      // Clear states
      setCart({});
      setCustomerName("");
      setPhone("");
      setAddress("");
      setTime("");

      // Persistent local tracking for community active ticket
      if (serverResult.rowIndex) {
        localStorage.setItem("halka_phulka_last_order_row", String(serverResult.rowIndex));
      }
    } catch (err: any) {
      console.error("Order placing error:", err);
      // Fallback/No-CORS edge cases:
      setErrorMessage("Order could not be sent to server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setLastOrderResponse(null);
    setErrorMessage(null);
  };

  // Success Overlay Screen
  if (lastOrderResponse) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#1B3A2D] text-white flex flex-col justify-between p-6 overflow-y-auto"
      >
        <div className="max-w-md mx-auto w-full py-8 text-center flex flex-col justify-center items-center flex-1">
          <motion.div 
            initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 12, delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-[#E8860A] flex items-center justify-center mb-6 shadow-lg shadow-[#E8860A]/30"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-serif font-bold text-[#FBF6EE] mb-2"
          >
            Order Confirmed!
          </motion.h1>
          <motion.p 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[#bfb8ac] font-medium mb-6 italic"
          >
            "Halka Bill, Full ka Feel"
          </motion.p>
          
          <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 15, delay: 0.4 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-left w-full border border-white/10 mb-8 space-y-4 shadow-2xl"
          >
            <div className="border-b border-white/10 pb-3 flex justify-between items-center text-sm font-mono text-[#FBF6EE]">
              <span>Order Reference: #{lastOrderResponse.rowIndex || "HP-99"}</span>
              <span>{new Date(lastOrderResponse.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider font-mono">Deliver To</p>
              <p className="text-lg font-semibold text-[#FBF6EE]">{lastOrderResponse.customer_name}</p>
              <p className="text-sm text-white/80">{lastOrderResponse.phone}</p>
              {lastOrderResponse.orderType === "delivery" ? (
                <p className="text-sm text-white/80 mt-1 flex items-start gap-1"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#E8860A]" /> {lastOrderResponse.address}</p>
              ) : (
                <p className="text-sm font-semibold text-[#E8860A] mt-1 flex items-center gap-1">🏪 SELF-PICKUP</p>
              )}
            </div>

            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider font-mono">Time Requested</p>
              <p className="text-sm font-semibold flex items-center gap-1.5 text-[#FBF6EE] mt-0.5">
                <Clock className="w-4 h-4 text-[#E8860A]" /> {lastOrderResponse.delivery_time}
              </p>
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-white/50 uppercase tracking-wider font-mono mb-2">Order Items</p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {lastOrderResponse.items.map((item: any, idx: number) => (
                  <motion.div 
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                    key={idx} 
                    className="flex justify-between text-sm text-white/90"
                  >
                    <span>{item.name} {item.size && item.size !== "Full" ? `(${item.size})` : ""} <span className="text-[#E8860A] font-semibold">x{item.qty}</span></span>
                    <span className="font-mono">₹{item.total}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 flex justify-between font-semibold text-[#FBF6EE]">
              <span>Total Amount (incl. charges)</span>
              <span className="text-[#E8860A] text-lg font-mono font-bold">₹{lastOrderResponse.order_total}</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="w-full space-y-3"
          >
            <button 
              onClick={() => {
                try {
                  const itemsListText = lastOrderResponse.items
                    .map((i: any) => `• *${i.name}* ${i.size !== "Full" ? `(${i.size})` : ""} - x${i.qty} (₹${i.total})`)
                    .join("\n");
                    
                  const text = `*HALKA PHULKA ORDER CONFIRMATION* 🍲\n---------------------------------------\n*Order Reference:* #${lastOrderResponse.rowIndex || "Success"}\n*Customer Name:* ${lastOrderResponse.customer_name}\n*Phone:* ${lastOrderResponse.phone}\n*Fulfillment:* ${lastOrderResponse.orderType === "delivery" ? `📍 Delivery: ${lastOrderResponse.address}` : "🏪 SELF-PICKUP"}\n*Time Requested:* ${lastOrderResponse.delivery_time}\n---------------------------------------\n*Order Items:*\n${itemsListText}\n---------------------------------------\n*TOTAL BILL AMOUNT:* ₹${lastOrderResponse.order_total}\n\n_Thank you for ordering homestyle goodness!_ ❤️`;
                  const encoded = encodeURIComponent(text);
                  window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
                } catch (err) {
                  console.error("WhatsApp Link shared error:", err);
                }
              }}
              className="w-full bg-[#25D366] hover:bg-[#20ba56] text-white py-3.5 rounded-xl font-extrabold transition transform active:scale-95 text-center cursor-pointer shadow-lg flex items-center justify-center gap-2 text-sm"
            >
              💬 Share Receipt to WhatsApp
            </button>
            <button 
              onClick={handleReset}
              className="w-full bg-[#E8860A] hover:bg-[#ff9711] text-white py-3.5 rounded-xl font-bold transition transform active:scale-95 text-center cursor-pointer shadow-md text-sm"
            >
              Order Again
            </button>
            <p className="text-[10px] text-white/50">Your order has been recorded. Click above to message the chef!</p>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Kitchen is Closed overlay / banner
  const isKitchenOpen = settings.kitchenOpen;

  return (
    <div className="relative w-full min-h-screen bg-[#FBF6EE] text-[#1B3A2D] pb-32">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-br from-[#122B20] via-[#1B3A2D] to-[#122B20] text-white p-6 rounded-b-[2rem] shadow-xl relative overflow-hidden border-b-4 border-[#E8860A]">
        {/* Ambient glow decoration */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#E8860A]/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
        
        <div className="max-w-md mx-auto relative z-10">
          {/* Tagline & Logo branding */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="inline-flex items-center gap-1 bg-[#E8860A]/90 backdrop-blur-sm text-[10px] font-black text-white px-3 py-1 rounded-full uppercase tracking-wider shadow-sm border border-orange-400/20">
                ✨ Cloud Kitchen Luxe
              </span>
              <h1 className="text-4xl font-serif italic font-black tracking-tight text-[#FBF6EE] mt-1.5 drop-shadow-sm">
                Halka Phulka
              </h1>
            </div>
            
            {/* Status indicators */}
            <div className="flex flex-col items-end gap-1">
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-bold shadow-inner ${isKitchenOpen ? "bg-emerald-950/60 text-[#5eead4] border border-emerald-500/20" : "bg-rose-950/60 text-rose-300 border border-rose-500/20"}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${isKitchenOpen ? "bg-[#34d399] animate-pulse shadow-[0_0_8px_#34d399]" : "bg-rose-400"}`}></span>
                {isKitchenOpen ? "Active Kitchen" : "Closed Today"}
              </span>
            </div>
          </div>
          
          <p className="text-stone-300 text-xs font-medium leading-relaxed italic border-l-2 border-[#E8860A] pl-3 py-0.5 mt-2 bg-white/5 rounded-r-lg">
            "Halka Bill, Full ka Feel" &bull; Fresh homestyle delicacies delivered right to your doorstep.
          </p>
          
          {/* Info stats */}
          <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-[#FBF6EE]/90">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-[#E8860A]" /> Timings: <b className="text-white font-semibold font-mono">{settings.deliveryWindow}</b>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl font-bold border border-white/5 font-mono shadow-sm">
              Fee: ₹{DELIVERY_CHARGE}
            </span>
          </div>
        </div>
      </div>

       {/* Main Container */}
      <div className="max-w-md mx-auto px-4 mt-6 space-y-6">
        
        {/* Account-less Order Lookup Box with AnimatePresence */}
        <AnimatePresence mode="wait">
          {showLookupPanel ? (
            <motion.div 
              key="lookup-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="bg-stone-50 p-4.5 rounded-3xl border border-stone-200/80 shadow-inner space-y-3 overflow-hidden"
            >
              <div className="flex justify-between items-center pb-1 border-b border-stone-200/60">
                <span className="text-[10px] uppercase font-black text-stone-500 tracking-wider flex items-center gap-1">🔍 Live Status Retrieval</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowLookupPanel(false);
                    setLookupError(null);
                  }}
                  className="text-[10.5px] font-black text-[#1B3A2D] hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[10.5px] text-stone-500 font-medium leading-relaxed">
                Did you refresh the page or clear your cookies? Enter your WhatsApp number below to recover and track your latest active order in real-time.
              </p>
              <form onSubmit={handleOrderLookup} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-[9px] text-[10px] text-stone-400 font-bold font-mono">+91</span>
                  <input
                    type="tel"
                    placeholder="WhatsApp Mobile Number"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white rounded-xl text-xs font-bold border border-stone-300 focus:ring-1 focus:ring-[#1B3A2D] outline-none text-stone-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLookingUp}
                  className="bg-[#1B3A2D] hover:bg-emerald-950 text-white px-4 py-2 rounded-xl text-xs font-black tracking-wide transition disabled:opacity-55 shrink-0 flex items-center justify-center cursor-pointer"
                >
                  {isLookingUp ? "Searching..." : "Track"}
                </button>
              </form>
              {lookupError && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100"
                >
                  {lookupError}
                </motion.p>
              )}
            </motion.div>
          ) : (
            !trackedOrder && (
              <motion.div 
                key="track-cta"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between bg-white text-[#1B3A2D] px-4 py-3 rounded-2xl border border-stone-200/80 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base select-none">🍲</span>
                  <div>
                    <h5 className="text-[11px] font-black leading-tight text-[#1B3A2D]">Already placed an order today?</h5>
                    <p className="text-[9.5px] text-stone-500 font-medium mt-0.5">Re-enable real-time live food tracking</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookupPanel(true)}
                  className="text-[10px] font-black text-[#E8860A] hover:text-[#ff9711] bg-[#E8860A]/10 hover:bg-[#E8860A]/15 px-3 py-1.5 rounded-lg border border-[#E8860A]/20 transition shrink-0 cursor-pointer"
                >
                  Track Now
                </button>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Dynamic Toast Message Banner */}
        <AnimatePresence>
          {showToastMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -50, scale: 0.9, x: "-50%" }}
              animate={{ opacity: 1, y: 20, scale: 1, x: "-50%" }}
              exit={{ opacity: 0, y: -50, scale: 0.9, x: "-50%" }}
              className="fixed top-4 left-1/2 bg-[#1B3A2D] text-[#FBF6EE] px-4 py-2.5 rounded-full text-xs font-black shadow-lg z-50 flex items-center gap-2 border border-emerald-800"
            >
              <span>✨</span> {showToastMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Reorder Section for returning customers */}
        {recentItems.length > 0 && cartCount === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50/70 p-4.5 rounded-3xl border border-emerald-600/10 space-y-3"
          >
            <div className="flex justify-between items-center pb-2 border-b border-emerald-600/10">
              <span className="text-[10px] font-black text-[#1B3A2D] uppercase tracking-wider flex items-center gap-1.5">
                ⚡ Quick Reorder Last Selection
              </span>
              <span className="text-[9px] text-[#E8860A] font-extrabold uppercase bg-white px-2 py-0.5 rounded-md border border-stone-100">
                1-Click shortcut
              </span>
            </div>
            <div className="space-y-1">
              {recentItems.map((ritem: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs font-semibold text-stone-700">
                  <span>{ritem.name} {ritem.size && ritem.size !== "Full" ? `(${ritem.size})` : ""} <span className="text-emerald-700 font-extrabold">x{ritem.qty}</span></span>
                  <span className="font-mono text-stone-500">₹{ritem.price * ritem.qty}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const raw = localStorage.getItem("halka_phulka_last_cart_items");
                if (raw) {
                  try {
                    setCart(JSON.parse(raw));
                    triggerToast("Restored your last order selection into basket!");
                  } catch(e){}
                }
              }}
              className="w-full bg-[#1B3A2D] hover:bg-emerald-950 text-white rounded-xl py-2.5 text-xs font-black cursor-pointer shadow-sm transition-all text-center flex justify-center items-center gap-1 active:scale-95"
            >
              🍲 Load Last Selection into Basket
            </button>
          </motion.div>
        )}
        
        {/* Live Order Status Tracker Anim */}
        <AnimatePresence>
          {trackedOrder && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 18 }}
              className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-md space-y-4 overflow-hidden"
            >
              <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                <div>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-1 rounded tracking-wider uppercase">Live Food Tracker</span>
                  <h4 className="text-sm font-black text-[#1B3A2D] mt-0.5">Order #{trackedOrder.rowIndex} Status</h4>
                </div>
                <button 
                  onClick={() => {
                    localStorage.removeItem("halka_phulka_last_order_row");
                    setTrackedOrder(null);
                  }}
                  className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest bg-rose-50 px-2 py-1 rounded-md cursor-pointer transition"
                >
                  Dismiss
                </button>
              </div>

              {/* Steps tracker map */}
              <div className="grid grid-cols-4 gap-1 relative">
                {/* background connector line */}
                <div className="absolute top-4 left-5 right-5 h-0.5 bg-stone-100 z-0"></div>
                
                {[
                  { label: "Placed", key: ["New", "Preparing", "Out for Delivery", "Done"], currentKey: "New" },
                  { label: "Preparing", key: ["Preparing", "Out for Delivery", "Done"], currentKey: "Preparing" },
                  { label: trackedOrder.orderType === "delivery" ? "Out Now" : "Ready", key: ["Out for Delivery", "Done"], currentKey: "Out for Delivery" },
                  { label: "Done!", key: ["Done"], currentKey: "Done" }
                ].map((step, idx) => {
                  const isActive = step.key.includes(trackedOrder.status);
                  const isCurrent = trackedOrder.status === step.currentKey || 
                    (trackedOrder.status === "New" && idx === 0) ||
                    (trackedOrder.status === "Preparing" && idx === 1) ||
                    (trackedOrder.status === "Out for Delivery" && idx === 2) ||
                    (trackedOrder.status === "Done" && idx === 3);

                  return (
                    <div key={idx} className="flex flex-col items-center text-center relative z-10">
                      <motion.div 
                        animate={isCurrent ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                        transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${
                          isCurrent 
                            ? "bg-[#E8860A] text-white border-[#E8860A] shadow-md shadow-[#E8860A]/20" 
                            : isActive 
                              ? "bg-[#1B3A2D] text-white border-[#1B3A2D]" 
                              : "bg-white text-stone-300 border-stone-100"
                        }`}
                      >
                        {idx + 1}
                      </motion.div>
                      <span className={`text-[9.5px] mt-1.5 font-sans font-black tracking-tight transition-colors ${
                        isCurrent ? "text-[#E8860A]" : isActive ? "text-[#1B3A2D]" : "text-stone-400"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {trackedOrder.status === "Cancelled" && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-rose-50 text-rose-700 p-2.5 rounded-xl text-[11px] font-bold border border-rose-100 mt-2"
                >
                  🛑 This order has been marked as Cancelled by the chefs. Please message the kitchen coordinator.
                </motion.div>
              )}

              {/* Order snapshot */}
              <div className="bg-[#1B3A2D]/5 p-3 rounded-2xl border border-stone-100 flex justify-between items-center text-xs">
                <div>
                  <p className="text-stone-400 text-[9px] font-black uppercase">Fulfillment Target</p>
                  <p className="font-extrabold text-[#1B3A2D] mt-0.5 truncate max-w-[200px]">
                    {trackedOrder.address === "PICKUP" ? "🏪 Self-Pickup Ticket" : `📍 ${trackedOrder.address}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-stone-400 text-[9px] font-black uppercase">Amount</p>
                  <p className="text-xs font-mono font-black text-[#E8860A] mt-0.5">₹{trackedOrder.total}</p>
                </div>
              </div>

              {/* Star Rating & Review Feedback Section for Completed Orders */}
              {trackedOrder.status === "Done" && (
                <div className="mt-4 pt-4 border-t border-dashed border-stone-200/80 space-y-3">
                  {trackedOrder.rating ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-600/10 text-center space-y-2"
                    >
                      <h5 className="text-[11px] font-black uppercase text-emerald-800 tracking-wider flex items-center justify-center gap-1">
                        💖 Feedback Saved! Thank you
                      </h5>
                      <div className="flex justify-center gap-1 py-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-4.5 h-4.5 ${i < trackedOrder.rating ? "text-[#E8860A] fill-[#E8860A]" : "text-stone-200 fill-stone-100"}`} 
                          />
                        ))}
                      </div>
                      {trackedOrder.review && (
                        <p className="text-xs italic text-stone-700 font-medium px-3 py-2 bg-white rounded-xl border border-stone-100 max-w-sm mx-auto">
                          "{trackedOrder.review}"
                        </p>
                      )}
                      <p className="text-[9px] text-[#7a7060]/70 font-semibold italic">
                        Your homestyle rating is stored under sheet row #{trackedOrder.rowIndex}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-[#FBF6EE] p-4 rounded-2xl border border-[#e5ddd0] space-y-3"
                    >
                      <div className="flex justify-between items-center pb-1">
                        <div>
                          <h5 className="text-xs font-black text-[#1B3A2D]">Rate your Homestyle Platter</h5>
                          <p className="text-[9.5px] text-[#7a7060] font-medium leading-tight">How was your meal and kitchen experience today?</p>
                        </div>
                        <span className="text-base select-none">🍲</span>
                      </div>

                      {/* Stars system */}
                      <div className="flex items-center gap-1.5 py-1 justify-center">
                        {[1, 2, 3, 4, 5].map((starNum) => {
                          const isLit = (hoverRating || feedbackRating) >= starNum;
                          return (
                            <button
                              key={starNum}
                              type="button"
                              onClick={() => {
                                setFeedbackRating(starNum);
                                triggerToast(`You selected ${starNum} star${starNum > 1 ? "s" : ""}!`);
                              }}
                              onMouseEnter={() => setHoverRating(starNum)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="p-1 hover:scale-110 active:scale-95 transition-all text-[#E8860A] cursor-pointer"
                            >
                              <Star 
                                className={`w-6 h-6 transition-colors ${isLit ? "fill-[#E8860A] text-[#E8860A]" : "text-stone-300 fill-stone-100"}`} 
                              />
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-1.5">
                        <textarea
                          placeholder="Tell the chefs what you loved! (e.g., Poori was super soft, perfect spice level...)"
                          value={feedbackReview}
                          onChange={(e) => setFeedbackReview(e.target.value.slice(0, 200))}
                          rows={2}
                          className="w-full text-xs font-semibold p-2.5 bg-white rounded-xl border border-stone-200 focus:ring-1 focus:ring-[#1B3A2D] outline-none text-stone-800 placeholder:text-stone-400"
                        />
                        <div className="flex justify-between items-center text-[9px] text-[#7a7060]/80 px-0.5">
                          <span>Max 200 characters</span>
                          <span>{feedbackReview.length}/200</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmittingFeedback || feedbackRating === 0}
                        onClick={handleSubmitFeedback}
                        className={`w-full py-2.5 rounded-xl text-xs font-black tracking-wide text-white transition-all shadow-sm ${feedbackRating === 0 ? "bg-[#1B3A2D]/40 text-white/70 cursor-not-allowed" : "bg-[#1B3A2D] hover:bg-emerald-950 hover:shadow active:scale-95 cursor-pointer"}`}
                      >
                        {isSubmittingFeedback ? "Submitting to Chefs..." : "Submit Homestyle Review"}
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Search bar to lookup dishes instantly */}
        {isKitchenOpen && (
          <div className="relative">
            <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-xs text-stone-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Query daily delicacies (e.g. Thali, Paneer, Snacks)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white hover:bg-stone-50/50 rounded-2xl text-xs font-bold border border-stone-200/80 focus:ring-1 focus:ring-[#1B3A2D] outline-none transition-all placeholder:text-stone-400 text-stone-800 shadow-sm"
            />
          </div>
        )}

        {/* Elegant Top Category Horizontal Filter Tabs */}
        {isKitchenOpen && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-stone-500 tracking-wider">Explore Selected Menu</label>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none scroll-smooth">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition-all duration-300 select-none cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === "all"
                    ? "bg-[#E8860A] text-white shadow-lg shadow-[#E8860A]/20 scale-105"
                    : "bg-white text-[#1B3A2D] border border-stone-200/60 hover:border-stone-400/50 shadow-sm"
                }`}
              >
                🍽️ All Dishes ({Object.values(settings.menu).flat().filter(Boolean).length})
              </button>
              {Object.keys(settings.menu).map((categoryKey) => {
                const categoryItems = settings.menu[categoryKey] || [];
                if (categoryItems.length === 0) return null;
                const categoryTitle = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
                
                const isThali = categoryKey.toLowerCase() === "thali";
                const emoji = isThali ? "⭐" : categoryKey.toLowerCase() === "starters" || categoryKey.toLowerCase() === "snacks" ? "🥟" : "🍛";

                return (
                  <button
                    key={categoryKey}
                    onClick={() => setSelectedCategory(categoryKey)}
                    className={`px-4 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition-all duration-300 select-none cursor-pointer flex items-center gap-2 ${
                      selectedCategory === categoryKey
                        ? "bg-[#1B3A2D] text-white shadow-lg shadow-[#1B3A2D]/20 scale-105"
                        : "bg-white text-[#1B3A2D] border border-stone-200/60 hover:border-stone-400/50 shadow-sm"
                    }`}
                  >
                    <span>{emoji} {categoryTitle}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${selectedCategory === categoryKey ? "bg-white/20 text-white" : "bg-[#1B3A2D]/10 text-[#1B3A2D]"}`}>
                      {categoryItems.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Closed announcement if Applicable */}
        {!isKitchenOpen && (
          <div className="bg-[#FFF3CD] text-[#856404] border border-[#ffeeba] p-5 rounded-2xl flex gap-3 shadow-md">
            <AlertTriangle className="w-6 h-6 shrink-0 text-[#E8860A] mt-0.5 animate-bounce" />
            <div>
              <h3 className="font-bold text-[#1B3A2D] text-lg font-serif">Kitchen Closed Today</h3>
              <p className="text-sm mt-1 text-[#5c4403] font-medium leading-relaxed">
                {settings.closedMsg || "We are currently not accepting new orders. Please check again later!"}
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Warning Banners if Delivery is manually disabled */}
        {isKitchenOpen && !settings.deliveryOn && (
          <div className="bg-[#EBF5FF] text-[#004085] border border-sky-200/65 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
            <Info className="w-5 h-5 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <p className="text-xs font-black uppercase text-sky-800 tracking-wider">Pickup Mode Activated</p>
              <p className="text-sm mt-0.5 leading-relaxed font-semibold text-sky-950">
                Home delivery is currently offline. We are happily preparing <b>Self-Pickup orders</b>.
              </p>
            </div>
          </div>
        )}

        {/* Menu Listings */}
        {isKitchenOpen && (
          <div className="space-y-10">
            {/* Iterating Settings Menu Categories Dynamically */}
            {Object.keys(settings.menu).map(categoryKey => {
              // Apply dynamic filter tab filtering
              if (selectedCategory !== "all" && selectedCategory !== categoryKey) return null;

              const categoryItems = settings.menu[categoryKey] || [];
              
              const filteredItems = categoryItems.filter(item => {
                const matchesSearch = !searchQuery.trim() || 
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
                return matchesSearch;
              });

              if (filteredItems.length === 0) return null;

              const isThali = categoryKey === "thali";

              // Formatting headings
              const categoryTitle = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", damping: 20 }}
                  key={categoryKey} 
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-dashed border-[#e5ddd0]/80 pb-2">
                    <h2 className="text-2xl font-serif text-[#1B3A2D] font-extrabold flex items-center gap-2">
                      {isThali ? "⭐ Today's Signature Story" : categoryTitle}
                    </h2>
                    <span className="text-xs text-[#7a7060] font-mono bg-[#1B3A2D]/5 px-3 py-1 rounded-full font-black">
                      {filteredItems.length} {filteredItems.length === 1 ? "Option" : "Options"}
                    </span>
                  </div>

                  <motion.div layout className="grid grid-cols-1 gap-5">
                    <AnimatePresence mode="popLayout">
                      {filteredItems.map((item) => {
                        const selectedPrefValue = sizePrefs[item.id] || "Full";
                        const currentPrice = selectedPrefValue === "Half" && item.half !== null ? item.half : item.price;
                        const sizeInCart = item.half !== null ? selectedPrefValue : "Full";
                        const countInCart = getItemQty(item.id, sizeInCart);

                        // Thali specific hero layout
                        if (isThali) {
                          return (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              whileHover={item.inStock ? { y: -3, scale: 1.01 } : {}}
                              transition={{ type: "spring", damping: 18 }}
                              key={item.id} 
                              id={`card-${item.id}`}
                              className={`bg-gradient-to-br from-[#11291E] via-[#1B3A2D] to-[#0A1D15] text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 border border-emerald-800/20 ${!item.inStock ? "opacity-60 saturate-50 select-none cursor-not-allowed" : "hover:shadow-2xl"}`}
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8860A]/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
                              
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="bg-[#E8860A] text-[9px] font-black uppercase text-white px-2 py-0.5 rounded-md tracking-wider">
                                    Daily Platter
                                  </span>
                                  <span className="text-stone-300/60 text-[10px] uppercase font-mono tracking-widest">HP Signature</span>
                                </div>

                                <div className="flex justify-between items-start mb-3">
                                  <h3 className="text-2xl font-serif text-[#FBF6EE] font-black flex items-center gap-2 pr-2 leading-tight">
                                    {item.name}
                                    <Sparkles className="w-5 h-5 text-[#E8860A] fill-[#E8860A] shrink-0 animate-pulse" />
                                  </h3>
                                  <span className="text-2xl font-black text-[#E8860A] font-mono shrink-0">
                                    ₹{item.price}
                                  </span>
                                </div>
                                
                                <p className="text-stone-300 text-xs leading-relaxed mb-5 italic mt-1 py-2.5 px-3 border-l-2 border-[#E8860A] bg-white/5 rounded-r-2xl font-sans">
                                  {item.description || "Veg Pulav · Chana Dal · 3 Poori · Alu Curry · Raita · Fryum · Pickle"}
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/10">
                                <span className="text-[10px] text-stone-300/80 font-bold flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-[#E8860A] border border-white/20"></span> 100% Pure Veg Homestyle
                                </span>

                                {!item.inStock ? (
                                  <span className="bg-red-500 text-white text-xs font-black px-4 py-2 rounded-xl select-none uppercase tracking-wider">
                                    Sold Out
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {countInCart > 0 ? (
                                      <motion.div 
                                        layout
                                        className="flex items-center bg-[#E8860A] text-white rounded-xl p-1 shadow-md"
                                      >
                                        <button 
                                          onClick={() => handleRemove(item)}
                                          className="w-9 h-9 flex items-center justify-center font-black text-xl active:scale-75 transition-transform cursor-pointer"
                                        >
                                          -
                                        </button>
                                        <span className="w-8 text-center text-sm font-bold font-mono">
                                          {countInCart}
                                        </span>
                                        <button 
                                          onClick={() => handleAdd(item, categoryKey)}
                                          className="w-9 h-9 flex items-center justify-center font-black text-xl active:scale-75 transition-transform cursor-pointer"
                                        >
                                          +
                                        </button>
                                      </motion.div>
                                    ) : (
                                      <motion.button 
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAdd(item, categoryKey)}
                                        className="bg-[#E8860A] hover:bg-[#ff9711] text-white px-5 py-3 rounded-2xl font-black transition-all duration-300 shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                      >
                                        <ShoppingBag className="w-4 h-4" /> Add Thali
                                      </motion.button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        }

                        // Standard Non-Thali Menu Item Cards
                        return (
                          <motion.div 
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            whileHover={item.inStock ? { y: -3, scale: 1.01 } : {}}
                            transition={{ type: "spring", damping: 18 }}
                            key={item.id} 
                            id={`card-${item.id}`}
                            className={`bg-white rounded-2xl p-5 shadow-sm border border-stone-200/50 flex flex-col justify-between transition-all duration-300 hover:shadow-md ${!item.inStock ? "opacity-60 saturate-50 select-none pointer-events-none" : ""}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                {/* Veg Indicator Dot */}
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="w-4 h-4 border border-emerald-600 p-0.5 rounded flex items-center justify-center shrink-0">
                                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                                  </span>
                                  <span className="text-[9px] font-black text-emerald-600 tracking-wider uppercase">VEG</span>
                                </div>
                                <h4 className="text-[17px] font-black text-[#1B3A2D] leading-snug">{item.name}</h4>
                              </div>
                              
                              <span className="text-xl font-black text-[#1B3A2D] font-mono shrink-0">
                                ₹{currentPrice}
                              </span>
                            </div>

                            {/* Full / Half Sizing toggle if item has sizes */}
                            {item.half !== null && (
                              <div className="my-4 py-1.5 px-2 bg-stone-50 rounded-2xl flex items-center justify-between border border-stone-100 shadow-inner">
                                <span className="text-[10px] font-black text-[#7a7060] uppercase pl-1 tracking-wider">Sizing:</span>
                                <div className="flex bg-white shadow-sm border border-stone-200/60 rounded-xl p-0.5">
                                  <button 
                                    onClick={() => toggleSize(item.id)}
                                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${selectedPrefValue === "Half" ? "bg-[#E8860A] text-white shadow-sm" : "text-[#7a7060] hover:text-[#1B3A2D]"}`}
                                  >
                                    Half (₹{item.half})
                                  </button>
                                  <button 
                                    onClick={() => toggleSize(item.id)}
                                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${selectedPrefValue === "Full" ? "bg-[#1B3A2D] text-white shadow-sm" : "text-[#7a7060] hover:text-[#1B3A2D]"}`}
                                  >
                                    Full (₹{item.price})
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-stone-200">
                              <span className="text-[10px] text-[#7a7060]/70 font-semibold italic">
                                {item.half !== null && `Portion: Mapped to ${selectedPrefValue}`}
                                {item.half === null && "Portion: Standard Unit"}
                              </span>

                              {!item.inStock ? (
                                <span className="text-red-500 text-xs font-black uppercase tracking-wider">
                                  Sold Out
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {countInCart > 0 ? (
                                    <motion.div 
                                      layout
                                      className="flex items-center bg-[#1B3A2D] text-white rounded-xl p-0.5 shadow-sm"
                                    >
                                      <button 
                                        onClick={() => handleRemove(item, sizeInCart)}
                                        className="w-8 h-8 flex items-center justify-center font-black text-lg active:scale-75 transition-transform cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <span className="w-7 text-center text-xs font-bold font-mono">
                                        {countInCart}
                                      </span>
                                      <button 
                                        onClick={() => handleAdd(item, categoryKey)}
                                        className="w-8 h-8 flex items-center justify-center font-black text-lg active:scale-75 transition-transform cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </motion.div>
                                  ) : (
                                    <motion.button 
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleAdd(item, categoryKey)}
                                      className="bg-white hover:bg-[#1B3A2D] hover:text-white border border-[#1B3A2D] text-[#1B3A2D] px-4.5 py-1.5 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer"
                                    >
                                      + Add Item
                                    </motion.button>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              );
            })}

            {/* Custom Checkout Container */}
            <div ref={checkoutRef} className="bg-white rounded-3xl p-6 shadow-md border border-stone-200/60 space-y-6">
              <h3 className="text-2xl font-serif font-black border-b border-[#e5ddd0]/60 pb-3 text-[#1B3A2D] flex items-center gap-2">
                <span>📞 Cozy Home Checkout</span>
              </h3>

              {cartCount === 0 ? (
                <div className="text-center py-8 text-[#7a7060]/80 text-sm">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-3 text-stone-300 border border-stone-100">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  Your culinary basket is empty.<br />Add homestyle dishes above to unlock checkout!
                </div>
              ) : (
                <form onSubmit={handlePlaceOrder} className="space-y-5">
                  {errorMessage && (
                    <div className="bg-rose-50 text-rose-600 p-3.5 rounded-xl text-xs font-bold border border-rose-200/80">
                      ⚠️ {errorMessage}
                    </div>
                  )}

                  {/* Mode Toggles: Delivery / Pickup */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider block">Choose Delivery Preference</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => settings.deliveryOn && setOrderType("delivery")}
                        disabled={!settings.deliveryOn}
                        className={`p-4 rounded-2xl font-black flex flex-col items-center justify-center border transition-all duration-300 cursor-pointer ${orderType === "delivery" ? "bg-[#1B3A2D] text-white border-[#1B3A2D] shadow-md shadow-[#1B3A2D]/10" : "bg-white text-stone-600 border-stone-200/80 hover:border-stone-400"} ${!settings.deliveryOn ? "opacity-35 cursor-not-allowed" : ""}`}
                      >
                        <MapPin className="w-6 h-6 mb-1.5 text-[#E8860A]" />
                        <span className="text-sm">Home Delivery</span>
                        <span className="text-[9px] opacity-70 mt-0.5">₹20 Service charge</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderType("pickup")}
                        className={`p-4 rounded-2xl font-black flex flex-col items-center justify-center border transition-all duration-300 cursor-pointer ${orderType === "pickup" ? "bg-[#1B3A2D] text-white border-[#1B3A2D] shadow-md shadow-[#1B3A2D]/10" : "bg-white text-stone-600 border-stone-200/80 hover:border-stone-400"}`}
                      >
                        <Clock className="w-6 h-6 mb-1.5 text-[#E8860A]" />
                        <span className="text-sm">Self-Pickup</span>
                        <span className="text-[9px] opacity-70 mt-0.5">No supplementary fee</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer personal details */}
                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#1B3A2D] uppercase tracking-wider block">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-stone-400" />
                        <input 
                          type="text" 
                          placeholder="What is your name?"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3.5 bg-stone-50 hover:bg-stone-100/50 rounded-xl text-sm border border-stone-200/80 focus:ring-2 focus:ring-[#1B3A2D] focus:bg-white outline-none transition-all placeholder:text-stone-400 font-semibold text-stone-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#1B3A2D] uppercase tracking-wider block">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-stone-400" />
                        <input 
                          type="tel" 
                          placeholder="Your WhatsApp phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-10 pr-4 py-3.5 bg-stone-50 hover:bg-stone-100/50 rounded-xl text-sm border border-stone-200/80 focus:ring-2 focus:ring-[#1B3A2D] focus:bg-white outline-none transition-all placeholder:text-stone-400 font-semibold text-stone-900"
                        />
                      </div>
                    </div>

                    {orderType === "delivery" && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3 bg-[#1B3A2D]/5 p-3.5 rounded-2xl border border-[#1B3A2D]/10 overflow-hidden"
                      >
                        <div className="flex justify-between items-center pb-1 border-b border-stone-200/60 font-sans">
                          <label className="text-[10px] font-black text-[#1B3A2D] uppercase tracking-wider block">📍 Delivery Destination</label>
                          <span className="text-[9px] font-bold text-[#E8860A] bg-[#E8860A]/15 px-2 py-0.5 rounded">Community Delivery</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 font-sans">
                          <div>
                            <label className="text-[9px] font-bold text-stone-500 block mb-1">Select Tower / Block</label>
                            <select
                              value={selectedBlock}
                              onChange={(e) => setSelectedBlock(e.target.value)}
                              className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold border border-stone-200 text-stone-800 outline-none focus:ring-1 focus:ring-[#1B3A2D] cursor-pointer"
                            >
                              {["Tower 1", "Tower 2", "Tower 3", "Tower 4", "Tower 5", "Tower 6", "Tower 7", "Tower 8", "Tower 9", "Tower 10", "Tower 11", "Tower 12"].map((tower) => (
                                <option key={tower} value={tower}>{tower}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-stone-500 block mb-1">Floor & Flat Number</label>
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="e.g., 2802"
                              value={flatNum}
                              onChange={(e) => setFlatNum(e.target.value)}
                              className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold border border-stone-200 text-stone-800 placeholder:text-stone-400 outline-none focus:ring-1 focus:ring-[#1B3A2D]"
                            />
                          </div>
                        </div>

                        {flatNum.trim() && (
                          <p className="text-[10px] text-stone-500 font-medium font-sans">
                            Formatted: <span className="font-mono text-[#1B3A2D] font-bold bg-white px-1.5 py-0.5 rounded border border-stone-100">{address}</span>
                          </p>
                        )}
                      </motion.div>
                    )}

                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] font-black text-[#1B3A2D] uppercase tracking-wider block">
                        Desired {orderType === "delivery" ? "Delivery" : "Pickup"} Time
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-stone-400" />
                        <input 
                          type="text" 
                          placeholder={orderType === "delivery" ? "e.g., 7:32 PM (Allowed 7PM-8PM)" : "e.g., 7:15 PM"}
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full pl-10 pr-4 py-3.5 bg-stone-50 hover:bg-stone-100/50 rounded-xl text-sm border border-stone-200/80 focus:ring-2 focus:ring-[#1B3A2D] focus:bg-white outline-none transition-all placeholder:text-stone-400 font-semibold text-stone-900 animate-none"
                        />
                      </div>
                      
                      {/* Interactive Time Option Pills */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(settings?.deliverySlots && settings.deliverySlots.length > 0
                          ? settings.deliverySlots
                          : ["ASAP", "7:00 PM (Dinner)", "7:30 PM (Dinner)", "8:00 PM (Dinner)", "8:30 PM (Dinner)", "9:00 PM (Dinner)"]
                        ).map((preset) => {
                          const isSelected = time === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setTime(preset);
                                triggerToast(`Selected slot preset: ${preset}`);
                              }}
                              className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg border transition duration-200 cursor-pointer ${
                                isSelected 
                                  ? "bg-[#1B3A2D] text-white border-[#1B3A2D] shadow" 
                                  : "bg-stone-50 hover:bg-stone-100 text-[#7a7060] border-stone-200/80"
                              }`}
                            >
                              🕒 {preset}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Deluxe Thermal printed receipt */}
                  <div className="bg-[#fefcf8] border-2 border-dashed border-stone-300 rounded-2xl p-5 shadow-inner relative overflow-hidden">
                    {/* Retro watermark effect */}
                    <div className="absolute -right-6 top-8 transform rotate-12 text-[#1B3A2D]/5 font-serif text-3xl font-extrabold tracking-widest pointer-events-none select-none">
                      HALKA PHULKA
                    </div>

                    <div className="border-b border-dashed border-stone-300 pb-3 mb-3 text-center">
                      <h4 className="text-xs font-mono font-black uppercase tracking-widest text-[#1B3A2D]/70">&bull; ESTD 2024 &bull; KITCHEN INVOICE</h4>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {cartList.map((item, index) => (
                        <div key={index} className="flex justify-between items-baseline text-xs font-mono font-semibold text-stone-700">
                          <span className="truncate pr-2">
                            {item.name} {item.size && item.size !== "Full" ? `(${item.size})` : ""} <span className="text-[#E8860A]">x{item.qty}</span>
                          </span>
                          <span className="shrink-0">₹{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-dashed border-stone-300 pt-3 mt-3 space-y-2 text-xs font-mono text-stone-600">
                      <div className="flex justify-between">
                        <span>Items Subtotal</span>
                        <span>₹{subtotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Fee</span>
                        <span>{orderType === "delivery" ? `₹${DELIVERY_CHARGE}` : "₹0 (Free pickup)"}</span>
                      </div>
                      <div className="flex justify-between text-[#1B3A2D] font-extrabold border-t border-dashed border-stone-300 pt-3 text-sm">
                        <span>TOTAL AMOUNT</span>
                        <span className="text-[#E8860A] text-base font-black">₹{orderTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Submission triggers */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#E8860A] hover:bg-[#ff9711] text-white py-4.5 rounded-2xl font-black transition-all duration-300 transform active:scale-95 text-center flex justify-center items-center gap-2.5 cursor-pointer shadow-lg disabled:opacity-60 text-sm hover:shadow-orange-500/10"
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" /> Confirm & Post Order (₹{orderTotal})
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Cart Strip */}
      {isKitchenOpen && cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-[#e5ddd0]/65 shadow-[0_-10px_35px_rgba(27,58,45,0.06)] z-40 max-w-md mx-auto rounded-t-3xl">
          <div className="flex justify-between items-center gap-3">
            <div>
              <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider block">Subtotal Basket</span>
              <div className="flex items-center gap-2">
                <span className="bg-[#1B3A2D] text-[#FBF6EE] text-[10px] font-black px-2 py-0.5 rounded-md">{cartCount} items</span>
                <span className="text-2xl font-black font-mono text-[#1B3A2D]">₹{orderTotal}</span>
              </div>
            </div>

            <button 
              onClick={scrollToCheckout}
              className="bg-[#E8860A] hover:bg-[#ff9711] text-white px-6 py-3.5 rounded-2xl font-black text-xs shadow-md shadow-[#E8860A]/10 flex items-center gap-1.5 cursor-pointer transition-all duration-300 active:scale-95 hover:scale-102"
            >
              Checkout Now <ChevronRight className="w-4.5 h-4.5 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
