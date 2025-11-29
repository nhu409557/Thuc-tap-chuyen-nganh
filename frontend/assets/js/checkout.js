// assets/js/checkout.js

import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
// 👇 Import từ common
import { formatPrice, showToast } from './utils/common.js';

let checkoutItems = [];
let savedAddresses = [];
let isUsingNewAddress = false;
const API_PROVINCE_URL = 'https://provinces.open-api.vn/api';

async function loadAndRenderCheckout() {
  const summaryEl = document.querySelector('#checkout-summary');
  if (!summaryEl) return;

  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const selectedIdsJson = localStorage.getItem('checkout_selected_items');
  if (!selectedIdsJson) {
    showToast('Chưa chọn sản phẩm nào', 'error');
    setTimeout(() => window.location.href = 'cart.html', 1000);
    return;
  }
  const selectedIds = JSON.parse(selectedIdsJson);

  try {
    const res = await api.getCart();
    const allCartItems = res.data || [];
    checkoutItems = allCartItems.filter(item => selectedIds.includes(item.product_id));

    if (checkoutItems.length === 0) {
      showToast('Sản phẩm đã chọn không còn trong giỏ', 'error');
      setTimeout(() => window.location.href = 'cart.html', 1000);
      return;
    }

    let total = 0;
    summaryEl.innerHTML = `
      <div class="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
        ${checkoutItems.map((item) => {
            const line = item.price * item.quantity;
            total += line;
            return `
            <div class="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
              <img src="${item.image}" class="w-12 h-12 rounded object-cover border border-gray-200" />
              <div class="flex-1 text-sm">
                <p class="font-medium text-gray-800 line-clamp-2">${item.title}</p>
                <div class="flex justify-between text-gray-500 mt-1">
                  <span>x${item.quantity}</span>
                  <span class="font-medium text-blue-600">${formatPrice(line)}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
      </div>
      <div class="border-t border-gray-200 pt-3">
        <div class="flex justify-between text-sm text-gray-600 mb-2">
          <span>Tạm tính</span>
          <span>${formatPrice(total)}</span>
        </div>
        <div class="flex justify-between text-sm text-gray-600 mb-4">
          <span>Phí vận chuyển</span>
          <span class="text-green-600">Miễn phí</span>
        </div>
        <div class="flex justify-between text-base font-bold text-gray-900 border-t border-dashed border-gray-300 pt-3">
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

async function loadAddresses() {
  const container = document.querySelector('#saved-addresses');
  if (!container) return;

  try {
    const res = await api.getAddresses();
    savedAddresses = res.data || [];

    if (savedAddresses.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-500 italic">Bạn chưa có địa chỉ nào. Vui lòng thêm mới.</p>`;
      toggleNewAddressForm(true);
      return;
    }

    container.innerHTML = savedAddresses.map((addr, index) => {
      const isChecked = addr.is_default ? 'checked' : (index === 0 ? 'checked' : '');
      const fullAddr = `${addr.street_address}, ${addr.ward}, ${addr.district}, ${addr.province}`;
      
      return `
        <label class="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition">
          <input type="radio" name="shipping_address" value="${addr.id}" class="mt-1 w-4 h-4 text-blue-600" ${isChecked}>
          <div class="text-sm">
            <p class="font-bold text-gray-900">
              ${addr.full_name} 
              <span class="font-normal text-gray-500 mx-2">|</span> 
              ${addr.phone}
              ${addr.is_default ? '<span class="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase">Mặc định</span>' : ''}
            </p>
            <p class="text-gray-600 mt-1">${fullAddr}</p>
          </div>
        </label>
      `;
    }).join('');

    container.querySelectorAll('input[name="shipping_address"]').forEach(radio => {
      radio.addEventListener('change', () => toggleNewAddressForm(false));
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="text-sm text-red-500">Lỗi tải địa chỉ.</p>`;
  }
}

function toggleNewAddressForm(show) {
  const form = document.querySelector('#new-address-form');
  const radios = document.querySelectorAll('input[name="shipping_address"]');
  isUsingNewAddress = show;
  if (show) {
    form.classList.remove('hidden');
    radios.forEach(r => r.checked = false);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    form.classList.add('hidden');
  }
}

async function initLocationSelects() {
  const provinceSelect = document.querySelector('#new-province');
  const districtSelect = document.querySelector('#new-district');
  const wardSelect = document.querySelector('#new-ward');
  if (!provinceSelect) return;

  try {
    const res = await fetch(`${API_PROVINCE_URL}/p/`);
    const data = await res.json();
    populateSelect(provinceSelect, data, 'Chọn Tỉnh/Thành');
  } catch(e) {}

  provinceSelect.addEventListener('change', async (e) => {
    const code = e.target.options[e.target.selectedIndex]?.dataset.code;
    wardSelect.innerHTML = '<option value="">-- Chọn Xã --</option>';
    wardSelect.disabled = true;
    if (code) {
      const res = await fetch(`${API_PROVINCE_URL}/p/${code}?depth=2`);
      const data = await res.json();
      populateSelect(districtSelect, data.districts, 'Chọn Huyện');
    } else {
      districtSelect.innerHTML = '<option value="">-- Chọn Huyện --</option>';
      districtSelect.disabled = true;
    }
  });

  districtSelect.addEventListener('change', async (e) => {
    const code = e.target.options[e.target.selectedIndex]?.dataset.code;
    if (code) {
      const res = await fetch(`${API_PROVINCE_URL}/d/${code}?depth=2`);
      const data = await res.json();
      populateSelect(wardSelect, data.wards, 'Chọn Xã');
    } else {
      wardSelect.innerHTML = '<option value="">-- Chọn Xã --</option>';
      wardSelect.disabled = true;
    }
  });
}

function populateSelect(el, data, placeholder) {
  el.innerHTML = `<option value="">-- ${placeholder} --</option>`;
  el.disabled = false;
  data.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    opt.dataset.code = item.code;
    el.appendChild(opt);
  });
}

function initPaymentMethodEvents() {
  const radios = document.querySelectorAll('input[name="payment_method"]');
  const bankInfo = document.getElementById('banking-info');

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'banking') {
        bankInfo.classList.remove('hidden');
      } else {
        bankInfo.classList.add('hidden');
      }
    });
  });
}

async function handleSubmitOrder(e) {
  e.preventDefault();
  const btn = document.querySelector('#btn-submit-order');
  
  const selectedProductIds = checkoutItems.map(item => item.product_id);
  if (!selectedProductIds.length) return;

  const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

  let payload = { 
    selected_products: selectedProductIds,
    payment_method: paymentMethod
  };

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

  try {
    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';

    const res = await api.createOrder(payload);
    
    localStorage.removeItem('checkout_selected_items');
    syncCartBadge();

    if (res.payment_url) {
       showToast('Đang chuyển sang cổng thanh toán MoMo...', 'info');
       setTimeout(() => {
           window.location.href = res.payment_url;
       }, 1500);
       return;
    }

    if (paymentMethod === 'banking') {
      showToast('Đặt hàng thành công! Vui lòng chuyển khoản.', 'success');
      setTimeout(() => window.location.href = 'account.html', 2000); 
    } else {
      showToast('Đặt hàng thành công!', 'success');
      setTimeout(() => window.location.href = 'account.html', 1500);
    }

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Đặt hàng thất bại', 'error');
    btn.disabled = false;
    btn.textContent = 'Đặt hàng';
  }
}

function initCheckout() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;

  loadAndRenderCheckout();
  loadAddresses();
  initLocationSelects();
  initPaymentMethodEvents();

  document.querySelector('#btn-toggle-new-address')?.addEventListener('click', () => {
    toggleNewAddressForm(true);
  });

  form.addEventListener('submit', handleSubmitOrder);
}

document.addEventListener('DOMContentLoaded', initCheckout);