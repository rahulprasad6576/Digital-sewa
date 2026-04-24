const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("./admin");

async function seed() {
  await mongoose.connect("mongodb://127.0.0.1:27017/digital_platform");

  const existing = await Admin.findOne({ email: "admin@digitalseva.com" });
  if (!existing) {
    const hashed = await bcrypt.hash("admin123", 10);
    await new Admin({ name: "Super Admin", email: "admin@digitalseva.com", password: hashed }).save();
    console.log("Admin created: admin@digitalseva.com / admin123");
  } else {
    console.log("Admin already exists");
  }

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });

