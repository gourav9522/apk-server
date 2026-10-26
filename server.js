const express = require('express');
const admin = require('firebase-admin');
const https = require('https');
const app = express();

// Firebase Admin SDK setup (Apni serviceAccountKey.json file yhi folder me rakhni hai)
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
  databaseURL: "https://apk-earner-default-rtdb.firebaseio.com"
});
const db = admin.database();

// CPAgrip Postback Endpoint
app.get('/cpa-postback', async (req, res) => {
    const subid = req.query.subid; // User ka Firebase UID
    const payout = parseFloat(req.query.payout || req.query.amount || 0); // CPAgrip se mila amount

    if (!subid) {
        return res.status(400).send('Missing subid');
    }

    try {
        const userRef = db.ref('users/' + subid);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            let currentWallet = snapshot.val().wallet || 0;
            let newWallet = currentWallet + payout;
            
            // Firebase wallet update
            await userRef.update({ wallet: newWallet });
            
            return res.status(200).send('SUCCESS: Wallet Updated');
        } else {
            return res.status(404).send('User not found');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // --- SELF-PING MECHANISM (Har 3 minute mein khud ko ping karega) ---
    const SELF_URL = process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/cpa-postback` : null;

    if (SELF_URL) {
        setInterval(() => {
            https.get(SELF_URL, (res) => {
                console.log(`Self-ping status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('Self-ping error:', err.message);
            });
        }, 3 * 60 * 1000); // 3 minutes = 1,80,000 milliseconds
    }
});
