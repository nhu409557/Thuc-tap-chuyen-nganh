// assets/js/cart.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { formatPrice, showToast, debounce } from './utils/common.js';

let cartItems = [];

/**
 * Hiển thị thông tin biến thể
 */
function getVariantDisplay(item) {
  const details = [];
  const color = item.variant_color || item.selected_color;
  if (color) details.push(`<span class="font-medium text-gray-800">Màu: ${color}</span>`);

  if (item.variant_attributes) {
    try {
      const attrs = typeof item.variant_attributes === 'string' ? JSON.parse(item.variant_attributes) : item.variant_attributes;
      Object.entries(attrs || {}).forEach(([key, value]) => {
        if (!value || key === 'color') return;
        details.push(`<span class="text-gray-600">${value}</span>`);
      });
    } catch (err) {}
  }

  // Fallback variant title
  if (details.length === 0 && item.variant_title && item.variant_title !== 'Default Title') {
    details.push(`<span class="text-gray-600">${item.variant_title}</span>`);
  }

  if (!details.length) return '';

  return `<div class="mt-1 flex flex-wrap gap-2 text-xs bg-gray-50 px-2 py-1 rounded w-fit border border-gray-100">${details.join('<span class="text-gray-300">|</span>')}</div>`;
}

/**
 * Render Empty State (Đã sửa lỗi hiển thị)
 */
function renderEmptyCart(isNotLoggedIn = false) {
  const listContainer = document.querySelector('#cart-items-list');
  const mobileBar = document.querySelector('#cart-summary-mobile');
  const desktopBar = document.querySelector('#cart-summary-desktop');

  if (!listContainer) return;

  // 1. Ẩn thanh thanh toán Mobile
  if(mobileBar) mobileBar.classList.add('translate-y-full');

  // 2. Ẩn thanh thanh toán Desktop (FIX LỖI: Thêm lg:hidden và xóa nội dung cũ)
  if(desktopBar && desktopBar.parentElement) {
      desktopBar.innerHTML = ''; // Xóa sạch nội dung cũ (tránh hiện 1đ)
      desktopBar.parentElement.classList.add('hidden', 'lg:hidden'); // Ẩn triệt để
  }

  // 3. Mở rộng khung hiển thị thông báo trống (Full width)
  if (listContainer.parentElement) {
    listContainer.parentElement.classList.remove('lg:col-span-2');
    listContainer.parentElement.classList.add('lg:col-span-3');
  }

  const message = isNotLoggedIn
    ? `Vui lòng <a href="login.html" class="text-blue-600 font-bold hover:underline">đăng nhập</a> để xem giỏ hàng.`
    : `Giỏ hàng của bạn đang trống.`;

  listContainer.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="bg-gray-100 p-6 rounded-full mb-4">
          <i class="fa-solid fa-cart-arrow-down text-4xl text-gray-400"></i>
      </div>
      <h2 class="text-lg font-bold text-gray-800 mb-2">Giỏ hàng trống</h2>
      <p class="text-gray-500 mb-6 text-sm">${message}</p>
      <a href="index.html" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm text-sm">
        Tiếp tục mua sắm
      </a>
    </div>
  `;
}

/**
 * Render List Items
 */
function renderCartItems() {
  const listContainer = document.querySelector('#cart-items-list');
  const desktopBar = document.querySelector('#cart-summary-desktop');

  if (!listContainer) return;
  if (!cartItems || cartItems.length === 0) { renderEmptyCart(false); return; }

  // Restore Layout (Hiển thị lại sidebar desktop)
  if(desktopBar && desktopBar.parentElement) {
      // Xóa class lg:hidden để nó hiện lại theo layout gốc (lg:block)
      desktopBar.parentElement.classList.remove('hidden', 'lg:hidden');
  }

  // Trả về layout chia cột (2 cột cho list, 1 cột cho summary)
  if (listContainer.parentElement) {
    listContainer.parentElement.classList.add('lg:col-span-2');
    listContainer.parentElement.classList.remove('lg:col-span-3');
  }

  listContainer.innerHTML = cartItems.map((item) => {
      const price = item.variant_price || item.base_price || item.price || 0;
      const image = item.variant_image || item.product_image || item.image || 'https://via.placeholder.com/80';
      const title = item.product_title || item.product_name || 'Sản phẩm';
      const quantity = item.quantity || 1;
      const variantHtml = getVariantDisplay(item);

      return `
      <div class="p-3 lg:p-5 flex gap-3 lg:gap-5 items-start group relative">
        
        <div class="flex items-center h-full pt-1 lg:pt-8">
          <input type="checkbox" class="item-checkbox w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            data-id="${item.id}" data-price="${price}" data-qty="${quantity}" checked />
        </div>

        <a class="flex-shrink-0 block w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-lg border border-gray-200 overflow-hidden" href="product.html?id=${item.product_id}">
            <img src="${image}" alt="${title}" class="w-full h-full object-contain mix-blend-multiply p-1" onerror="this.src='https://via.placeholder.com/80'"/>
        </a>

        <div class="flex-1 min-w-0 flex flex-col justify-between">
          <div>
              <div class="flex justify-between items-start gap-2">
                  <a class="hover:text-blue-600 transition" href="product.html?id=${item.product_id}">
                    <h3 class="font-semibold text-sm lg:text-base text-gray-800 line-clamp-2 leading-snug">${title}</h3>
                  </a>
                  <button class="text-gray-400 hover:text-red-500 p-1 lg:hidden btn-remove" data-id="${item.id}"><i class="fa-solid fa-xmark"></i></button>
              </div>
              
              ${variantHtml}
              
              <div class="mt-2 text-red-600 font-bold text-sm lg:text-base">${formatPrice(price)}</div>
          </div>

          <div class="mt-3 flex justify-between items-end">
              <div class="flex items-center border border-gray-300 rounded-lg h-8 w-24">
                <button type="button" class="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 btn-qty rounded-l-lg transition" data-id="${item.id}" data-current-qty="${quantity}" data-new-qty="${quantity - 1}">-</button>
                <input type="number" min="1" value="${quantity}" data-id="${item.id}" data-current-qty="${quantity}" class="w-8 text-center text-sm font-semibold bg-transparent focus:outline-none input-qty appearance-none m-0" />
                <button type="button" class="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 btn-qty rounded-r-lg transition" data-id="${item.id}" data-current-qty="${quantity}" data-new-qty="${quantity + 1}">+</button>
              </div>

              <button class="hidden lg:flex items-center gap-1 text-gray-400 hover:text-red-600 text-sm transition btn-remove" data-id="${item.id}">
                <i class="fa-solid fa-trash-can"></i> <span>Xóa</span>
              </button>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

/**
 * Render Summary (Cho cả Desktop & Mobile)
 */
function renderCartSummary() {
  const desktopContainer = document.querySelector('#cart-summary-desktop');
  const mobileContainer = document.querySelector('#cart-summary-mobile');
  
  const checkboxes = document.querySelectorAll('.item-checkbox:checked');
  let subtotal = 0;
  let count = 0;

  checkboxes.forEach((cb) => {
    subtotal += (parseInt(cb.dataset.price)||0) * (parseInt(cb.dataset.qty)||0);
    count += (parseInt(cb.dataset.qty)||0);
  });

  // 1. Render Desktop Sidebar
  if (desktopContainer) {
      if (!checkboxes.length && cartItems.length > 0) {
        desktopContainer.innerHTML = `<p class="text-sm text-gray-500 text-center py-4">Vui lòng chọn sản phẩm.</p>`;
      } else if (cartItems.length > 0) {
        desktopContainer.innerHTML = `
            <h3 class="font-bold text-lg mb-4 text-gray-800">Tóm tắt đơn hàng</h3>
            <div class="space-y-3 text-sm border-b border-gray-100 pb-4">
            <div class="flex justify-between text-gray-600"><span>Tạm tính (${count} món)</span><span>${formatPrice(subtotal)}</span></div>
            <div class="flex justify-between text-gray-600"><span>Giảm giá</span><span class="text-green-600">0₫</span></div>
            </div>
            <div class="flex justify-between items-center pt-2">
            <span class="font-bold text-gray-800">Tổng tiền</span>
            <span class="text-xl font-bold text-red-600">${formatPrice(subtotal)}</span>
            </div>
            <button id="btn-checkout-desktop" class="mt-6 w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-md active:scale-95">
            Mua hàng (${count})
            </button>
        `;
        // Gắn event Desktop
        document.getElementById('btn-checkout-desktop')?.addEventListener('click', handleCheckoutClick);
      }
      // Nếu cartItems.length == 0 thì đã bị handle bởi renderEmptyCart
  }

  // 2. Render Mobile Sticky Bar
  if (mobileContainer) {
      if(cartItems.length > 0) {
          mobileContainer.classList.remove('translate-y-full'); // Hiện lên
          const btnClass = checkboxes.length ? 'bg-red-600 text-white shadow-md active:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed';
          const btnText = checkboxes.length ? `Mua hàng (${count})` : 'Chọn SP';
          
          mobileContainer.innerHTML = `
            <div class="flex items-center justify-between gap-4">
                <div class="flex flex-col">
                    <span class="text-xs text-gray-500">Tổng thanh toán:</span>
                    <span class="text-lg font-bold text-red-600 leading-tight">${formatPrice(subtotal)}</span>
                </div>
                <button id="btn-checkout-mobile" class="px-8 py-2.5 rounded-lg font-bold text-sm transition ${btnClass}" ${!checkboxes.length ? 'disabled' : ''}>
                    ${btnText}
                </button>
            </div>
          `;
          // Gắn event Mobile
          document.getElementById('btn-checkout-mobile')?.addEventListener('click', handleCheckoutClick);
      } else {
          mobileContainer.classList.add('translate-y-full'); // Ẩn đi
      }
  }
}

// Handler chuyển trang checkout
function handleCheckoutClick() {
    const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showToast('Vui lòng chọn sản phẩm', 'warning');
        return;
    }
    const selectedIds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.id));
    localStorage.setItem('checkout_selected_items', JSON.stringify(selectedIds));
    window.location.href = 'checkout.html';
}

/**
 * Gắn sự kiện (Event Delegation)
 * Chỉ chạy 1 lần duy nhất khi load trang
 */
function initCartEvents() {
  const listContainer = document.querySelector('#cart-items-list');
  if (!listContainer) return;

  // Checkbox Change -> Re-calc Summary
  listContainer.addEventListener('change', (e) => {
      if(e.target.classList.contains('item-checkbox')) renderCartSummary();
  });

  // Remove Item
  listContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-remove');
      if(btn) {
          btn.disabled = true; // Ngăn click đúp
          if(confirm("Xóa sản phẩm này khỏi giỏ?")) {
             await handleRemoveItem(btn.dataset.id);
          }
          btn.disabled = false;
      }
  });

  // Change Quantity (+/- Button)
  listContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-qty');
      if(btn) {
          const id = btn.dataset.id;
          const newQty = parseInt(btn.dataset.newQty) || 1;
          const currentQty = parseInt(btn.dataset.currentQty);
          await handleUpdateQuantity(id, newQty, currentQty);
      }
  });

  // Change Quantity (Input)
  listContainer.addEventListener('change', (e) => {
      if(e.target.classList.contains('input-qty')) {
          const id = e.target.dataset.id;
          const val = parseInt(e.target.value) || 1;
          const currentQty = parseInt(e.target.dataset.currentQty);
          handleUpdateQuantity(id, val, currentQty);
      }
  });
}

// Logic API
async function handleRemoveItem(id) {
  try {
    await api.removeCartItem(id);
    showToast('Đã xóa', 'default');
    syncCartBadge();
    await loadAndRenderCart(); // Gọi lại render, nhưng KHÔNG gọi lại initCartEvents
  } catch (err) { 
      console.error(err);
      showToast('Lỗi xóa sản phẩm', 'error'); 
  }
}

async function handleUpdateQuantity(id, qty, currentQty) {
  if (!id || qty < 1 || qty === currentQty) return;
  try {
    await api.updateCartItem(id, qty);
    syncCartBadge();
    await loadAndRenderCart(); 
  } catch (err) {
    showToast(err.message || 'Lỗi cập nhật', 'error');
    await loadAndRenderCart(); // Rollback UI
  }
}

export async function loadAndRenderCart() {
  const listContainer = document.querySelector('#cart-items-list');
  if (!listContainer) return;

  if (!getToken()) { renderEmptyCart(true); return; }

  try {
    const res = await api.getCart();
    cartItems = res.data || [];
    
    if (!cartItems.length) { 
        renderEmptyCart(false); 
        return; 
    }

    renderCartItems();
    renderCartSummary();
    // Không gọi initCartEvents() ở đây nữa
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = '<div class="p-8 text-center text-red-500">Lỗi tải giỏ hàng.</div>';
  }
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initCartEvents(); // Chạy 1 lần duy nhất để lắng nghe sự kiện
    loadAndRenderCart();
});