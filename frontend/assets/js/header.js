// assets/js/header.js
import { formatPrice } from "./utils/common.js";
import { getToken, removeToken } from "./utils/storage.js";
import { showToast } from "./ui/toast.js";
import { getQueryParam } from "./utils/url.js";
import { api } from "./api.js";

// 1. LOGIC MENU DANH MỤC ĐỘNG (Chuẩn giao diện cũ)
export async function initHeaderCategories() {
    const desktopNav = document.getElementById("header-nav-items");
    const mobileNav = document.getElementById("mobile-nav-items");

    if (!desktopNav || !mobileNav) return;

    try {
        const res = await api.getCategories();
        const categories = res.data || [];
        const currentSlug = getQueryParam("slug");

        // Render Desktop (Style cũ: text-sm font-medium text-gray-700)
        const desktopHtml = `
            <a href="index.html" class="text-sm font-medium text-gray-700 hover:text-blue-600">Trang chủ</a>
            ${categories
                .map((c) => {
                    const activeClass =
                        c.slug === currentSlug
                            ? "text-blue-600"
                            : "text-gray-700";

                    // Nếu có icon FontAwesome thì hiện, không thì thôi (để giữ style tối giản cũ)
                    let iconHtml = "";
                    if (c.icon && c.icon.includes("fa-")) {
                        iconHtml = `<i class="${c.icon} mr-1"></i>`;
                    }

                    return `
                <a href="category.html?slug=${c.slug}" class="flex items-center gap-1.5 text-sm font-medium ${activeClass} hover:text-blue-600">
                    ${iconHtml}
                    <span>${c.name}</span>
                </a>`;
                })
                .join("")}
            <a href="contact.html" class="text-sm font-medium text-gray-700 hover:text-blue-600">Liên hệ</a>
        `;
        desktopNav.innerHTML = desktopHtml;

        // Render Mobile
        const mobileHtml = `
            <a href="index.html" class="text-gray-700 hover:text-blue-600 block py-2">Trang chủ</a>
            ${categories
                .map(
                    (c) => `
                <a href="category.html?slug=${c.slug}" class="text-gray-700 hover:text-blue-600 block py-2 capitalize">${c.name}</a>
            `
                )
                .join("")}
            <a href="contact.html" class="text-gray-700 hover:text-blue-600 block py-2">Liên hệ</a>
        `;
        mobileNav.innerHTML = mobileHtml;
    } catch (err) {
        console.error(err);
        desktopNav.innerHTML = "";
    }
}

// 2. SEARCH
function initSearch() {
    const inputs = [
        document.getElementById("header-search-input"),
        document.getElementById("mobile-search-input"),
    ];
    inputs.forEach((input) => {
        if (!input) return;
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const keyword = input.value.trim();
                if (keyword)
                    window.location.href = `category.html?q=${encodeURIComponent(
                        keyword
                    )}`;
            }
        });
    });
}

// 3. AUTH & DROPDOWN
export async function updateHeaderAuth() {
    const token = getToken();

    const loginLink = document.getElementById("header-login-link");
    const userTrigger = document.getElementById("user-dropdown-trigger");
    const userDropdown = document.getElementById("user-dropdown");
    const mobileLogin = document.getElementById("mobile-login-link");
    const mobileLogout = document.getElementById("mobile-logout-btn");

    if (token) {
        loginLink?.classList.add("hidden");
        userTrigger?.classList.remove("hidden");
        mobileLogin?.classList.add("hidden");
        mobileLogout?.classList.remove("hidden");

        try {
            const user = await api.me();
            document.getElementById("user-dropdown-name").textContent =
                user.name;
            document.getElementById("user-dropdown-email").textContent =
                user.email;

            if (user.role === "admin") {
                if (
                    userDropdown &&
                    !document.getElementById("admin-dashboard-link")
                ) {
                    const adminLink = document.createElement("a");
                    adminLink.id = "admin-dashboard-link";
                    adminLink.href = "admin/index.html";
                    adminLink.className =
                        "block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 font-bold";
                    adminLink.textContent = "Trang Quản Trị";
                    userDropdown.insertBefore(
                        adminLink,
                        userDropdown.children[1]
                    );
                }
            }
        } catch (err) {
            removeToken();
        }
    } else {
        loginLink?.classList.remove("hidden");
        userTrigger?.classList.add("hidden");
        mobileLogin?.classList.remove("hidden");
        mobileLogout?.classList.add("hidden");
    }

    const handleLogout = () => {
        removeToken();
        showToast("Đã đăng xuất", "default");
        window.location.href = "index.html";
    };

    document
        .getElementById("header-logout-btn")
        ?.addEventListener("click", handleLogout);
    mobileLogout?.addEventListener("click", handleLogout);
}

// 4. UI TOGGLES
export function initMobileMenu() {
    const btn = document.getElementById("mobile-menu-btn");
    const menu = document.getElementById("mobile-menu");
    const panel = document.getElementById("mobile-menu-panel");
    const overlay = document.getElementById("mobile-menu-overlay");
    const closeBtn = document.getElementById("mobile-menu-close");

    if (!btn || !menu) return;

    const open = () => {
        menu.classList.remove("hidden");
        setTimeout(() => panel.classList.remove("translate-x-full"), 10);
    };
    const close = () => {
        panel.classList.add("translate-x-full");
        setTimeout(() => menu.classList.add("hidden"), 300);
    };

    btn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    overlay?.addEventListener("click", close);
}

export function initUserDropdown() {
    const trigger = document.getElementById("user-dropdown-trigger");
    const dropdown = document.getElementById("user-dropdown");

    if (!trigger || !dropdown) return;

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add("hidden");
        }
    });
}

// 5. MINI CART DROPDOWN
export function initMiniCart() {
    const wrapper = document.querySelector(".header-cart-wrapper");
    const container = document.getElementById("header-cart-items");
    const totalEl = document.getElementById("header-cart-total");

    if (!wrapper || !container) return;

    // Sự kiện rê chuột vào để load cart
    wrapper.addEventListener("mouseenter", async () => {
        const token = getToken();
        if (!token) {
            container.innerHTML =
                '<p class="text-sm text-gray-500 text-center py-4">Vui lòng <a href="login.html" class="text-blue-600 hover:underline">đăng nhập</a></p>';
            totalEl.textContent = "0đ";
            return;
        }

        try {
            // Gọi API lấy giỏ hàng (sử dụng lại api.getCart có sẵn)
            const res = await api.getCart();
            const items = res.data || [];
            renderMiniCart(items, container, totalEl);
        } catch (e) {
            console.error(e);
            container.innerHTML =
                '<p class="text-sm text-red-500 text-center py-4">Lỗi tải giỏ hàng</p>';
        }
    });
}

function renderMiniCart(items, container, totalEl) {
    if (items.length === 0) {
        container.innerHTML =
            '<p class="text-sm text-gray-500 text-center py-4">Giỏ hàng trống</p>';
        if (totalEl) totalEl.textContent = "0đ";
        return;
    }

    let total = 0;
    const html = items
        .map((item) => {
            total += item.price * item.quantity;
            return `
            <div class="flex gap-3 items-center hover:bg-gray-50 p-1 rounded transition">
                <img src="${item.image}" alt="${
                item.title
            }" class="w-10 h-10 object-cover rounded border border-gray-200">
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-medium text-gray-800 truncate" title="${
                        item.title
                    }">${item.title}</h4>
                    <p class="text-xs text-gray-500 mt-0.5">
                        ${
                            item.quantity
                        } x <span class="text-blue-600 font-bold">${formatPrice(
                item.price
            )}</span>
                    </p>
                </div>
            </div>
        `;
        })
        .join("");

    container.innerHTML = html;
    if (totalEl) totalEl.textContent = formatPrice(total);
}

initSearch();
initHeaderCategories();
initMiniCart();
