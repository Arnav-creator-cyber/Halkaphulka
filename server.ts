import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Path definitions for persistence
const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default settings matching the spec
const DEFAULT_SETTINGS = {
  "kitchenOpen": true,
  "deliveryOn": true,
  "deliveryWindow": "7PM – 8PM",
  "closedMsg": "Sorry, we are closed for today! Fresh details will be available tomorrow at 5PM.",
  "deliverySlots": ["ASAP", "7:00 PM (Dinner)", "7:30 PM (Dinner)", "8:00 PM (Dinner)", "8:30 PM (Dinner)", "9:00 PM (Dinner)"],
  "gasUrl": "",
  "menu": {
    "thali": [
      {
        "id": "thali",
        "name": "Dinner Thali",
        "price": 129,
        "half": null,
        "inStock": true,
        "description": "Veg Pulav · Chana Dal · 3 Poori · Alu Curry · Raita · Fryum · Pickle"
      }
    ],
    "curries": [
      { "id": "pbm", "name": "Paneer Butter Masala", "price": 189, "half": 99, "inStock": true },
      { "id": "mvc", "name": "Mix Veg Curry", "price": 159, "half": 79, "inStock": true },
      { "id": "kpc", "name": "Kaju Paneer Curry", "price": 189, "half": 99, "inStock": true },
      { "id": "pk", "name": "Paneer Kadhai", "price": 189, "half": 99, "inStock": true }
    ],
    "chinese": [
      { "id": "cp", "name": "Chilly Paneer", "price": 189, "half": 99, "inStock": true },
      { "id": "p65", "name": "Paneer 65", "price": 189, "half": 99, "inStock": true }
    ],
    "addons": [
      { "id": "er", "name": "Extra Roti", "price": 15, "half": null, "inStock": true },
      { "id": "br", "name": "Boondi Raita", "price": 20, "half": null, "inStock": true },
      { "id": "evp", "name": "Extra Veg Pulav", "price": 45, "half": null, "inStock": true }
    ],
    "combos": [
      { "id": "rc1", "name": "3 Roti + Alu Curry", "price": 129, "half": null, "inStock": true },
      { "id": "rice1", "name": "Veg Pulav + Alu Curry", "price": 119, "half": null, "inStock": true },
      { "id": "cc1", "name": "3 Roti + Chilly Paneer", "price": 139, "half": null, "inStock": true },
      { "id": "cc2", "name": "3 Roti + Paneer 65", "price": 139, "half": null, "inStock": true }
    ]
  }
};

// Ensure settings exist
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

// Ensure orders exist
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
}

// Helper to read and write database files
function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: any) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getOrders(): any[] {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function saveOrders(orders: any[]) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// Let's implement CORS-like preflight helpers if needed, but simple Express endpoints work well.
// API endpoint mimicking Google Apps Script (doGet and doPost) and the n8n webhook pipeline
// GET ?type=settings -> Get Settings
// GET ?type=updateStatus&rowIndex=N&status=X -> Update status
// GET (default) -> Get all orders
app.get("/api/gsheets", (req, res) => {
  const type = req.query.type as string;

  if (type === "settings") {
    return res.json(getSettings());
  }

  if (type === "updateStatus") {
    const rowIndex = parseInt(req.query.rowIndex as string, 10);
    const status = req.query.status as string;

    if (isNaN(rowIndex) || !status) {
      return res.status(400).json({ error: "Missing rowIndex or status" });
    }

    const orders = getOrders();
    // Google sheets starts row 1 with headers. Row 2 is index 0.
    const arrayIndex = rowIndex - 2;

    if (arrayIndex >= 0 && arrayIndex < orders.length) {
      orders[arrayIndex].status = status;
      saveOrders(orders);
      return res.json({ success: true, message: `Status updated to ${status} for row ${rowIndex}` });
    }

    return res.status(404).json({ error: `Order at row ${rowIndex} (array index ${arrayIndex}) not found` });
  }

  // Default: Return all orders formatted as specified with rowIndex
  const rawOrders = getOrders();
  const formattedOrders = rawOrders.map((order, index) => {
    return {
      ...order,
      rowIndex: index + 2 // Matching Google Sheets rowIndex mapping
    };
  });

  return res.json(formattedOrders);
});

// Update order core fields (name, phone, address, time, total, items string) from Admin bottom sheet
app.post("/api/gsheets/updateOrder", (req, res) => {
  const { rowIndex, name, phone, address, deliveryTime, orderTotal, items } = req.body;
  const targetRowIndex = parseInt(rowIndex, 10);
  if (isNaN(targetRowIndex)) {
    return res.status(400).json({ error: "Invalid rowIndex" });
  }

  const orders = getOrders();
  const arrayIndex = targetRowIndex - 2;

  if (arrayIndex >= 0 && arrayIndex < orders.length) {
    orders[arrayIndex].name = name ?? orders[arrayIndex].name;
    orders[arrayIndex].phone = phone ?? orders[arrayIndex].phone;
    orders[arrayIndex].address = address ?? orders[arrayIndex].address;
    orders[arrayIndex].deliveryTime = deliveryTime ?? orders[arrayIndex].deliveryTime;
    orders[arrayIndex].total = orderTotal !== undefined ? parseFloat(orderTotal) : orders[arrayIndex].total;
    orders[arrayIndex].items = items ?? orders[arrayIndex].items;
    saveOrders(orders);
    return res.json({ success: true, message: `Order at row ${targetRowIndex} updated successfully` });
  }

  return res.status(404).json({ error: "Order not found" });
});

// Rate an order with star rating & brief review text
app.post("/api/gsheets/rateOrder", (req, res) => {
  const { rowIndex, rating, review } = req.body;
  const targetRowIndex = parseInt(rowIndex, 10);
  if (isNaN(targetRowIndex)) {
    return res.status(400).json({ error: "Invalid rowIndex" });
  }

  const orders = getOrders();
  const arrayIndex = targetRowIndex - 2;

  if (arrayIndex >= 0 && arrayIndex < orders.length) {
    orders[arrayIndex].rating = typeof rating === "number" ? rating : orders[arrayIndex].rating;
    orders[arrayIndex].review = typeof review === "string" ? review : orders[arrayIndex].review;
    saveOrders(orders);
    return res.json({ success: true, message: `Review for order at row ${targetRowIndex} saved successfully` });
  }

  return res.status(404).json({ error: "Order not found" });
});

// Rate an order with star rating & brief review text (alias endpoint)
app.post("/api/orders/review", (req, res) => {
  const { rowIndex, rating, review } = req.body;
  const targetRowIndex = parseInt(rowIndex, 10);
  if (isNaN(targetRowIndex)) {
    return res.status(400).json({ error: "Invalid rowIndex" });
  }

  const orders = getOrders();
  const arrayIndex = targetRowIndex - 2;

  if (arrayIndex >= 0 && arrayIndex < orders.length) {
    orders[arrayIndex].rating = typeof rating === "number" ? rating : orders[arrayIndex].rating;
    orders[arrayIndex].review = typeof review === "string" ? review : orders[arrayIndex].review;
    saveOrders(orders);
    return res.json({ success: true, message: `Review for order at row ${targetRowIndex} saved successfully` });
  }

  return res.status(404).json({ error: "Order not found" });
});

// POST to update settings (type === 'settings')
app.post("/api/gsheets", (req, res) => {
  const data = req.body;

  if (data && data.type === "settings") {
    // Write entire settings
    saveSettings(data.settings);
    return res.json({ success: true });
  }

  // Legacy fallback if settings is sent inside an object
  if (data && data.kitchenOpen !== undefined) {
    saveSettings(data);
    return res.json({ success: true });
  }

  return res.status(400).json({ error: "Invalid payload format" });
});

// POST /api/webhook -> Simulated n8n pipeline node that formats and appends the row to our mock "Google Sheet"
app.post("/api/webhook", (req, res) => {
  const body = req.body;

  // Expected fields: customer_name, phone, address, delivery_time, order_type, items (array), subtotal, delivery_charge, order_total, timestamp
  const customer_name = body.customer_name || "Guest";
  const phone = body.phone || "";
  const address = body.address || "";
  const delivery_time = body.delivery_time || "";
  const order_type = body.order_type || "pickup";
  const order_total = body.order_total || 0;
  const timestamp = body.timestamp || new Date().toISOString();

  // Create readable items list: e.g. "Dinner Thali (Regular) x1, Ext Roti x2"
  const itemsText = Array.isArray(body.items) 
    ? body.items.map((i: any) => `${i.name}${i.size ? ` (${i.size})` : ""} x${i.qty}`).join(", ") 
    : "No items";

  // New Google Sheets Row structure:
  // Timestamp | Name | Phone | Items | Total | Address | Delivery Time | Status | Order Type
  const newOrder = {
    timestamp,
    name: customer_name,
    phone,
    items: itemsText,
    total: Number(order_total),
    address,
    deliveryTime: delivery_time,
    status: "New",
    orderType: order_type
  };

  const orders = getOrders();
  orders.push(newOrder);
  saveOrders(orders);

  // Return success response compatible with customer app (mode: 'no-cors' ignores return, but let's be fully clean)
  res.json({ success: true, rowIndex: orders.length + 1 });
});

// POST /api/orders/review & /api/gsheets/rateOrder -> Submit rating and review for an order associated with its rowIndex
const handleFeedbackReview = (req: express.Request, res: express.Response) => {
  const { rowIndex, rating, review } = req.body;
  const targetRowIndex = parseInt(rowIndex, 10);
  const ratingNum = parseInt(rating, 10);

  if (isNaN(targetRowIndex) || isNaN(ratingNum)) {
    return res.status(400).json({ error: "Invalid rowIndex or rating" });
  }

  const orders = getOrders();
  const arrayIndex = targetRowIndex - 2;

  if (arrayIndex >= 0 && arrayIndex < orders.length) {
    orders[arrayIndex].rating = ratingNum;
    orders[arrayIndex].review = review || "";
    saveOrders(orders);
    return res.json({ success: true, message: `Review and rating saved for order #${targetRowIndex}`, order: orders[arrayIndex] });
  }

  return res.status(404).json({ error: `Order with Row Index ${targetRowIndex} not found` });
};

app.post("/api/orders/review", handleFeedbackReview);
app.post("/api/gsheets/rateOrder", handleFeedbackReview);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

start();
