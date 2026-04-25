// Bill Payment Service Integration
// Supports: Electricity, Water, Gas
// BBPS-compatible provider architecture

const axios = require("axios");

const DEMO_MODE = process.env.BILL_DEMO_MODE !== "false";

const BILL_API_URL = process.env.BILL_API_URL;
const BILL_API_KEY = process.env.BILL_API_KEY;
const BILL_API_SECRET = process.env.BILL_API_SECRET;

function isBillPaymentEnabled() {
  if (DEMO_MODE) return true;
  return !!BILL_API_URL && !!BILL_API_KEY;
}

/**
 * Fetch bill details before payment
 * @param {string} type - 'electricity' | 'water' | 'gas'
 * @param {object} params - biller-specific params
 */
async function fetchBill(type, params) {
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 800));
    return {
      success: true,
      billerName: getBillerName(type, params),
      customerName: "Demo Customer",
      billNumber: "BILL" + Date.now(),
      billDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      amount: Math.floor(Math.random() * 2000) + 100,
      status: "pending",
      message: "Bill fetched successfully (Demo Mode)",
    };
  }

  if (!BILL_API_URL || !BILL_API_KEY) {
    throw new Error("Bill payment provider not configured");
  }

  try {
    const response = await axios.post(
      `${BILL_API_URL}/bill/fetch`,
      {
        api_key: BILL_API_KEY,
        type,
        ...params,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${BILL_API_KEY}`,
          "X-API-Secret": BILL_API_SECRET || "",
        },
        timeout: 20000,
      }
    );

    return {
      success: response.data.status === "success",
      billerName: response.data.biller_name || getBillerName(type, params),
      customerName: response.data.customer_name,
      billNumber: response.data.bill_number,
      billDate: response.data.bill_date,
      dueDate: response.data.due_date,
      amount: response.data.amount,
      status: response.data.status,
      message: response.data.message || "Bill fetched",
    };
  } catch (err) {
    console.error("Fetch bill error:", err.message);
    throw new Error(`Bill fetch failed: ${err.message}`);
  }
}

/**
 * Pay a bill
 * @param {string} type - 'electricity' | 'water' | 'gas'
 * @param {object} params - bill payment params
 */
async function payBill(type, params) {
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1200));
    return {
      success: true,
      transactionId: "BILLTXN" + Date.now(),
      referenceId: "REF" + Date.now(),
      amount: params.amount,
      status: "success",
      message: `${type} bill paid successfully (Demo Mode)`,
    };
  }

  if (!BILL_API_URL || !BILL_API_KEY) {
    throw new Error("Bill payment provider not configured");
  }

  try {
    const response = await axios.post(
      `${BILL_API_URL}/bill/pay`,
      {
        api_key: BILL_API_KEY,
        type,
        ...params,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${BILL_API_KEY}`,
          "X-API-Secret": BILL_API_SECRET || "",
        },
        timeout: 30000,
      }
    );

    return {
      success: response.data.status === "success",
      transactionId: response.data.transaction_id,
      referenceId: response.data.reference_id,
      amount: response.data.amount,
      status: response.data.status,
      message: response.data.message || `${type} bill payment processed`,
    };
  } catch (err) {
    console.error("Pay bill error:", err.message);
    throw new Error(`Bill payment failed: ${err.message}`);
  }
}

/**
 * Check bill payment status
 * @param {string} transactionId
 */
async function checkBillStatus(transactionId) {
  if (DEMO_MODE) {
    return {
      status: "success",
      message: "Demo mode - always successful",
    };
  }

  if (!BILL_API_URL || !BILL_API_KEY) {
    throw new Error("Bill payment provider not configured");
  }

  try {
    const response = await axios.get(
      `${BILL_API_URL}/bill/status`,
      {
        params: { transaction_id: transactionId },
        headers: {
          "Authorization": `Bearer ${BILL_API_KEY}`,
        },
        timeout: 15000,
      }
    );

    return {
      status: response.data.status || "unknown",
      message: response.data.message || "Status retrieved",
    };
  } catch (err) {
    console.error("Bill status error:", err.message);
    throw new Error(`Status check failed: ${err.message}`);
  }
}

function getBillerName(type, params) {
  const names = {
    electricity: params.biller || "Electricity Board",
    water: params.biller || "Water Supply Board",
    gas: params.biller || "Gas Provider",
  };
  return names[type] || type;
}

module.exports = {
  isBillPaymentEnabled,
  fetchBill,
  payBill,
  checkBillStatus,
  DEMO_MODE,
};

