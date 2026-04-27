const Razorpay = require("razorpay");
const crypto = require("crypto");

const DEMO_MODE = process.env.PAYMENT_DEMO_MODE === "true";

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

function isPaymentEnabled() {
  return DEMO_MODE || !!razorpay;
}

function isDemoMode() {
  return DEMO_MODE;
}

// Demo order storage (in-memory, per-process)
const demoOrders = new Map();

async function createOrder(amount, receipt, notes = {}) {
  if (DEMO_MODE) {
    const orderId = "order_demo_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const order = {
      id: orderId,
      amount: amount * 100,
      currency: "INR",
      receipt,
      notes,
      status: "created",
      created_at: Math.floor(Date.now() / 1000),
    };
    demoOrders.set(orderId, order);
    return order;
  }

  if (!razorpay) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
  }

  const options = {
    amount: amount * 100, // Razorpay expects paise
    currency: "INR",
    receipt,
    notes,
  };

  return await razorpay.orders.create(options);
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  if (DEMO_MODE) return true;
  if (!razorpay) return false;
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

function verifyWebhookSignature(body, signature) {
  if (DEMO_MODE) return true;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

async function fetchPayment(paymentId) {
  if (DEMO_MODE) {
    return {
      id: paymentId,
      status: "captured",
      amount: 10000,
      currency: "INR",
    };
  }
  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }
  return await razorpay.payments.fetch(paymentId);
}

async function refundPayment(paymentId, amount) {
  if (DEMO_MODE) {
    return {
      id: "refund_demo_" + Date.now(),
      payment_id: paymentId,
      status: "processed",
    };
  }
  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }
  const options = {};
  if (amount) {
    options.amount = amount * 100; // paise
  }
  return await razorpay.payments.refund(paymentId, options);
}

module.exports = {
  isPaymentEnabled,
  isDemoMode,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  refundPayment,
  DEMO_MODE,
};
