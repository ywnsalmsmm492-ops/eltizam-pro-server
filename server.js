const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
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
    // 1. جلب بيانات الجلسة السابقة إن وجدت
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    // 2. جلب أحدث إصدار لواتساب ويب لتجنب الرفض
    let version = [2, 3000, 1015901307]; // إصدار احتياطي
    try {
        const { version: fetchedVersion } = await fetchLatestBaileysVersion();
        version = fetchedVersion;
        console.log(`استخدام إصدار واتساب: v${version.join('.')}`);
    } catch (e) {
        console.log('جاري استخدام إصدار واتساب الافتراضي');
    }

    // 3. إعداد الاتصال مع التمويه (Spoofing)
    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        // هذا هو السطر السحري لحل مشكلة 405 (التمويه كمتصفح كروم على أوبونتو)
        browser: ['Ubuntu', 'Chrome', '110.0.5481.192'], 
        syncFullHistory: false // لمنع استهلاك الذاكرة في استضافة Render
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            isReady = false;
            console.log('✅ تم توليد باركود جديد، يمكنك مسحه الآن');
        }

        if (connection === 'open') {
            isReady = true;
            qrCodeData = '';
            console.log('✅ متصل بالواتساب بنجاح! نظام التزام برو جاهز.');
        }

        if (connection === 'close') {
            isReady = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`⚠️ انقطع الاتصال (كود الخطأ: ${statusCode || 'غير معروف'})`);
            
            if (shouldReconnect) {
                console.log('🔄 جاري محاولة إعادة الاتصال...');
                setTimeout(startWhatsApp, 3000); // الانتظار 3 ثوانٍ قبل المحاولة لتجنب الحظر
            } else {
                console.log('❌ تم تسجيل الخروج من الهاتف، يجب مسح الباركود من جديد.');
            }
        }
    });

    // حفظ التحديثات في ملف الاعتمادات
    sock.ev.on('creds.update', saveCreds);
}

startWhatsApp();

// نقطة النهاية لعرض الباركود
app.get('/whatsapp/qr', (req, res) => {
    if (isReady) {
        return res.json({ connected: true, message: 'Already connected' });
    }
    res.json({ connected: false, qr: qrCodeData });
});

// نقطة النهاية لفحص حالة الاتصال
app.get('/whatsapp/status', (req, res) => {
    res.json({ connected: isReady });
});

// نقطة النهاية لإرسال الرسائل
app.post('/whatsapp/send', async (req, res) => {
    if (!isReady) return res.status(400).json({ success: false, error: 'Not connected to WhatsApp' });
    
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, error: 'Missing phone or message data' });
    
    try {
        const jid = phone + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true, message: 'تم إرسال الرسالة بنجاح' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 خادم التزام برو يعمل على منفذ ${PORT}`));
