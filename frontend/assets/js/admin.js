// assets/js/admin.js

import { getToken, removeToken } from './utils/storage.js';
import { api } from './api.js';
import { formatPrice } from './utils/common.js';
import { showToast } from './ui/toast.js';

// Export lại để các file HTML admin (như products.html) có thể import và sử dụng
export { formatPrice };

// === 1. KIỂM TRA ĐĂNG NHẬP + QUYỀN ADMIN ===
async function checkAuth() {
    const token = getToken();
    if (!token) {
        // Chưa đăng nhập
        window.location.href = 'login.html';
        return null;
    }

    try {
        const user = await api.me();

        // Nếu không phải admin -> Đá về trang chủ
        if (!user || user.role !== 'admin') {
            alert('CẢNH BÁO: Bạn không có quyền truy cập trang quản trị!');
            window.location.href = '../index.html';
            return null;
        }

        // Có thể dùng user để hiển thị tên admin sau này nếu muốn
        return user;
    } catch (err) {
        // Lỗi token / lỗi mạng / token hết hạn
        console.error('Lỗi xác thực admin:', err);
        removeToken();
        window.location.href = 'login.html';
        return null;
    }
}

// === 2. HÀM RENDER LAYOUT CHÍNH (SIDEBAR + HEADER) ===
export async function renderAdminLayout(activePage) {
    // Check đăng nhập + quyền admin
    const user = await checkAuth();
    if (!user) return; // đã redirect trong checkAuth rồi

    const body = document.body;
    // Lấy nội dung riêng của từng trang (đang nằm trong body) để chèn vào khung layout
    const pageSpecificContent = body.innerHTML; 

    // Định nghĩa Menu Sidebar
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', link: 'index.html', group: 'Chung' },
        
        { id: 'products', label: 'Sản phẩm', icon: 'fa-box-open', link: 'products.html', group: 'Quản lý' },
        { id: 'categories', label: 'Danh mục', icon: 'fa-list', link: 'categories.html', group: 'Quản lý' },
        { id: 'brands', label: 'Hãng sản xuất', icon: 'fa-copyright', link: 'brands.html', group: 'Quản lý' },
        { id: 'orders', label: 'Đơn hàng', icon: 'fa-cart-shopping', link: 'orders.html', group: 'Quản lý' },
        // THÊM DÒNG NÀY:
        { id: 'coupons', label: 'Mã giảm giá', icon: 'fa-ticket', link: 'coupons.html', group: 'Quản lý' },
        // --- THÊM DÒNG NÀY ---
    { id: 'reviews', label: 'Đánh giá', icon: 'fa-star', link: 'reviews.html', group: 'Quản lý' },
        // 👇 MỚI THÊM:
        { id: 'users', label: 'Tài khoản', icon: 'fa-users', link: 'users.html', group: 'Hệ thống' },
    ];

    // Hàm tạo HTML cho Sidebar
    const renderMenu = () => {
        let html = '';
        let currentGroup = '';

        menuItems.forEach(item => {
            // Render tiêu đề nhóm (VD: Chung, Quản lý)
            if (item.group !== currentGroup) {
                html += `<p class="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">${item.group}</p>`;
                currentGroup = item.group;
            }

            // Kiểm tra active state
            const isActive = item.id === activePage;
            const activeClass = isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800';
            
            const iconColor = isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400';

            html += `
            <a href="${item.link}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeClass}">
                <i class="fa-solid ${item.icon} w-5 text-center transition-colors ${iconColor}"></i>
                <span class="font-medium text-sm">${item.label}</span>
            </a>`;
        });
        return html;
    };

    // Ghi đè body bằng Layout hoàn chỉnh
    body.innerHTML = `
    <div class="flex h-screen bg-gray-100 font-sans antialiased text-gray-900 overflow-hidden">
        
        <aside class="w-64 bg-[#0f172a] text-white flex flex-col flex-shrink-0 transition-all duration-300 fixed md:relative z-30 h-full hidden md:flex" id="sidebar">
            <div class="h-16 flex items-center px-6 border-b border-slate-800 bg-[#020617]">
                <div class="flex items-center gap-3 text-blue-500 font-bold text-xl tracking-wider">
                    <i class="fa-brands fa-codepen text-2xl"></i>
                    <span class="text-white">TECHHUB</span>
                </div>
            </div>

            <div class="p-4 border-b border-slate-800 bg-[#0f172a]">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px]">
                        <div class="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white">
                            AD
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-white">Administrator</p>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p class="text-[10px] text-slate-400 uppercase tracking-wide">Online</p>
                        </div>
                    </div>
                </div>
            </div>

            <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                ${renderMenu()}
                
                <p class="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Tài khoản</p>
                <button id="btn-open-change-pw" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group text-slate-400 hover:text-white hover:bg-slate-800">
                    <i class="fa-solid fa-key w-5 text-center transition-colors text-slate-500 group-hover:text-blue-400"></i>
                    <span class="font-medium text-sm">Đổi mật khẩu</span>
                </button>
            </nav>

            <div class="p-4 border-t border-slate-800 bg-[#020617]">
                <button id="btn-logout" class="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-400 bg-slate-800/50 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200">
                    <i class="fa-solid fa-right-from-bracket"></i>
                    <span>Đăng xuất</span>
                </button>
            </div>
        </aside>

        <div class="flex-1 flex flex-col h-full relative min-w-0">
            
            <header class="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-4 lg:px-8 z-20 sticky top-0">
                <div class="flex items-center gap-4">
                    <button class="md:hidden text-slate-500 hover:text-blue-600 p-1" onclick="document.getElementById('sidebar').classList.toggle('hidden'); document.getElementById('sidebar').classList.toggle('absolute'); document.getElementById('sidebar').classList.toggle('w-64');">
                        <i class="fa-solid fa-bars text-xl"></i>
                    </button>
                    
                    <div class="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                        <span>Admin</span>
                        <i class="fa-solid fa-chevron-right text-[10px]"></i>
                        <span class="font-semibold text-blue-600 capitalize">${menuItems.find(i => i.id === activePage)?.label || 'Page'}</span>
                    </div>
                </div>

                <div class="flex items-center gap-3 sm:gap-5">
                    <a href="../index.html" target="_blank" class="hidden sm:flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        <i class="fa-solid fa-globe"></i> Xem Website
                    </a>
                    
                    <button class="relative p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-50">
                        <i class="fa-regular fa-bell text-xl"></i>
                        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
                    </button>
                </div>
            </header>

            <main class="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 lg:p-8 scroll-smooth">
                ${pageSpecificContent}
            </main>
        </div>
    </div>

    <div id="admin-pw-modal" class="fixed inset-0 z-[60] hidden bg-black/50 flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-gray-800">Đổi mật khẩu Admin</h3>
                <button onclick="document.getElementById('admin-pw-modal').classList.add('hidden')" class="text-gray-400 hover:text-red-500"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <form id="admin-pw-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu hiện tại</label>
                    <input type="password" name="old_password" class="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition" required placeholder="••••••••">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu mới</label>
                    <input type="password" name="new_password" class="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition" required placeholder="••••••••">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Xác nhận mật khẩu</label>
                    <input type="password" name="confirm_password" class="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition" required placeholder="••••••••">
                </div>
                <div class="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-100">
                    <button type="button" onclick="document.getElementById('admin-pw-modal').classList.add('hidden')" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">Hủy</button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-md">Cập nhật</button>
                </div>
            </form>
        </div>
    </div>
    `;

    // === 3. XỬ LÝ SỰ KIỆN ===

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            removeToken();
            window.location.href = 'login.html';
        }
    });

    // Đổi mật khẩu
    const pwModal = document.getElementById('admin-pw-modal');
    const pwForm = document.getElementById('admin-pw-form');
    
    document.getElementById('btn-open-change-pw')?.addEventListener('click', () => {
        pwForm.reset();
        pwModal.classList.remove('hidden');
    });

    pwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = pwForm.querySelector('input[name="old_password"]').value;
        const newPass = pwForm.querySelector('input[name="new_password"]').value;
        const confirmPass = pwForm.querySelector('input[name="confirm_password"]').value;

        if (newPass !== confirmPass) {
            showToast('Mật khẩu xác nhận không khớp', 'error');
            return;
        }

        const btn = pwForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Đang xử lý...';

        try {
            await api.changePassword({ 
                old_password: oldPass,
                new_password: newPass,
                confirm_password: confirmPass
            });
            
            alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
            removeToken();
            window.location.href = 'login.html';
        } catch (err) {
            showToast(err.message || 'Lỗi đổi mật khẩu', 'error');
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}
