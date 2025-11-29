// assets/js/wishlist.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { showToast } from './ui/toast.js';
import { syncCartBadge } from './main.js';

// Helper format tiền
function formatPrice(vnd) {
  if (typeof vnd !== 'number') return vnd;
  return vnd.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Render một thẻ sản phẩm (dựa theo code mẫu của bạn)
 * @param {object} item - Item từ API (đã join với product)
 * item.id = wishlist_items.id
 * item.product_id = products.id
 */
function renderWishlistProductCard(item) {
  return `
    <div class="group bg-white rounded-lg border border-gray-300 overflow-hidden transition-all duration-200 hover:shadow-lg">
      <div class="relative">
        <a class="relative block" href="product.html?id=${item.product_id}">
          <div class="relative h-48 bg-gray-100 overflow-hidden">
            <img alt="${item.title}" loading="lazy" src="${item.image}" class="object-cover w-full h-full hover:scale-105 transition-transform duration-300" />
            ${item.compare_at ? '<div class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">SALE</div>' : ''}
          </div>
        </a>
        <div class="p-3 sm:p-4">
          <p class="text-xs text-gray-500 mb-1">ID: ${item.product_id}</p>
          <a href="product.html?id=${item.product_id}">
            <h3 class="font-semibold text-sm leading-tight mb-2 hover:text-blue-600 transition line-clamp-2">${item.title}</h3>
          </a>
          <div class="mb-3">
            <div class="flex items-baseline gap-2">
              <span class="font-bold text-blue-600">${formatPrice(item.price)}</span>
              ${item.compare_at ? `<span class="text-sm line-through text-gray-400">${formatPrice(item.compare_at)}</span>` : ''}
            </div>
          </div>
          <div class="flex gap-2">
            <button 
              class="flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2 btn-add-to-cart" 
              data-product-id="${item.product_id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>
              <span>Thêm</span>
            </button>
            <button 
              class="bg-gray-200 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-300 transition btn-remove-wishlist" 
              data-wishlist-id="${item.id}" 
              aria-label="Remove from wishlist">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-red-500"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Tải và render danh sách yêu thích
 */
async function loadAndRenderWishlist() {
  const container = document.querySelector('#wishlist-container');
  const countEl = document.querySelector('#wishlist-count');
  if (!container) return;

  const token = getToken();
  if (!token) {
    container.innerHTML = `<p class="col-span-full text-sm text-gray-500">Vui lòng <a href="login.html" class="text-blue-600 underline">đăng nhập</a> để xem danh sách yêu thích.</p>`;
    return;
  }

  try {
    const res = await api.getWishlist();
    const items = res.data || [];

    if (countEl) countEl.textContent = items.length;

    if (!items.length) {
      container.innerHTML = `<p class="col-span-full text-sm text-gray-500">Danh sách yêu thích trống.</p>`;
      return;
    }

    container.innerHTML = items.map(renderWishlistProductCard).join('');
    initWishlistEvents(); // Gắn sự kiện cho các nút
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="col-span-full text-sm text-red-500">Không tải được danh sách yêu thích.</p>`;
  }
}

/**
 * Gắn sự kiện cho các nút "Xóa" và "Thêm vào giỏ"
 */
function initWishlistEvents() {
  const container = document.querySelector('#wishlist-container');
  if (!container) return;

  // Sự kiện Xóa khỏi Yêu thích
  container.querySelectorAll('.btn-remove-wishlist').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const wishlistItemId = e.currentTarget.dataset.wishlistId;
      try {
        await api.removeWishlist(wishlistItemId);
        showToast('Đã xóa khỏi yêu thích', 'default');
        loadAndRenderWishlist(); // Tải lại danh sách
      } catch (err) {
        showToast('Lỗi: Không thể xóa', 'error');
      }
    });
  });

  // Sự kiện Thêm vào giỏ hàng
  container.querySelectorAll('.btn-add-to-cart').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const productId = e.currentTarget.dataset.productId;
      try {
        await api.addToCart(productId, 1);
        showToast('Đã thêm vào giỏ hàng', 'success');
        syncCartBadge(); // Cập nhật số lượng trên header
      } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
      }
    });
  });
}

// Chạy khi tải trang
document.addEventListener('DOMContentLoaded', loadAndRenderWishlist);