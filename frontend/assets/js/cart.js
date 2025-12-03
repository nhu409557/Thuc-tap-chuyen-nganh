// assets/js/cart.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { formatPrice, showToast, debounce } from './utils/common.js';

let cartItems = [];

function renderEmptyCart(isNotLoggedIn = false) {
  const listContainer = document.querySelector('#cart-items-list');
  const summaryContainer = document.querySelector('#cart-summary');
  const couponBox = document.querySelector('#coupon-box');
  
  if (!listContainer || !summaryContainer) return;

  if (summaryContainer.parentElement) summaryContainer.parentElement.classList.add('hidden');
  if (couponBox) couponBox.classList.add('hidden');

  if (listContainer.parentElement) {
    listContainer.parentElement.classList.remove('lg:col-span-2');
    listContainer.parentElement.classList.add('lg:col-span-3');
  }

  let message = isNotLoggedIn
    ? `Vui lòng <a href="login.html" class="text-blue-600 underline">đăng nhập</a> để xem giỏ hàng.`
    : `Bạn chưa có sản phẩm nào trong giỏ hàng.`;

  listContainer.innerHTML = `
    <div class="bg-white rounded-lg border border-gray-300 p-12 text-center">
      <h2 class="text-xl font-semibold mb-2">Giỏ hàng trống</h2>
      <p class="text-gray-500 mb-6">${message}</p>
      <a href="index.html" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition inline-block">
        Tiếp tục mua sắm
      </a>
    </div>
  `;
  listContainer.classList.remove('divide-y', 'border');
}

// 👇 HÀM MỚI: Xử lý hiển thị thông tin biến thể
function getVariantDisplay(item) {
    let details = [];

    // 1. Hiển thị Màu (Ưu tiên lấy từ variant, fallback lấy từ selected_color)
    const color = item.variant_color || item.selected_color;
    if (color) {
        details.push(`<span class="font-medium text-gray-700">Màu: ${color}</span>`);
    }

    // 2. Hiển thị Cấu hình (RAM, ROM...) từ JSON attributes
    if (item.variant_attributes) {
        try {
            // Parse JSON nếu nó là chuỗi
            const attrs = typeof item.variant_attributes === 'string' 
                ? JSON.parse(item.variant_attributes) 
                : item.variant_attributes;

            // Duyệt qua từng thuộc tính (trừ màu vì đã hiện ở trên)
            Object.entries(attrs).forEach(([key, value]) => {
                if (key !== 'color' && value) {
                    // Tự động viết hoa chữ cái đầu của Key (ví dụ: ram -> Ram)
                    const label = key.toUpperCase(); 
                    details.push(`<span class="text-gray-600">${label}: ${value}</span>`);
                }
            });
        } catch (e) {
            console.warn('Lỗi parse attributes', e);
        }
    }

    // Nếu không có variant attributes nhưng có tên biến thể
    if (details.length === 0 && item.variant_title) {
        details.push(item.variant_title);
    }

    if (details.length === 0) return '';

    // Gộp lại thành HTML
    return `
        <div class="mt-1 flex flex-wrap gap-2 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 w-fit">
            ${details.join('<span class="text-gray-300">|</span>')}
        </div>
    `;
}

async function loadAndRenderCart() {
  const listContainer = document.querySelector('#cart-items-list');
  const summaryContainer = document.querySelector('#cart-summary');
  const couponBox = document.querySelector('#coupon-box');
  if (!listContainer || !summaryContainer) return;

  const token = getToken();
  if (!token) { renderEmptyCart(true); return; }

  try {
    const res = await api.getCart();
    cartItems = res.data || []; // Dữ liệu này trả về từ API CartController::index

    if (cartItems.length === 0) { renderEmptyCart(false); return; }

    if (summaryContainer.parentElement) summaryContainer.parentElement.classList.remove('hidden');
    if (couponBox) couponBox.classList.remove('hidden');
    if (listContainer.parentElement) {
      listContainer.parentElement.classList.add('lg:col-span-2');
      listContainer.parentElement.classList.remove('lg:col-span-3');
    }
    listContainer.classList.add('divide-y', 'border');

    listContainer.innerHTML = cartItems.map((item) => {
        // Giá & Ảnh: Ưu tiên của biến thể
        const displayPrice = item.variant_price || item.base_price;
        const displayImage = item.variant_image || item.product_image;
        
        // Render HTML cấu hình
        const variantHtml = getVariantDisplay(item);

        return `
      <div class="p-4 md:p-6 flex gap-4 items-start border-b border-gray-200 last:border-0">
        <div class="flex items-center h-full pt-8">
          <input 
            type="checkbox" 
            class="item-checkbox w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
            data-id="${item.id}"  <-- SỬA CHỖ NÀY
            data-product-id="${item.product_id}" 
            data-variant-id="${item.product_variant_id || ''}"
            data-price="${displayPrice}" 
            data-qty="${item.quantity}"
            checked 
          />
        </div>

        <a class="flex-shrink-0" href="product.html?id=${item.product_id}">
          <div class="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
            <img alt="${item.product_title}" src="${displayImage}" class="object-contain w-full h-full mix-blend-multiply" />
          </div>
        </a>
        
        <div class="flex-1 min-w-0">
          <a class="hover:text-blue-600" href="product.html?id=${item.product_id}">
            <h3 class="font-semibold text-sm md:text-base line-clamp-2 text-gray-800">${item.product_title}</h3>
          </a>
          
          ${variantHtml}

          <p class="text-blue-600 font-bold mt-2 text-base">${formatPrice(displayPrice)}</p>
        </div>

        <div class="flex flex-col items-end gap-3">
          <div class="flex items-center border border-gray-300 rounded-lg">
            <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 btn-qty text-gray-500" data-id="${item.id}" data-new-qty="${item.quantity - 1}">-</button>
            <input 
              type="number" 
              min="1" 
              value="${item.quantity}" 
              data-id="${item.id}" 
              class="w-10 text-center bg-transparent border-x border-gray-300 focus:outline-none text-sm font-semibold input-qty" 
            />
            <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 btn-qty text-gray-500" data-id="${item.id}" data-new-qty="${item.quantity + 1}">+</button>
          </div>
          <button class="text-red-500 text-xs font-medium hover:underline btn-remove flex items-center gap-1" data-id="${item.id}">
            <i class="fa-solid fa-trash"></i> Xóa
          </button>
        </div>
      </div>
    `}).join('');

    renderCartSummary();
    initCartEvents();

  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `<p class="p-6 text-red-500 text-center">Lỗi tải giỏ hàng. Vui lòng thử lại.</p>`;
  }
}

// ... (Giữ nguyên các hàm renderCartSummary, initCartEvents, handleRemoveItem, handleUpdateQuantity)
function renderCartSummary() {
  const summaryContainer = document.querySelector('#cart-summary');
  if (!summaryContainer) return;
  const checkboxes = document.querySelectorAll('.item-checkbox:checked');
  let total = 0; 
  let count = 0;
  checkboxes.forEach(cb => {
    const price = parseInt(cb.dataset.price);
    const qty = parseInt(cb.dataset.qty);
    total += price * qty;
    count += qty;
  });
  summaryContainer.innerHTML = `
    <h3 class="font-bold text-lg mb-4">Tóm tắt đơn hàng</h3>
    <div class="space-y-3 text-sm border-b border-gray-200 pb-4">
      <div class="flex justify-between">
        <span class="text-gray-500">Đã chọn:</span>
        <span class="font-semibold">${count} sản phẩm</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Tạm tính:</span>
        <span class="font-semibold">${formatPrice(total)}</span>
      </div>
    </div>
    <div class="flex justify-between items-center text-lg font-bold mt-4 mb-6">
      <span>Tổng cộng:</span>
      <span class="text-blue-600 text-xl">${formatPrice(total)}</span>
    </div>
    <button 
      id="btn-checkout" 
      class="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-center hover:opacity-90 transition ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}" 
      ${count === 0 ? 'disabled' : ''}>
      Mua Hàng (${count})
    </button>
  `;
  
  const btnCheckout = document.querySelector('#btn-checkout');
  if (btnCheckout && !btnCheckout.disabled) {
    btnCheckout.addEventListener('click', () => {
      // 👇 SỬA ĐỔI QUAN TRỌNG: Lưu Cart Item ID (dòng trong giỏ) thay vì Product ID
      // item-checkbox cần có attribute data-cart-id (sẽ thêm ở bước render bên dưới)
      // Nếu chưa có, ta dùng data-id (nhưng ở bước render list phải gán data-id là cart_item.id)
      
      // Cách sửa nhanh nhất: Trong hàm loadAndRenderCart, dòng checkbox đang gán data-id="${item.product_id}"
      // Hãy sửa lại thành data-id="${item.id}" (ID của cart_item) thì đoạn code này sẽ đúng.
      
      const selectedCartItemIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
      localStorage.setItem('checkout_selected_items', JSON.stringify(selectedCartItemIds));
      window.location.href = 'checkout.html';
    });
  }
}
function initCartEvents() {
    const listContainer = document.querySelector('#cart-items-list');
    if (!listContainer) return;
    listContainer.querySelectorAll('.item-checkbox').forEach(cb => { cb.addEventListener('change', renderCartSummary); });
    const debouncedUpdate = debounce(handleUpdateQuantity, 500);
    listContainer.querySelectorAll('.btn-qty').forEach(btn => { 
        btn.addEventListener('click', (e) => { handleUpdateQuantity(e.currentTarget.dataset.id, parseInt(e.currentTarget.dataset.newQty)); }); 
    });
    listContainer.querySelectorAll('.btn-remove').forEach(btn => { 
        btn.addEventListener('click', (e) => handleRemoveItem(e.currentTarget.dataset.id)); 
    });
    listContainer.querySelectorAll('.input-qty').forEach(input => { 
        input.addEventListener('input', (e) => { 
            const val = parseInt(e.currentTarget.value) || 1; 
            debouncedUpdate(e.currentTarget.dataset.id, val); 
        }); 
    });
}
async function handleRemoveItem(id) {
    try { await api.removeCartItem(id); showToast('Đã xóa', 'success'); syncCartBadge(); loadAndRenderCart(); } 
    catch (e) { showToast('Lỗi xóa', 'error'); }
}
async function handleUpdateQuantity(id, qty) {
    if (qty < 1) return;
    try { await api.updateCartItem(id, qty); syncCartBadge(); loadAndRenderCart(); } 
    catch (e) { showToast('Lỗi cập nhật', 'error'); }
}

document.addEventListener('DOMContentLoaded', loadAndRenderCart);