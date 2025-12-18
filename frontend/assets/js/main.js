// assets/js/main.js

import { loadHeaderFooter } from './utils/dom.js';
import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { initMobileMenu, initUserDropdown, updateHeaderAuth, initHeaderCategories } from './header.js';
import { showToast } from './ui/toast.js'; // Import để hiển thị thông báo
import './search.js';

// 1. SCROLL TO TOP
export function initBackToTop() {
    const btn = document.getElementById('btn-back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
            btn.classList.add('opacity-100', 'visible', 'translate-y-0');
        } else {
            btn.classList.add('opacity-0', 'invisible', 'translate-y-4');
            btn.classList.remove('opacity-100', 'visible', 'translate-y-0');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// 2. CART BADGE
export async function syncCartBadge() {
  const badge = document.querySelector('#cart-count-badge');
  if (!badge) return;

  const token = getToken();
  let count = 0;

  if (!token) {
    badge.textContent = '0';
    badge.classList.add('hidden'); 
    return;
  }

  try {
    const res = await api.getCart();
    const items = res.data || [];
    count = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  } catch (err) {
    console.error('Failed to sync cart badge:', err.message);
    count = 0;
  }

  badge.textContent = String(count);
  
  if (count > 0) {
      badge.classList.remove('hidden');
      badge.classList.add('animate-bounce');
      setTimeout(() => badge.classList.remove('animate-bounce'), 1000);
  } else {
      badge.classList.add('hidden');
  }
}

// 3. NEWSLETTER (ĐĂNG KÝ NHẬN TIN) - [MỚI THÊM]
function initNewsletter() {
    const form = document.getElementById('newsletter-form');
    // Nếu trang hiện tại không có section newsletter thì bỏ qua
    if (!form) return; 

    form.addEventListener('submit', async (e) => {
        // QUAN TRỌNG: Chặn hành động load lại trang mặc định của Form
        e.preventDefault();

        const emailInput = document.getElementById('newsletter-email');
        const btn = document.getElementById('newsletter-btn') || form.querySelector('button');
        const email = emailInput.value.trim();

        if (!email) {
            showToast('Vui lòng nhập email', 'error');
            return;
        }

        // Lưu trạng thái nút cũ để restore sau khi gọi API
        const originalText = btn.textContent;
        const originalContent = btn.innerHTML;

        try {
            // UI Loading
            btn.disabled = true;
            btn.textContent = 'Đang gửi...';

            // Gọi API
            await api.subscribeNewsletter(email);

            // Thành công
            showToast('Đăng ký nhận tin thành công!', 'success');
            emailInput.value = ''; // Xóa trắng ô nhập

        } catch (err) {
            // Thất bại
            console.error(err);
            showToast(err.message || 'Lỗi đăng ký, vui lòng thử lại', 'error');
        } finally {
            // Khôi phục nút
            btn.disabled = false;
            // Nếu nút có icon thì trả lại HTML cũ, không thì trả text cũ
            if (originalContent !== originalText) {
                btn.innerHTML = originalContent;
            } else {
                btn.textContent = originalText;
            }
        }
    });
}

// 4. MAIN INIT
document.addEventListener('DOMContentLoaded', async () => {
  // Load Header & Footer chung
  await loadHeaderFooter();

  // Khởi tạo các thành phần Header
  await initHeaderCategories(); 
  initMobileMenu();
  initUserDropdown();
  await updateHeaderAuth();
  
  // Đồng bộ giỏ hàng
  syncCartBadge();
  
  // Nút cuộn lên đầu trang
  initBackToTop();
  
  // Khởi tạo Newsletter (Mới)
  initNewsletter(); 
});