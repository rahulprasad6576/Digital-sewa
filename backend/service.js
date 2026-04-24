const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["pan", "aadhaar", "electricity", "water", "mobile", "dth", "gas", "train"], required: true },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
  details: { type: Object },
  amount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Service", serviceSchema);
