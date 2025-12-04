// assets/js/products.js

import { api } from "./api.js";
import { getQueryParam } from "./utils/url.js";
import { getToken } from "./utils/storage.js";
import { syncCartBadge } from "./main.js";
import { loadComponents } from "./utils/dom.js";
import { formatPrice, showToast } from "./utils/common.js";

// ============================================================
// 1. CẤU HÌNH MẶC ĐỊNH (FALLBACK SPECS)
// ============================================================
const SPECS_MAPPING = {
    phones: [
        {
            group: "Cấu hình",
            fields: [
                { k: "os", l: "HĐH" },
                { k: "cpu", l: "Chip" },
                { k: "ram", l: "RAM" },
                { k: "storage", l: "Bộ nhớ" },
            ],
        },
        {
            group: "Màn hình",
            fields: [
                { k: "screen_size", l: "Kích thước" },
                { k: "screen_res", l: "Độ phân giải" },
            ],
        },
        {
            group: "Camera",
            fields: [
                { k: "rear_cam_res", l: "Cam sau" },
                { k: "front_cam_res", l: "Cam trước" },
            ],
        },
        {
            group: "Pin",
            fields: [
                { k: "battery_capacity", l: "Pin" },
                { k: "charging_support", l: "Sạc" },
            ],
        },
    ],
    laptops: [
        {
            group: "Cấu hình",
            fields: [
                { k: "cpu", l: "CPU" },
                { k: "ram", l: "RAM" },
                { k: "storage", l: "Ổ cứng" },
                { k: "gpu", l: "VGA" },
            ],
        },
        {
            group: "Màn hình",
            fields: [
                { k: "screen_size", l: "Kích thước" },
                { k: "screen_res", l: "Độ phân giải" },
            ],
        },
        {
            group: "Khác",
            fields: [
                { k: "weight", l: "Trọng lượng" },
                { k: "battery", l: "Pin" },
            ],
        },
    ],
    default: [
        {
            group: "Thông số sản phẩm",
            fields: [
                { k: "material", l: "Chất liệu" },
                { k: "size", l: "Kích thước" },
                { k: "origin", l: "Xuất xứ" },
            ],
        },
    ],
};

// ============================================================
// 2. HÀM RENDER UI (CARD & SKELETON)
// ============================================================

function renderSkeleton(count = 6) {
    return Array(count)
        .fill(0)
        .map(
            () => `
      <div class="bg-white rounded-xl border border-gray-200 p-3 flex flex-col h-full">
        <div class="relative overflow-hidden rounded-lg bg-gray-200 h-48 w-full skeleton mb-3"></div>
        <div class="h-4 w-3/4 bg-gray-200 rounded mb-2 skeleton"></div>
        <div class="h-4 w-1/2 bg-gray-200 rounded mb-4 skeleton"></div>
        <div class="mt-auto flex gap-2">
            <div class="h-9 flex-1 bg-gray-200 rounded skeleton"></div>
            <div class="h-9 w-10 bg-gray-200 rounded skeleton"></div>
        </div>
      </div>
    `
        )
        .join("");
}

function productCardHTML(p) {
    // Logic giảm giá
    let discountTag = "";
    if (p.compare_at && p.compare_at > p.price) {
        const percent = Math.round(
            ((p.compare_at - p.price) / p.compare_at) * 100
        );
        discountTag = `<div class="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">-${percent}%</div>`;
    }

    // Logic tồn kho
    const stock = parseInt(p.stock_quantity || 0);
    const isOutOfStock = stock <= 0;

    const btnBuyClass = isOutOfStock
        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
        : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm btn-buy-now";

    const btnCartClass = isOutOfStock
        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
        : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:scale-95 hover:border-blue-200 add-to-cart-btn";

    return `
    <div class="bg-white rounded-xl border border-gray-200 p-3 flex flex-col h-full relative group hover:shadow-lg transition-shadow duration-300">
      <a href="product.html?id=${encodeURIComponent(
          p.id
      )}" class="block relative overflow-hidden rounded-lg bg-gray-50">
        <img src="${p.image}" alt="${p.title}" loading="lazy" 
             class="w-full h-48 object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105 ${
                 isOutOfStock ? "grayscale opacity-80" : ""
             }" />
        ${discountTag}
        ${
            isOutOfStock
                ? '<div class="absolute inset-0 flex items-center justify-center bg-black/10"><span class="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded">HẾT HÀNG</span></div>'
                : ""
        }
      </a>
      
      <div class="mt-3 flex-1 flex flex-col">
        <a href="product.html?id=${encodeURIComponent(p.id)}">
            <h3 class="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 hover:text-blue-600 transition-colors min-h-[40px]" title="${
                p.title
            }">
                ${p.title}
            </h3>
        </a>

        <div class="mt-auto pt-2">
            <div class="flex flex-wrap items-baseline gap-2">
                <span class="text-lg font-bold ${
                    isOutOfStock ? "text-gray-500" : "text-blue-600"
                }">${formatPrice(p.price)}</span>
                ${
                    p.compare_at && p.compare_at > p.price
                        ? `<span class="text-xs text-gray-400 line-through">${formatPrice(
                              p.compare_at
                          )}</span>`
                        : ""
                }
            </div>
        </div>
      </div>

      <div class="flex gap-2 mt-4">
        <button 
          class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1 ${btnBuyClass}"
          data-id="${p.id}" ${isOutOfStock ? "disabled" : ""}>
          ${isOutOfStock ? "Hết hàng" : "Mua ngay"}
        </button>
        
        <button 
          class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors border border-transparent ${btnCartClass}" 
          title="Thêm vào giỏ" data-id="${p.id}" ${
        isOutOfStock ? "disabled" : ""
    }>
          <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        </button>
        
        <button class="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-500 active:scale-95 transition-colors border border-transparent hover:border-red-200 btn-add-to-wishlist" title="Thêm vào yêu thích" data-id="${
            p.id
        }">
          <svg class="w-5 h-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// 3. XỬ LÝ SỰ KIỆN (ACTIONS)
// ============================================================

function attachProductEvents(container) {
    container.querySelectorAll(".add-to-cart-btn").forEach((btn) =>
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddToCartClick(e.currentTarget, btn.dataset.id);
        })
    );

    container.querySelectorAll(".btn-buy-now").forEach((btn) =>
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBuyNowClick(btn.dataset.id);
        })
    );

    container.querySelectorAll(".btn-add-to-wishlist").forEach((btn) =>
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddToWishlistClick(e, btn.dataset.id);
        })
    );
}

function checkLogin() {
    const token = getToken();
    if (!token) {
        showToast("Vui lòng đăng nhập để thực hiện", "error");
        setTimeout(() => (window.location.href = "login.html"), 800);
        return false;
    }
    return true;
}

async function handleAddToCartClick(btnElement, productId) {
    if (!checkLogin()) return;

    const originalContent = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;

    try {
        await api.addToCart(productId, 1);
        syncCartBadge();

        btnElement.classList.remove(
            "bg-gray-100",
            "text-gray-600",
            "hover:bg-blue-50"
        );
        btnElement.classList.add(
            "bg-green-600",
            "text-white",
            "border-green-600"
        );
        btnElement.innerHTML = `<i class="fa-solid fa-check"></i>`;
        showToast("Đã thêm vào giỏ hàng", "success");

        setTimeout(() => {
            btnElement.classList.remove(
                "bg-green-600",
                "text-white",
                "border-green-600"
            );
            btnElement.classList.add(
                "bg-gray-100",
                "text-gray-600",
                "hover:bg-blue-50"
            );
            btnElement.innerHTML = originalContent;
            btnElement.disabled = false;
        }, 1500);
    } catch (err) {
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
        showToast(err.message || "Lỗi thêm giỏ hàng", "error");
    }
}

async function handleBuyNowClick(productId) {
    if (!checkLogin()) return;
    try {
        await api.addToCart(productId, 1);
        syncCartBadge();
        const itemsToCheckout = [parseInt(productId)];
        localStorage.setItem(
            "checkout_selected_items",
            JSON.stringify(itemsToCheckout)
        );
        window.location.href = "checkout.html";
    } catch (err) {
        showToast(err.message || "Lỗi mua hàng", "error");
    }
}

async function handleAddToWishlistClick(e, productId) {
    if (!checkLogin()) return;
    const btn = e.currentTarget;
    try {
        await api.addWishlist(productId);
        showToast("Đã thêm vào yêu thích", "success");
        const icon = btn.querySelector("svg");
        if (icon) {
            icon.setAttribute("fill", "currentColor");
            btn.classList.add("text-red-500", "bg-red-100", "border-red-200");
        }
    } catch (err) {
        console.error(err);
        showToast(err.message || "Lỗi thêm yêu thích", "error");
    }
}

// ============================================================
// 4. TRANG CHI TIẾT (DETAIL PAGE)
// ============================================================

function initProductTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");
    if (!tabs.length) return;

    tabs.forEach((t) => {
        const newTab = t.cloneNode(true);
        t.parentNode.replaceChild(newTab, t);
        newTab.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach((x) => {
                x.classList.remove("text-blue-600", "border-blue-600");
                x.classList.add(
                    "text-gray-500",
                    "hover:text-gray-700",
                    "border-transparent"
                );
            });
            newTab.classList.remove(
                "text-gray-500",
                "hover:text-gray-700",
                "border-transparent"
            );
            newTab.classList.add("text-blue-600", "border-blue-600");
            contents.forEach((c) => c.classList.add("hidden"));
            const targetId = newTab.dataset.tab + "-content";
            document.getElementById(targetId)?.classList.remove("hidden");
        });
    });
}

async function initProductDetailPage() {
    if (!document.querySelector("#product-title")) return;
    const id = getQueryParam("id");
    if (!id) return;

    initProductTabs();

    try {
        const product = await api.getProduct(id);
        document.querySelector("#product-title").textContent = product.title;
        document.querySelector("#product-price").textContent = formatPrice(
            product.price
        );
        if (product.compare_at)
            document.querySelector("#product-compare-price").textContent =
                formatPrice(product.compare_at);
        document.querySelector("#product-description").innerHTML =
            product.description?.replace(/\n/g, "<br>") || "Chưa có mô tả.";

        // Check Tồn kho chi tiết
        const stockEl = document.getElementById("product-stock-status");
        const btnAdd = document.querySelector("#btn-add-cart");
        const btnBuy = document.querySelector("#btn-buy-now");
        const stockQty = parseInt(product.stock_quantity || 0);

        if (stockEl) {
            if (stockQty > 0) {
                stockEl.innerHTML = `<span class="text-green-600 font-medium flex items-center gap-1"><i class="fa-solid fa-check-circle"></i> Còn hàng (${stockQty})</span>`;
                if (btnAdd) btnAdd.disabled = false;
                if (btnBuy) btnBuy.disabled = false;

                if (btnAdd) {
                    const newBtn = btnAdd.cloneNode(true);
                    btnAdd.parentNode.replaceChild(newBtn, btnAdd);
                    newBtn.addEventListener("click", (e) =>
                        handleAddToCartClick(e.currentTarget, product.id)
                    );
                }
                if (btnBuy) {
                    const newBtn = btnBuy.cloneNode(true);
                    btnBuy.parentNode.replaceChild(newBtn, btnBuy);
                    newBtn.addEventListener("click", () =>
                        handleBuyNowClick(product.id)
                    );
                }
            } else {
                stockEl.innerHTML = `<span class="text-red-500 font-bold flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Hết hàng</span>`;
                if (btnAdd) {
                    btnAdd.disabled = true;
                    btnAdd.innerHTML = "Hết hàng";
                    btnAdd.className =
                        "w-full bg-gray-200 text-gray-500 border-2 border-gray-300 p-3 rounded-lg font-bold cursor-not-allowed flex items-center justify-center gap-2";
                }
                if (btnBuy) {
                    btnBuy.disabled = true;
                    btnBuy.className =
                        "w-full bg-gray-300 text-gray-500 p-3 rounded-lg font-bold text-lg cursor-not-allowed shadow-none";
                }
            }
        }

        // Breadcrumb
        const breadcrumb = document.getElementById("breadcrumb-container");
        if (breadcrumb) {
            breadcrumb.innerHTML = `
            <a href="index.html" class="hover:text-blue-600">Trang chủ</a>
            <span class="text-gray-300 mx-2">/</span>
            <a href="category.html?slug=${
                product.category
            }" class="hover:text-blue-600 capitalize">${
                product.category || "Sản phẩm"
            }</a>
            <span class="text-gray-300 mx-2">/</span>
            <span class="text-gray-700 font-medium truncate max-w-[200px]">${
                product.title
            }</span>
        `;
        }

        // Gallery
        const mainImg = document.querySelector("#main-image");
        const galleryContainer = document.querySelector("#gallery-container");
        mainImg.src = product.image;
        const images =
            product.gallery && product.gallery.length > 0
                ? product.gallery
                : [product.image];

        galleryContainer.innerHTML = images
            .map(
                (imgUrl, index) => `
        <div class="w-16 h-16 border-2 border-transparent hover:border-blue-500 rounded-lg overflow-hidden cursor-pointer transition-all ${
            index === 0 ? "border-blue-500" : ""
        }" 
             onclick="changeMainImage(this, '${imgUrl}')">
            <img src="${imgUrl}" class="w-full h-full object-cover" />
        </div>
    `
            )
            .join("");

        window.changeMainImage = (thumbEl, newSrc) => {
            mainImg.src = newSrc;
            document
                .querySelectorAll("#gallery-container > div")
                .forEach((div) =>
                    div.classList.remove(
                        "border-blue-500",
                        "border-transparent"
                    )
                );
            thumbEl.classList.add("border-blue-500");
        };

        // Render Specs
        const specsTemplate = product.specs_template;
        renderSpecs(product.specs, specsTemplate, product.category);
    } catch (err) {
        console.error(err);
    }
}

function renderSpecs(specsJson, specsTemplateJson, category) {
    const container = document.getElementById("specs-container");
    if (!container) return;

    let specs = {};
    try {
        specs =
            typeof specsJson === "string"
                ? JSON.parse(specsJson)
                : specsJson || {};
    } catch (e) {}

    let template = [];
    if (specsTemplateJson) {
        try {
            template =
                typeof specsTemplateJson === "string"
                    ? JSON.parse(specsTemplateJson)
                    : specsTemplateJson;
        } catch (e) {}
    }

    // Fallback nếu không có template từ DB
    if (!template || template.length === 0) {
        template = SPECS_MAPPING[category] || SPECS_MAPPING["default"];
    }

    if (!template || template.length === 0) {
        container.innerHTML =
            '<p class="p-4 text-center text-gray-500 italic">Chưa có thông số kỹ thuật.</p>';
        return;
    }

    let html = "";
    template.forEach((group) => {
        html += `<div class="px-4 py-2 bg-gray-100 font-bold text-gray-800 text-sm uppercase mt-2 first:mt-0 rounded-t">${group.group}</div><ul class="text-sm text-gray-700 bg-white border border-gray-100 rounded-b mb-4">`;
        group.fields.forEach((field) => {
            const key = field.k || field.key;
            const label = field.l || field.label;
            let value = specs[key];
            if (!value)
                value =
                    '<span class="text-gray-400 italic text-xs">Đang cập nhật</span>';
            html += `<li class="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 last:border-0"><span class="col-span-5 text-gray-500 font-medium">${label}:</span><span class="col-span-7 font-semibold text-gray-900">${value}</span></li>`;
        });
        html += `</ul>`;
    });
    container.innerHTML = html;
}

// ============================================================
// 5. LOGIC DANH MỤC & TRANG CHỦ
// ============================================================

let currentCategorySlug = "all";

async function initCategoryPage() {
    if (!document.querySelector("#category-products")) return;

    // Logic Sidebar Mobile
    const mobileBtn = document.getElementById("mobile-filter-toggle");
    const closeBtn = document.getElementById("close-filter-btn");
    const sidebar = document.getElementById("filter-sidebar");

    if (mobileBtn && sidebar)
        mobileBtn.addEventListener("click", () =>
            sidebar.classList.add("active")
        );
    if (closeBtn && sidebar)
        closeBtn.addEventListener("click", () =>
            sidebar.classList.remove("active")
        );

    // Lấy tham số từ URL
    const slug = getQueryParam("slug");
    const query = getQueryParam("q"); // <--- Lấy từ khóa tìm kiếm

    currentCategorySlug = slug || "all";
    const titleEl = document.querySelector("#category-title");

    // 👇 CẬP NHẬT LOGIC: Hiển thị tiêu đề theo tìm kiếm
    if (query) {
        if (titleEl) titleEl.textContent = `Kết quả tìm kiếm: "${query}"`;
        document.title = `Tìm kiếm: ${query} - TechHub`;
    } else {
        // Logic cũ: Hiển thị theo danh mục
        if (titleEl)
            titleEl.textContent =
                currentCategorySlug === "all"
                    ? "Tất cả sản phẩm"
                    : `Danh mục: ${currentCategorySlug.toUpperCase()}`;
    }

    await loadBrandFilter(currentCategorySlug);
    attachFilterEvents();
    loadProductsWithFilter(); // Gọi hàm tải sản phẩm
}

async function loadBrandFilter(category) {
    const brandContainer = document.getElementById("brand-filters");
    if (!brandContainer) return;
    try {
        const res = await api.getBrands(category);
        const brands = res.data || [];
        if (brands.length === 0) {
            brandContainer.innerHTML =
                '<p class="text-sm text-gray-500">Không có thương hiệu</p>';
            return;
        }
        brandContainer.innerHTML = brands
            .map(
                (brand) => `
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" name="brand-filter" value="${brand}" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /><span class="text-sm text-gray-700">${brand}</span></label>
        `
            )
            .join("");
    } catch (err) {
        console.error("Lỗi tải brands:", err);
    }
}

function attachFilterEvents() {
    document
        .getElementById("filter-price-btn")
        ?.addEventListener("click", loadProductsWithFilter);
    document
        .getElementById("brand-filters")
        ?.addEventListener("change", loadProductsWithFilter);
    document
        .getElementById("sort-by")
        ?.addEventListener("change", loadProductsWithFilter);
}

async function loadProductsWithFilter() {
    const container = document.querySelector("#category-products");
    if (!container) return;

    container.innerHTML = renderSkeleton(6);

    // Lấy giá trị các bộ lọc
    const minPrice = document.getElementById("min-price")?.value;
    const maxPrice = document.getElementById("max-price")?.value;
    const sortBy = document.getElementById("sort-by")?.value;
    const checkedBrands = Array.from(
        document.querySelectorAll('input[name="brand-filter"]:checked')
    ).map((cb) => cb.value);

    // 👇 THÊM: Lấy query từ URL để lọc
    const searchQuery = getQueryParam("q");

    let params = {};

    // Chỉ lọc theo category nếu KHÔNG phải là tìm kiếm (hoặc tùy logic bạn muốn kết hợp)
    if (currentCategorySlug !== "all") params.category = currentCategorySlug;

    // 👇 THÊM: Gửi tham số q lên API
    if (searchQuery) params.q = searchQuery;

    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (checkedBrands.length > 0) params.brand = checkedBrands.join(",");
    if (sortBy) params.sort = sortBy;

    try {
        const data = await api.getProducts(params);
        const products = data.data || data.items || data;

        if (!products.length) {
            container.innerHTML = `
                <div class="col-span-full text-center py-10">
                    <div class="mb-4 text-gray-300 text-6xl"><i class="fa-solid fa-magnifying-glass"></i></div>
                    <p class="text-gray-500 mb-2">Không tìm thấy sản phẩm phù hợp.</p>
                    ${
                        searchQuery
                            ? '<a href="category.html" class="text-blue-600 hover:underline">Xem tất cả sản phẩm</a>'
                            : '<button onclick="location.reload()" class="text-blue-600 hover:underline text-sm">Xóa bộ lọc</button>'
                    }
                </div>`;
            return;
        }

        container.innerHTML = products.map(productCardHTML).join("");
        attachProductEvents(container);
        document.getElementById("filter-sidebar")?.classList.remove("active");
    } catch (err) {
        console.error(err);
        container.innerHTML =
            '<p class="col-span-full text-center text-red-500">Lỗi tải sản phẩm.</p>';
    }
}
// 👇 LOGIC DANH MỤC TRANG CHỦ (FIX LỖI XOAY)
async function initHomeCategories() {
    const container = document.getElementById("home-categories-container");
    if (!container) return;

    try {
        const res = await api.getCategories();
        const categories = res.data || [];
        const count = categories.length;

        if (count === 0) {
            container.innerHTML =
                '<p class="col-span-full text-center text-gray-500">Chưa có danh mục.</p>';
            return;
        }

        // Tính số cột
        let desktopCols = count;
        if (count > 6 && count <= 12) {
            desktopCols = Math.ceil(count / 2);
        } else if (count > 12) {
            desktopCols = Math.ceil(count / 3);
        }

        container.style.setProperty("--desktop-cols", desktopCols);
        container.className =
            "grid grid-cols-2 md:grid-cols-[repeat(var(--desktop-cols),minmax(0,1fr))] gap-4 md:gap-6";

        const gradients = [
            "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
            "from-purple-50 to-purple-100 border-purple-200 text-purple-700",
            "from-orange-50 to-orange-100 border-orange-200 text-orange-700",
            "from-green-50 to-green-100 border-green-200 text-green-700",
            "from-pink-50 to-pink-100 border-pink-200 text-pink-700",
            "from-teal-50 to-teal-100 border-teal-200 text-teal-700",
        ];

        const html = categories
            .map((cat, index) => {
                const styleClass = gradients[index % gradients.length];

                let iconHtml = `<span class="text-4xl drop-shadow-sm">${
                    cat.icon || "📦"
                }</span>`;
                if (cat.icon && cat.icon.includes("fa-")) {
                    iconHtml = `<i class="${cat.icon} text-3xl mb-2"></i>`;
                }

                return `
            <a href="category.html?slug=${cat.slug}" 
               class="group relative flex flex-col items-center justify-center p-6 rounded-2xl border bg-gradient-to-br ${styleClass} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-32 md:h-40">
                <div class="mb-3 transform group-hover:scale-110 transition-transform duration-300">
                    ${iconHtml}
                </div>
                <h3 class="font-bold text-sm md:text-base text-gray-900 text-center leading-tight line-clamp-2">${cat.name}</h3>
            </a>
            `;
            })
            .join("");

        container.innerHTML = html;
    } catch (e) {
        console.error("Lỗi tải danh mục trang chủ:", e);
        container.innerHTML =
            '<p class="col-span-full text-center text-red-500">Lỗi tải danh mục.</p>';
    }
}

async function initHomePage() {
    if (!document.getElementById("hero-section")) return;

    const componentMap = {
        "#hero-section": "components/_hero.html",
        "#feature-bar-section": "components/_feature-bar.html",
        "#categories-section": "components/_categories.html",
        "#best-sellers-section": "components/_best-sellers.html",
        "#new-products-section": "components/_new-products.html",
        "#promo-banners-section": "components/_promo-banners.html",
        "#testimonials-section": "components/_testimonials.html",
        "#newsletter-section": "components/_newsletter.html",
    };

    try {
        await loadComponents(componentMap);
        // Gọi render danh mục sau khi HTML có sẵn
        initHomeCategories();
    } catch (e) {
        console.error(e);
    }

    const container = document.querySelector("#best-sellers");
    if (!container) return;

    container.innerHTML = renderSkeleton(4);

    try {
        const data = await api.getProducts({ page: 1, sort: "newest" });
        const products = data.data || data.items || data;
        container.innerHTML = products
            .slice(0, 8)
            .map(productCardHTML)
            .join("");
        attachProductEvents(container);
    } catch (err) {
        container.innerHTML = `<p class="text-gray-500">Không tải được sản phẩm.</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initHomePage();
    initCategoryPage();
    initProductDetailPage();
});
