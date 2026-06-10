const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
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
    // جلب بيانات الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    // جلب أحدث إصدار لواتساب ويب لتجنب خطأ 405
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`استخدام إصدار واتساب: v${version.join('.')}, الأحدث: ${isLatest}`);

    // إعداد الاتصال
    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        // تعريف نوع المتصفح لتجنب حظر الاتصال
        browser: Browsers.ubuntu('Chrome'), 
        syncFullHistory: false // تسريع الاتصال وتقليل استهلاك الذاكرة
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            isReady = false;
            console.log('✅ تم توليد باركود جديد، يرجى المسح');
        }

        if (connection === 'open') {
            isReady = true;
            qrCodeData = '';
            console.log('✅ متصل بالواتساب بنجاح');
        }

        if (connection === 'close') {
            isReady = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`⚠️ انقطع الاتصال (السبب: ${statusCode})`);
            
            if (shouldReconnect) {
                console.log('🔄 جاري إعادة الاتصال...');
                startWhatsApp();
            } else {
                console.log('❌ تم تسجيل الخروج من الهاتف، يجب مسح الباركود من جديد.');
            }
        }
    });

    // حفظ بيانات تسجيل الدخول عند تحديثها
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
    if (!isReady) return res.status(400).json({ success: false, error: 'Not connected' });
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, error: 'Missing data' });
    
    try {
        const jid = phone + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الخادم يعمل على منفذ ${PORT}`));
