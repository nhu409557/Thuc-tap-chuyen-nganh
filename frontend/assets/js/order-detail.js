// assets/js/order-detail.js

import { api } from './api.js';
import { getQueryParam } from './utils/url.js';
import { getToken } from './utils/storage.js';
import { formatPrice, showToast } from './utils/common.js';

const BANK_CONFIG = {
  BANK_ID: 'MB',
  ACCOUNT_NO: '033445566',
  TEMPLATE: 'compact'
};

const STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800' },
  shipping: { label: 'Đang giao', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Giao thành công', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800' }
};

const METHOD_MAP = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  banking: 'Chuyển khoản ngân hàng',
  momo: 'Ví điện tử MoMo'
};

function generateVietQR(amount, orderId) {
  const content = `DH${orderId}`;
  return `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-${BANK_CONFIG.TEMPLATE}.png?amount=${amount}&addInfo=${content}&accountName=TECHHUB`;
}

async function loadOrderDetail() {
  const contentEl = document.getElementById('order-detail-content');
  const loadingEl = document.getElementById('loading-state');

  const id = getQueryParam('id');
  if (!id) {
    loadingEl.innerHTML = `<p class="text-red-500">Không tìm thấy mã đơn hàng.</p>`;
    return;
  }

  try {
    const order = await api.getOrder(id);

    // Thông tin chung
    document.getElementById('order-code').textContent = '#' + order.id;
    document.getElementById('order-date').textContent = new Date(
      order.created_at
    ).toLocaleString('vi-VN');

    // Badge trạng thái
    const statusKey = (order.status || 'pending').toLowerCase();
    const statusConfig =
      STATUS_MAP[statusKey] || {
        label: order.status,
        color: 'bg-gray-100 text-gray-800'
      };
    const badgeEl = document.getElementById('order-status-badge');
    badgeEl.textContent = statusConfig.label;
    badgeEl.className = `px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`;

    // Trạng thái thanh toán
    const paymentStatusEl = document.getElementById('payment-status');
    const isPaid = order.payment_status === 'Paid';

    if (isPaid) {
      paymentStatusEl.innerHTML = `<span class="text-green-600 font-bold flex items-center gap-1 justify-end"><i class="fa-solid fa-circle-check"></i> Đã thanh toán</span>`;
    } else {
      paymentStatusEl.innerHTML = `<span class="text-gray-500 font-medium flex items-center gap-1 justify-end"><i class="fa-regular fa-clock"></i> Chưa thanh toán</span>`;
    }

    // QR Code chuyển khoản (chỉ khi banking + chưa thanh toán + chưa hủy)
    if (document.getElementById('dynamic-qr-section')) {
      document.getElementById('dynamic-qr-section').remove();
    }

    if (order.payment_method === 'banking' && !isPaid && statusKey !== 'cancelled') {
      const qrUrl = generateVietQR(order.total_amount, order.id);

      const qrHtml = `
            <div id="dynamic-qr-section" class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row items-center gap-6 animate-fade-in">
                <div class="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-shrink-0">
                    <img src="${qrUrl}" alt="Mã QR Thanh Toán" class="w-48 h-auto object-contain">
                </div>
                <div class="flex-1 space-y-2 text-sm text-gray-700">
                    <h4 class="font-bold text-blue-800 text-lg mb-2">Quét mã để thanh toán</h4>
                    <p>Ngân hàng: <span class="font-semibold">${BANK_CONFIG.BANK_ID}</span></p>
                    <p>Số tài khoản: <span class="font-semibold copy-text cursor-pointer hover:text-blue-600" title="Click để sao chép">${BANK_CONFIG.ACCOUNT_NO}</span></p>
                    <p>Số tiền: <span class="font-bold text-red-600 text-lg">${formatPrice(
                      order.total_amount
                    )}</span></p>
                    <p>Nội dung: <span class="font-mono font-bold bg-white px-2 py-1 rounded border border-gray-300">${'DH' +
                      order.id}</span></p>
                    <p class="text-xs text-gray-500 italic mt-2">* Hệ thống sẽ xử lý đơn hàng ngay sau khi nhận được tiền.</p>
                </div>
            </div>
        `;

      const detailContent = document.getElementById('order-detail-content');
      detailContent.insertBefore(
        document.createRange().createContextualFragment(qrHtml),
        detailContent.children[1]
      );
    }

    // Nút hủy đơn
    const headerActionDiv = badgeEl.parentElement;
    const oldCancelBtn = document.getElementById('btn-cancel-order');
    if (oldCancelBtn) oldCancelBtn.remove();

    if (statusKey === 'pending' && !isPaid) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'btn-cancel-order';
      cancelBtn.textContent = 'Hủy đơn hàng';
      cancelBtn.className =
        'mt-2 text-xs text-red-600 hover:text-red-800 hover:underline font-semibold cursor-pointer transition-colors';
      cancelBtn.onclick = async () => {
        if (confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) {
          try {
            await api.cancelOrder(order.id);
            showToast('Đã hủy đơn hàng thành công', 'success');
            setTimeout(() => window.location.reload(), 1000);
          } catch (err) {
            showToast(err.message || 'Không thể hủy đơn', 'error');
          }
        }
      };
      headerActionDiv.appendChild(cancelBtn);
    }

    // Thông tin khách hàng
    document.getElementById('customer-name').textContent = order.name;
    document.getElementById('customer-phone').textContent = order.phone;
    document.getElementById('customer-address').textContent = order.address;

    // Phương thức thanh toán
    const methodKey = (order.payment_method || 'cod').toLowerCase();
    document.getElementById('payment-method').textContent =
      METHOD_MAP[methodKey] || order.payment_method;

    // Danh sách sản phẩm
    const itemsContainer = document.getElementById('order-items-list');
    const items = order.items || [];
    let subtotal = 0;

    const allowedReviewStatus = ['delivered', 'completed'];
    const canReview = allowedReviewStatus.includes(statusKey);

    if (items.length > 0) {
      itemsContainer.innerHTML = items
        .map((item) => {
          const itemTotal = item.price * item.quantity;
          subtotal += itemTotal;
          
          // Ảnh: ưu tiên ảnh variant, sau đó đến ảnh sản phẩm
          const imgUrl =
            item.variant_image ||
            item.product_image ||
            item.image ||
            'https://via.placeholder.com/60';

          // Xử lý text hiển thị phân loại (màu + các attributes khác)
          let variantParts = [];

          // Màu
          if (item.selected_color) {
            variantParts.push(`Màu: ${item.selected_color}`);
          }

          // Attributes (JSON) – ví dụ: capacity, ram, storage...
          if (item.variant_attributes) {
            try {
              const attrs =
                typeof item.variant_attributes === 'string'
                  ? JSON.parse(item.variant_attributes)
                  : item.variant_attributes;

              const specs = Object.entries(attrs)
                .filter(([k, v]) => k !== 'color' && v)
                .map(([k, v]) => v);

              if (specs.length) {
                variantParts.push(specs.join(' / '));
              }
            } catch (e) {
              // ignore parse error
            }
          }

          const variantText = variantParts.join(' - ');
          const variantHtml = variantText
            ? `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 mt-1 inline-block">${variantText}</span>`
            : '';

          let reviewBtnHtml = '';
          if (canReview) {
            reviewBtnHtml = `
                  <button class="btn-open-review mt-2 inline-flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-200 hover:bg-yellow-100 transition"
                     data-order-id="${order.id}"
                     data-product-id="${item.product_id}"
                     data-product-name="${item.product_title || item.title}">
                     <i class="fa-solid fa-star text-yellow-500 text-[10px]"></i>
                     Viết đánh giá
                  </button>
                `;
          }

          return `
            <tr class="bg-white border-b hover:bg-gray-50 transition">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-4">
                        <img src="${imgUrl}" alt="${item.product_title}" class="w-12 h-12 object-cover rounded border border-gray-200 mix-blend-multiply">
                        <div>
                            <a href="product.html?id=${item.product_id}" class="font-medium text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
                              ${item.product_title || item.title}
                            </a>
                            ${variantHtml}
                            <div>${reviewBtnHtml}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center text-gray-600">x${item.quantity}</td>
                <td class="px-6 py-4 text-right text-gray-600">${formatPrice(item.price)}</td>
                <td class="px-6 py-4 text-right font-bold text-gray-900">${formatPrice(itemTotal)}</td>
            </tr>
            `;
        })
        .join('');

      if (canReview) {
        document.querySelectorAll('.btn-open-review').forEach((btn) => {
          btn.addEventListener('click', openReviewModal);
        });
      }
    } else {
      itemsContainer.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Không có thông tin sản phẩm</td></tr>`;
      subtotal = order.total_amount;
    }

    // Tổng tiền
    document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('summary-total').textContent = formatPrice(
      order.total_amount
    );

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    loadingEl.innerHTML = `<p class="text-red-500 font-medium">Lỗi tải đơn hàng: ${err.message}</p>`;
  }
}

// ================== REVIEW MODAL ==================

const modal = document.getElementById('review-modal');
const form = document.getElementById('review-form');

function openReviewModal(e) {
  const btn = e.currentTarget;
  document.getElementById('review-order-id').value = btn.dataset.orderId;
  document.getElementById('review-product-id').value = btn.dataset.productId;
  document.getElementById('review-product-name').textContent =
    btn.dataset.productName;
  document.getElementById('review-comment').value = '';
  const star5 = document.getElementById('star5');
  if (star5) star5.checked = true;
  modal.classList.remove('hidden');
}

document
  .getElementById('close-review-modal')
  ?.addEventListener('click', () => modal.classList.add('hidden'));

modal?.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

if (form) {
  form.addEventListener('submit', async (e) => {
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
      await api.createReview({
        order_id: orderId,
        product_id: productId,
        rating: rating,
        comment: comment
      });
      showToast('Đánh giá thành công!', 'success');
      modal.classList.add('hidden');
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
