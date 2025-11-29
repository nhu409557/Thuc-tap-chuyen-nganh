// assets/js/cart.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
// 👇 Import từ common
import { formatPrice, showToast, debounce } from './utils/common.js';

// Biến toàn cục lưu danh sách items
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
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-16 w-16 mx-auto text-gray-300 mb-4">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
        <path d="M3 6h18"></path>
        <path d="M16 10a4 4 0 0 1-8 0"></path>
      </svg>
      <h2 class="text-xl font-semibold mb-2">Giỏ hàng của bạn trống</h2>
      <p class="text-gray-500 mb-6">${message}</p>
      <a href="index.html" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition inline-block">
        Tiếp tục mua sắm
      </a>
    </div>
  `;
  
  listContainer.classList.remove('divide-y', 'border');
}

async function loadAndRenderCart() {
  const listContainer = document.querySelector('#cart-items-list');
  const summaryContainer = document.querySelector('#cart-summary');
  const couponBox = document.querySelector('#coupon-box');
  
  if (!listContainer || !summaryContainer) return;

  const token = getToken();
  if (!token) {
    renderEmptyCart(true);
    return;
  }

  try {
    const res = await api.getCart();
    cartItems = res.data || [];

    if (cartItems.length === 0) {
      renderEmptyCart(false);
      return;
    }

    if (summaryContainer.parentElement) summaryContainer.parentElement.classList.remove('hidden');
    if (couponBox) couponBox.classList.remove('hidden');
    if (listContainer.parentElement) {
      listContainer.parentElement.classList.add('lg:col-span-2');
      listContainer.parentElement.classList.remove('lg:col-span-3');
    }
    listContainer.classList.add('divide-y', 'border');

    listContainer.innerHTML = cartItems.map((item) => `
      <div class="p-4 md:p-6 flex gap-4 items-start border-b border-gray-200 last:border-0">
        <div class="flex items-center h-full pt-8">
          <input type="checkbox" class="item-checkbox w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
            data-id="${item.product_id}" 
            data-price="${item.price}" 
            data-qty="${item.quantity}"
            checked 
          />
        </div>

        <a class="flex-shrink-0" href="product.html?id=${item.product_id}">
          <div class="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
            <img alt="${item.title}" src="${item.image}" class="object-cover w-full h-full" />
          </div>
        </a>
        
        <div class="flex-1 min-w-0">
          <a class="hover:text-blue-600" href="product.html?id=${item.product_id}">
            <h3 class="font-semibold text-sm md:text-base line-clamp-2">${item.title}</h3>
          </a>
          <p class="text-blue-600 font-bold mt-1">${formatPrice(item.price)}</p>
        </div>

        <div class="flex flex-col items-end gap-3">
          <div class="flex items-center border border-gray-300 rounded-lg">
            <button class="p-2 hover:bg-gray-100 btn-qty" data-id="${item.id}" data-new-qty="${item.quantity - 1}">-</button>
            <input type="number" min="1" value="${item.quantity}" data-id="${item.id}" class="w-10 text-center bg-transparent border-x border-gray-300 focus:outline-none input-qty" />
            <button class="p-2 hover:bg-gray-100 btn-qty" data-id="${item.id}" data-new-qty="${item.quantity + 1}">+</button>
          </div>
          <button class="text-red-500 text-sm hover:underline btn-remove" data-id="${item.id}">Xóa</button>
        </div>
      </div>
    `).join('');

    renderCartSummary();
    initCartEvents();

  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `<p class="p-6 text-red-500 text-center">Lỗi tải giỏ hàng. Vui lòng thử lại.</p>`;
  }
}

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
    <button id="btn-checkout" class="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-center hover:opacity-90 transition ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${count === 0 ? 'disabled' : ''}>
      Mua Hàng (${count})
    </button>
  `;

  const btnCheckout = document.querySelector('#btn-checkout');
  if (btnCheckout && !btnCheckout.disabled) {
    btnCheckout.addEventListener('click', () => {
      const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
      localStorage.setItem('checkout_selected_items', JSON.stringify(selectedIds));
      window.location.href = 'checkout.html';
    });
  }
}

function initCartEvents() {
  const listContainer = document.querySelector('#cart-items-list');
  if (!listContainer) return;

  listContainer.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('change', renderCartSummary);
  });

  const debouncedUpdate = debounce(handleUpdateQuantity, 500);

  listContainer.querySelectorAll('.btn-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleUpdateQuantity(e.currentTarget.dataset.id, parseInt(e.currentTarget.dataset.newQty));
    });
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
  try {
    await api.removeCartItem(id);
    showToast('Đã xóa', 'success');
    syncCartBadge();
    loadAndRenderCart();
  } catch (e) { showToast('Lỗi xóa', 'error'); }
}

async function handleUpdateQuantity(id, qty) {
  if (qty < 1) return;
  try {
    await api.updateCartItem(id, qty);
    syncCartBadge();
    loadAndRenderCart();
  } catch (e) { showToast('Lỗi cập nhật', 'error'); }
}

document.addEventListener('DOMContentLoaded', loadAndRenderCart);