const express = require("express");
const QRCode = require("qrcode");
const admin = require("firebase-admin");
const cors = require("cors");
const path = require("path");

let serviceAccount;

// Firebase setup
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.log("✅ Using Firebase credentials from ENV");
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} else {
  console.log("⚠️ Using local serviceAccountKey.json");
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
app.use(express.json());
app.use(cors());

// Base URL (for QR redirect links)
const backendBaseUrl = process.env.BASE_URL || "http://localhost:3000";

// ------------------- ROUTES -------------------

// Create QR
app.post("/qr", async (req, res) => {
  try {
    const { title, targetUrl } = req.body;
    const id = Date.now().toString(36); // simple unique id

    await db.collection("qr_codes").doc(id).set({
      id,
      title,
      targetUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const qrUrl = `${backendBaseUrl}/r/${id}`;
    const qrImage = await QRCode.toDataURL(qrUrl);

    res.json({ id, qrUrl, qrImage });
  } catch (err) {
    console.error("❌ Error creating QR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Redirect by QR
app.get("/r/:id", async (req, res) => {
  try {
    const doc = await db.collection("qr_codes").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send("QR not found");
    res.redirect(doc.data().targetUrl);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Edit QR
app.put("/qr/:id", async (req, res) => {
  try {
    const { targetUrl } = req.body;
    await db.collection("qr_codes").doc(req.params.id).update({
      targetUrl,
      updatedAt: new Date(),
    });
    res.json({ message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all QRs
app.get("/qr", async (req, res) => {
  try {
    const snapshot = await db.collection("qr_codes").get();
    const data = snapshot.docs.map((doc) => doc.data());
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- START SERVER -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
