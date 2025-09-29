const express = require("express");
const QRCode = require("qrcode");
const admin = require("firebase-admin");
const cors = require("cors");

let serviceAccount;

// Firebase setup
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log("✅ Using Firebase credentials from ENV");
  // Running on Render (use env var)
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} else {
    console.log("⚠️ Using local serviceAccountKey.json");
  // Running locally (use file)
  serviceAccount = require("./serviceAccountKey.json");
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors());

// Create QR
app.post("/qr", async (req, res) => {
  try {
    const { title, targetUrl } = req.body;
    const id = Date.now().toString(36); // simple unique id
    await db.collection("qr_codes").doc(id).set({
      id, title, targetUrl,
      createdAt: new Date(), updatedAt: new Date()
    });

    const qrUrl = `https://whitesmoke-heron-128056.hostingersite.com/r/${id}`;
    const qrImage = await QRCode.toDataURL(qrUrl);

    res.json({ id, qrUrl, qrImage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Redirect
app.get("/r/:id", async (req, res) => {
  const doc = await db.collection("qr_codes").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).send("QR not found");
  res.redirect(doc.data().targetUrl);
});

// Edit QR
app.put("/qr/:id", async (req, res) => {
  const { targetUrl } = req.body;
  await db.collection("qr_codes").doc(req.params.id).update({
    targetUrl, updatedAt: new Date()
  });
  res.json({ message: "Updated successfully" });
});

// List QRs
app.get("/qr", async (req, res) => {
  const snapshot = await db.collection("qr_codes").get();
  const data = snapshot.docs.map(doc => doc.data());
  res.json(data);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
