const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const validator = require("validator");
require("dotenv").config();
const path = require("path");

const { authLimiter, apiLimiter } = require("./utils/rateLimiter");
const { isPaymentEnabled, createOrder, verifyPaymentSignature, verifyWebhookSignature, fetchPayment, DEMO_MODE: PAYMENT_DEMO } = require("./utils/paymentGateway");
const { isRechargeEnabled, doRecharge, checkRechargeStatus, checkMobileOperator, DEMO_MODE: RECHARGE_DEMO } = require("./utils/rechargeService");
const { isBillPaymentEnabled, fetchBill, payBill, checkBillStatus, DEMO_MODE: BILL_DEMO } = require("./utils/billPaymentService");

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.razorpay.com"],
      connectSrc: ["'self'", "https://api.razorpay.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", "https://api.razorpay.com"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(apiLimiter);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5500", "http://127.0.0.1:5500"];

// Allow Render deployment URL dynamically
if (process.env.RENDER_EXTERNAL_URL) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}
if (process.env.RENDER_EXTERNAL_HOSTNAME) {
  allowedOrigins.push(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
}

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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET is not set in environment variables.");
  console.error("💡 Create a .env file with JWT_SECRET=your_strong_secret_key");
  process.exit(1);
}
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

// MongoDB Connection with graceful fallback
let dbConnected = false;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => {
  dbConnected = true;
  console.log("✅ MongoDB Connected");
})
.catch(err => {
  console.error("❌ MongoDB Connection Failed:");
  console.error("Error name:", err.name);
  console.error("Error message:", err.message);
  console.error("Error code:", err.code);
  console.error("⚠️  Server will start in LIMITED MODE (DB features unavailable).");
  console.error("💡 To fix: set MONGODB_URI in .env and restart.");
});

mongoose.connection.on("connected", () => { dbConnected = true; });
mongoose.connection.on("error", (err) => {
  dbConnected = false;
  console.error("MongoDB runtime error:", err.message);
});
mongoose.connection.on("disconnected", () => {
  dbConnected = false;
  console.error("MongoDB disconnected!");
});

// Check MongoDB connection state
function dbReady(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Database not connected. Server is running in limited mode. Please check MONGODB_URI in .env",
      hint: "Ensure MongoDB is running and MONGODB_URI is set correctly."
    });
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

app.post("/signup", authLimiter, dbReady, async (req, res) => {
  try {
    let { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required ❌" });
    }

    name = name.trim();
    email = email.trim().toLowerCase();
    password = password.trim();

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format ❌" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters ❌" });
    }
    if (name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters ❌" });
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

app.post("/login", authLimiter, dbReady, async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required ❌" });
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format ❌" });
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

function extractToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return authHeader;
}

// Middleware to verify JWT
function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Access Denied ❌" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid Token ❌" });
  }
}

// Admin middleware
function adminMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Admin Access Denied" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    if (verified.role !== "admin") return res.status(403).json({ message: "Not an admin" });
    req.admin = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid Token" });
  }
}

// ================== ADMIN ROUTES ==================

app.post("/admin/login", authLimiter, dbReady, async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

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

app.get("/payment/config", authMiddleware, (req, res) => {
  res.json({
    razorpayKeyId: PAYMENT_DEMO ? "rzp_test_demo" : (process.env.RAZORPAY_KEY_ID || null),
    paymentEnabled: isPaymentEnabled(),
    demoMode: PAYMENT_DEMO,
    mode: process.env.NODE_ENV || "development",
  });
});

app.post("/payment/order", authMiddleware, async (req, res) => {
  try {
    if (!isPaymentEnabled()) {
      return res.status(503).json({
        message: "Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
        demoMode: false,
      });
    }

    const { amount, service } = req.body;
    if (!amount || amount < 1) {
      return res.status(400).json({ message: "Invalid amount. Minimum amount is ₹1 (100 paise)." });
    }

    const receipt = "rcpt_" + Date.now();
    const order = await createOrder(amount, receipt, { userId: req.user.userId, service });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpayKeyId: PAYMENT_DEMO ? "rzp_test_demo" : process.env.RAZORPAY_KEY_ID,
      demoMode: PAYMENT_DEMO,
    });
  } catch (err) {
    console.error("Order creation error:", err.message);
    if (err.statusCode === 401 || err.error?.code === "UNAUTHORIZED") {
      return res.status(401).json({ message: "Razorpay authentication failed. Check your API keys." });
    }
    res.status(500).json({ message: "Failed to create payment order: " + err.message });
  }
});

app.post("/payment/verify", authMiddleware, async (req, res) => {
  try {
    const { orderId, paymentId, signature, amount, service } = req.body;

    if (!isPaymentEnabled()) {
      return res.status(503).json({
        message: "Razorpay not configured. Cannot verify payments.",
      });
    }

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: "Missing required fields: orderId, paymentId, and signature are required" });
    }

    const isValid = verifyPaymentSignature(orderId, paymentId, signature);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // In demo mode, skip Razorpay API check
    if (!PAYMENT_DEMO) {
      const razorpayPayment = await fetchPayment(paymentId);
      if (razorpayPayment.status !== "captured") {
        return res.status(400).json({ message: "Payment not captured by Razorpay" });
      }
    }

    const transactionId = paymentId;
    const payment = new Payment({
      userId: req.user.userId,
      amount,
      service,
      transactionId,
      status: "completed",
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });
    await payment.save();

    await new Notification({
      userId: req.user.userId,
      title: "Payment Successful",
      message: `₹${amount} paid for ${service}. Transaction ID: ${transactionId}`,
      type: "success",
    }).save();

    res.json({ message: "Payment verified successfully", transactionId, payment });
  } catch (err) {
    console.error("Payment verification error:", err.message);
    res.status(500).json({ message: "Payment verification failed: " + err.message });
  }
});

// Razorpay Webhook for async payment confirmations
app.post("/razorpay/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body;

    if (!verifyWebhookSignature(body, signature)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(body);
    console.log("Razorpay webhook received:", event.event);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const existing = await Payment.findOne({ transactionId: payment.id });
      if (!existing) {
        await new Payment({
          userId: payment.notes?.userId,
          amount: payment.amount / 100,
          service: payment.notes?.service || "unknown",
          transactionId: payment.id,
          status: "completed",
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
        }).save();
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).json({ message: "Webhook processing failed" });
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

app.get("/payment/status/:transactionId", authMiddleware, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      transactionId: req.params.transactionId,
      userId: req.user.userId,
    });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ================== RECHARGE ROUTES ==================

app.post("/recharge/mobile", authMiddleware, async (req, res) => {
  try {
    const { number, amount, operator, paymentId } = req.body;
    if (!number || !amount || amount < 10) {
      return res.status(400).json({ message: "Valid number and amount (min ₹10) required" });
    }

    if (paymentId) {
      const existingPayment = await Payment.findOne({ transactionId: paymentId, userId: req.user.userId });
      if (!existingPayment) {
        return res.status(400).json({ message: "Payment not found. Please complete payment first." });
      }
      if (existingPayment.status !== "completed") {
        return res.status(400).json({ message: "Payment not completed. Please complete payment first." });
      }
    }

    const result = await doRecharge("mobile", { number, amount, operator });

    const service = new Service({
      userId: req.user.userId,
      type: "mobile",
      details: { number, amount, operator, operatorRefId: result.operatorRefId, paymentId },
      amount,
      status: result.success ? "completed" : "failed",
    });
    await service.save();

    await new Notification({
      userId: req.user.userId,
      title: result.success ? "Mobile Recharge Successful" : "Recharge Failed",
      message: result.success
        ? `₹${amount} recharged to ${number}. Ref: ${result.operatorRefId}`
        : result.message,
      type: result.success ? "success" : "error",
    }).save();

    res.json({ message: result.message, service });
  } catch (err) {
    console.error("Recharge error:", err.message);
    res.status(500).json({ message: "Recharge failed: " + err.message });
  }
});

app.post("/recharge/dth", authMiddleware, async (req, res) => {
  try {
    const { subscriberId, amount, operator, paymentId } = req.body;
    if (!subscriberId || !amount || amount < 10) {
      return res.status(400).json({ message: "Valid subscriber ID and amount required" });
    }

    if (paymentId) {
      const existingPayment = await Payment.findOne({ transactionId: paymentId, userId: req.user.userId });
      if (!existingPayment) {
        return res.status(400).json({ message: "Payment not found. Please complete payment first." });
      }
      if (existingPayment.status !== "completed") {
        return res.status(400).json({ message: "Payment not completed. Please complete payment first." });
      }
    }

    const result = await doRecharge("dth", { subscriberId, amount, operator });

    const service = new Service({
      userId: req.user.userId,
      type: "dth",
      details: { subscriberId, amount, operator, operatorRefId: result.operatorRefId, paymentId },
      amount,
      status: result.success ? "completed" : "failed",
    });
    await service.save();

    await new Notification({
      userId: req.user.userId,
      title: result.success ? "DTH Recharge Successful" : "Recharge Failed",
      message: result.success
        ? `₹${amount} DTH recharge for ${subscriberId}. Ref: ${result.operatorRefId}`
        : result.message,
      type: result.success ? "success" : "error",
    }).save();

    res.json({ message: result.message, service });
  } catch (err) {
    console.error("DTH recharge error:", err.message);
    res.status(500).json({ message: "DTH recharge failed: " + err.message });
  }
});

app.get("/recharge/status/:serviceId", authMiddleware, async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.serviceId,
      userId: req.user.userId,
    });
    if (!service) {
      return res.status(404).json({ message: "Recharge not found" });
    }

    const refId = service.details?.operatorRefId;
    if (!refId) {
      return res.json({ service, providerStatus: null });
    }

    const providerStatus = await checkRechargeStatus(refId);
    res.json({ service, providerStatus });
  } catch (err) {
    res.status(500).json({ message: "Status check failed: " + err.message });
  }
});

app.get("/recharge/status", authMiddleware, (req, res) => {
  res.json({
    demoMode: RECHARGE_DEMO,
    mobileEnabled: isRechargeEnabled("mobile"),
    dthEnabled: isRechargeEnabled("dth"),
    message: RECHARGE_DEMO
      ? "Running in Demo Mode. Recharges are simulated but realistic."
      : "Real recharge APIs configured.",
  });
});

app.post("/operator/detect", authMiddleware, async (req, res) => {
  try {
    const { number } = req.body;
    if (!number || number.length !== 10) {
      return res.status(400).json({ message: "Valid 10-digit number required" });
    }
    const result = await checkMobileOperator(number);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Operator detection failed: " + err.message });
  }
});

// ================== BILL PAYMENT ROUTES ==================

app.post("/bill/fetch", authMiddleware, async (req, res) => {
  try {
    const { type, ...params } = req.body;
    if (!type || !["electricity", "water", "gas"].includes(type)) {
      return res.status(400).json({ message: "Valid bill type required (electricity, water, gas)" });
    }

    const result = await fetchBill(type, params);
    res.json(result);
  } catch (err) {
    console.error("Bill fetch error:", err.message);
    res.status(500).json({ message: "Bill fetch failed: " + err.message });
  }
});

app.post("/bill/pay", authMiddleware, async (req, res) => {
  try {
    const { type, amount, ...params } = req.body;
    if (!type || !amount) {
      return res.status(400).json({ message: "Bill type and amount required" });
    }

    const result = await payBill(type, { amount, ...params });

    const service = new Service({
      userId: req.user.userId,
      type,
      details: { ...params, amount, transactionId: result.transactionId, referenceId: result.referenceId },
      amount,
      status: result.success ? "completed" : "failed",
    });
    await service.save();

    await new Notification({
      userId: req.user.userId,
      title: result.success ? "Bill Payment Successful" : "Bill Payment Failed",
      message: result.success
        ? `₹${amount} ${type} bill paid. Ref: ${result.referenceId}`
        : result.message,
      type: result.success ? "success" : "error",
    }).save();

    res.json({ message: result.message, service });
  } catch (err) {
    console.error("Bill pay error:", err.message);
    res.status(500).json({ message: "Bill payment failed: " + err.message });
  }
});

app.get("/bill/status/:transactionId", authMiddleware, async (req, res) => {
  try {
    const result = await checkBillStatus(req.params.transactionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Status check failed: " + err.message });
  }
});

app.get("/bill/config", authMiddleware, (req, res) => {
  res.json({
    demoMode: BILL_DEMO,
    enabled: isBillPaymentEnabled(),
    message: BILL_DEMO
      ? "Running in Demo Mode. Bill payments are simulated."
      : "Real bill payment APIs configured.",
  });
});

// ================== CONTACT ROUTES ==================

app.post("/contact", async (req, res) => {
  try {
    let { name, email, phone, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "Name, email, subject and message are required ❌" });
    }

    name = name.trim();
    email = email.trim().toLowerCase();
    subject = subject.trim();
    message = message.trim();

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format ❌" });
    }
    if (name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters ❌" });
    }
    if (message.length < 10) {
      return res.status(400).json({ message: "Message must be at least 10 characters ❌" });
    }

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
      reply = "You can pay using Razorpay (UPI, Cards, Net Banking). Go to the Payment section after logging in.";
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
      "Secure Razorpay Payments",
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
      { name: "Premium", price: "₹99/month", features: ["Priority processing", "Razorpay payments", "Advanced notifications", "Chatbot support"] },
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
