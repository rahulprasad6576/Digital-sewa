const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const path = require("path");

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5500", "http://127.0.0.1:5500"];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey123";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/digital_platform";

// Import Models
const User = require("./user");
const Payment = require("./payment");
const Contact = require("./contact");
const Notification = require("./notification");
const Service = require("./service");
const Admin = require("./admin");

console.log("Server Starting...");
const maskedUri = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
console.log("MongoDB URI:", maskedUri);
console.log("MONGODB_URI env present:", !!process.env.MONGODB_URI);

// MongoDB Connection with options
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => {
  console.error("❌ MongoDB Connection Failed:");
  console.error("Error name:", err.name);
  console.error("Error message:", err.message);
  console.error("Error code:", err.code);
  console.error("Please set MONGODB_URI environment variable.");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.error("MongoDB disconnected!");
});

// Check MongoDB connection state
function dbReady(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Database not connected. Please check server logs." });
  }
  next();
}

// ================== HEALTH CHECK ==================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    dbState: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    mongoUriPresent: !!process.env.MONGODB_URI,
    timestamp: new Date().toISOString()
  });
});

// ================== DB DIAGNOSTICS ==================
app.get("/debug/db", async (req, res) => {
  try {
    const testConn = await mongoose.createConnection(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    }).asPromise();
    await testConn.close();
    res.json({
      mongodbUriPresent: !!process.env.MONGODB_URI,
      connectionTest: "success",
      currentReadyState: mongoose.connection.readyState,
      readyStateLabels: ["disconnected", "connected", "connecting", "disconnecting"]
    });
  } catch (err) {
    res.json({
      mongodbUriPresent: !!process.env.MONGODB_URI,
      connectionTest: "failed",
      errorName: err.name,
      errorMessage: err.message,
      errorCode: err.code,
      currentReadyState: mongoose.connection.readyState,
      readyStateLabels: ["disconnected", "connected", "connecting", "disconnecting"],
      hint: "Common fixes: (1) Check MONGODB_URI in Render Environment, (2) URL-encode special chars in password, (3) Whitelist 0.0.0.0/0 in Atlas Network Access, (4) Ensure Atlas cluster is active"
    });
  }
});

// ================== AUTH ROUTES ==================

app.post("/signup", dbReady, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required ❌" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists ❌" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User Registered ✅" });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.post("/login", dbReady, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required ❌" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found ❌" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ userId: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ message: "Login Successful ✅", token: token, name: user.name });
    } else {
      res.status(400).json({ message: "Wrong Password ❌" });
    }
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// Middleware to verify JWT
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Access Denied ❌" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token ❌" });
  }
}

// Admin middleware
function adminMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Admin Access Denied" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    if (verified.role !== "admin") return res.status(403).json({ message: "Not an admin" });
    req.admin = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
}

// ================== ADMIN ROUTES ==================

app.post("/admin/login", dbReady, async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (isMatch) {
      const token = jwt.sign({ adminId: admin._id, email: admin.email, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ message: "Admin Login Successful", token: token });
    } else {
      res.status(400).json({ message: "Wrong Password" });
    }
  } catch (err) {
    console.error("Admin login error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.get("/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPayments = await Payment.countDocuments();
    const totalContacts = await Contact.countDocuments();
    const totalServices = await Service.countDocuments();
    const recentUsers = await User.find().sort({ _id: -1 }).limit(5).select("-password");
    const recentContacts = await Contact.find().sort({ _id: -1 }).limit(5);

    res.json({
      stats: { totalUsers, totalPayments, totalContacts, totalServices },
      recentUsers,
      recentContacts
    });
  } catch (err) {
    console.error("Admin stats error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.get("/admin/users", adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.get("/admin/payments", adminMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find().populate("userId", "name email");
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ================== DASHBOARD ==================

app.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    const services = await Service.find({ userId: req.user.userId }).sort({ _id: -1 }).limit(5);
    const payments = await Payment.find({ userId: req.user.userId }).sort({ _id: -1 }).limit(5);
    const notifications = await Notification.find({ userId: req.user.userId, read: false }).sort({ _id: -1 });

    res.json({ user, services, payments, notifications });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ================== SERVICE ROUTES ==================

app.post("/service", authMiddleware, async (req, res) => {
  try {
    const { type, details, amount } = req.body;
    const service = new Service({
      userId: req.user.userId,
      type,
      details,
      amount: amount || 0
    });
    await service.save();

    const notification = new Notification({
      userId: req.user.userId,
      title: "New Service Request",
      message: `Your ${type} service request has been received.`,
      type: "info"
    });
    await notification.save();

    res.json({ message: "Service request submitted ✅", service });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.get("/services", authMiddleware, async (req, res) => {
  try {
    const services = await Service.find({ userId: req.user.userId }).sort({ _id: -1 });
    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ================== PAYMENT ROUTES ==================

app.post("/payment", authMiddleware, async (req, res) => {
  try {
    const { amount, service, upiId } = req.body;
    const transactionId = "TXN" + Date.now();

    const payment = new Payment({
      userId: req.user.userId,
      amount,
      service,
      upiId,
      transactionId,
      status: "completed"
    });
    await payment.save();

    const notification = new Notification({
      userId: req.user.userId,
      title: "Payment Successful",
      message: `₹${amount} paid for ${service}. Transaction ID: ${transactionId}`,
      type: "success"
    });
    await notification.save();

    res.json({ message: "Payment successful ✅", transactionId, payment });
  } catch (err) {
    res.status(500).json({ message: "Payment failed: " + err.message });
  }
});

app.get("/payments", authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.userId }).sort({ _id: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ================== CONTACT ROUTES ==================

app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const contact = new Contact({ name, email, phone, subject, message });
    await contact.save();
    res.json({ message: "Message sent successfully ✅" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send message: " + err.message });
  }
});

// ================== NOTIFICATION ROUTES ==================

app.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.userId }).sort({ _id: -1 }).limit(10);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.put("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ================== CHATBOT ==================

app.post("/chatbot", async (req, res) => {
  try {
    const { message } = req.body;
    const msg = message.toLowerCase();

    let reply = "I'm sorry, I didn't understand. Try: 'hello', 'services', 'payment', 'contact', 'help'";

    if (msg.includes("hello") || msg.includes("hi") || msg.includes("namaste")) {
      reply = "Hello! Welcome to Digital Seva. How can I help you today?";
    } else if (msg.includes("service") || msg.includes("seva")) {
      reply = "We offer: PAN Card, Aadhaar, Electricity Bill, Water Bill, Mobile Recharge, DTH Recharge, Gas Booking, and Train Booking services.";
    } else if (msg.includes("payment") || msg.includes("pay") || msg.includes("upi")) {
      reply = "You can pay using UPI. Go to the Payment section after logging in. Demo payments are accepted for testing.";
    } else if (msg.includes("login") || msg.includes("sign")) {
      reply = "Click on Login or Sign Up button on the homepage to create an account.";
    } else if (msg.includes("contact") || msg.includes("help") || msg.includes("support")) {
      reply = "You can reach us via the Contact page or email us at support@digitalseva.com";
    } else if (msg.includes("plan") || msg.includes("price") || msg.includes("cost")) {
      reply = "We have Basic (Free), Premium (₹99/month), and Enterprise (₹499/month) plans. Check the Plans page for details.";
    }

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ message: "Chatbot error: " + err.message });
  }
});

// ================== VISION / ABOUT DATA ==================

app.get("/about", async (req, res) => {
  res.json({
    vision: "To make digital services accessible to every Indian citizen through a single, easy-to-use platform.",
    mission: "Simplifying government and utility services with technology, transparency, and trust.",
    features: [
      "8+ Digital Services in one place",
      "Secure UPI Payments",
      "Multi-language Support (English & Hindi)",
      "Real-time Notifications",
      "24/7 AI Chatbot Support"
    ],
    stats: { users: "10,000+", services: "50,000+", satisfaction: "98%" }
  });
});

// ================== PLANS DATA ==================

app.get("/plans", async (req, res) => {
  res.json({
    plans: [
      { name: "Basic", price: "Free", features: ["Access to all services", "Email support", "Basic notifications"] },
      { name: "Premium", price: "₹99/month", features: ["Priority processing", "UPI payments", "Advanced notifications", "Chatbot support"] },
      { name: "Enterprise", price: "₹499/month", features: ["Bulk services", "Dedicated manager", "API access", "Custom integrations"] }
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

