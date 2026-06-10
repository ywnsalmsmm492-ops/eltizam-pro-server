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
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        // هذا السطر يحل المشكلة
        executablePath: require('puppeteer').executablePath()
    }
});

client.on('qr', async (qr) => {
    qrCodeData = await qrcode.toDataURL(qr);
    isReady = false;
});

client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
    console.log('✅ الواتساب متصل');
});

client.on('disconnected', () => {
    isReady = false;
    console.log('⚠️ انقطع الاتصال');
    setTimeout(() => client.initialize(), 5000);
});

client.initialize();

app.get('/whatsapp/qr', (req, res) => {
    res.json({ connected: isReady, qr: qrCodeData });
});

app.get('/whatsapp/status', (req, res) => {
    res.json({ connected: isReady });
});

app.post('/whatsapp/send', async (req, res) => {
    if (!isReady) return res.json({ success: false, error: 'الواتساب غير متصل' });
    const { phone, message } = req.body;
    if (!phone || !message) return res.json({ success: false, error: 'البيانات ناقصة' });
    try {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        await client.sendMessage(cleanPhone + '@c.us', message);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 يعمل على ${PORT}`));
