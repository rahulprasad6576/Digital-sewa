const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(cors({
  origin: ["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5500", "http://127.0.0.1:5500"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const JWT_SECRET = "mysecretkey123";

// Import Models
const User = require("./user");
const Payment = require("./payment");
const Contact = require("./contact");
const Notification = require("./notification");
const Service = require("./service");
const Admin = require("./admin");

console.log("Server Starting...");

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/digital_platform")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

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

// ================== AUTH ROUTES ==================

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists ❌" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User Registered ✅" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error ❌" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
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
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error ❌" });
  }
});

// ================== ADMIN ROUTES ==================

app.post("/admin/login", async (req, res) => {
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
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/admin/users", adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/admin/payments", adminMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find().populate("userId", "name email");
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error ❌" });
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

    // Create notification
    const notification = new Notification({
      userId: req.user.userId,
      title: "New Service Request",
      message: `Your ${type} service request has been received.`,
      type: "info"
    });
    await notification.save();

    res.json({ message: "Service request submitted ✅", service });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/services", authMiddleware, async (req, res) => {
  try {
    const services = await Service.find({ userId: req.user.userId }).sort({ _id: -1 });
    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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

    // Create notification
    const notification = new Notification({
      userId: req.user.userId,
      title: "Payment Successful",
      message: `₹${amount} paid for ${service}. Transaction ID: ${transactionId}`,
      type: "success"
    });
    await notification.save();

    res.json({ message: "Payment successful ✅", transactionId, payment });
  } catch (err) {
    res.status(500).json({ message: "Payment failed ❌" });
  }
});

app.get("/payments", authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.userId }).sort({ _id: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Failed to send message ❌" });
  }
});

// ================== NOTIFICATION ROUTES ==================

app.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.userId }).sort({ _id: -1 }).limit(10);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Chatbot error" });
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

// Start Server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
