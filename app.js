/* jshint esversion: 8 */
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3004;
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

// 檢查環境變數
const requiredEnv = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
requiredEnv.forEach(key => {
    if (!process.env[key]) {
        console.error(`缺少環境變數: ${key}`);
        process.exit(1);
    }
});

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const visitorCountFile = path.join(__dirname, 'visitorCount.json');
if (!fs.existsSync(visitorCountFile)) {
    fs.writeFileSync(visitorCountFile, JSON.stringify({ count: 0 }));
}

const getVisitorCount = () => {
    try {
        const data = fs.readFileSync(visitorCountFile, 'utf8');
        return JSON.parse(data).count || 0;
    } catch (err) {
        console.error('讀取 visitorCount.json 失敗:', err.message);
        return 0;
    }
};

const updateVisitorCount = () => {
    const currentCount = getVisitorCount();
    const newCount = currentCount + 1;
    try {
        fs.writeFileSync(visitorCountFile, JSON.stringify({ count: newCount }));
        return newCount;
    } catch (err) {
        console.error('寫入 visitorCount.json 失敗:', err.message);
        return currentCount;
    }
};

app.get('/visitor-count', (req, res) => {
    try {
        const count = updateVisitorCount();
        res.json({ count });
    } catch (err) {
        console.error('處理 /visitor-count 失敗:', err.message);
        res.status(500).json({ error: '無法更新訪客計數' });
    }
});

app.post('/send-to-telegram', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: '所有欄位都是必填的' });
    }

    const text = `新訊息:\n姓名: ${name}\nEmail: ${email}\n訊息: ${message}\n時間: ${new Date().toLocaleString('zh-TW')}`;
    bot.sendMessage(chatId, text)
        .then(() => res.json({ message: '訊息已發送至 Telegram' }))
        .catch(err => {
            console.error('Telegram 發送失敗:', err.message);
            res.status(500).json({ error: '發送至 Telegram 失敗' });
        });
});

bot.on('message', (msg) => {
    const text = `收到訊息:\n內容: ${msg.text}\n來自: ${msg.from.first_name || '未知用戶'}\n時間: ${new Date().toLocaleString('zh-TW')}`;
    bot.sendMessage(chatId, text).catch(err => console.error('Telegram 回覆失敗:', err.message));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).send('Not Found'));

app.listen(port, () => console.log(`伺服器運行於 http://localhost:${port}`));