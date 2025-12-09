// assets/js/reviews.js
import { api } from './api.js';

// --- HELPERS ---
function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) html += '<i class="fa-solid fa-star text-yellow-400"></i>';
        else html += '<i class="fa-solid fa-star text-gray-300"></i>';
    }
    return html;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- MAIN LOGIC ---
export async function initReviews(productId) {
    const listContainer = document.getElementById('reviews-list');
    const summaryAvg = document.getElementById('avg-rating-text');
    const summaryStars = document.getElementById('avg-rating-stars');
    const summaryTotal = document.getElementById('total-reviews-text');

    if (!listContainer) return; // Nếu không có chỗ để render thì thôi

    try {
        const res = await api.getProductReviews(productId);
        const reviews = res.data || [];
        const summary = res.summary || { total_reviews: 0, average_rating: 0 };

        // 1. Render phần Thống kê (Summary)
        if (summaryAvg) summaryAvg.textContent = summary.average_rating + '/5';
        if (summaryTotal) summaryTotal.textContent = `${summary.total_reviews} đánh giá`;
        if (summaryStars) summaryStars.innerHTML = renderStars(Math.round(summary.average_rating));

        // 2. Render Danh sách (List)
        if (reviews.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-gray-300 text-5xl mb-3"><i class="fa-regular fa-comment-dots"></i></div>
                    <p class="text-gray-500">Sản phẩm này chưa có đánh giá nào.</p>
                    <p class="text-sm text-gray-400 mt-1">Hãy mua hàng để trở thành người đầu tiên đánh giá nhé!</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = reviews.map(r => {
            const name = r.user_name || 'Khách hàng';
            // Hiển thị phản hồi của Admin nếu có
            const adminReplyHtml = r.admin_reply 
                ? `
                <div class="mt-3 ml-4 pl-4 border-l-2 border-blue-200 bg-blue-50 p-3 rounded-r-lg">
                    <p class="text-xs font-bold text-blue-700 mb-1"><i class="fa-solid fa-headset mr-1"></i> TechHub phản hồi:</p>
                    <p class="text-sm text-gray-700">${r.admin_reply}</p>
                </div>
                ` 
                : '';

            return `
            <div class="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold uppercase flex-shrink-0">
                        ${name.charAt(0)}
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-bold text-gray-800 text-sm">${name}</p>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <div class="text-xs">${renderStars(r.rating)}</div>
                                    <span class="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 flex items-center gap-1">
                                        <i class="fa-solid fa-check-circle"></i> Đã mua hàng
                                    </span>
                                </div>
                            </div>
                            <span class="text-xs text-gray-400">${formatDate(r.created_at)}</span>
                        </div>
                        
                        <div class="mt-2 text-gray-700 text-sm leading-relaxed">
                            ${r.comment}
                        </div>

                        ${adminReplyHtml}
                    </div>
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Lỗi tải review:', err);
        listContainer.innerHTML = '<p class="text-center text-red-500">Không thể tải đánh giá.</p>';
    }
}