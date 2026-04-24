const API_URL = "http://localhost:5000";

async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!name || !email || !password) {
    alert(currentLang === "hi" ? "कृपया सभी फ़ील्ड भरें" : "Please fill all fields");
    return;
  }

  try {
    const res = await fetch(API_URL + "/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      window.location.href = "index.html";
    } else {
      alert(data.message || "Signup failed");
    }
  } catch (err) {
    console.error("Signup error:", err);
    alert(currentLang === "hi" ? "एरर: सर्वर से कनेक्ट नहीं हो पाया" : "Error: Could not connect to server. Please check if the server is running.");
  }
}

