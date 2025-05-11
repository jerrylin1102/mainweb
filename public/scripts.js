/* jshint esversion: 8 */
const toggleContactForm = () => {
    const form = document.querySelector('.contact-form');
    const overlay = document.querySelector('.overlay');
    if (form && overlay) {
        form.classList.toggle('active');
        overlay.classList.toggle('active');
    }
};

const togglePopup = () => {
    const popup = document.querySelector('.popup');
    const overlay = document.querySelector('.popup-overlay');
    if (popup && overlay) {
        popup.classList.toggle('active');
        overlay.classList.toggle('active');
    }
};

// 新增：履歷模態視窗控制
let currentResumePage = 1;
const totalResumePages = 4;

const toggleResumeModal = () => {
    const modal = document.querySelector('.resume-modal');
    if (modal) {
        modal.classList.toggle('active');
        // 切換時重置為第一頁
        if (modal.classList.contains('active')) {
            updateResumePage(1);
        }
    }
};

const updateResumePage = (pageNum) => {
    currentResumePage = pageNum;
    const img = document.getElementById('resume-image');
    const pageIndicator = document.getElementById('current-page');
    
    if (img && pageIndicator) {
        img.src = `resume${currentResumePage}.jpg`;
        img.alt = `履歷第${currentResumePage}頁`;
        pageIndicator.textContent = currentResumePage;
    }
};

const navigateResume = (direction) => {
    let newPage = currentResumePage;
    
    if (direction === 'next') {
        newPage = (currentResumePage % totalResumePages) + 1;
    } else if (direction === 'prev') {
        newPage = currentResumePage - 1;
        if (newPage < 1) newPage = totalResumePages;
    }
    
    updateResumePage(newPage);
};

const submitForm = async e => {
    e.preventDefault();
    const form = document.getElementById('contact-form');
    const status = document.querySelector('.form-status');
    if (!form || !status) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    status.textContent = '正在發送...';
    try {
        const res = await fetch('/send-to-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('發送失敗');
        toggleContactForm();
        form.reset();
        togglePopup();
    } catch (err) {
        status.textContent = err.message || '發送失敗，請稍後再試。';
        status.style.color = '#dc3545';
    }
};

const updateVisitorCount = async () => {
    try {
        const res = await fetch('/visitor-count');
        if (!res.ok) throw new Error('無法獲取訪客計數');
        const { count } = await res.json();
        document.getElementById('visitor-count').textContent = count;
    } catch (err) {
        document.getElementById('visitor-count').textContent = '無法載入';
    }
};

const updateTime = () => {
    document.getElementById('current-time').textContent = new Date().toLocaleString('zh-TW', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const createRipple = e => {
    const button = e.currentTarget;
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
};

const backToTop = document.querySelector('.back-to-top');
window.addEventListener('scroll', () => backToTop.style.display = window.scrollY > 200 ? 'block' : 'none');
const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// 隨機問候語
const greetings = [
    "嗨！今天是美好的一天，對吧？",
    "歡迎來到我的小宇宙！",
    "很高興見到你，有什麼我可以幫你的？",
    "生活就像程式，總有 bug 等著修！",
    "你好，我的朋友！"
];

const updateGreeting = () => {
    const greetingElement = document.querySelector('.greeting');
    if (greetingElement) {
        const randomIndex = Math.floor(Math.random() * greetings.length);
        greetingElement.textContent = greetings[randomIndex];
    }
};

const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
};

// 布告欄功能
const loadAnnouncements = async () => {
    try {
        const response = await fetch('/api/announcements');
        const data = await response.json();
        const announcementList = document.getElementById('announcement-list');
        announcementList.innerHTML = '';
        
        data.announcements.forEach(item => {
            const announcementEl = document.createElement('div');
            announcementEl.className = 'announcement-item';
            announcementEl.innerHTML = `
                <h3>${item.title}</h3>
                <p>${item.content}</p>
            `;
            announcementEl.onclick = () => showAnnouncementDetail(item);
            announcementList.appendChild(announcementEl);
        });
    } catch (err) {
        console.error('載入公告失敗:', err);
    }
};

const showAnnouncementDetail = (announcement) => {
    const modal = document.querySelector('.announcement-modal');
    const titleEl = document.getElementById('announcement-title');
    const bodyEl = document.getElementById('announcement-body');
    
    titleEl.textContent = announcement.title;
    bodyEl.textContent = announcement.content;
    modal.classList.add('active');
};

const closeAnnouncementDetail = () => {
    const modal = document.querySelector('.announcement-modal');
    modal.classList.remove('active');
};

document.addEventListener('DOMContentLoaded', () => {
    // 載入布告欄內容
    loadAnnouncements();

    // 布告欄關閉按鈕事件
    document.querySelector('.close-announcement')?.addEventListener('click', closeAnnouncementDetail);

    // 漢堡選單功能
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const menuItems = document.getElementById('menuItems');

    // 載入選單項目
    const loadMenuItems = async () => {
        try {
            const response = await fetch('/api/menu');
            const data = await response.json();
            menuItems.innerHTML = data.menuItems
                .map(item => `
                    <div class="menu-item">
                        <a href="${item.url}" target="_blank">${item.title}</a>
                        ${item.description ? `<div class="menu-description">${item.description}</div>` : ''}
                    </div>
                `)
                .join('');
        } catch (error) {
            console.error('載入選單項目失敗：', error);
        }
    };

    // 切換選單
    const toggleMenu = () => {
        hamburgerMenu.classList.toggle('active');
        menuOverlay.classList.toggle('active');
    };

    hamburgerMenu.addEventListener('click', toggleMenu);
    document.addEventListener('click', (e) => {
        if (menuOverlay.classList.contains('active') && 
            !menuOverlay.contains(e.target) && 
            !hamburgerMenu.contains(e.target)) {
            toggleMenu();
        }
    });

    // 初始載入選單項目
    loadMenuItems();

    // 原來的按鈕初始化
    document.querySelectorAll('.contact-btn').forEach(btn => {
        if (btn.textContent === '聯絡我') {
            btn.addEventListener('click', toggleContactForm);
        } else if (btn.textContent === 'Github') {
            btn.addEventListener('click', () => {
                window.open('https://github.com/jerrylin1102', '_blank');
            });
        }
    });

    // 新增履歷按鈕監聽
    const resumeBtn = document.querySelector('.resume-btn');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', toggleResumeModal);
    }

    // 履歷導航按鈕
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const closeResumeBtn = document.querySelector('.resume-close');

    if (prevBtn) prevBtn.addEventListener('click', () => navigateResume('prev'));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateResume('next'));
    if (closeResumeBtn) closeResumeBtn.addEventListener('click', toggleResumeModal);

    document.getElementById('contact-form')?.addEventListener('submit', submitForm);
    document.querySelector('.back-btn')?.addEventListener('click', toggleContactForm);
    document.querySelector('.close-popup')?.addEventListener('click', togglePopup);
    backToTop?.addEventListener('click', scrollToTop);

    const savedTheme = localStorage.getItem('theme') || 'light';
    const themeToggle = document.querySelector('.switch input');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        if (themeToggle) themeToggle.checked = false;
    }
    
    themeToggle?.addEventListener('change', toggleTheme);

    updateTime();
    setInterval(updateTime, 1000);
    updateVisitorCount();
    updateGreeting();

    const starsContainer = document.querySelector('.stars-container');
    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        const dx = (Math.random() - 0.5) * 200;
        const dy = (Math.random() - 0.5) * 200;
        star.style.setProperty('--dx', `${dx}px`);
        star.style.setProperty('--dy', `${dy}px`);
        star.style.animationDuration = `${Math.random() * 5 + 5}s`;
        starsContainer.appendChild(star);
    }
});
