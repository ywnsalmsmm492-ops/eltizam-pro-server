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
let reconnectAttempts = 0;

function createClient() {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        }
    });

    client.on('qr', async (qr) => {
        qrCodeData = await qrcode.toDataURL(qr);
        isReady = false;
        console.log('🔄 باركود جديد تم إنشاؤه');
    });

    client.on('ready', () => {
        isReady = true;
        qrCodeData = '';
        reconnectAttempts = 0;
        console.log('✅ الواتساب جاهز ومتصل');
    });

    client.on('disconnected', (reason) => {
        isReady = false;
        console.log('⚠️ انقطع الاتصال:', reason);
        // إعادة الاتصال تلقائياً بعد 5 ثواني
        setTimeout(() => {
            reconnectAttempts++;
            console.log(`🔄 محاولة إعادة الاتصال رقم ${reconnectAttempts}...`);
            client.initialize();
        }, 5000);
    });

    client.initialize();
}

createClient();

// نقطة نهاية لعرض الباركود
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
        return res.status(503).json({ success: false, error: 'الواتساب غير متصل حالياً' });
    }
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'رقم الهاتف أو الرسالة مفقودة' });
    }
    try {
        // تنظيف رقم الهاتف
        const cleanPhone = phone.replace(/[^\d]/g, '');
        const chatId = cleanPhone + '@c.us';
        await client.sendMessage(chatId, message);
        console.log(`📤 تم إرسال رسالة إلى ${cleanPhone}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ فشل إرسال الرسالة:', error.message);
        res.json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 التزام برو - سيرفر الواتساب يعمل على المنفذ ${PORT}`);
});
