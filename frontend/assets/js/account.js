// assets/js/account.js

import { api } from './api.js';
import { getToken, removeToken } from './utils/storage.js';
import { showToast } from './ui/toast.js';
import { syncCartBadge } from './main.js';

// ... (Các hằng số API_PROVINCE_URL, ORDER_STATUS_MAP giữ nguyên) ...
const API_PROVINCE_URL = 'https://provinces.open-api.vn/api';
// ... (Hàm helper formatPrice giữ nguyên) ...
function formatPrice(vnd) {
  if (typeof vnd !== 'number') return vnd;
  return vnd.toLocaleString('vi-VN') + ' ₫';
}
// ... (Hàm checkMomoCallback giữ nguyên) ...
// ... (Hàm fetchProvinces, populateSelect giữ nguyên) ...
async function fetchProvinces() { const res = await fetch(`${API_PROVINCE_URL}/p/`); return res.json(); }
async function fetchDistricts(provinceCode) { const res = await fetch(`${API_PROVINCE_URL}/p/${provinceCode}?depth=2`); const data = await res.json(); return data.districts || []; }
async function fetchWards(districtCode) { const res = await fetch(`${API_PROVINCE_URL}/d/${districtCode}?depth=2`); const data = await res.json(); return data.wards || []; }
function populateSelect(selectEl, data, placeholder, preSelectedValue = '') { selectEl.innerHTML = `<option value="">-- ${placeholder} --</option>`; selectEl.disabled = false; for (const item of data) { const option = document.createElement('option'); option.value = item.name; option.textContent = item.name; option.dataset.code = item.code; if (item.name === preSelectedValue) option.selected = true; selectEl.appendChild(option); } }

const ORDER_STATUS_MAP = {
    'pending':    { label: 'Chờ xác nhận', color: 'text-yellow-700 bg-yellow-100 border-yellow-200' },
    'confirmed':  { label: 'Đã xác nhận',  color: 'text-blue-700 bg-blue-100 border-blue-200' },
    'shipping':   { label: 'Đang giao',    color: 'text-indigo-700 bg-indigo-100 border-indigo-200' },
    'delivered':  { label: 'Giao thành công', color: 'text-green-700 bg-green-100 border-green-200' },
    'cancelled':  { label: 'Đã hủy',       color: 'text-red-700 bg-red-100 border-red-200' }
};
async function checkMomoCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('partnerCode')) return;
  const resultCode = urlParams.get('resultCode');
  const message = urlParams.get('message');
  const fullOrderId = urlParams.get('orderId'); 
  const orderId = fullOrderId ? fullOrderId.split('_').pop() : null;
  window.history.replaceState({}, document.title, window.location.pathname);
  if (resultCode === '0') {
    if (orderId) { try { await api.confirmOrderPayment(orderId); showToast('Thanh toán thành công!', 'success'); } catch (err) { console.error(err); } }
    setTimeout(() => { const orderTabBtn = document.querySelector('button[data-tab="orders"]'); if (orderTabBtn) orderTabBtn.click(); loadOrders(); }, 500);
  } else {
    const msg = decodeURIComponent(message || 'Giao dịch thất bại'); showToast('Thanh toán thất bại: ' + msg, 'error');
    if (orderId) { try { showToast('Đang khôi phục giỏ hàng...', 'info'); await api.restoreOrderToCart(orderId); await syncCartBadge(); setTimeout(() => { window.location.href = 'cart.html'; }, 1500); } catch (err) { console.error('Lỗi khôi phục giỏ:', err); } }
  }
}
function renderAddressCard(addr) {
  const fullAddress = `${addr.street_address}, ${addr.ward}, ${addr.district}, ${addr.province}`;
  return `
    <div class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mb-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-bold text-gray-800">${addr.full_name}
            ${addr.is_default ? '<span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Mặc định</span>' : ''}
          </p>
          <p class="text-sm text-gray-600 mt-1">${addr.phone}</p>
          <p class="text-sm text-gray-600">${fullAddress}</p>
        </div>
        <div class="flex gap-3">
          <button class="text-xs text-blue-600 hover:underline btn-edit-address" data-id="${addr.id}">Sửa</button>
          <button class="text-xs text-red-600 hover:underline btn-delete-address" data-id="${addr.id}">Xóa</button>
        </div>
      </div>
      ${!addr.is_default ? `
        <button class="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition btn-set-default" data-id="${addr.id}">
          Đặt làm mặc định
        </button>` : ''}
    </div>
  `;
}
function renderWishlistProductCard(item) {
  return `
    <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col hover:shadow-md transition relative group">
      <a href="product.html?id=${item.product_id}" class="block mb-3">
        <img src="${item.image}" class="w-full h-40 object-contain" alt="${item.title}" />
      </a>
      <h3 class="font-semibold text-sm text-gray-800 line-clamp-2 mb-2 h-10">${item.title}</h3>
      <div class="mt-auto">
        <div class="font-bold text-blue-600 mb-3">${formatPrice(item.price)}</div>
        <div class="flex gap-2">
          <button class="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs hover:bg-blue-700 transition btn-add-to-cart" data-product-id="${item.product_id}">Thêm vào giỏ</button>
          <button class="px-3 py-1.5 bg-gray-100 text-red-500 rounded hover:bg-red-50 transition btn-remove-wishlist" data-wishlist-id="${item.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// A. Hồ Sơ
async function loadProfile() {
  const nameInput = document.querySelector('#account-name');
  const emailInput = document.querySelector('#account-email');
  if(!nameInput) return;

  try {
    const user = await api.me();
    nameInput.value = user.name;
    emailInput.value = user.email;
  } catch (err) { console.error(err); }
}

// B. Đơn Hàng
async function loadOrders() {
  const container = document.querySelector('#orders-list');
  if (!container) return;
  container.innerHTML = `<p class="text-sm text-gray-500">Đang tải đơn hàng...</p>`;

  try {
    const res = await api.getOrders();
    const orders = res.data || [];

    if (!orders.length) {
      container.innerHTML = `<p class="text-sm text-gray-500 italic">Bạn chưa có đơn hàng nào.</p>`;
      return;
    }

    container.innerHTML = orders.map((o) => {
        const statusKey = (o.status || 'pending').toLowerCase();
        const statusObj = ORDER_STATUS_MAP[statusKey] || ORDER_STATUS_MAP['pending'];
        const isPaid = o.payment_status === 'Paid';
        const payStatusHtml = isPaid 
            ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-green-600 border border-green-200 bg-green-50 px-2 py-0.5 rounded"><i class="fa-solid fa-check"></i> Đã thanh toán</span>`
            : `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500 border border-gray-300 bg-gray-50 px-2 py-0.5 rounded">Chưa thanh toán</span>`;

        let methodText = 'COD';
        if (o.payment_method === 'momo') methodText = 'MoMo';
        if (o.payment_method === 'banking') methodText = 'Chuyển khoản';

        return `
        <a href="order-detail.html?id=${o.id}" class="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition mb-4 group">
          <div class="flex justify-between items-start mb-3">
            <div class="space-y-1">
               <div class="flex items-center gap-2">
                   <span class="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition">#${o.id}</span>
                   <span class="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase font-bold tracking-wide">${methodText}</span>
               </div>
               <div>${payStatusHtml}</div>
            </div>
            
            <span class="text-xs font-semibold px-3 py-1 rounded-full border ${statusObj.color}">
                ${statusObj.label}
            </span>
          </div>
          <div class="flex justify-between text-sm text-gray-600 pt-3 border-t border-gray-100">
            <span>Ngày đặt: ${new Date(o.created_at).toLocaleDateString('vi-VN')}</span>
            <span class="font-bold text-blue-600 text-base">${formatPrice(o.total_amount)}</span>
          </div>
        </a>
      `}).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500">Lỗi tải đơn hàng.</p>`;
  }
}

// C. Yêu Thích
async function loadWishlist() {
  const container = document.querySelector('#wishlist-grid');
  if (!container) return;
  try {
    const res = await api.getWishlist();
    const items = res.data || [];
    if (!items.length) {
      container.innerHTML = `<p class="col-span-full text-sm text-gray-500 italic">Danh sách yêu thích trống.</p>`;
      return;
    }
    container.innerHTML = items.map(renderWishlistProductCard).join('');
    initWishlistEvents(); 
  } catch (err) { container.innerHTML = `<p class="col-span-full text-sm text-red-500">Lỗi tải danh sách yêu thích.</p>`; }
}

// D. Địa Chỉ
async function loadAddresses() {
  const container = document.querySelector('#address-list');
  if (!container) return;
  try {
    const res = await api.getAddresses();
    const addresses = res.data || [];
    if (!addresses.length) {
      container.innerHTML = `<p class="text-sm text-gray-500 italic">Bạn chưa lưu địa chỉ nào.</p>`;
    } else {
      container.innerHTML = addresses.map(renderAddressCard).join('');
    }
    attachDynamicAddressEvents(addresses); 
  } catch (err) { container.innerHTML = `<p class="text-sm text-red-500">Lỗi tải địa chỉ.</p>`; }
}

function initWishlistEvents() {
  const container = document.querySelector('#wishlist-grid');
  if (!container) return;
  container.querySelectorAll('.btn-remove-wishlist').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.wishlistId;
      try { await api.removeWishlist(id); showToast('Đã xóa', 'default'); loadWishlist(); } 
      catch (err) { showToast('Lỗi xóa', 'error'); }
    });
  });
  container.querySelectorAll('.btn-add-to-cart').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.productId;
      try { await api.addToCart(id, 1); showToast('Đã thêm vào giỏ', 'success'); syncCartBadge(); } 
      catch (err) { showToast('Lỗi thêm giỏ', 'error'); }
    });
  });
}

function initAddressForm() {
  const formContainer = document.querySelector('#address-form');
  const showFormBtn = document.querySelector('#btn-show-add-address-form');
  const cancelBtn = document.querySelector('#btn-cancel-edit-address');
  const formTitle = document.querySelector('#address-form-title');
  
  const idInput = document.querySelector('#address-id');
  const nameInput = document.querySelector('#address-full_name');
  const phoneInput = document.querySelector('#address-phone');
  const streetInput = document.querySelector('#address-street_address');
  const provinceSelect = document.querySelector('#address-province');
  const districtSelect = document.querySelector('#address-district');
  const wardSelect = document.querySelector('#address-ward');
  
  if (!formContainer || !showFormBtn) return;

  (async () => {
    try {
      const provinces = await fetchProvinces();
      populateSelect(provinceSelect, provinces, 'Chọn Tỉnh/Thành phố');
    } catch (e) {}
  })();

  provinceSelect.addEventListener('change', async (e) => {
    const code = e.target.options[e.target.selectedIndex]?.dataset.code;
    wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>'; wardSelect.disabled = true;
    if (code) {
      const districts = await fetchDistricts(code);
      populateSelect(districtSelect, districts, 'Chọn Quận/Huyện');
    } else {
      districtSelect.innerHTML = '<option value="">-- Chọn Quận/Huyện --</option>'; districtSelect.disabled = true;
    }
  });

  districtSelect.addEventListener('change', async (e) => {
    const code = e.target.options[e.target.selectedIndex]?.dataset.code;
    if (code) {
      const wards = await fetchWards(code);
      populateSelect(wardSelect, wards, 'Chọn Phường/Xã');
    } else {
      wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>'; wardSelect.disabled = true;
    }
  });

  showFormBtn.addEventListener('click', () => {
    formTitle.textContent = 'Thêm địa chỉ mới';
    idInput.value = ''; nameInput.value = ''; phoneInput.value = ''; streetInput.value = '';
    provinceSelect.value = ''; districtSelect.value = ''; wardSelect.value = '';
    districtSelect.disabled = true; wardSelect.disabled = true;
    formContainer.classList.remove('hidden');
    showFormBtn.classList.add('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    formContainer.classList.add('hidden');
    showFormBtn.classList.remove('hidden');
  });
  
  formContainer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      full_name: nameInput.value, phone: phoneInput.value,
      province: provinceSelect.value, district: districtSelect.value, ward: wardSelect.value,
      street_address: streetInput.value,
    };
    
    if (!data.full_name || !data.phone || !data.province || !data.street_address) {
      showToast('Vui lòng điền đủ thông tin', 'error'); return;
    }

    try {
      if (idInput.value) {
        await api.updateAddress(idInput.value, data);
        showToast('Cập nhật thành công', 'success');
      } else {
        await api.addAddress(data);
        showToast('Thêm mới thành công', 'success');
      }
      formContainer.classList.add('hidden');
      showFormBtn.classList.remove('hidden');
      loadAddresses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function attachDynamicAddressEvents(addresses) {
  const listContainer = document.querySelector('#address-list');
  if(!listContainer) return;
  listContainer.querySelectorAll('.btn-delete-address').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Xóa địa chỉ này?')) {
        try { await api.deleteAddress(btn.dataset.id); loadAddresses(); } 
        catch (e) { showToast('Lỗi xóa', 'error'); }
      }
    });
  });
  listContainer.querySelectorAll('.btn-edit-address').forEach(btn => {
    btn.addEventListener('click', async () => {
      const addr = addresses.find(a => a.id == btn.dataset.id);
      if (!addr) return;
      const form = document.querySelector('#address-form');
      document.querySelector('#address-form-title').textContent = 'Cập nhật địa chỉ';
      document.querySelector('#btn-show-add-address-form').classList.add('hidden');
      form.classList.remove('hidden');
      window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
      document.querySelector('#address-id').value = addr.id;
      document.querySelector('#address-full_name').value = addr.full_name;
      document.querySelector('#address-phone').value = addr.phone;
      document.querySelector('#address-street_address').value = addr.street_address;
      const provSelect = document.querySelector('#address-province');
      const distSelect = document.querySelector('#address-district');
      const wardSelect = document.querySelector('#address-ward');
      try {
        const provinces = await fetchProvinces();
        populateSelect(provSelect, provinces, 'Chọn Tỉnh', addr.province);
        const provCode = provSelect.options[provSelect.selectedIndex]?.dataset.code;
        if(provCode) {
            const districts = await fetchDistricts(provCode);
            populateSelect(distSelect, districts, 'Chọn Huyện', addr.district);
        }
        const distCode = distSelect.options[distSelect.selectedIndex]?.dataset.code;
        if(distCode) {
            const wards = await fetchWards(distCode);
            populateSelect(wardSelect, wards, 'Chọn Xã', addr.ward);
        }
      } catch(e) {}
    });
  });
  listContainer.querySelectorAll('.btn-set-default').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await api.setDefaultAddress(btn.dataset.id); loadAddresses(); }
      catch (e) { showToast('Lỗi', 'error'); }
    });
  });
}

// 4. TAB & LOGOUT
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'profile'; // Mặc định là profile

  const activateTab = (tabId) => {
      buttons.forEach(b => {
         // Reset style (thêm class hover, bỏ class active)
         b.className = `tab-btn w-full flex items-center gap-3 px-4 py-3 text-left font-medium transition hover:bg-gray-50 text-gray-700 border-l-4 border-transparent`;
         
         if(b.dataset.tab === tabId) {
             // Active style
             b.className = `tab-btn w-full flex items-center gap-3 px-4 py-3 text-left font-medium transition bg-blue-50 text-blue-600 border-l-4 border-blue-600`;
         }
      });

      contents.forEach(c => {
        if (c.id === `${tabId}-content`) c.classList.remove('hidden');
        else c.classList.add('hidden');
      });
  };

  // Init lần đầu
  activateTab(initialTab);

  // Gắn sự kiện click
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
      // Update URL không reload (optional)
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('tab', btn.dataset.tab);
      window.history.pushState({}, '', newUrl);
    });
  });
}

function initLogout() {
  document.querySelector('#btn-logout')?.addEventListener('click', () => {
    removeToken();
    window.location.href = 'index.html';
  });
}

// 👇 HÀM XỬ LÝ ĐỔI MẬT KHẨU (MỚI)
function initChangePassword() {
    const btnShow = document.querySelector('#btn-show-change-pw');
    const container = document.querySelector('#change-pw-container');
    const btnCancel = document.querySelector('#btn-cancel-change-pw');
    const form = document.querySelector('#change-password-form');

    if (!btnShow || !container || !form) return;

    // Mở Form
    btnShow.addEventListener('click', () => {
        container.classList.remove('hidden');
        btnShow.classList.add('hidden');
    });

    // Đóng Form
    btnCancel.addEventListener('click', () => {
        container.classList.add('hidden');
        btnShow.classList.remove('hidden');
        form.reset();
    });

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = form.querySelector('input[name="old_password"]').value;
        const newPass = form.querySelector('input[name="new_password"]').value;
        const confirmPass = form.querySelector('input[name="confirm_password"]').value;

        if (newPass !== confirmPass) {
            showToast('Mật khẩu xác nhận không khớp', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Đang xử lý...';

        try {
            await api.changePassword({
                old_password: oldPass,
                new_password: newPass,
                confirm_password: confirmPass
            });
            
            showToast('Đổi mật khẩu thành công!', 'success');
            
            // Reset & Đóng
            form.reset();
            container.classList.add('hidden');
            btnShow.classList.remove('hidden');

        } catch (err) {
            showToast(err.message || 'Lỗi đổi mật khẩu', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }

  checkMomoCallback();
  initTabs();
  initLogout();
  initAddressForm();
  
  // Gọi hàm xử lý đổi pass
  initChangePassword(); 
  
  loadProfile();
  loadOrders();
  loadWishlist();
  loadAddresses();
});