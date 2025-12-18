import { getToken, removeToken } from './utils/storage.js';
import { showToast } from './ui/toast.js';
import { getQueryParam } from './utils/url.js';
import { api } from './api.js';
import { initSearchSuggestions } from './search.js';

// 1. LOGIC MENU DANH MỤC ĐỘNG (UPDATED: Hỗ trợ cả Emoji và FontAwesome)
export async function initHeaderCategories() {
    const desktopNav = document.getElementById('header-nav-items');
    const mobileNav = document.getElementById('mobile-nav-items');

    if (!desktopNav || !mobileNav) return;

    try {
        const res = await api.getCategories();
        const categories = res.data || [];
        const currentSlug = getQueryParam('slug');

        const isHome = !currentSlug && (
            window.location.pathname.endsWith('/') ||
            window.location.pathname.endsWith('index.html') ||
            window.location.pathname.includes('index')
        );

        // --- Helper: Xử lý hiển thị icon ---
        const renderIcon = (iconStr, isMobile = false) => {
            // Trường hợp 1: Không có icon -> dùng mặc định
            if (!iconStr) return `<i class="fa-solid fa-folder ${isMobile ? '' : 'mr-1.5'}"></i>`;
            
            // Trường hợp 2: Là class FontAwesome (có chứa 'fa-')
            if (iconStr.includes('fa-')) {
                return `<i class="${iconStr} ${isMobile ? '' : 'mr-1.5'}"></i>`;
            }
            
            // Trường hợp 3: Là Emoji (📱, 💻...)
            return `<span class="${isMobile ? 'text-xl leading-none' : 'mr-1.5 text-lg leading-none'}">${iconStr}</span>`;
        };

        // Render Desktop (nav ngang)
        const desktopHtml = `
            <a href="index.html"
               class="category-item px-4 py-2 text-sm font-semibold ${isHome ? 'text-blue-600' : 'text-gray-700'} hover:text-blue-700 transition-colors whitespace-nowrap flex items-center">
               <i class="fa-solid fa-house mr-1.5"></i>Trang chủ
            </a>

            ${categories.map(c => {
                const active = c.slug === currentSlug;
                return `
                <a href="category.html?slug=${c.slug}"
                   class="category-item px-4 py-2 text-sm font-semibold ${active ? 'text-blue-600' : 'text-gray-700'} hover:text-blue-600 transition-colors whitespace-nowrap flex items-center">
                    ${renderIcon(c.icon, false)}${c.name}
                </a>`;
            }).join('')}

            <a href="contact.html"
               class="category-item px-4 py-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors whitespace-nowrap flex items-center">
               <i class="fa-solid fa-envelope mr-1.5"></i>Liên hệ
            </a>
        `;
        desktopNav.innerHTML = desktopHtml;

        // Render Mobile (menu dọc)
        const mobileHtml = `
            <a href="index.html"
               class="mobile-nav-link flex items-center gap-3 px-3 py-3 rounded-xl ${isHome ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <span class="w-8 text-center flex items-center justify-center"><i class="fa-solid fa-house"></i></span>
                <span class="font-semibold">Trang chủ</span>
            </a>

            ${categories.map(c => {
                const active = c.slug === currentSlug;
                return `
                <a href="category.html?slug=${c.slug}"
                   class="mobile-nav-link flex items-center gap-3 px-3 py-3 rounded-xl ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <span class="w-8 text-center flex items-center justify-center">${renderIcon(c.icon, true)}</span>
                    <span class="font-semibold capitalize">${c.name}</span>
                </a>`;
            }).join('')}

            <a href="contact.html"
               class="mobile-nav-link flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <span class="w-8 text-center flex items-center justify-center"><i class="fa-solid fa-envelope"></i></span>
                <span class="font-semibold">Liên hệ</span>
            </a>
        `;
        mobileNav.innerHTML = mobileHtml;

        // Click link thì đóng menu
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => {
                document.getElementById('mobile-menu-close')?.click();
            });
        });

    } catch (err) {
        console.error(err);
        desktopNav.innerHTML = '';
    }
}

// 2. SEARCH (Enter + Click nút)
function initSearchEnter() {
    const searchPairs = [
        { inputId: 'header-search-input', btnId: 'header-search-btn' },
        { inputId: 'mobile-search-input', btnId: 'mobile-search-btn' }
    ];

    searchPairs.forEach(({ inputId, btnId }) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);

        const performSearch = () => {
            if (!input) return;
            const keyword = input.value.trim();
            if (keyword) window.location.href = `category.html?q=${encodeURIComponent(keyword)}`;
        };

        input?.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
        btn?.addEventListener('click', (e) => { e.preventDefault(); performSearch(); });
    });
}

// 3. AUTH & DROPDOWN
export async function updateHeaderAuth() {
  const token = getToken();

  const loginLink = document.getElementById('header-login-link');
  const userTrigger = document.getElementById('user-dropdown-trigger');
  const userDropdown = document.getElementById('user-dropdown');
  const headerGreeting = document.getElementById('header-greeting');

  const mobileLoginLink = document.getElementById('mobile-login-link');
  const mobileUserInfo = document.getElementById('mobile-user-info');
  const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

  if (token) {
    loginLink?.classList.add('hidden');
    userTrigger?.classList.remove('hidden');

    mobileLoginLink?.classList.add('hidden');
    mobileUserInfo?.classList.remove('hidden');
    mobileLogoutBtn?.classList.remove('hidden');

    try {
      const user = await api.me();
      
      if (headerGreeting && user.name) {
          const lastName = user.name.trim().split(' ').pop();
          headerGreeting.textContent = `Chào, ${lastName}`;
      }

      document.getElementById('user-dropdown-name') && (document.getElementById('user-dropdown-name').textContent = user.name);
      document.getElementById('user-dropdown-email') && (document.getElementById('user-dropdown-email').textContent = user.email);

      document.getElementById('mobile-user-name') && (document.getElementById('mobile-user-name').textContent = user.name);
      document.getElementById('mobile-user-email') && (document.getElementById('mobile-user-email').textContent = user.email);

      if (user.role === 'admin') {
          if (userDropdown && !document.getElementById('admin-dashboard-link')) {
              const adminLink = document.createElement('a');
              adminLink.id = 'admin-dashboard-link';
              adminLink.href = 'admin/index.html';
              adminLink.className = 'flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-bold border-b border-gray-100';
              adminLink.innerHTML = '<i class="fa-solid fa-user-shield w-5"></i> Quản trị';
              if (userDropdown.children.length > 1) userDropdown.insertBefore(adminLink, userDropdown.children[1]);
          }
      }
    } catch (err) {
      removeToken();
    }
  } else {
    loginLink?.classList.remove('hidden');
    userTrigger?.classList.add('hidden');

    mobileLoginLink?.classList.remove('hidden');
    mobileUserInfo?.classList.add('hidden');
    mobileLogoutBtn?.classList.add('hidden');
  }

  const handleLogout = () => {
    removeToken();
    showToast('Đã đăng xuất', 'default');
    window.location.href = 'index.html';
  };

  document.getElementById('header-logout-btn')?.addEventListener('click', handleLogout);
  mobileLogoutBtn?.addEventListener('click', handleLogout);
}

// 4. UI TOGGLES (Menu & Dropdown)
export function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const panel = document.getElementById('mobile-menu-panel');
  const overlay = document.getElementById('mobile-menu-overlay');
  const closeBtn = document.getElementById('mobile-menu-close');

  if (!btn || !menu) return;

  const open = () => {
      menu.classList.remove('hidden');
      setTimeout(() => {
          overlay?.classList.remove('opacity-0');
          panel?.classList.remove('translate-x-full');
      }, 10);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
  };

  const close = () => {
      overlay?.classList.add('opacity-0');
      panel?.classList.add('translate-x-full');
      setTimeout(() => {
          menu.classList.add('hidden');
          document.documentElement.style.overflow = '';
          document.body.style.overflow = '';
      }, 300);
  };

  btn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.classList.contains('hidden')) close();
  });
}

export function initUserDropdown() {
  const trigger = document.getElementById('user-dropdown-trigger');
  const dropdown = document.getElementById('user-dropdown');

  if (!trigger || !dropdown) return;

  trigger.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  };

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

// 5. MOBILE SEARCH TOGGLE
export function initMobileSearchToggle() {
    const toggleBtn = document.getElementById('mobile-search-toggle');
    const searchBar = document.getElementById('mobile-search-bar');
    const input = document.getElementById('mobile-search-input');

    if (!toggleBtn || !searchBar) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            setTimeout(() => input?.focus(), 100);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchBar.classList.contains('hidden') && 
            !searchBar.contains(e.target) && 
            !toggleBtn.contains(e.target)) {
            searchBar.classList.add('hidden');
        }
    });
}

// ============================================================
// MAIN INIT
// ============================================================
function checkHeaderLoaded() {
  const searchInput = document.getElementById('header-search-input');
  const mobileBtn = document.getElementById('mobile-menu-btn');

  if (searchInput && mobileBtn) {
    initSearchSuggestions();
    initSearchEnter();
    initHeaderCategories();
    updateHeaderAuth();
    initMobileMenu();
    initUserDropdown();
    initMobileSearchToggle();
  } else {
    setTimeout(checkHeaderLoaded, 50);
  }
}

checkHeaderLoaded();