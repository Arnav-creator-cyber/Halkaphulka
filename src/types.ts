export interface MenuItem {
  id: string;
  name: string;
  price: number;
  half: number | null;
  inStock: boolean;
  description?: string;
}

export interface Settings {
  kitchenOpen: boolean;
  deliveryOn: boolean;
  deliveryWindow: string;
  closedMsg: string;
  deliverySlots?: string[];
  menu: {
    thali: MenuItem[];
    [category: string]: MenuItem[];
  };
}

export interface Order {
  rowIndex: number;
  timestamp: string;
  name: string;
  phone: string;
  items: string; // From Google Sheets or n8n items string
  total: number;
  address: string;
  deliveryTime: string;
  status: "New" | "Preparing" | "Out for Delivery" | "Done" | "Cancelled";
  orderType: "delivery" | "pickup";
  rating?: number;
  review?: string;
}

export interface CartItem {
  id: string;
  name: string;
  size: "Full" | "Half";
  price: number;
  qty: number;
  category: string;
}
