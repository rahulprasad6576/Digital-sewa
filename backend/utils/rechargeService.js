// Real Recharge Service Integration
// Supports: Mobile Recharge, DTH Recharge
// Provider-agnostic architecture - works with any HTTP API provider

const axios = require("axios");

// Demo/Test mode - returns success without real API call
const DEMO_MODE = process.env.RECHARGE_DEMO_MODE !== "false";

// Provider configuration
const PROVIDER_URL = process.env.RECHARGE_API_URL;
const API_KEY = process.env.RECHARGE_API_KEY;
const API_SECRET = process.env.RECHARGE_API_SECRET;
const PROVIDER = process.env.RECHARGE_PROVIDER || "custom";

function isRechargeEnabled(type) {
  if (DEMO_MODE) return true; // Always enabled in demo
  return !!PROVIDER_URL && !!API_KEY;
}

/**
 * Do a real or demo recharge
 * @param {string} type - 'mobile' | 'dth'
 * @param {object} details - recharge details
 * @returns {Promise<{success: boolean, operatorRefId: string, status: string, message: string}>}
 */
async function doRecharge(type, details) {
  if (DEMO_MODE) {
    // Simulate real recharge with realistic delay
    await new Promise(r => setTimeout(r, 1500));
    return {
      success: true,
      operatorRefId: "DEMO" + Date.now(),
      status: "success",
      message: `${type} recharge processed successfully (Demo Mode - no real transaction)`,
    };
  }

  // Validate configuration
  if (!PROVIDER_URL || !API_KEY) {
    throw new Error("Recharge provider not configured. Set RECHARGE_API_URL and RECHARGE_API_KEY in .env");
  }

  try {
    // Build request based on provider type
    const payload = buildPayload(type, details);
    
    const response = await axios.post(
      `${PROVIDER_URL}/recharge`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
          "X-API-Secret": API_SECRET || "",
        },
        timeout: 30000,
      }
    );

    // Normalize provider response
    return normalizeResponse(response.data, type);
  } catch (err) {
    console.error("Recharge API error:", err.message);
    if (err.response) {
      return {
        success: false,
        operatorRefId: null,
        status: "failed",
        message: err.response.data?.message || `Provider error: ${err.response.status}`,
      };
    }
    throw new Error(`Recharge failed: ${err.message}`);
  }
}

/**
 * Check recharge status from provider
 * @param {string} operatorRefId
 * @returns {Promise<{status: string, message: string}>}
 */
async function checkRechargeStatus(operatorRefId) {
  if (DEMO_MODE) {
    return {
      status: "success",
      message: "Demo mode - always successful",
    };
  }

  if (!PROVIDER_URL || !API_KEY) {
    throw new Error("Recharge provider not configured");
  }

  try {
    const response = await axios.get(
      `${PROVIDER_URL}/status`,
      {
        params: { refId: operatorRefId },
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        },
        timeout: 15000,
      }
    );
    return {
      status: response.data.status || "unknown",
      message: response.data.message || "Status retrieved",
    };
  } catch (err) {
    console.error("Status check error:", err.message);
    throw new Error(`Status check failed: ${err.message}`);
  }
}

/**
 * Auto-detect mobile operator from number
 * @param {string} number
 * @returns {Promise<{operator: string, circle: string}>}
 */
async function checkMobileOperator(number) {
  if (!number || number.length !== 10) {
    throw new Error("Invalid mobile number. Must be 10 digits.");
  }

  if (DEMO_MODE) {
    // Realistic operator detection based on number series
    const prefix = number.substring(0, 4);
    const operators = {
      airtel: ["9900", "9916", "9958", "9873", "9810", "9650"],
      jio: ["7000", "8777", "6290", "6001", "9088", "9123"],
      vi: ["9820", "9879", "9818", "9711", "9310", "9811"],
      bsnl: ["9434", "9776", "9402", "9850", "9437"],
    };
    
    let detected = "Unknown";
    for (const [op, prefixes] of Object.entries(operators)) {
      if (prefixes.includes(prefix)) {
        detected = op.charAt(0).toUpperCase() + op.slice(1);
        break;
      }
    }
    if (detected === "Unknown") {
      const allOps = ["Airtel", "Jio", "Vi", "BSNL"];
      detected = allOps[Math.floor(Math.random() * allOps.length)];
    }
    return {
      operator: detected,
      circle: "Delhi NCR",
    };
  }

  // Real operator lookup via API
  if (!PROVIDER_URL || !API_KEY) {
    throw new Error("Operator lookup not configured");
  }

  try {
    const response = await axios.get(
      `${PROVIDER_URL}/operator-lookup`,
      {
        params: { number },
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );
    return {
      operator: response.data.operator || "Unknown",
      circle: response.data.circle || "Unknown",
    };
  } catch (err) {
    console.error("Operator lookup error:", err.message);
    throw new Error(`Operator lookup failed: ${err.message}`);
  }
}

/**
 * Build provider payload based on recharge type
 */
function buildPayload(type, details) {
  const base = {
    api_key: API_KEY,
    type: type,
    timestamp: new Date().toISOString(),
  };

  if (type === "mobile") {
    return {
      ...base,
      number: details.number,
      amount: details.amount,
      operator: details.operator,
      circle: details.circle || "",
    };
  }

  if (type === "dth") {
    return {
      ...base,
      subscriber_id: details.subscriberId,
      amount: details.amount,
      operator: details.operator,
    };
  }

  return base;
}

/**
 * Normalize provider response to standard format
 */
function normalizeResponse(data, type) {
  const success = data.status === "success" || data.status === "1" || data.success === true;
  return {
    success,
    operatorRefId: data.reference_id || data.refId || data.operator_ref || "REF" + Date.now(),
    status: success ? "success" : "failed",
    message: data.message || (success ? `${type} recharge successful` : `${type} recharge failed`),
  };
}

module.exports = {
  isRechargeEnabled,
  doRecharge,
  checkRechargeStatus,
  checkMobileOperator,
  DEMO_MODE,
};

