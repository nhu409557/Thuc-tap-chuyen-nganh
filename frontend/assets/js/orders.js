import { api } from './api.js';
import { getToken } from './utils/storage.js';
import { formatPrice } from './utils/common.js';

// Cấu hình hiển thị trạng thái đơn hàng
const STATUS_CONFIG = {
    'pending': { label: 'Chờ xác nhận', class: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    'confirmed': { label: 'Đã xác nhận', class: 'text-blue-700 bg-blue-50 border-blue-200' },
    'shipping': { label: 'Đang giao hàng', class: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    'delivered': { label: 'Giao thành công', class: 'text-green-700 bg-green-50 border-green-200' },
    'cancelled': { label: 'Đã hủy', class: 'text-red-700 bg-red-50 border-red-200' },
    'returned': { label: 'Đã hoàn trả', class: 'text-purple-700 bg-purple-50 border-purple-200' },
    'return requested': { label: 'Yêu cầu trả hàng', class: 'text-orange-700 bg-orange-50 border-orange-200' }
};

let allOrders = [];

// Hàm lọc đơn hàng theo Tab
function filterOrders(statusKey) {
    if (statusKey === 'all') return allOrders;

    return allOrders.filter(order => {
        const s = (order.status || '').toLowerCase();
        
        if (statusKey === 'pending') return s === 'pending' || s === 'confirmed';
        if (statusKey === 'shipping') return s === 'shipping';
        if (statusKey === 'completed') return s === 'delivered';
        if (statusKey === 'cancelled') return s === 'cancelled';
        if (statusKey === 'returned') return s === 'returned' || s === 'return requested';
        
        return false;
    });
}

async function loadOrders() {
    const listEl = document.getElementById('orders-list');
    const loadingEl = document.getElementById('loading-state');
    
    listEl.innerHTML = '';
    loadingEl.classList.remove('hidden');

    try {
        const res = await api.getOrders();
        allOrders = Array.isArray(res) ? res : (res.data || []);
        renderList(allOrders); 
    } catch (err) {
        listEl.innerHTML = `<div class="text-center text-red-500 py-8 px-4">Lỗi tải đơn hàng: ${err.message}</div>`;
    } finally {
        loadingEl.classList.add('hidden');
    }
}

function renderList(orders) {
    const listEl = document.getElementById('orders-list');
    
    if (orders.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-gray-300 mx-auto max-w-lg">
                <i class="fa-solid fa-box-open text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Chưa có đơn hàng nào trong mục này.</p>
                <a href="products.html" class="inline-block mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition w-full sm:w-auto">Mua sắm ngay</a>
            </div>`;
        return;
    }

    listEl.innerHTML = orders.map(order => {
        // 1. Xử lý Trạng thái Đơn hàng
        let statusKey = (order.status || '').toLowerCase();
        const config = STATUS_CONFIG[statusKey] || { label: order.status, class: 'text-gray-600 bg-gray-50' };

        // 2. Xử lý Tên sản phẩm (Text summary)
        const firstItemName = order.items && order.items.length > 0 ? order.items[0].product_title : `Đơn hàng #${order.id}`;
        const moreCount = order.items && order.items.length > 1 ? `và ${order.items.length - 1} sản phẩm khác` : '';

        // 3. Xử lý Hình thức thanh toán (Method)
        let methodText = 'COD';
        if (order.payment_method === 'momo') methodText = 'MoMo';
        else if (order.payment_method === 'banking') methodText = 'CK Ngân hàng';

        // 4. Xử lý Trạng thái thanh toán (Payment Status)
        let payStatusHtml = '';
        if (order.payment_status === 'Paid') {
            payStatusHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-green-600 border border-green-200 bg-green-50 px-2 py-0.5 rounded"><i class="fa-solid fa-check"></i> Đã thanh toán</span>`;
        } else if (order.payment_status === 'Refunded') {
            payStatusHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-purple-600 border border-purple-200 bg-purple-50 px-2 py-0.5 rounded"><i class="fa-solid fa-rotate-left"></i> Đã hoàn tiền</span>`;
        } else {
            payStatusHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500 border border-gray-300 bg-gray-50 px-2 py-0.5 rounded">Chưa thanh toán</span>`;
        }

        // 5. Logic nút bấm
        let actionBtn = `<a href="order-detail.html?id=${order.id}" class="block w-full sm:w-auto text-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Xem chi tiết</a>`;
        
        if (statusKey === 'delivered' && order.payment_status === 'Paid') {
            actionBtn = `<a href="order-detail.html?id=${order.id}" class="block w-full sm:w-auto text-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">Đánh giá / Trả hàng</a>`;
        }

        return `
            <div class="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3 mb-3">
                    <div class="flex flex-col gap-1 w-full sm:w-auto">
                        <div class="flex items-center justify-between sm:justify-start gap-2">
                             <div class="flex items-center gap-2">
                                <span class="font-bold text-gray-800 text-lg">#${order.id}</span>
                                <span class="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase font-bold tracking-wide">${methodText}</span>
                             </div>
                             <div class="sm:hidden px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${config.class}">
                                 ${config.label}
                             </div>
                        </div>
                        <div class="text-sm text-gray-500 flex items-center gap-2">
                            <span>${new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                            <span class="text-gray-300">|</span>
                            ${payStatusHtml}
                        </div>
                    </div>

                    <div class="hidden sm:block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${config.class}">
                        ${config.label}
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row justify-between gap-4">
                    <div class="flex-1">
                        <p class="font-medium text-gray-800 line-clamp-2 text-sm sm:text-base">
                            <i class="fa-solid fa-box-open text-gray-400 mr-1"></i> ${firstItemName}
                        </p>
                        <p class="text-xs text-gray-500 mt-1 pl-5">${moreCount}</p>
                    </div>

                    <div class="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start border-t sm:border-t-0 border-gray-50 pt-3 sm:pt-0 mt-1 sm:mt-0">
                        <span class="text-xs text-gray-500">Tổng tiền:</span>
                        <span class="text-base sm:text-lg font-bold text-red-600">${formatPrice(order.total_amount)}</span>
                    </div>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

// Xử lý sự kiện Click Tab
document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.href = 'login.html';
        return;
    }

    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'text-blue-600', 'border-blue-600', 'font-semibold'));
            tabs.forEach(t => t.classList.add('text-gray-600', 'border-transparent'));
            
            tab.classList.add('active', 'text-blue-600', 'border-blue-600', 'font-semibold');
            tab.classList.remove('text-gray-600', 'border-transparent');

            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

            const status = tab.dataset.status;
            renderList(filterOrders(status));
        });
    });

    loadOrders();
});