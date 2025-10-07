const express = require("express");
const QRCode = require("qrcode");
const admin = require("firebase-admin");
const cors = require("cors");

// Firebase setup
let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log("✅ Using Firebase credentials from ENV");
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} else {
    console.log("⚠️ Using local serviceAccountKey.json");
    serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors());

// -----------------------------
// Create URL Redirect QR (Existing)
// -----------------------------
app.post("/qr", async (req, res) => {
    try {
        const { title, targetUrl } = req.body;
        const id = Date.now().toString(36); // simple unique id

        await db.collection("qr_codes").doc(id).set({
            id,
            title,
            type: "url",
            targetUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const qrUrl = `https://qr-imbus-cf24.onrender.com/r/${id}`;
        const qrImage = await QRCode.toDataURL(qrUrl);

        res.json({ id, qrUrl, qrImage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -----------------------------
// Create Contact QR (NEW)
// -----------------------------
app.post("/qr/contact", async (req, res) => {
  try {
    const { title, contact } = req.body;

    if (!contact || !contact.name || !contact.phone) {
      return res.status(400).json({ error: "Missing required contact fields" });
    }

    // fallback if title not provided
    const qrTitle = title || contact.name || "New Contact";

    const id = Date.now().toString(36);

    // Generate vCard content with proper line breaks
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${contact.name}`,
      `TEL:${contact.phone}`,
      contact.email ? `EMAIL:${contact.email}` : "",
      contact.homepage ? `URL:${contact.homepage}` : "",
      contact.address ? `ADR:${contact.address}` : "",
      "END:VCARD"
    ]
      .filter(Boolean)
      .join("\n");

    // Generate QR image
    const qrImage = await QRCode.toDataURL(vcard);

    // Save in Firestore
    await db.collection("qr_codes").doc(id).set({
      id,
      title: qrTitle,
      type: "contact",
      contact,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Respond with generated image
    res.json({ id, qrImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Redirect (Existing)
// -----------------------------
app.get("/r/:id", async (req, res) => {
    const doc = await db.collection("qr_codes").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send("QR not found");
    res.redirect(doc.data().targetUrl);
});

// -----------------------------
// Edit QR (Existing)
// -----------------------------
app.put("/qr/:id", async (req, res) => {
    const { targetUrl } = req.body;
    await db.collection("qr_codes").doc(req.params.id).update({
        targetUrl,
        updatedAt: new Date()
    });
    res.json({ message: "Updated successfully" });
});

// -----------------------------
// List QRs (Existing)
// -----------------------------
app.get("/qr", async (req, res) => {
    const snapshot = await db.collection("qr_codes").get();
    const data = snapshot.docs.map(doc => doc.data());
    res.json(data);
});

// -----------------------------
// Server
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));