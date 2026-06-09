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

// إنشاء عميل واتساب مع حفظ الجلسة محلياً
client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// حدث ظهور باركود جديد
client.on('qr', async (qr) => {
    qrCodeData = await qrcode.toDataURL(qr);
    isReady = false;
});

// حدث الجاهزية بعد الربط
client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
});

client.initialize();

// نقطة نهاية لعرض الباركود للواجهة الأمامية
app.get('/whatsapp/qr', (req, res) => {
    res.json({ connected: isReady, qr: qrCodeData });
});

// نقطة نهاية للتحقق من حالة الاتصال
app.get('/whatsapp/status', (req, res) => {
    res.json({ connected: isReady });
});

// نقطة نهاية لإرسال رسالة واتساب
app.post('/whatsapp/send', async (req, res) => {
    if (!isReady) {
        return res.json({ success: false, error: 'الواتساب غير متصل' });
    }
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.json({ success: false, error: 'رقم الهاتف أو الرسالة مفقودة' });
    }
    try {
        const chatId = phone + '@c.us';
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 التزام برو - سيرفر الواتساب يعمل على المنفذ ${PORT}`);
});
