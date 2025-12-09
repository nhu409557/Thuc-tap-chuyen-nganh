// assets/js/main.js

import { loadHeaderFooter } from './utils/dom.js';
import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { initMobileMenu, initUserDropdown, updateHeaderAuth, initHeaderCategories } from './header.js';
import './search.js';

// 1. SCROLL TO TOP (Giữ nguyên)
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

// 2. CART BADGE (Giữ nguyên)
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

// 3. MAIN INIT
document.addEventListener('DOMContentLoaded', async () => {
  await loadHeaderFooter();

  // ❌ ĐÃ XÓA initHomeCategories() Ở ĐÂY

  // Menu Header (vẫn giữ, vì header load xong rồi)
  await initHeaderCategories(); 

  initMobileMenu();
  initUserDropdown();
  await updateHeaderAuth();
  syncCartBadge();
  initBackToTop();
});