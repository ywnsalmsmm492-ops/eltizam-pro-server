const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let sock;
let qrCodeData = '';
let isReady = false;

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // سنعرضه بأنفسنا
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            isReady = false;
            console.log('QR Code generated');
        }

        if (connection === 'open') {
            isReady = true;
            qrCodeData = '';
            console.log('Connected to WhatsApp');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...');
            if (shouldReconnect) {
                startWhatsApp();
            } else {
                console.log('Logged out, delete auth_info_baileys folder and restart');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startWhatsApp();

app.get('/whatsapp/qr', (req, res) => {
    res.json({ connected: isReady, qr: qrCodeData });
});

app.get('/whatsapp/status', (req, res) => {
    res.json({ connected: isReady });
});

app.post('/whatsapp/send', async (req, res) => {
    if (!isReady) return res.json({ success: false, error: 'Not connected' });
    const { phone, message } = req.body;
    if (!phone || !message) return res.json({ success: false, error: 'Missing data' });
    try {
        const jid = phone + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
