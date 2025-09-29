const express = require("express");
const QRCode = require("qrcode");
const admin = require("firebase-admin");
const cors = require("cors");

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
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(express.json());
app.use(cors());

// Optional: serve frontend if you have Angular/React build
// app.use(express.static(path.join(__dirname, "dist/frontendd")));
// app.get("*", (req, res) => {
//     res.sendFile(path.join(__dirname, "dist/frontend/index.html"));
// });

// Simple root route to prevent 404
app.get("/", (req, res) => {
    res.send("✅ QR Backend is running. Use /qr endpoints.");
});

// Create QR
app.post("/qr", async (req, res) => {
    try {
        const { title, targetUrl } = req.body;
        const id = Date.now().toString(36); // simple unique id
        await db.collection("qr_codes").doc(id).set({
            id, title, targetUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const baseUrl = process.env.BASE_URL || "http://localhost:3000";
        const qrUrl = `${baseUrl}/r/${id}`;
        const qrImage = await QRCode.toDataURL(qrUrl);

        res.json({ id, qrUrl, qrImage });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Redirect
app.get("/r/:id", async (req, res) => {
    try {
        const doc = await db.collection("qr_codes").doc(req.params.id).get();
        if (!doc.exists) return res.status(404).send("QR not found");
        res.redirect(doc.data().targetUrl);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Edit QR
app.put("/qr/:id", async (req, res) => {
    try {
        const { targetUrl } = req.body;
        await db.collection("qr_codes").doc(req.params.id).update({
            targetUrl, updatedAt: new Date()
        });
        res.json({ message: "Updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// List QRs
app.get("/qr", async (req, res) => {
    try {
        const snapshot = await db.collection("qr_codes").get();
        const data = snapshot.docs.map(doc => doc.data());
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
