const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http'); // ✅ สร้าง HTTP server จำลองให้ Render ตรวจเจอ port

// ==========================================
// 🌐 HTTP Health-check Server สำหรับ Render
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is running!');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Health-check server listening on port ${PORT}`);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, 
        headless: true, 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            // 🔧 ลด RAM ให้อยู่ภายใน 512MB ของ Render Free Plan
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--mute-audio',
            '--no-default-browser-check',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-component-update',
            '--js-flags=--max-old-space-size=256'
        ]
    }
});

const imageCounter = new Map();

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🚀 บอทระบบโล่ล้างบาง 5 วินาที (Fix Bug) พร้อมรัน 24 ชม.'));

client.on('message', async (msg) => {
    if (!msg.from.endsWith('@g.us')) return;

    try {
        const chat = await msg.getChat();
        const chatId = chat.id._serialized; // เก็บ ID กลุ่มไว้สำหรับเรียกใช้ใน setTimeout ป้องกัน Scope หลุด
        
        // เช็คสิทธิ์แอดมิน
        const sender = chat.participants.find(p => p.id._serialized === msg.author);
        if (sender && (sender.isAdmin || sender.isSuperAdmin)) return;

        // 🛑 เคสที่ 1: เจอลิงก์ -> ลบและเตะทันที
        if (/(https?:\/\/[^\s]+|www\.[^\s]+)/gi.test(msg.body)) {
            msg.delete(true).catch(() => {});
            await chat.removeParticipants([msg.author]);
            return;
        }

        // 📷 เคสที่ 2: เจอรูปภาพ/สื่อทั่วไป
        if (msg.hasMedia) {
            let userData = imageCounter.get(msg.author) || { count: 0, isKicked: false, cleanMode: false };
            
            // 🔥 อุดรอยรั่วจากภาพถ่าย: ถ้าบอทเปิดโหมดล้างบาง (cleanMode) อยู่ รูปภาพจะโดนลบทิ้งทั้งหมดทันที!
            if (userData.cleanMode) {
                msg.delete(true).catch(() => {});
                return;
            }

            userData.count += 1;
            imageCounter.set(msg.author, userData);

            // รูปใบที่ 1 และ 2 ลบปกติสำหรับทุกคน
            msg.delete(true).catch(() => {});

            // 🔥 กฎเหล็ก: ยิงรูปรัวครบ 3 ใบ สั่งล็อกกลุ่ม เตะ และเปิดโหมดล้างบาง 5 วินาที
            if (userData.count >= 3 && !userData.isKicked) {
                userData.isKicked = true;
                userData.cleanMode = true; 
                imageCounter.set(msg.author, userData);

                // สั่งล็อกกลุ่มและเตะออกทันที
                Promise.all([
                    chat.setMessagesAdminsOnly(true),
                    chat.removeParticipants([msg.author])
                ]).catch(() => {});

                console.log(`[🛡️ PERFECT SHIELD] ล็อกกลุ่ม + เตะออก + เปิดระบบล้างบาง 5 วินาที`);

                // ⏳ สเต็ปที่ 1: ปิดโหมดล้างบางหลังจากผ่านไป 5 วินาที
                setTimeout(() => {
                    if (imageCounter.has(msg.author)) {
                        let currentData = imageCounter.get(msg.author);
                        currentData.cleanMode = false;
                        imageCounter.set(msg.author, currentData);
                        console.log(`[🧹 CLEAN DONE] จบกระบวนการกวาดล้างรูปหลุดรอด`);
                    }
                }, 5000);

                // ⏳ สเต็ปที่ 2: ปลดล็อกกลุ่มให้กลับมาใช้งานตามปกติเมื่อครบ 1 นาที (60 วินาที)
                setTimeout(async () => {
                    try {
                        const targetChat = await client.getChatById(chatId); // ✅ ปลอดภัยขึ้น: ดึงอินสแตนซ์แชทล่าสุดมาสั่งปลดล็อก
                        await targetChat.setMessagesAdminsOnly(false);
                        imageCounter.delete(msg.author); 
                        console.log(`[🔓 DEACTIVATE] เปิดกลุ่มให้สมาชิกใช้งานปกติแล้ว`);
                    } catch (err) {}
                }, 60000);
            }
        }

    } catch (error) {
        // เงียบไว้
    }
});

client.initialize();
