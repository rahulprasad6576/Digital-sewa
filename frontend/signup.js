const API_URL = "";

async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!name || !email || !password) {
    alert("Please fill all fields");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      location.href = "login.html";
    } else {
      alert(data.message || "Signup failed");
    }
  } catch (err) {
    alert("Network error: Cannot connect to server. Please try again later.");
    console.error("Signup fetch error:", err);
  }
}

