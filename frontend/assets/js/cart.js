// assets/js/cart.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { formatPrice, showToast, debounce } from './utils/common.js';

let cartItems = [];

/**
 * Hiển thị thông tin biến thể (màu, cấu hình, ...).
 */
function getVariantDisplay(item) {
  const details = [];

  // 1. Màu sắc: ưu tiên variant_color, fallback selected_color
  const color = item.variant_color || item.selected_color;
  if (color) {
    details.push(
      `<span class="font-medium text-gray-700">Màu: ${color}</span>`
    );
  }

  // 2. Cấu hình từ JSON variant_attributes
  if (item.variant_attributes) {
    try {
      const attrs =
        typeof item.variant_attributes === 'string'
          ? JSON.parse(item.variant_attributes)
          : item.variant_attributes;

      Object.entries(attrs || {}).forEach(([key, value]) => {
        if (!value) return;
        if (key === 'color') return; // màu đã hiển thị ở trên

        const label = key.replace(/_/g, ' ');
        details.push(
          `<span class="text-gray-600">${label}: <span class="font-medium">${value}</span></span>`
        );
      });
    } catch (err) {
      console.warn('Lỗi parse variant_attributes', err);
    }
  }

  // 3. Nếu không có attributes nhưng có variant_title -> dùng luôn
  if (details.length === 0 && item.variant_title) {
    details.push(
      `<span class="text-gray-600">${item.variant_title}</span>`
    );
  }

  if (!details.length) return '';

  return `
    <div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
      ${details.join('<span class="text-slate-300">•</span>')}
    </div>
  `;
}

/**
 * Khi giỏ hàng trống hoặc chưa đăng nhập.
 */
function renderEmptyCart(isNotLoggedIn = false) {
  const listContainer = document.querySelector('#cart-items-list');
  const summaryContainer = document.querySelector('#cart-summary');

  if (!listContainer || !summaryContainer) return;

  // Ẩn phần tóm tắt
  if (summaryContainer.parentElement) {
    summaryContainer.parentElement.classList.add('hidden');
  }

  // Cho giỏ hàng chiếm full 3 cột khi trống
  if (listContainer.parentElement) {
    listContainer.parentElement.classList.remove('lg:col-span-2');
    listContainer.parentElement.classList.add('lg:col-span-3');
  }

  const message = isNotLoggedIn
    ? `Vui lòng <a href="login.html" class="text-blue-600 underline">đăng nhập</a> để xem giỏ hàng.`
    : `Bạn chưa có sản phẩm nào trong giỏ hàng.`;

  listContainer.classList.remove('divide-y', 'border');
  listContainer.innerHTML = `
    <div class="bg-white rounded-lg border border-gray-300 p-12 text-center">
      <h2 class="text-xl font-semibold mb-2">Giỏ hàng trống</h2>
      <p class="text-gray-500 mb-6">${message}</p>
      <a href="index.html"
         class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition inline-block">
        Tiếp tục mua sắm
      </a>
    </div>
  `;
}

/**
 * Render danh sách item trong giỏ.
 */
function renderCartItems() {
  const listContainer = document.querySelector('#cart-items-list');
  const summaryContainer = document.querySelector('#cart-summary');

  if (!listContainer || !summaryContainer) return;
  if (!cartItems || cartItems.length === 0) {
    renderEmptyCart(false);
    return;
  }

  // Bật lại layout 2 cột
  if (summaryContainer.parentElement) {
    summaryContainer.parentElement.classList.remove('hidden');
  }
  if (listContainer.parentElement) {
    listContainer.parentElement.classList.add('lg:col-span-2');
    listContainer.parentElement.classList.remove('lg:col-span-3');
  }

  listContainer.classList.add('divide-y', 'border');

  listContainer.innerHTML = cartItems
    .map((item) => {
      const price =
        item.variant_price || item.base_price || item.price || 0;
      const image =
        item.variant_image ||
        item.product_image ||
        item.image ||
        'https://via.placeholder.com/80';
      const title =
        item.product_title || item.product_name || 'Sản phẩm';
      const quantity = item.quantity || 1;
      const lineTotal = price * quantity;

      const originalPrice =
        item.original_price && item.original_price > price
          ? item.original_price
          : null;

      const variantHtml = getVariantDisplay(item);

      return `
      <div class="p-4 md:p-6 flex gap-4 items-start">
        <!-- Checkbox chọn sản phẩm -->
        <div class="flex items-center h-full pt-8">
          <input 
            type="checkbox"
            class="item-checkbox w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            data-id="${item.id}"
            data-product-id="${item.product_id}"
            data-variant-id="${item.product_variant_id || ''}"
            data-price="${price}"
            data-qty="${quantity}"
            checked
          />
        </div>

        <!-- Ảnh sản phẩm -->
        <a class="flex-shrink-0" href="product.html?id=${item.product_id}">
          <div class="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
            <img src="${image}"
                 alt="${title}"
                 class="object-contain w-full h-full mix-blend-multiply" />
          </div>
        </a>

        <!-- Thông tin sản phẩm -->
        <div class="flex-1 min-w-0">
          <a class="hover:text-blue-600" href="product.html?id=${item.product_id}">
            <h3 class="font-semibold text-sm md:text-base line-clamp-2 text-gray-800">
              ${title}
            </h3>
          </a>

          ${variantHtml}

          <div class="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <!-- Giá -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500 line-through ${
                originalPrice ? '' : 'hidden'
              }">
                ${originalPrice ? formatPrice(originalPrice) : ''}
              </span>
              <span class="text-base font-semibold text-red-600">
                ${formatPrice(price)}
              </span>
            </div>

            <!-- Số lượng & thành tiền & nút xóa -->
            <div class="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              <div class="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 btn-qty text-gray-500"
                  data-id="${item.id}"
                  data-new-qty="${quantity - 1}">
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value="${quantity}"
                  data-id="${item.id}"
                  class="w-10 text-center bg-transparent border-x border-gray-300 focus:outline-none text-sm font-semibold input-qty"
                />
                <button
                  type="button"
                  class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 btn-qty text-gray-500"
                  data-id="${item.id}"
                  data-new-qty="${quantity + 1}">
                  +
                </button>
              </div>

              <div class="text-right">
                <div class="text-xs text-gray-500">Thành tiền</div>
                <div class="text-sm font-semibold text-gray-900">
                  ${formatPrice(lineTotal)}
                </div>
              </div>

              <button
                type="button"
                class="text-red-500 text-xs font-medium hover:underline btn-remove flex items-center gap-1"
                data-id="${item.id}">
                <i class="fa-solid fa-trash"></i> Xóa
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

/**
 * Tính và hiển thị tóm tắt đơn hàng.
 * Không còn logic mã giảm giá – chỉ tính tạm tính, giảm giá = 0, phí ship, thành tiền.
 */
function renderCartSummary() {
  const summaryContainer = document.querySelector('#cart-summary');
  if (!summaryContainer) return;

  const checkboxes = document.querySelectorAll('.item-checkbox:checked');

  if (!checkboxes.length) {
    summaryContainer.innerHTML = `
      <h3 class="font-bold text-lg mb-4">Tóm tắt đơn hàng</h3>
      <p class="text-sm text-gray-500">Hãy chọn ít nhất một sản phẩm để đặt hàng.</p>
    `;
    return;
  }

  let subtotal = 0;
  let itemCount = 0;

  checkboxes.forEach((cb) => {
    const price = parseInt(cb.dataset.price, 10) || 0;
    const qty = parseInt(cb.dataset.qty, 10) || 0;
    subtotal += price * qty;
    itemCount += qty;
  });

  // Logic ship mẫu: >= 2tr miễn phí, ngược lại 30k
  const shipping = 0;
  const discount = 0; // Không áp dụng mã giảm giá ở giỏ hàng
  const total = subtotal + shipping - discount;

  summaryContainer.innerHTML = `
    <h3 class="font-bold text-lg mb-4">Tóm tắt đơn hàng</h3>
    <div class="space-y-3 text-sm border-b border-gray-200 pb-4">
      <div class="flex justify-between">
        <span class="text-gray-500">Tạm tính (${itemCount} sản phẩm)</span>
        <span class="font-semibold">${formatPrice(subtotal)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Giảm giá</span>
        <span class="font-semibold text-green-600">- ${formatPrice(discount)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Phí vận chuyển</span>
        <span class="font-semibold">${
          shipping === 0 ? 'Miễn phí' : formatPrice(shipping)
        }</span>
      </div>
    </div>
    <div class="flex justify-between items-center mt-4">
      <span class="text-base font-semibold">Thành tiền</span>
      <span class="text-xl font-bold text-red-600">${formatPrice(total)}</span>
    </div>
    <a href="checkout.html"
       class="mt-4 block w-full text-center bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
      Tiến hành đặt hàng
    </a>
  `;
}

/**
 * Gắn event sau khi render list.
 */
function initCartEvents() {
  const listContainer = document.querySelector('#cart-items-list');
  if (!listContainer) return;

  // Checkbox chọn sản phẩm
  listContainer
    .querySelectorAll('.item-checkbox')
    .forEach((cb) => cb.addEventListener('change', renderCartSummary));

  // Nút xóa
  listContainer
    .querySelectorAll('.btn-remove')
    .forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        await handleRemoveItem(id);
      });
    });

  // Nút +/- số lượng
  listContainer
    .querySelectorAll('.btn-qty')
    .forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const newQty = parseInt(e.currentTarget.dataset.newQty, 10) || 1;
        await handleUpdateQuantity(id, newQty);
      });
    });

  // Nhập tay số lượng với debounce
  const debouncedUpdate = debounce(handleUpdateQuantity, 500);
  listContainer
    .querySelectorAll('.input-qty')
    .forEach((input) => {
      input.addEventListener('input', (e) => {
        const id = e.currentTarget.dataset.id;
        const val = parseInt(e.currentTarget.value, 10) || 1;
        debouncedUpdate(id, val);
      });
    });
}

/**
 * Xóa 1 item trong giỏ.
 */
async function handleRemoveItem(id) {
  try {
    await api.removeCartItem(id);
    showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'success');
    syncCartBadge();
    await loadAndRenderCart();
  } catch (err) {
    console.error(err);
    showToast('Lỗi xóa sản phẩm', 'error');
  }
}

/**
 * Cập nhật số lượng.
 */
async function handleUpdateQuantity(id, qty) {
  if (!id) return;
  if (qty < 1) qty = 1;

  try {
    await api.updateCartItem(id, qty);
    syncCartBadge();
    await loadAndRenderCart();
  } catch (err) {
    console.error(err);
    showToast('Lỗi cập nhật số lượng', 'error');
  }
}

/**
 * Hàm chính: load giỏ hàng từ API và render.
 */
export async function loadAndRenderCart() {
  const listContainer = document.querySelector('#cart-items-list');
  const summaryContainer = document.querySelector('#cart-summary');

  if (!listContainer || !summaryContainer) return;

  const token = getToken();
  if (!token) {
    renderEmptyCart(true);
    return;
  }

  listContainer.innerHTML =
    '<p class="p-6 text-gray-500">Đang tải giỏ hàng...</p>';

  try {
    const res = await api.getCart();
    cartItems = res.data || [];

    if (!cartItems.length) {
      renderEmptyCart(false);
      return;
    }

    renderCartItems();
    renderCartSummary();
    initCartEvents();
  } catch (err) {
    console.error(err);
    listContainer.innerHTML =
      '<p class="p-6 text-red-500 text-center">Lỗi tải giỏ hàng. Vui lòng thử lại.</p>';
  }
}

// Tự động load khi vào trang giỏ hàng
document.addEventListener('DOMContentLoaded', loadAndRenderCart);
