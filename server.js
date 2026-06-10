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
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        console.log('🔁 Connection Update:', JSON.stringify(update)); // تسجيل كل تحديث

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            isReady = false;
            console.log('✅ تم توليد باركود جديد');
        }

        if (connection === 'open') {
            isReady = true;
            qrCodeData = '';
            console.log('✅ متصل بالواتساب');
        }

        if (connection === 'close') {
            isReady = false;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ انقطع الاتصال', lastDisconnect?.error);
            if (shouldReconnect) {
                console.log('🔄 إعادة الاتصال...');
                startWhatsApp();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startWhatsApp();

app.get('/whatsapp/qr', (req, res) => {
    console.log('📱 طلب باركود، isReady:', isReady, 'qr length:', qrCodeData.length);
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
app.listen(PORT, () => console.log(`🚀 يعمل على ${PORT}`));
