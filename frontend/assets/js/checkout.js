// assets/js/checkout.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { formatPrice, showToast } from './utils/common.js';

let checkoutItems = [];
let savedAddresses = [];
let isUsingNewAddress = false;
const API_PROVINCE_URL = 'https://provinces.open-api.vn/api';

// --- Helper: Hiển thị thông tin biến thể ---
function getVariantText(item) {
    let parts = [];
    const color = item.variant_color || item.selected_color;
    if (color) parts.push(`Màu: ${color}`);

    if (item.variant_attributes) {
        try {
            const attrs = typeof item.variant_attributes === 'string' 
                ? JSON.parse(item.variant_attributes) 
                : item.variant_attributes;
            
            Object.entries(attrs).forEach(([k, v]) => {
                if (k !== 'color' && v) parts.push(v);
            });
        } catch(e) {}
    }
    return parts.join(' | ');
}

// --- Load trang thanh toán ---
async function loadAndRenderCheckout() {
  const summaryEl = document.querySelector('#checkout-summary');
  if (!summaryEl) return;

  const token = getToken();
  if (!token) { window.location.href = 'login.html'; return; }

  // Lấy danh sách ID giỏ hàng (Cart Item IDs)
  const selectedIdsJson = localStorage.getItem('checkout_selected_items');
  if (!selectedIdsJson) {
    showToast('Chưa chọn sản phẩm nào', 'error');
    setTimeout(() => window.location.href = 'cart.html', 1000);
    return;
  }
  
  const selectedCartItemIds = JSON.parse(selectedIdsJson);

  try {
    const res = await api.getCart();
    const allCartItems = res.data || [];
    
    // 🔥 LỌC THEO CART ITEM ID (item.id) thay vì product_id để phân biệt biến thể
    checkoutItems = allCartItems.filter(item => selectedCartItemIds.includes(item.id));

    if (checkoutItems.length === 0) {
      showToast('Sản phẩm đã chọn không còn trong giỏ', 'error');
      setTimeout(() => window.location.href = 'cart.html', 1000);
      return;
    }

    let total = 0;
    summaryEl.innerHTML = `
      <div class="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        ${checkoutItems.map((item) => {
            // Lấy thông tin chính xác (ưu tiên biến thể)
            const displayPrice = item.variant_price || item.base_price || item.price || 0;
            const displayImage = item.variant_image || item.product_image || item.image || 'https://via.placeholder.com/60';
            const displayTitle = item.product_title || item.title || 'Sản phẩm';
            
            const lineTotal = displayPrice * item.quantity;
            total += lineTotal;

            const variantInfo = getVariantText(item);

            return `
            <div class="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
              <div class="w-16 h-16 rounded border border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden">
                  <img src="${displayImage}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.src='https://via.placeholder.com/60'"/>
              </div>
              <div class="flex-1 text-sm">
                <p class="font-bold text-gray-800 line-clamp-2">${displayTitle}</p>
                ${variantInfo ? `<p class="text-xs text-gray-500 mt-1 bg-gray-100 px-2 py-0.5 rounded w-fit">${variantInfo}</p>` : ''}
                <div class="flex justify-between items-center mt-2">
                  <span class="text-gray-500 text-xs">SL: x${item.quantity}</span>
                  <span class="font-bold text-blue-600">${formatPrice(lineTotal)}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
      </div>
      
      <div class="border-t border-gray-200 pt-4 space-y-2">
        <div class="flex justify-between text-sm text-gray-600">
          <span>Tạm tính</span>
          <span>${formatPrice(total)}</span>
        </div>
        <div class="flex justify-between text-sm text-gray-600">
          <span>Phí vận chuyển</span>
          <span class="text-green-600 font-medium">Miễn phí</span>
        </div>
        <div class="flex justify-between text-base font-bold text-gray-900 border-t border-dashed border-gray-300 pt-3 mt-2">
          <span>Tổng thanh toán</span>
          <span class="text-red-600 text-xl">${formatPrice(total)}</span>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    showToast('Lỗi tải đơn hàng', 'error');
  }
}

// --- Submit Đơn Hàng ---
async function handleSubmitOrder(e) {
  e.preventDefault();
  const btn = document.querySelector('#btn-submit-order');
  
  if (checkoutItems.length === 0) return;

  const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

  // 🔥 TẠO PAYLOAD CHI TIẾT
  // Gửi đầy đủ thông tin để Backend không cần query lại và không bị lỗi thiếu title
  const itemsPayload = checkoutItems.map(item => ({
      id: item.id, // ID dòng giỏ hàng (để xóa)
      product_id: item.product_id,
      product_variant_id: item.product_variant_id, 
      quantity: item.quantity,
      
      // Gửi tiêu đề để tránh lỗi 'Column product_title cannot be null'
      title: item.product_title || item.title || 'Sản phẩm',
      
      price: item.variant_price || item.base_price || item.price,
      variant_color: item.variant_color || item.selected_color,
      variant_attributes: item.variant_attributes
  }));

  let payload = { 
    items: itemsPayload,
    payment_method: paymentMethod
  };

  // Logic địa chỉ (Mới hoặc có sẵn)
  if (isUsingNewAddress) {
    const name = document.querySelector('#new-name').value.trim();
    const phone = document.querySelector('#new-phone').value.trim();
    const province = document.querySelector('#new-province').value;
    const district = document.querySelector('#new-district').value;
    const ward = document.querySelector('#new-ward').value;
    const street = document.querySelector('#new-street').value.trim();

    if (!name || !phone || !province || !district || !ward || !street) {
      showToast('Vui lòng điền đầy đủ thông tin giao hàng', 'error');
      return;
    }
    const addressData = { full_name: name, phone, province, district, ward, street_address: street };

    try {
      btn.disabled = true;
      btn.textContent = 'Đang lưu địa chỉ...';
      await api.addAddress(addressData);
      payload.name = name;
      payload.phone = phone;
      payload.address = `${street}, ${ward}, ${district}, ${province}`;
    } catch(err) {
      btn.disabled = false;
      btn.textContent = 'Đặt hàng';
      showToast('Lỗi lưu địa chỉ: ' + err.message, 'error');
      return;
    }
  } else {
    const checkedRadio = document.querySelector('input[name="shipping_address"]:checked');
    if (!checkedRadio) {
      showToast('Vui lòng chọn địa chỉ giao hàng', 'error');
      return;
    }
    const addrId = checkedRadio.value;
    const addr = savedAddresses.find(a => a.id == addrId);
    if (!addr) return;

    payload.name = addr.full_name;
    payload.phone = addr.phone;
    payload.address = `${addr.street_address}, ${addr.ward}, ${addr.district}, ${addr.province}`;
  }

  // Gọi API tạo đơn
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang xử lý...';

    const res = await api.createOrder(payload);
    
    // Xóa cache checkout & update badge
    localStorage.removeItem('checkout_selected_items');
    syncCartBadge();

    if (res.payment_url) {
       showToast('Đang chuyển sang cổng thanh toán MoMo...', 'info');
       setTimeout(() => { window.location.href = res.payment_url; }, 1500);
       return;
    }

    showToast('Đặt hàng thành công!', 'success');
    setTimeout(() => window.location.href = `order-detail.html?id=${res.order_id}`, 1500);

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Đặt hàng thất bại', 'error');
    btn.disabled = false;
    btn.textContent = 'Đặt hàng';
  }
}

// ... (Giữ nguyên các hàm loadAddresses, initLocationSelects, initPaymentMethodEvents)
// Đảm bảo copy các hàm phụ trợ loadAddresses, initLocationSelects... từ file cũ vào đây nếu chưa có
// Hoặc giữ nguyên phần đó trong file của bạn.

// --- MAIN INIT ---
async function loadAddresses() {
  const container = document.querySelector('#saved-addresses');
  if (!container) return;
  try {
    const res = await api.getAddresses();
    savedAddresses = res.data || [];
    if (savedAddresses.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-500 italic">Bạn chưa có địa chỉ nào.</p>`;
      toggleNewAddressForm(true);
      return;
    }
    container.innerHTML = savedAddresses.map((addr, index) => {
      const isChecked = addr.is_default ? 'checked' : (index === 0 ? 'checked' : '');
      return `<label class="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition"><input type="radio" name="shipping_address" value="${addr.id}" class="mt-1 w-4 h-4 text-blue-600" ${isChecked}><div class="text-sm"><p class="font-bold text-gray-900">${addr.full_name} | ${addr.phone}</p><p class="text-gray-600">${addr.street_address}, ${addr.ward}, ${addr.district}, ${addr.province}</p></div></label>`;
    }).join('');
    container.querySelectorAll('input[name="shipping_address"]').forEach(r => r.addEventListener('change', () => toggleNewAddressForm(false)));
  } catch (err) { console.error(err); }
}

function toggleNewAddressForm(show) {
  const form = document.querySelector('#new-address-form');
  const radios = document.querySelectorAll('input[name="shipping_address"]');
  isUsingNewAddress = show;
  if (show) { form.classList.remove('hidden'); radios.forEach(r => r.checked = false); } 
  else { form.classList.add('hidden'); }
}

async function initLocationSelects() {
  const p = document.querySelector('#new-province'), d = document.querySelector('#new-district'), w = document.querySelector('#new-ward');
  if(!p) return;
  try { const res = await fetch(`${API_PROVINCE_URL}/p/`); const data = await res.json(); populateSelect(p, data, 'Tỉnh/TP'); } catch(e){}
  p.addEventListener('change', async (e) => {
      const code = e.target.options[e.target.selectedIndex]?.dataset.code;
      w.innerHTML='<option value="">-- Xã --</option>'; w.disabled=true;
      if(code){ const res=await fetch(`${API_PROVINCE_URL}/p/${code}?depth=2`); const data=await res.json(); populateSelect(d, data.districts, 'Huyện'); } 
      else { d.innerHTML='<option value="">-- Huyện --</option>'; d.disabled=true; }
  });
  d.addEventListener('change', async (e) => {
      const code = e.target.options[e.target.selectedIndex]?.dataset.code;
      if(code){ const res=await fetch(`${API_PROVINCE_URL}/d/${code}?depth=2`); const data=await res.json(); populateSelect(w, data.wards, 'Xã'); }
      else { w.innerHTML='<option value="">-- Xã --</option>'; w.disabled=true; }
  });
}
function populateSelect(el, data, placeholder) {
  el.innerHTML = `<option value="">-- ${placeholder} --</option>`; el.disabled = false;
  data.forEach(i => { const opt = document.createElement('option'); opt.value = i.name; opt.textContent = i.name; opt.dataset.code = i.code; el.appendChild(opt); });
}
function initPaymentMethodEvents() {
    const radios = document.querySelectorAll('input[name="payment_method"]');
    const bankInfo = document.getElementById('banking-info');
    radios.forEach(r => r.addEventListener('change', (e) => {
        if(e.target.value === 'banking') bankInfo?.classList.remove('hidden'); else bankInfo?.classList.add('hidden');
    }));
}

function initCheckout() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;
  loadAndRenderCheckout();
  loadAddresses();
  initLocationSelects();
  initPaymentMethodEvents();
  document.querySelector('#btn-toggle-new-address')?.addEventListener('click', () => toggleNewAddressForm(true));
  form.addEventListener('submit', handleSubmitOrder);
}

document.addEventListener('DOMContentLoaded', initCheckout);