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
        hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
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
    "你好，來自未來的朋友！"
];

const updateGreeting = () => {
    const greetingElement = document.querySelector('.greeting');
    if (greetingElement) {
        const randomIndex = Math.floor(Math.random() * greetings.length);
        greetingElement.textContent = greetings[randomIndex];
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.contact-btn')?.addEventListener('click', toggleContactForm);
    document.querySelectorAll('.dynamic-button').forEach(btn => btn.addEventListener('click', createRipple));
    document.getElementById('contact-form')?.addEventListener('submit', submitForm);
    document.querySelector('.back-btn')?.addEventListener('click', toggleContactForm);
    document.querySelector('.close-popup')?.addEventListener('click', togglePopup);
    backToTop?.addEventListener('click', scrollToTop);
    document.querySelectorAll('.contact-btn').forEach(btn => {
        btn.addEventListener('click', createRipple); // 保留波紋效果
        if (btn.textContent === '聯絡我') {
            btn.addEventListener('click', toggleContactForm);
        } else if (btn.textContent === 'Github') {
            btn.addEventListener('click', () => {
                window.open('https://github.com/jerrylin1102', '_blank'); // 新頁面開啟連結
            });
        }
    });

    updateTime();
    setInterval(updateTime, 1000);
    updateVisitorCount();
    updateGreeting();
});