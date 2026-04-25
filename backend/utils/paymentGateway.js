const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

function isPaymentEnabled() {
  return !!razorpay;
}

async function createOrder(amount, receipt, notes = {}) {
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
  if (!razorpay) return false;
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

function verifyWebhookSignature(body, signature) {
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
  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }
  return await razorpay.payments.fetch(paymentId);
}

async function refundPayment(paymentId, amount) {
  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }
  const options = {};
  if (amount) {
    options.amount = amount * 100; // paise
  }
  return await razorpay.payments.refund(paymentId, options);
}

module.exports = { isPaymentEnabled, createOrder, verifyPaymentSignature, verifyWebhookSignature, fetchPayment, refundPayment };


