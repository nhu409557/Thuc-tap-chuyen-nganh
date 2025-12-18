import { api } from './api.js';
import { getQueryParam } from './utils/url.js';
import { getToken } from './utils/storage.js';
import { formatPrice, showToast } from './utils/common.js';

// --- CẤU HÌNH ---
const BANK_CONFIG = {
  BANK_ID: 'Vietcombank',
  ACCOUNT_NO: '1019518414',
  TEMPLATE: 'compact'
};

const STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  shipping: { label: 'Đang giao', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  delivered: { label: 'Giao thành công', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800 border-red-200' },
  returned: { label: 'Đã hoàn trả', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'return_requested': { label: 'Đang yêu cầu trả hàng', color: 'bg-orange-100 text-orange-800 border-orange-200' }
};

const METHOD_MAP = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  banking: 'Chuyển khoản ngân hàng',
  momo: 'Ví điện tử MoMo'
};

let currentOrderItems = [];

function generateVietQR(amount, orderId) {
  const content = `DH${orderId}`;
  return `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-${BANK_CONFIG.TEMPLATE}.png?amount=${amount}&addInfo=${content}&accountName=TECHHUB`;
}

// ============================================================
// 1. HÀM LOAD CHI TIẾT ĐƠN HÀNG
// ============================================================
async function loadOrderDetail() {
  const contentEl = document.getElementById('order-detail-content');
  const loadingEl = document.getElementById('loading-state');
  const actionContainer = document.getElementById('order-actions-container');

  const id = getQueryParam('id');
  if (!id) {
    loadingEl.innerHTML = `<p class="text-red-500">Không tìm thấy mã đơn hàng.</p>`;
    return;
  }

  try {
    const order = await api.getOrder(id);
    currentOrderItems = order.items || [];
    
    const returnRequest = order.return_request; 
    const returnItemsMap = order.return_items_map || {};

    // --- 1.1 Render Header & Trạng thái ---
    document.getElementById('order-code').textContent = '#' + order.id;
    document.getElementById('order-date').textContent = new Date(order.created_at).toLocaleString('vi-VN');

    let displayStatusKey = (order.status || 'pending').toLowerCase();
    if (returnRequest && returnRequest.status === 'pending') {
        displayStatusKey = 'return_requested';
    } else if (order.status === 'Return Requested') {
        displayStatusKey = 'return_requested';
    }

    const statusConfig = STATUS_MAP[displayStatusKey] || { label: order.status, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    const badgeEl = document.getElementById('order-status-badge');
    badgeEl.textContent = statusConfig.label;
    badgeEl.className = `px-3 py-1 rounded-full text-sm font-bold border ${statusConfig.color}`;

    // --- [FIX] Trạng thái thanh toán ---
    const paymentStatusEl = document.getElementById('payment-status');
    const isPaid = order.payment_status === 'Paid';
    const isRefunded = order.payment_status === 'Refunded';
    
    if (isPaid) {
      paymentStatusEl.innerHTML = `<span class="text-green-600 flex items-center gap-1 justify-start md:justify-end"><i class="fa-solid fa-circle-check"></i> Đã thanh toán</span>`;
    } else if (isRefunded) {
      paymentStatusEl.innerHTML = `<span class="text-purple-600 flex items-center gap-1 justify-start md:justify-end font-bold"><i class="fa-solid fa-rotate-left"></i> Đã hoàn tiền</span>`;
    } else {
      paymentStatusEl.innerHTML = `<span class="text-gray-500 flex items-center gap-1 justify-start md:justify-end"><i class="fa-regular fa-clock"></i> Chưa thanh toán</span>`;
    }

    // --- 1.2 Render QR ---
    if (document.getElementById('dynamic-qr-section')) document.getElementById('dynamic-qr-section').remove();
    
    if (order.payment_method === 'banking' && !isPaid && !isRefunded && displayStatusKey !== 'cancelled') {
        const qrUrl = generateVietQR(order.total_amount, order.id);
        const qrHtml = `
            <div id="dynamic-qr-section" class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-center gap-4 md:gap-6 animate-fade-in shadow-sm">
                <div class="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-shrink-0">
                    <img src="${qrUrl}" alt="Mã QR" class="w-32 md:w-40 h-auto object-contain">
                </div>
                <div class="flex-1 space-y-2 text-sm text-gray-700 text-center md:text-left w-full">
                    <h4 class="font-bold text-blue-800 text-base md:text-lg mb-2"><i class="fa-solid fa-qrcode mr-1"></i> Quét mã để thanh toán</h4>
                    <p class="break-words">Ngân hàng: <b>${BANK_CONFIG.BANK_ID}</b></p>
                    <p class="break-words">STK: <b>${BANK_CONFIG.ACCOUNT_NO}</b></p>
                    <p>Số tiền: <span class="font-bold text-red-600 text-lg">${formatPrice(order.total_amount)}</span></p>
                    <p>Nội dung: <span class="font-mono font-bold bg-white px-2 py-1 rounded border border-gray-300 text-xs md:text-sm">${'DH' + order.id}</span></p>
                </div>
            </div>`;
        document.getElementById('order-detail-content').insertBefore(document.createRange().createContextualFragment(qrHtml), document.getElementById('order-detail-content').children[1]);
    }

    // --- 1.3 Xử lý Nút Hành Động ---
    actionContainer.innerHTML = ''; 

    // A. Nút Hủy
    if (displayStatusKey === 'pending') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'w-full md:w-auto text-xs bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 hover:text-red-700 font-semibold transition flex items-center justify-center gap-1';
      cancelBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Hủy đơn hàng';
      cancelBtn.onclick = async () => {
        if(confirm('Bạn chắc chắn muốn hủy đơn hàng này?')) {
            try { await api.cancelOrder(order.id); showToast('Đã hủy đơn', 'success'); setTimeout(()=>window.location.reload(), 1000); }
            catch(e) { showToast(e.message, 'error'); }
        }
      };
      actionContainer.appendChild(cancelBtn);
    }

    // B. Nút Trả Hàng
    if (returnRequest && returnRequest.status === 'pending') {
        const info = document.createElement('div');
        info.className = "w-full md:w-auto mt-2 text-xs text-orange-600 font-medium bg-orange-50 p-2 rounded border border-orange-200 flex items-center justify-center md:justify-start gap-2";
        info.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Yêu cầu trả hàng đang được xử lý...`;
        actionContainer.appendChild(info);
    } 
    else {
        const isDelivered = (order.status || '').toLowerCase() === 'delivered';
        const deliveredAt = order.delivered_at;
        
        let isWithin7Days = false;
        const checkDateStr = deliveredAt || order.updated_at; 
        
        if (isDelivered && checkDateStr) {
            const checkDate = new Date(checkDateStr);
            const now = new Date();
            const diffTime = Math.abs(now - checkDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays <= 7) isWithin7Days = true;
        }

        if (isPaid && isDelivered && isWithin7Days) {
             const returnBtn = document.createElement('button');
             returnBtn.className = 'w-full md:w-auto text-xs bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-lg hover:bg-orange-100 hover:text-orange-700 font-bold transition flex items-center justify-center gap-1 mt-2';
             returnBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Yêu cầu Trả hàng';
             returnBtn.onclick = () => window.openReturnModal(order.id);
             actionContainer.appendChild(returnBtn);
        }
    }

    // --- 1.4 Render Thông tin khách ---
    document.getElementById('customer-name').textContent = order.name;
    document.getElementById('customer-phone').textContent = order.phone;
    document.getElementById('customer-address').textContent = order.address;
    document.getElementById('payment-method').textContent = METHOD_MAP[(order.payment_method||'').toLowerCase()] || order.payment_method;

    // --- 1.5 Render Items (Responsive) ---
    const itemsContainer = document.getElementById('order-items-list');
    let subtotalCalculator = 0; 
    const canReview = ['delivered', 'completed'].includes((order.status||'').toLowerCase());

    if (currentOrderItems.length > 0) {
      itemsContainer.innerHTML = currentOrderItems.map((item) => {
          const itemTotal = item.price * item.quantity;
          subtotalCalculator += itemTotal;
          const imgUrl = item.variant_image || item.product_image || item.image || 'https://via.placeholder.com/60';

          let variantParts = [];
          if (item.selected_color) variantParts.push(`Màu: ${item.selected_color}`);
          const variantText = variantParts.join(' - ');
          const variantHtml = variantText ? `<span class="text-[10px] md:text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block">${variantText}</span>` : '';

          // Badge Trả Hàng
          const key = item.product_id + '_' + (item.product_variant_id || '');
          const returnInfo = returnItemsMap[key];
          
          let returnBadgeHtml = '';
          if (returnInfo) {
              const reasonText = returnInfo.reason === 'defective' ? 'Lỗi máy' : 'Khác';
              returnBadgeHtml = `
                  <div class="mt-2 text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded inline-flex items-center gap-1 w-fit">
                      <i class="fa-solid fa-rotate-left"></i> 
                      Trả: <b>${returnInfo.quantity}</b>
                  </div>
              `;
          }

          let reviewBtnHtml = '';
          if (canReview) {
             reviewBtnHtml = `<button class="btn-open-review mt-2 md:ml-2 inline-flex items-center gap-1 text-[10px] font-medium bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-200 hover:bg-yellow-100 transition" data-order-id="${order.id}" data-product-id="${item.product_id}" data-product-name="${item.product_title}"><i class="fa-solid fa-star text-yellow-500"></i> Đánh giá</button>`;
          }

          // HTML cho Mobile (Hiển thị SL x Đơn giá ngay dưới tên)
          const mobileQtyPrice = `
            <div class="block md:hidden text-xs text-gray-500 mt-1">
                ${item.quantity} x ${formatPrice(item.price)}
            </div>
          `;

          return `
            <tr class="bg-white border-b hover:bg-gray-50 transition">
                <td class="px-4 py-3 md:px-6 md:py-4">
                    <div class="flex items-start gap-3 md:gap-4">
                        <img src="${imgUrl}" class="w-12 h-12 md:w-14 md:h-14 object-contain rounded-lg border border-gray-200 bg-white mix-blend-multiply flex-shrink-0">
                        <div class="min-w-0">
                            <a href="product.html?id=${item.product_id}" class="font-bold text-gray-800 line-clamp-2 hover:text-blue-600 transition-colors text-xs md:text-sm">
                              ${item.product_title || item.title}
                            </a>
                            ${variantHtml}
                            ${mobileQtyPrice} <div class="flex flex-wrap gap-2 items-center">
                                ${returnBadgeHtml} ${reviewBtnHtml}   
                            </div>
                        </div>
                    </div>
                </td>
                <td class="hidden md:table-cell px-6 py-4 text-center text-gray-600 font-medium">x${item.quantity}</td>
                <td class="hidden md:table-cell px-6 py-4 text-right text-gray-600">${formatPrice(item.price)}</td>
                <td class="px-4 py-3 md:px-6 md:py-4 text-right font-bold text-gray-900 align-top md:align-middle text-sm">
                    ${formatPrice(itemTotal)}
                </td>
            </tr>`;
        }).join('');

        if(canReview) {
            document.querySelectorAll('.btn-open-review').forEach(btn => btn.addEventListener('click', openReviewModal));
        }
    } else {
        itemsContainer.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500 italic">Không có thông tin sản phẩm</td></tr>`;
        subtotalCalculator = order.total_amount;
    }

    // --- 1.6 Render Tổng tiền ---
    const discountVal = parseInt(order.discount_amount || 0);
    const finalTotal = parseInt(order.total_amount);
    const displaySubtotal = subtotalCalculator > 0 ? subtotalCalculator : (finalTotal + discountVal);

    document.getElementById('summary-subtotal').textContent = formatPrice(displaySubtotal);
    document.getElementById('summary-total').textContent = formatPrice(finalTotal);
    
    const discountRow = document.getElementById('summary-discount-row');
    if (discountVal > 0) {
        discountRow.classList.remove('hidden');
        document.getElementById('summary-discount-amount').textContent = `-${formatPrice(discountVal)}`;
        document.getElementById('summary-coupon-code').textContent = order.coupon_code || '';
    } else {
        discountRow.classList.add('hidden');
    }

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    loadingEl.innerHTML = `<p class="text-red-500 font-medium bg-red-50 p-4 rounded-lg inline-block border border-red-200">Lỗi tải đơn hàng: ${err.message}</p>`;
  }
}

// ============================================================
// 2. MODAL TRẢ HÀNG
// ============================================================

window.openReturnModal = (orderId) => {
    document.getElementById('return-order-id').value = orderId;
    const container = document.getElementById('return-items-container');
    container.innerHTML = ''; 
    document.getElementById('estimated-refund-total').textContent = '0đ';

    currentOrderItems.forEach(item => {
        const imgUrl = item.variant_image || item.product_image || item.image || 'https://via.placeholder.com/60';
        const price = parseInt(item.price);
        const maxQty = parseInt(item.quantity);
        const variantLabel = item.selected_color ? `(${item.selected_color})` : '';

        const row = document.createElement('div');
        row.className = "flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-xl bg-white return-item-row transition-all hover:shadow-sm";
        row.dataset.price = price;
        row.dataset.productId = item.product_id;
        row.dataset.variantId = item.product_variant_id || '';

        row.innerHTML = `
            <div class="flex gap-3">
                <div class="flex-shrink-0">
                    <img src="${imgUrl}" class="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg border border-gray-100 bg-gray-50 mix-blend-multiply">
                </div>
                <div class="flex-1 min-w-0 sm:hidden">
                     <h4 class="text-xs font-bold text-gray-800 line-clamp-2" title="${item.product_title}">${item.product_title} ${variantLabel}</h4>
                     <div class="text-[10px] text-gray-500 mt-1">
                        Mua: <b>${maxQty}</b> | Giá: <b>${formatPrice(price)}</b>
                     </div>
                </div>
            </div>

            <div class="flex-1 min-w-0">
                <div class="hidden sm:block">
                    <h4 class="text-sm font-bold text-gray-800 line-clamp-1" title="${item.product_title}">${item.product_title} ${variantLabel}</h4>
                    <div class="text-xs text-gray-500 mb-3 mt-1 flex gap-3">
                        <span class="bg-gray-100 px-1.5 py-0.5 rounded">Đã mua: <b>${maxQty}</b></span>
                        <span>Đơn giá: <b class="text-gray-700">${formatPrice(price)}</b></span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 mt-2 sm:mt-0">
                    <div>
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Số lượng trả</label>
                        <select class="return-qty-select w-full border border-gray-300 bg-gray-50 rounded-lg px-2 py-1.5 text-xs sm:text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer">
                            <option value="0">0 (Không trả)</option>
                            ${Array.from({length: maxQty}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Lý do trả</label>
                        <select class="return-reason-select w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer" disabled>
                            <option value="defective">Lỗi sản phẩm (Hoàn 100%)</option>
                            <option value="other">Đổi ý/Khác (Hoàn 80%)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });

    attachReturnCalculationEvents();
    document.getElementById('return-modal').classList.remove('hidden');
};

function attachReturnCalculationEvents() {
    const container = document.getElementById('return-items-container');
    const rows = container.querySelectorAll('.return-item-row');

    rows.forEach(row => {
        const qtySelect = row.querySelector('.return-qty-select');
        const reasonSelect = row.querySelector('.return-reason-select');

        qtySelect.addEventListener('change', () => {
            const qty = parseInt(qtySelect.value);
            if (qty > 0) {
                reasonSelect.disabled = false;
                row.classList.add('border-blue-400', 'bg-blue-50/50', 'ring-1', 'ring-blue-400');
            } else {
                reasonSelect.disabled = true;
                row.classList.remove('border-blue-400', 'bg-blue-50/50', 'ring-1', 'ring-blue-400');
            }
            calculateTotalRefund();
        });

        reasonSelect.addEventListener('change', () => {
            calculateTotalRefund();
        });
    });
}

function calculateTotalRefund() {
    let total = 0;
    const rows = document.querySelectorAll('.return-item-row');
    rows.forEach(row => {
        const price = parseInt(row.dataset.price);
        const qty = parseInt(row.querySelector('.return-qty-select').value);
        const reason = row.querySelector('.return-reason-select').value;
        if (qty > 0) {
            let itemTotal = price * qty;
            if (reason === 'other') itemTotal = itemTotal * 0.8;
            total += itemTotal;
        }
    });
    document.getElementById('estimated-refund-total').textContent = formatPrice(total);
}

const returnForm = document.getElementById('return-form');
if (returnForm) {
    returnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderId = document.getElementById('return-order-id').value;
        const rows = document.querySelectorAll('.return-item-row');
        const itemsToReturn = [];

        rows.forEach(row => {
            const qty = parseInt(row.querySelector('.return-qty-select').value);
            if (qty > 0) {
                itemsToReturn.push({
                    product_id: row.dataset.productId,
                    variant_id: row.dataset.variantId || null,
                    quantity: qty,
                    reason: row.querySelector('.return-reason-select').value
                });
            }
        });

        if (itemsToReturn.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 sản phẩm để trả', 'warning');
            return;
        }

        const submitBtn = returnForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

        try {
            await api.request('/orders/return', {
                method: 'POST',
                auth: true,
                body: { order_id: orderId, items: itemsToReturn, images: [] }
            });
            showToast('Đã gửi yêu cầu trả hàng thành công!', 'success');
            document.getElementById('return-modal').classList.add('hidden');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            showToast(err.message || 'Lỗi gửi yêu cầu', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// ============================================================
// 3. REVIEW MODAL
// ============================================================
const reviewModal = document.getElementById('review-modal');
const reviewForm = document.getElementById('review-form');

function openReviewModal(e) {
  const btn = e.currentTarget;
  document.getElementById('review-order-id').value = btn.dataset.orderId;
  document.getElementById('review-product-id').value = btn.dataset.productId;
  document.getElementById('review-product-name').textContent = btn.dataset.productName;
  document.getElementById('review-comment').value = '';
  document.getElementById('star5').checked = true;
  reviewModal.classList.remove('hidden');
}

if (reviewForm) {
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('review-order-id').value;
    const productId = document.getElementById('review-product-id').value;
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    const rating = ratingInput ? ratingInput.value : 5;
    const comment = document.getElementById('review-comment').value.trim();

    if (!comment) {
      showToast('Vui lòng nhập nội dung đánh giá', 'error');
      return;
    }
    try {
      await api.createReview({ order_id: orderId, product_id: productId, rating: rating, comment: comment });
      showToast('Đánh giá thành công!', 'success');
      reviewModal.classList.add('hidden');
    } catch (err) {
      showToast(err.message || 'Lỗi khi gửi đánh giá', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }
  loadOrderDetail();
});