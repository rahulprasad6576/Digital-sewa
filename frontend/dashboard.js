const API_URL = "";

const translations = {
  en: {
    logout: "Logout",
    welcome: "Welcome to Digital Seva",
    chooseService: "Choose a service to get started",
    panCard: "PAN Card",
    panDesc: "Apply or check PAN card status",
    aadhaar: "Aadhaar Services",
    aadhaarDesc: "Update or download Aadhaar",
    electricity: "Electricity Bill",
    electricityDesc: "Pay your electricity bill online",
    water: "Water Bill",
    waterDesc: "Pay your water bill online",
    mobile: "Mobile Recharge",
    mobileDesc: "Recharge your mobile fast",
    dth: "DTH Recharge",
    dthDesc: "Recharge your DTH connection",
    gas: "Gas Booking",
    gasDesc: "Book your LPG cylinder",
    train: "Train Booking",
    trainDesc: "Book train tickets online"
  },
  hi: {
    logout: "लॉग आउट",
    welcome: "डिजिटल सेवा में आपका स्वागत है",
    chooseService: "शुरू करने के लिए एक सेवा चुनें",
    panCard: "पैन कार्ड",
    panDesc: "पैन कार्ड आवेदन या स्टेटस",
    aadhaar: "आधार सेवाएं",
    aadhaarDesc: "आधार अपडेट या डाउनलोड",
    electricity: "बिजली बिल",
    electricityDesc: "अपना बिजली बिल ऑनलाइन भरें",
    water: "पानी का बिल",
    waterDesc: "अपना पानी का बिल ऑनलाइन भरें",
    mobile: "मोबाइल रिचार्ज",
    mobileDesc: "अपना मोबाइल तेजी से रिचार्ज करें",
    dth: "डीटीएच रिचार्ज",
    dthDesc: "अपना डीटीएच कनेक्शन रिचार्ज करें",
    gas: "गैस बुकिंग",
    gasDesc: "एलपीजी सिलेंडर बुक करें",
    train: "ट्रेन बुकिंग",
    trainDesc: "ट्रेन टिकट ऑनलाइन बुक करें"
  }
};

let currentLang = localStorage.getItem("lang") || "en";

function applyLang() {
  const t = translations[currentLang];
  document.querySelectorAll("[data-key]").forEach(el => {
    el.textContent = t[el.dataset.key];
  });
  document.querySelector(".lang-switch").textContent = currentLang === "en" ? "हिंदी" : "English";
}

function toggleLang() {
  currentLang = currentLang === "en" ? "hi" : "en";
  localStorage.setItem("lang", currentLang);
  applyLang();
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  window.location.href = "index.html";
}

async function loadUser() {
  const token = localStorage.getItem("token");
  const userName = localStorage.getItem("userName");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  if (userName) {
    document.getElementById("userName").textContent = userName;
  }

  try {
    const res = await fetch(API_URL + "/dashboard", {
      headers: { "Authorization": token }
    });

    const data = await res.json();

    if (!res.ok) {
      logout();
    }
  } catch (err) {
    console.log("Dashboard load error", err);
  }
}

applyLang();
loadUser();

