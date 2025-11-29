// assets/js/utils/common.js

// 1. CẤU HÌNH HỆ THỐNG
// Dễ dàng thay đổi URL khi deploy lên server thật
export const API_BASE = 'http://localhost/Web%20ban%20thiet%20bi%20dien%20tu/backend/public/index.php';

// 2. FORMAT TIỀN TỆ (VND)
export function formatPrice(vnd) {
  if (vnd === null || vnd === undefined) return '0 ₫';
  if (typeof vnd !== 'number') {
      vnd = parseInt(vnd);
      if (isNaN(vnd)) return '0 ₫';
  }
  return vnd.toLocaleString('vi-VN') + ' ₫';
}

// 3. SHOW TOAST (Thông báo)
// Logic này chuyển từ ui/toast.js sang đây hoặc import lại để wrap
// Nhưng để đơn giản và tập trung, ta sẽ giữ nguyên ui/toast.js và chỉ export lại hoặc viết wrapper ở đây nếu cần.
// Tuy nhiên, theo yêu cầu của bạn là "Gom vào", tôi sẽ đề xuất cách import từ ui/toast.js vào đây rồi export ra
// để các file khác chỉ cần import từ common.js là có đủ "đồ chơi".

import { showToast as showToastOriginal } from '../ui/toast.js';

export const showToast = showToastOriginal;

// 4. CÁC TIỆN ÍCH KHÁC (Debounce, Sleep...)
export function debounce(func, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, delay);
  };
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}