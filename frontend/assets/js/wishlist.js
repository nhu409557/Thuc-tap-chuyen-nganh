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
 * Render thẻ sản phẩm (Responsive: 2 cột trên mobile)
 */
function renderWishlistProductCard(item) {
  // Logic sale tag
  let saleTag = '';
  if (item.compare_at && item.compare_at > item.price) {
      const percent = Math.round(((item.compare_at - item.price) / item.compare_at) * 100);
      saleTag = `<div class="absolute top-2 left-2 bg-red-600 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded shadow-sm z-10">-${percent}%</div>`;
  }

  return `
    <div class="group bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg flex flex-col h-full relative">
      
      <div class="relative bg-gray-50">
        <a class="block relative overflow-hidden" href="product.html?id=${item.product_id}">
          <div class="relative h-40 md:h-52 w-full">
            <img alt="${item.title}" loading="lazy" src="${item.image}" 
                 class="object-contain w-full h-full mix-blend-multiply hover:scale-105 transition-transform duration-500 p-2" 
                 onerror="this.src='https://placehold.co/300x300?text=No+Image'"/>
          </div>
          ${saleTag}
        </a>
      </div>

      <div class="p-3 md:p-4 flex flex-col flex-1">
        
        <a href="product.html?id=${item.product_id}" class="mb-1">
          <h3 class="font-semibold text-xs md:text-sm text-gray-800 leading-snug line-clamp-2 hover:text-blue-600 transition h-[32px] md:h-[40px]" title="${item.title}">
            ${item.title}
          </h3>
        </a>

        <div class="mb-3 mt-auto">
          <div class="flex flex-wrap items-baseline gap-1.5 md:gap-2">
            <span class="font-bold text-blue-600 text-sm md:text-lg">${formatPrice(item.price)}</span>
            ${item.compare_at ? `<span class="text-[10px] md:text-xs line-through text-gray-400">${formatPrice(item.compare_at)}</span>` : ''}
          </div>
        </div>

        <div class="flex gap-2 mt-auto">
          <button 
            class="flex-1 bg-blue-600 text-white rounded-lg px-2 py-2 md:px-3 text-xs md:text-sm font-medium hover:bg-blue-700 active:scale-95 transition flex items-center justify-center gap-1.5 btn-add-to-cart shadow-sm" 
            data-product-id="${item.product_id}">
            <i class="fa-solid fa-cart-plus"></i>
            <span>Thêm</span>
          </button>
          
          <button 
            class="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition btn-remove-wishlist border border-transparent hover:border-red-200" 
            data-wishlist-id="${item.id}" 
            title="Xóa bỏ">
            <i class="fa-solid fa-trash-can text-xs md:text-sm"></i>
          </button>
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
    container.innerHTML = `
        <div class="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <i class="fa-regular fa-user text-4xl text-gray-300 mb-3"></i>
            <p class="text-gray-500 mb-4">Vui lòng đăng nhập để xem danh sách yêu thích.</p>
            <a href="login.html" class="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">Đăng nhập ngay</a>
        </div>`;
    return;
  }

  try {
    const res = await api.getWishlist();
    const items = res.data || [];

    if (countEl) countEl.textContent = items.length;

    if (!items.length) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <i class="fa-regular fa-heart text-4xl text-gray-300 mb-3"></i>
            <p class="text-gray-500 mb-4">Danh sách yêu thích của bạn đang trống.</p>
            <a href="index.html" class="inline-block px-6 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition">Khám phá sản phẩm</a>
        </div>`;
      return;
    }

    container.innerHTML = items.map(renderWishlistProductCard).join('');
    initWishlistEvents(); // Gắn sự kiện cho các nút
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="col-span-full text-center text-red-500 py-8">Không tải được danh sách yêu thích. Vui lòng thử lại sau.</p>`;
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
      e.stopPropagation(); // Ngăn click vào card
      if(!confirm('Bạn chắc chắn muốn xóa sản phẩm này?')) return;
      
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
      e.stopPropagation(); // Ngăn click vào card
      const productId = e.currentTarget.dataset.productId;
      const btnEl = e.currentTarget;
      
      const originalHtml = btnEl.innerHTML;
      btnEl.disabled = true;
      btnEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;

      try {
        await api.addToCart(productId, 1);
        showToast('Đã thêm vào giỏ hàng', 'success');
        syncCartBadge(); // Cập nhật số lượng trên header
        
        // Hiệu ứng thành công
        btnEl.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        btnEl.classList.add('bg-green-600', 'hover:bg-green-700');
        btnEl.innerHTML = `<i class="fa-solid fa-check"></i> Xong`;
        
        setTimeout(() => {
            btnEl.classList.add('bg-blue-600', 'hover:bg-blue-700');
            btnEl.classList.remove('bg-green-600', 'hover:bg-green-700');
            btnEl.innerHTML = originalHtml;
            btnEl.disabled = false;
        }, 2000);

      } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
        btnEl.innerHTML = originalHtml;
        btnEl.disabled = false;
      }
    });
  });
}

// Chạy khi tải trang
document.addEventListener('DOMContentLoaded', loadAndRenderWishlist);