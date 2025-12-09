import { getToken, removeToken } from './utils/storage.js';
import { showToast } from './ui/toast.js';
import { getQueryParam } from './utils/url.js';
import { api } from './api.js';
// Import hàm khởi tạo từ search.js
import { initSearchSuggestions } from './search.js';

// 1. LOGIC MENU DANH MỤC ĐỘNG
export async function initHeaderCategories() {
    const desktopNav = document.getElementById('header-nav-items');
    const mobileNav = document.getElementById('mobile-nav-items');
    
    if (!desktopNav || !mobileNav) return;

    try {
        const res = await api.getCategories();
        const categories = res.data || [];
        const currentSlug = getQueryParam('slug');

        const desktopHtml = `
            <a href="index.html" class="text-sm font-medium text-gray-700 hover:text-blue-600">Trang chủ</a>
            ${categories.map(c => {
                const activeClass = c.slug === currentSlug ? 'text-blue-600' : 'text-gray-700';
                let iconHtml = '';
                if (c.icon && c.icon.includes('fa-')) {
                     iconHtml = `<i class="${c.icon} mr-1"></i>`;
                }
                return `
                <a href="category.html?slug=${c.slug}" class="flex items-center gap-1.5 text-sm font-medium ${activeClass} hover:text-blue-600">
                    ${iconHtml}<span>${c.name}</span>
                </a>`;
            }).join('')}
            <a href="contact.html" class="text-sm font-medium text-gray-700 hover:text-blue-600">Liên hệ</a>
        `;
        desktopNav.innerHTML = desktopHtml;

        const mobileHtml = `
            <a href="index.html" class="text-gray-700 hover:text-blue-600 block py-2">Trang chủ</a>
            ${categories.map(c => `
                <a href="category.html?slug=${c.slug}" class="text-gray-700 hover:text-blue-600 block py-2 capitalize">${c.name}</a>
            `).join('')}
            <a href="contact.html" class="text-gray-700 hover:text-blue-600 block py-2">Liên hệ</a>
        `;
        mobileNav.innerHTML = mobileHtml;

    } catch (err) {
        console.error(err);
        desktopNav.innerHTML = '';
    }
}

// 2. SEARCH (Enter Key Redirect)
function initSearchEnter() {
    const inputs = [document.getElementById('header-search-input'), document.getElementById('mobile-search-input')];
    inputs.forEach(input => {
        if(!input) return;
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const keyword = input.value.trim();
                if (keyword) window.location.href = `category.html?q=${encodeURIComponent(keyword)}`;
            }
        });
    });
}

// 3. AUTH & DROPDOWN
export async function updateHeaderAuth() {
  const token = getToken();
  const loginLink = document.getElementById('header-login-link');
  const userTrigger = document.getElementById('user-dropdown-trigger');
  const userDropdown = document.getElementById('user-dropdown');
  const mobileLogin = document.getElementById('mobile-login-link');
  const mobileLogout = document.getElementById('mobile-logout-btn');

  if (token) {
    loginLink?.classList.add('hidden');
    userTrigger?.classList.remove('hidden');
    mobileLogin?.classList.add('hidden');
    mobileLogout?.classList.remove('hidden');

    try {
      const user = await api.me();
      if(document.getElementById('user-dropdown-name')) document.getElementById('user-dropdown-name').textContent = user.name;
      if(document.getElementById('user-dropdown-email')) document.getElementById('user-dropdown-email').textContent = user.email;

      if (user.role === 'admin') {
          if (userDropdown && !document.getElementById('admin-dashboard-link')) {
              const adminLink = document.createElement('a');
              adminLink.id = 'admin-dashboard-link';
              adminLink.href = 'admin/index.html'; 
              adminLink.className = 'block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 font-bold';
              adminLink.textContent = 'Trang Quản Trị';
              if(userDropdown.children.length > 1) userDropdown.insertBefore(adminLink, userDropdown.children[1]);
          }
      }
    } catch (err) { removeToken(); }
  } else {
    loginLink?.classList.remove('hidden');
    userTrigger?.classList.add('hidden');
    mobileLogin?.classList.remove('hidden');
    mobileLogout?.classList.add('hidden');
  }

  const handleLogout = () => {
    removeToken();
    showToast('Đã đăng xuất', 'default');
    window.location.href = 'index.html';
  };

  document.getElementById('header-logout-btn')?.addEventListener('click', handleLogout);
  mobileLogout?.addEventListener('click', handleLogout);
}

// 4. UI TOGGLES
export function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const panel = document.getElementById('mobile-menu-panel');
  const overlay = document.getElementById('mobile-menu-overlay');
  const closeBtn = document.getElementById('mobile-menu-close');

  if (!btn || !menu) return;

  const open = () => {
      menu.classList.remove('hidden');
      setTimeout(() => panel.classList.remove('translate-x-full'), 10);
  };
  const close = () => {
      panel.classList.add('translate-x-full');
      setTimeout(() => menu.classList.add('hidden'), 300);
  };

  btn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
}

export function initUserDropdown() {
  const trigger = document.getElementById('user-dropdown-trigger');
  const dropdown = document.getElementById('user-dropdown');

  if (!trigger || !dropdown) {
      console.warn("User dropdown elements not found yet."); // Debug log
      return;
  }

  // Xóa listener cũ (nếu có) bằng cách clone node (mẹo nhanh) hoặc đảm bảo chỉ init 1 lần
  // Ở đây ta giả định init chạy 1 lần đúng lúc
  
  trigger.onclick = (e) => { // Dùng onclick trực tiếp để tránh duplicate listener
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  };

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

// ============================================================
// MAIN INIT: CHỜ HEADER HTML ĐƯỢC LOAD XONG MỚI CHẠY LOGIC
// ============================================================
function checkHeaderLoaded() {
    const searchInput = document.getElementById('header-search-input');
    // FIX: Kiểm tra thêm cả nút User Dropdown để đảm bảo nó đã load
    const userTrigger = document.getElementById('user-dropdown-trigger'); 
    
    if (searchInput && userTrigger) {
        // HTML đã load xong hoàn toàn
        initSearchSuggestions(); 
        initSearchEnter();       
        initHeaderCategories();  
        updateHeaderAuth();      
        initMobileMenu();        
        initUserDropdown();      
    } else {
        // Chưa load xong, chờ 50ms rồi kiểm tra lại
        setTimeout(checkHeaderLoaded, 50);
    }
}

// Bắt đầu kiểm tra
checkHeaderLoaded();