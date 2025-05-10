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
// 修改管理員密碼
app.post('/api/admin/change-password', (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        
        // 驗證當前密碼
        const hashedCurrentPassword = crypto.createHash('md5').update(currentPassword).digest('hex');
        if (hashedCurrentPassword !== adminData.password) {
            return res.status(401).json({ error: '當前密碼錯誤' });
        }
        
        // 更新新密碼
        const hashedNewPassword = crypto.createHash('md5').update(newPassword).digest('hex');
        adminData.password = hashedNewPassword;
        
        fs.writeFileSync(adminDataPath, JSON.stringify(adminData, null, 4));
        res.json({ success: true, message: '密碼修改成功' });
    } catch (err) {
        res.status(500).json({ error: '密碼修改失敗' });
    }
});

// 新增使用者
app.post('/api/admin/users', (req, res) => {
    try {
        const { username, password, permission } = req.body;
        if (!username || !password || !permission) {
            return res.status(400).json({ error: '所有欄位都是必填的' });
        }
        
        if (permission !== 'view' && permission !== 'edit') {
            return res.status(400).json({ error: '權限類型無效' });
        }

        const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        
        // 檢查使用者名稱是否已存在
        if (adminData.users.some(user => user.username === username)) {
            return res.status(400).json({ error: '使用者名稱已存在' });
        }

        // 新增使用者
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
        adminData.users.push({
            username,
            password: hashedPassword,
            permission,
            isAdmin: false
        });

        fs.writeFileSync(adminDataPath, JSON.stringify(adminData, null, 4));
        res.json({ success: true, message: '使用者創建成功' });
    } catch (err) {
        res.status(500).json({ error: '創建使用者失敗' });
    }
});

// 獲取所有使用者
app.get('/api/admin/users', (req, res) => {
    try {
        const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        // 返回使用者列表，但不包含密碼
        const users = adminData.users.map(({ password, ...user }) => user);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: '獲取使用者列表失敗' });
    }
});

// 刪除使用者
app.delete('/api/admin/users/:username', (req, res) => {
    try {
        const { username } = req.params;
        const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        
        const userIndex = adminData.users.findIndex(user => user.username === username);
        if (userIndex === -1) {
            return res.status(404).json({ error: '找不到該使用者' });
        }

        // 不允許刪除管理員
        if (adminData.users[userIndex].isAdmin) {
            return res.status(403).json({ error: '無法刪除管理員帳號' });
        }

        adminData.users.splice(userIndex, 1);
        fs.writeFileSync(adminDataPath, JSON.stringify(adminData, null, 4));
        res.json({ success: true, message: '使用者已刪除' });
    } catch (err) {
        res.status(500).json({ error: '刪除使用者失敗' });
    }
});

app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        
        // 計算密碼的 MD5 雜湊
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
        
        const user = adminData.users.find(u => u.username === username && u.password === hashedPassword);
        if (user) {
            res.json({ 
                success: true,
                isAdmin: user.isAdmin,
                permission: user.permission 
            });
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
// 驗證使用者權限的中間件
const checkPermission = (permission) => {
    return async (req, res, next) => {
        try {
            const { username } = req.body;
            if (!username) {
                return res.status(401).json({ error: '未提供使用者資訊' });
            }

            const adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
            const user = adminData.users.find(u => u.username === username);
            
            if (!user) {
                return res.status(401).json({ error: '未找到使用者' });
            }

            if (user.permission !== permission && !user.isAdmin) {
                return res.status(403).json({ error: '權限不足' });
            }

            next();
        } catch (err) {
            res.status(500).json({ error: '權限驗證失敗' });
        }
    };
};

app.post('/api/menu', checkPermission('edit'), (req, res) => {
    try {
        const { title, url, description } = req.body;
        if (!title || !url) {
            return res.status(400).json({ error: '標題和URL都是必須的' });
        }

        const menuData = JSON.parse(fs.readFileSync(menuDataPath, 'utf8'));
        const newItem = {
            id: Date.now().toString(),
            title,
            url,
            description: description || ''
        };
        menuData.menuItems.push(newItem);
        fs.writeFileSync(menuDataPath, JSON.stringify(menuData, null, 4));
        res.json(newItem);
    } catch (err) {
        res.status(500).json({ error: '無法新增選單項目' });
    }
});

// 更新選單項目
app.put('/api/menu/:id', checkPermission('edit'), (req, res) => {
    try {
        const { id } = req.params;
        const { title, url, description } = req.body;
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
            url,
            description: description || menuData.menuItems[itemIndex].description || ''
        };

        fs.writeFileSync(menuDataPath, JSON.stringify(menuData, null, 4));
        res.json(menuData.menuItems[itemIndex]);
    } catch (err) {
        res.status(500).json({ error: '無法更新選單項目' });
    }
});

// 刪除選單項目
app.delete('/api/menu/:id', checkPermission('edit'), (req, res) => {
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
