// assets/js/checkout.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { formatPrice, showToast } from './utils/common.js';

let checkoutItems = [];
let savedAddresses = [];
let isUsingNewAddress = false;
const API_PROVINCE_URL = 'https://provinces.open-api.vn/api';

// --- BIẾN MỚI CHO COUPON ---
let currentCoupon = null; 
let subtotalAmount = 0;   

// --- Helper: Hiển thị thông tin biến thể ---
function getVariantText(item) {
    let parts = [];
    const color = item.variant_color || item.selected_color;
    if (color) parts.push(color); // Chỉ hiện tên màu cho gọn

    if (item.variant_attributes) {
        try {
            const attrs = typeof item.variant_attributes === 'string' 
                ? JSON.parse(item.variant_attributes) 
                : item.variant_attributes;
            
            Object.entries(attrs).forEach(([k, v]) => {
                if (k !== 'color' && k !== 'color_code' && v) parts.push(v);
            });
        } catch(e) {}
    }
    return parts.join(' / ');
}

// --- Load trang thanh toán ---
async function loadAndRenderCheckout() {
  const summaryEl = document.querySelector('#checkout-summary');
  if (!summaryEl) return;

  const token = getToken();
  if (!token) { window.location.href = 'login.html'; return; }

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
    checkoutItems = allCartItems.filter(item => selectedCartItemIds.includes(item.id));

    if (checkoutItems.length === 0) {
      showToast('Sản phẩm đã chọn không còn trong giỏ', 'error');
      setTimeout(() => window.location.href = 'cart.html', 1000);
      return;
    }

    subtotalAmount = 0;

    const itemsHtml = checkoutItems.map((item) => {
        const displayPrice = item.variant_price || item.base_price || item.price || 0;
        const displayImage = item.variant_image || item.product_image || item.image || 'https://via.placeholder.com/60';
        const displayTitle = item.product_title || item.title || 'Sản phẩm';
        
        const lineTotal = displayPrice * item.quantity;
        subtotalAmount += lineTotal;

        const variantInfo = getVariantText(item);

        return `
        <div class="flex gap-3 border-b border-gray-100 pb-3 last:border-0 items-start">
          <div class="w-14 h-14 md:w-16 md:h-16 rounded border border-gray-200 bg-white flex-shrink-0 overflow-hidden p-1">
              <img src="${displayImage}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.src='https://via.placeholder.com/60'"/>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-gray-800 text-xs md:text-sm line-clamp-2 leading-snug">${displayTitle}</p>
            ${variantInfo ? `<p class="text-[10px] md:text-xs text-gray-500 mt-1 bg-gray-100 px-1.5 py-0.5 rounded w-fit truncate max-w-full">${variantInfo}</p>` : ''}
            <div class="flex justify-between items-center mt-1.5">
              <span class="text-gray-500 text-xs">x${item.quantity}</span>
              <span class="font-bold text-blue-600 text-xs md:text-sm">${formatPrice(lineTotal)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    summaryEl.innerHTML = `
      <div class="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar pr-1">
        ${itemsHtml}
      </div>
      
      <div class="border-t border-gray-200 pt-4 space-y-2">
        <div class="flex justify-between text-sm text-gray-600">
          <span>Tạm tính</span>
          <span>${formatPrice(subtotalAmount)}</span>
        </div>
        
        <div class="flex justify-between text-sm text-gray-600">
          <span>Phí vận chuyển</span>
          <span class="text-green-600 font-medium">Miễn phí</span>
        </div>

        <div id="row-discount" class="flex justify-between text-sm text-green-600 hidden">
           <span>Giảm giá <span id="lbl-coupon-code" class="font-bold text-[10px] bg-green-100 px-1 rounded ml-1 border border-green-200"></span></span>
           <span id="lbl-discount-amount">-0đ</span>
        </div>

        <div class="flex justify-between text-base font-bold text-gray-900 border-t border-dashed border-gray-300 pt-3 mt-2">
          <span>Tổng cộng</span>
          <span id="lbl-final-total" class="text-red-600 text-xl">${formatPrice(subtotalAmount)}</span>
        </div>
      </div>
    `;
    
    // Cập nhật giá lần đầu cho mobile sticky bar
    updateTotalUI();

  } catch (err) {
    console.error(err);
    showToast('Lỗi tải đơn hàng', 'error');
  }
}

// --- LOGIC COUPON ---
async function handleApplyCoupon() {
    const input = document.getElementById('coupon-code-input');
    const btn = document.getElementById('btn-apply-coupon');
    const msg = document.getElementById('coupon-message');
    const code = input.value.trim().toUpperCase();

    msg.classList.add('hidden');
    msg.className = 'text-xs mt-2 hidden';
    
    if (!code) {
        currentCoupon = null;
        updateTotalUI();
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        const res = await api.checkCoupon(code);
        
        currentCoupon = {
            code: code,
            discount: res.discount_amount
        };

        msg.textContent = `Đã dùng mã: -${formatPrice(res.discount_amount)}`;
        msg.className = 'text-xs mt-2 block text-green-600 font-medium';
        updateTotalUI();

    } catch (err) {
        currentCoupon = null;
        msg.textContent = err.message || 'Mã không hợp lệ';
        msg.className = 'text-xs mt-2 block text-red-500 font-medium';
        updateTotalUI();
    } finally {
        btn.disabled = false;
        btn.textContent = 'Áp dụng';
    }
}

function updateTotalUI() {
    const rowDiscount = document.getElementById('row-discount');
    const lblCode = document.getElementById('lbl-coupon-code');
    const lblDiscount = document.getElementById('lbl-discount-amount');
    const lblTotal = document.getElementById('lbl-final-total');
    const mobileTotal = document.getElementById('mobile-total-display'); // Mobile Sticky

    let discount = 0;

    if (currentCoupon) {
        discount = currentCoupon.discount;
        if(rowDiscount) rowDiscount.classList.remove('hidden');
        if(lblCode) lblCode.textContent = currentCoupon.code;
        if(lblDiscount) lblDiscount.textContent = `-${formatPrice(discount)}`;
    } else {
        if(rowDiscount) rowDiscount.classList.add('hidden');
    }

    let finalTotal = subtotalAmount - discount;
    if (finalTotal < 0) finalTotal = 0;
    
    const formattedTotal = formatPrice(finalTotal);
    if(lblTotal) lblTotal.textContent = formattedTotal;
    if(mobileTotal) mobileTotal.textContent = formattedTotal; // Update mobile
}

// --- Submit Đơn Hàng ---
async function handleSubmitOrder(e) {
  if(e) e.preventDefault(); // Prevent default form submit if triggered by form
  
  // Select both buttons to manage loading state
  const btnDesktop = document.querySelector('#btn-submit-order-desktop');
  const btnMobile = document.querySelector('#btn-submit-order-mobile');
  
  if (checkoutItems.length === 0) return;

  const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

  const itemsPayload = checkoutItems.map(item => ({
      id: item.id, 
      product_id: item.product_id,
      product_variant_id: item.product_variant_id, 
      quantity: item.quantity,
      title: item.product_title || item.title || 'Sản phẩm',
      price: item.variant_price || item.base_price || item.price,
      variant_color: item.variant_color || item.selected_color,
      variant_attributes: item.variant_attributes
  }));

  let payload = { 
    items: itemsPayload,
    payment_method: paymentMethod,
    coupon_code: currentCoupon ? currentCoupon.code : null 
  };

  // Logic địa chỉ
  if (isUsingNewAddress) {
    const name = document.querySelector('#new-name').value.trim();
    const phone = document.querySelector('#new-phone').value.trim();
    const province = document.querySelector('#new-province').value;
    const district = document.querySelector('#new-district').value;
    const ward = document.querySelector('#new-ward').value;
    const street = document.querySelector('#new-street').value.trim();

    if (!name || !phone || !province || !district || !ward || !street) {
      showToast('Vui lòng điền đầy đủ thông tin giao hàng', 'error');
      // Scroll to form on mobile
      document.getElementById('new-address-form').scrollIntoView({behavior: 'smooth'});
      return;
    }
    const addressData = { full_name: name, phone, province, district, ward, street_address: street };

    try {
      setLoading(true, 'Đang lưu ĐC...');
      await api.addAddress(addressData);
      payload.name = name;
      payload.phone = phone;
      payload.address = `${street}, ${ward}, ${district}, ${province}`;
    } catch(err) {
      setLoading(false);
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

  // Helper Loading state
  function setLoading(isLoading, text = 'Đang xử lý...') {
      if(btnDesktop) {
          btnDesktop.disabled = isLoading;
          btnDesktop.innerHTML = isLoading ? `<i class="fa-solid fa-circle-notch fa-spin"></i> ${text}` : 'Đặt hàng';
      }
      if(btnMobile) {
          btnMobile.disabled = isLoading;
          btnMobile.innerHTML = isLoading ? `<i class="fa-solid fa-circle-notch fa-spin"></i>` : 'Đặt hàng';
      }
  }

  // Gọi API tạo đơn
  try {
    setLoading(true);

    const res = await api.createOrder(payload);
    
    localStorage.removeItem('checkout_selected_items');
    syncCartBadge();

    if (res.payment_url) {
       showToast('Chuyển sang thanh toán...', 'info');
       setTimeout(() => { window.location.href = res.payment_url; }, 1000);
       return;
    }

    showToast('Đặt hàng thành công!', 'success');
    setTimeout(() => window.location.href = `order-detail.html?id=${res.order_id}`, 1000);

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Đặt hàng thất bại', 'error');
    setLoading(false);
  }
}

// ... (Các hàm loadAddresses, toggleNewAddressForm, initLocationSelects, populateSelect, initPaymentMethodEvents giữ nguyên như cũ)
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
        return `
        <label class="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition">
            <input type="radio" name="shipping_address" value="${addr.id}" class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 flex-shrink-0" ${isChecked}>
            <div class="text-sm">
                <p class="font-bold text-gray-900">${addr.full_name} <span class="font-normal text-gray-500 text-xs">| ${addr.phone}</span></p>
                <p class="text-gray-600 mt-0.5 leading-snug text-xs md:text-sm">${addr.street_address}, ${addr.ward}, ${addr.district}, ${addr.province}</p>
                ${addr.is_default ? '<span class="inline-block mt-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">Mặc định</span>' : ''}
            </div>
        </label>`;
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
  
  // Submit Form (Desktop)
  form.addEventListener('submit', handleSubmitOrder);
  
  // Submit Mobile Button
  document.getElementById('btn-submit-order-mobile')?.addEventListener('click', () => handleSubmitOrder(null));
  
  document.getElementById('btn-apply-coupon')?.addEventListener('click', handleApplyCoupon);
}

document.addEventListener('DOMContentLoaded', initCheckout);