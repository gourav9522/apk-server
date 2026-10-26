const express = require('express');
const admin = require('firebase-admin');
const https = require('https');
const app = express();

// Firebase Admin SDK setup
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
  databaseURL: "https://apk-earner-default-rtdb.firebaseio.com"
});
const db = admin.database();

// CPAgrip Postback Endpoint
app.get('/cpa-postback', async (req, res) => {
    const subid = req.query.subid; // User ka Firebase UID jo link se gaya tha
    const payout = parseFloat(req.query.payout || req.query.amount || 0); // CPAgrip se mila amount
    const offerId = req.query.offer_id || req.query.id || 'default_offer'; // Offer/Mission ID

    if (!subid) {
        return res.status(400).send('Missing subid');
    }

    try {
        const userRef = db.ref('users/' + subid);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            let userData = snapshot.val();
            
            // Check if user already completed this specific offer/mission
            if (userData.completedMissions && userData.completedMissions[offerId]) {
                return res.status(200).send('ALREADY_COMPLETED: Reward already claimed for this offer');
            }

            let currentWallet = userData.wallet || 0;
            let earnedAmount = payout > 0 ? payout : 2.00; // Default fallback amount agar payout na aaye
            let newWallet = currentWallet + earnedAmount;
            
            // Update wallet and mark mission as completed for this user
            let updates = {};
            updates['wallet'] = newWallet;
            updates[`completedMissions/${offerId}`] = true;

            await userRef.update(updates);
            
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

    // --- SELF-PING MECHANISM ---
    const SELF_URL = process.env.RENDER_EXTERNAL_URL 
        ? `${process.env.RENDER_EXTERNAL_URL}/cpa-postback` 
        : "https://apk-earner-backend.onrender.com/cpa-postback";

    if (SELF_URL) {
        setInterval(() => {
            https.get(SELF_URL, (res) => {
                console.log(`Self-ping status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('Self-ping error:', err.message);
            });
        }, 3 * 60 * 1000); // Every 3 minutes
    }
});
