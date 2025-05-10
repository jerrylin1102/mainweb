/* jshint esversion: 8 */
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
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

// SQLite資料庫設定
const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) {
        console.error('資料庫連接錯誤:', err.message);
        process.exit(1);
    }
    console.log('已連接到SQLite資料庫');
    initializeDatabase();
});

// 初始化資料庫
function initializeDatabase() {
    // 創建使用者表格
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        permission TEXT NOT NULL,
        isAdmin INTEGER NOT NULL DEFAULT 0
    )`);

    // 創建選單表格
    db.run(`CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT
    )`);

    // 匯入現有資料
    importExistingData();
}

// 匯入現有JSON資料到SQLite
function importExistingData() {
    try {
        const adminData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/admin.json'), 'utf8'));
        const menuData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/menu.json'), 'utf8'));

        // 匯入使用者資料
        const userStmt = db.prepare('INSERT OR REPLACE INTO users (username, password, permission, isAdmin) VALUES (?, ?, ?, ?)');
        adminData.users.forEach(user => {
            userStmt.run(user.username, user.password, user.permission, user.isAdmin ? 1 : 0);
        });
        userStmt.finalize();

        // 匯入選單資料
        const menuStmt = db.prepare('INSERT OR REPLACE INTO menu_items (id, title, url, description) VALUES (?, ?, ?, ?)');
        menuData.menuItems.forEach(item => {
            menuStmt.run(item.id, item.title, item.url, item.description);
        });
        menuStmt.finalize();

        console.log('資料匯入完成');
    } catch (err) {
        console.error('資料匯入錯誤:', err.message);
    }
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 驗證管理員登入
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
    
    db.get('SELECT isAdmin, permission FROM users WHERE username = ? AND password = ?', 
        [username, hashedPassword],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: '登入失敗' });
            }
            if (user) {
                res.json({
                    success: true,
                    isAdmin: user.isAdmin === 1,
                    permission: user.permission
                });
            } else {
                res.status(401).json({ error: '帳號或密碼錯誤' });
            }
        });
});

// 修改使用者密碼
app.post('/api/admin/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    const hashedCurrentPassword = crypto.createHash('md5').update(currentPassword).digest('hex');
    const hashedNewPassword = crypto.createHash('md5').update(newPassword).digest('hex');

    db.run('UPDATE users SET password = ? WHERE username = ? AND password = ?',
        [hashedNewPassword, username, hashedCurrentPassword],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '密碼修改失敗' });
            }
            if (this.changes === 0) {
                return res.status(401).json({ error: '當前密碼錯誤' });
            }
            res.json({ success: true, message: '密碼修改成功' });
        });
});

// 新增使用者
app.post('/api/admin/users', (req, res) => {
    const { username, password, permission } = req.body;
    if (!username || !password || !permission) {
        return res.status(400).json({ error: '所有欄位都是必填的' });
    }
    
    if (permission !== 'view' && permission !== 'edit') {
        return res.status(400).json({ error: '權限類型無效' });
    }

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
    
    db.run('INSERT INTO users (username, password, permission, isAdmin) VALUES (?, ?, ?, 0)',
        [username, hashedPassword, permission],
        function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: '使用者名稱已存在' });
                }
                return res.status(500).json({ error: '創建使用者失敗' });
            }
            res.json({ success: true, message: '使用者創建成功' });
        });
});

// 獲取所有使用者
app.get('/api/admin/users', (req, res) => {
    db.all('SELECT username, permission, isAdmin FROM users', (err, users) => {
        if (err) {
            return res.status(500).json({ error: '獲取使用者列表失敗' });
        }
        res.json(users.map(user => ({
            ...user,
            isAdmin: user.isAdmin === 1
        })));
    });
});

// 刪除使用者
app.delete('/api/admin/users/:username', (req, res) => {
    const { username } = req.params;
    
    db.get('SELECT isAdmin FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '刪除使用者失敗' });
        }
        if (!user) {
            return res.status(404).json({ error: '找不到該使用者' });
        }
        if (user.isAdmin === 1) {
            return res.status(403).json({ error: '無法刪除管理員帳號' });
        }
        
        db.run('DELETE FROM users WHERE username = ?', [username], function(err) {
            if (err) {
                return res.status(500).json({ error: '刪除使用者失敗' });
            }
            res.json({ success: true, message: '使用者已刪除' });
        });
    });
});

// 驗證使用者權限的中間件
const checkPermission = (permission) => {
    return async (req, res, next) => {
        const { username } = req.body;
        if (!username) {
            return res.status(401).json({ error: '未提供使用者資訊' });
        }

        db.get('SELECT permission, isAdmin FROM users WHERE username = ?',
            [username],
            (err, user) => {
                if (err) {
                    return res.status(500).json({ error: '權限驗證失敗' });
                }
                if (!user) {
                    return res.status(401).json({ error: '未找到使用者' });
                }
                if (user.permission !== permission && user.isAdmin !== 1) {
                    return res.status(403).json({ error: '權限不足' });
                }
                next();
            });
    };
};

// 獲取選單項目
app.get('/api/menu', (req, res) => {
    db.all('SELECT * FROM menu_items', (err, items) => {
        if (err) {
            return res.status(500).json({ error: '無法獲取選單項目' });
        }
        res.json({ menuItems: items });
    });
});

// 新增選單項目
app.post('/api/menu', checkPermission('edit'), (req, res) => {
    const { title, url, description } = req.body;
    if (!title || !url) {
        return res.status(400).json({ error: '標題和URL都是必須的' });
    }

    const id = Date.now().toString();
    db.run('INSERT INTO menu_items (id, title, url, description) VALUES (?, ?, ?, ?)',
        [id, title, url, description || ''],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '無法新增選單項目' });
            }
            res.json({
                id,
                title,
                url,
                description: description || ''
            });
        });
});

// 更新選單項目
app.put('/api/menu/:id', checkPermission('edit'), (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    db.get('SELECT * FROM menu_items WHERE id = ?', [id], (err, item) => {
        if (err) {
            return res.status(500).json({ error: '無法更新選單項目' });
        }
        if (!item) {
            return res.status(404).json({ error: '找不到該選單項目' });
        }

        const newTitle = updates.title !== undefined ? updates.title : item.title;
        const newUrl = updates.url !== undefined ? updates.url : item.url;
        const newDescription = updates.description !== undefined ? updates.description : item.description;

        db.run('UPDATE menu_items SET title = ?, url = ?, description = ? WHERE id = ?',
            [newTitle, newUrl, newDescription, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: '無法更新選單項目' });
                }
                res.json({
                    id,
                    title: newTitle,
                    url: newUrl,
                    description: newDescription
                });
            });
    });
});

// 刪除選單項目
app.delete('/api/menu/:id', checkPermission('edit'), (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM menu_items WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: '無法刪除選單項目' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: '找不到該選單項目' });
        }
        res.json({ success: true });
    });
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
    db.close((err) => {
        if (err) {
            console.error('關閉資料庫連接錯誤:', err.message);
        }
        process.exit();
    });
});

app.listen(port, () => console.log(`伺服器運行於 http://localhost:${port}`));
