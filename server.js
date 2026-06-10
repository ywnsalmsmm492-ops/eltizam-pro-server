const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let client;
let qrCodeData = '';
let isReady = false;

client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', async (qr) => {
    qrCodeData = await qrcode.toDataURL(qr);
    isReady = false;
});

client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
});

client.initialize();

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
        await client.sendMessage(phone + '@c.us', message);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
