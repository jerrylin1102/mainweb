/* jshint esversion: 8 */
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
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

// 讀取管理員信息
const adminDataPath = path.join(__dirname, 'data/admin.json');
const menuDataPath = path.join(__dirname, 'data/menu.json');

// 驗證管理員登入
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        
        // 計算密碼的 MD5 雜湊
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
        
        if (username === adminData.username && hashedPassword === adminData.password) {
            res.json({ success: true });
        } else {
            res.status(401).json({ error: '帳號或密碼錯誤' });
        }
    } catch (err) {
        res.status(500).json({ error: '登入失敗' });
    }
});

// 獲取選單項目
app.get('/api/menu', (req, res) => {
    try {
        const menuData = JSON.parse(fs.readFileSync(menuDataPath, 'utf8'));
        res.json(menuData);
    } catch (err) {
        res.status(500).json({ error: '無法獲取選單項目' });
    }
});

// 新增選單項目
app.post('/api/menu', (req, res) => {
    try {
        const { title, url } = req.body;
        if (!title || !url) {
            return res.status(400).json({ error: '標題和URL都是必須的' });
        }

        const menuData = JSON.parse(fs.readFileSync(menuDataPath, 'utf8'));
        const newItem = {
            id: Date.now().toString(),
            title,
            url
        };
        menuData.menuItems.push(newItem);
        fs.writeFileSync(menuDataPath, JSON.stringify(menuData, null, 4));
        res.json(newItem);
    } catch (err) {
        res.status(500).json({ error: '無法新增選單項目' });
    }
});

// 更新選單項目
app.put('/api/menu/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, url } = req.body;
        if (!title || !url) {
            return res.status(400).json({ error: '標題和URL都是必須的' });
        }

        const menuData = JSON.parse(fs.readFileSync(menuDataPath, 'utf8'));
        const itemIndex = menuData.menuItems.findIndex(item => item.id === id);
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: '找不到該選單項目' });
        }

        menuData.menuItems[itemIndex] = {
            ...menuData.menuItems[itemIndex],
            title,
            url
        };

        fs.writeFileSync(menuDataPath, JSON.stringify(menuData, null, 4));
        res.json(menuData.menuItems[itemIndex]);
    } catch (err) {
        res.status(500).json({ error: '無法更新選單項目' });
    }
});

// 刪除選單項目
app.delete('/api/menu/:id', (req, res) => {
    try {
        const { id } = req.params;
        const menuData = JSON.parse(fs.readFileSync(menuDataPath, 'utf8'));
        const itemIndex = menuData.menuItems.findIndex(item => item.id === id);
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: '找不到該選單項目' });
        }

        menuData.menuItems.splice(itemIndex, 1);
        fs.writeFileSync(menuDataPath, JSON.stringify(menuData, null, 4));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '無法刪除選單項目' });
    }
});

const visitorCountFile = path.join(__dirname, 'visitorCount.json');
let visitorCount = 0;

// 初次啟動時從文件載入計數
const loadVisitorCount = () => {
    try {
        if (fs.existsSync(visitorCountFile)) {
            const data = fs.readFileSync(visitorCountFile, 'utf8');
            const visitorData = JSON.parse(data);
            visitorCount = visitorData.count || 0;
        } else {
            fs.writeFileSync(visitorCountFile, JSON.stringify({ count: 0 }));
        }
    } catch (err) {
        console.error('載入訪客計數失敗:', err.message);
        visitorCount = 0;
    }
};

// 定期將計數寫入文件（每 5 分鐘）
const saveVisitorCount = () => {
    try {
        fs.writeFileSync(visitorCountFile, JSON.stringify({ count: visitorCount }));
        console.log('計數已持久化:', visitorCount);
    } catch (err) {
        console.error('持久化訪客計數失敗:', err.message);
    }
};

// 初次載入計數
loadVisitorCount();

// 每 5 分鐘持久化一次
setInterval(saveVisitorCount, 5 * 60 * 1000);

// 處理訪客計數請求
app.get('/visitor-count', (req, res) => {
    try {
        visitorCount += 1; // 直接在記憶體中增加計數
        res.json({ count: visitorCount });
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

// 伺服器關閉時保存計數
process.on('SIGINT', () => {
    saveVisitorCount();
    process.exit();
});

app.listen(port, () => console.log(`伺服器運行於 http://localhost:${port}`));
