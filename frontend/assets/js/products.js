// assets/js/products.js

import { api } from './api.js';
import { getQueryParam } from './utils/url.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { loadComponents } from './utils/dom.js';
import { formatPrice, showToast } from './utils/common.js';

// ============================================================
// 1. CẤU HÌNH MẶC ĐỊNH CHO THÔNG SỐ (SPECS)
// ============================================================
const SPECS_MAPPING = {
    phones: [
        { group: "Cấu hình", fields: [{ k: "os", l: "HĐH" }, { k: "cpu", l: "Chip" }, { k: "ram", l: "RAM" }, { k: "storage", l: "Bộ nhớ" }] },
        { group: "Màn hình", fields: [{ k: "screen_size", l: "Kích thước" }, { k: "screen_res", l: "Độ phân giải" }] },
        { group: "Camera", fields: [{ k: "rear_cam_res", l: "Cam sau" }, { k: "front_cam_res", l: "Cam trước" }] },
        { group: "Pin", fields: [{ k: "battery_capacity", l: "Pin" }, { k: "charging_support", l: "Sạc" }] }
    ],
    laptops: [
        { group: "Cấu hình", fields: [{ k: "cpu", l: "CPU" }, { k: "ram", l: "RAM" }, { k: "storage", l: "Ổ cứng" }, { k: "gpu", l: "VGA" }] },
        { group: "Màn hình", fields: [{ k: "screen_size", l: "Kích thước" }, { k: "screen_res", l: "Độ phân giải" }] },
        { group: "Khác", fields: [{ k: "weight", l: "Trọng lượng" }, { k: "battery", l: "Pin" }] }
    ],
    default: [
        { group: "Thông số sản phẩm", fields: [{ k: "material", l: "Chất liệu" }, { k: "size", l: "Kích thước" }, { k: "origin", l: "Xuất xứ" }] }
    ]
};

// ============================================================
// 2. STATE CHO TRANG CHI TIẾT SẢN PHẨM (VARIANTS)
// ============================================================
let productState = {
    variants: [],          // Danh sách variants từ API
    selectedColor: null,   // Giá trị đang chọn cho màu
    selectedCapacity: null,// Giá trị đang chọn cho cấu hình (dung lượng)
    currentVariant: null,  // Variant hiện tại

    baseGallery: [],       // Gallery gốc của sản phẩm
    baseImage: null        // Ảnh đại diện gốc
};

// ============================================================
// 3. UI LISTING (CARD SẢN PHẨM - CÓ CHỌN NHANH + YÊU THÍCH)
// ============================================================

function renderSkeleton(count = 6) {
    return Array(count).fill(0).map(() => `
      <div class="bg-white rounded-xl border border-gray-200 p-3 flex flex-col h-full">
        <div class="relative overflow-hidden rounded-lg bg-gray-200 h-48 w-full skeleton mb-3"></div>
        <div class="h-4 w-3/4 bg-gray-200 rounded mb-2 skeleton"></div>
        <div class="h-4 w-1/2 bg-gray-200 rounded mb-4 skeleton"></div>
        <div class="mt-auto flex gap-2">
            <div class="h-9 flex-1 bg-gray-200 rounded skeleton"></div>
            <div class="h-9 w-10 bg-gray-200 rounded skeleton"></div>
        </div>
      </div>
    `).join('');
}

// Helper lấy cấu hình từ variant (như đã làm ở detail)
function getCardVariantCapacity(v) {
    if (v.capacity && v.capacity.trim() !== '') return v.capacity;
    if (v.attributes) {
        try {
            const attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
            const vals = Object.entries(attrs)
                .filter(([k, val]) => k !== 'color' && val)
                .map(([k, val]) => val);
            if (vals.length > 0) return vals.join('/');
        } catch (e) {}
    }
    return '';
}

// Hàm render thẻ sản phẩm (có chọn màu/cấu hình + nút yêu thích)
function productCardHTML(p) {
    let discountTag = '';
    if (p.compare_at && p.compare_at > p.price) {
        const percent = Math.round(((p.compare_at - p.price) / p.compare_at) * 100);
        discountTag = `<div class="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10">-${percent}%</div>`;
    }

    const stock = parseInt(p.stock_quantity || 0);
    const isOutOfStock = stock <= 0;

    // Xử lý Variants để vẽ nút chọn
    let variantsHtml = '';
    let defaultVariantId = '';
    let displayPrice = p.price;
    let displayImage = p.image;

    // Nếu có biến thể, lấy danh sách Màu và Cấu hình
    if (p.variants && p.variants.length > 0) {
        const colors = [...new Set(
            p.variants
                .map(v => {
                    if (v.color && v.color.trim() !== '') return v.color;
                    if (v.attributes) {
                        try {
                            const attrs = typeof v.attributes === 'string'
                                ? JSON.parse(v.attributes)
                                : v.attributes;
                            return attrs && attrs.color ? attrs.color : null;
                        } catch (e) {
                            return null;
                        }
                    }
                    return null;
                })
                .filter(Boolean)
        )];

        // Mặc định chọn variant đầu tiên
        const firstVar = p.variants[0];
        defaultVariantId = firstVar.id;
        displayPrice = firstVar.price;
        if (firstVar.image) displayImage = firstVar.image;

        // HTML Chọn Màu (Hình tròn)
        let colorsHtml = '';
        if (colors.length > 0) {
            colorsHtml = `
                <div class="flex gap-1 mb-2 overflow-x-auto pb-1 custom-scrollbar">
                    ${colors.map((c, idx) => `
                        <button onclick="selectCardColor(this, ${p.id}, '${c.replace(/'/g, "\\'")}')" 
                                class="w-5 h-5 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition focus:outline-none ring-1 ring-transparent focus:ring-blue-500 ${idx===0 ? 'ring-blue-500 ring-offset-1' : ''}" 
                                style="background-color: ${getColorHex(c)};" 
                                title="${c}"
                                data-color="${c}">
                        </button>
                    `).join('')}
                </div>`;
        }

        // HTML Chọn Cấu hình (Nút nhỏ) - Mặc định hiện cấu hình của màu đầu tiên
        variantsHtml = `
            <div class="mt-2 px-1 card-variants-area" 
                 id="card-vars-${p.id}" 
                 data-variants='${JSON.stringify(p.variants).replace(/'/g, "&apos;")}'>
                ${colorsHtml}
                <div class="flex flex-wrap gap-1 text-[10px] capacity-container">
                    ${renderCardCapacities(p.variants, colors[0])}
                </div>
            </div>
        `;
    }

    const btnBuyClass = isOutOfStock
        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
        : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm btn-buy-now";

    const btnCartClass = isOutOfStock
        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
        : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:scale-95 hover:border-blue-200 add-to-cart-btn";

    return `
    <div class="bg-white rounded-xl border border-gray-200 p-3 flex flex-col h-full relative group hover:shadow-lg transition-shadow duration-300 product-card" id="product-card-${p.id}">
      
      <!-- Nút yêu thích -->
      <button onclick="toggleWishlist(this, ${p.id})" 
              class="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all hover:scale-110"
              title="Thêm vào yêu thích">
          <i class="fa-regular fa-heart text-lg"></i>
      </button>

      <a href="product.html?id=${encodeURIComponent(p.id)}" class="block relative overflow-hidden rounded-lg bg-gray-50">
        <img src="${displayImage}" id="img-card-${p.id}" alt="${p.title}" loading="lazy" 
             class="w-full h-48 object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105 ${isOutOfStock ? 'grayscale opacity-80' : ''}" />
        ${discountTag}
        ${isOutOfStock ? '<div class="absolute inset-0 flex items-center justify-center bg-black/10"><span class="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded">HẾT HÀNG</span></div>' : ''}
      </a>
      
      <div class="mt-3 flex-1 flex flex-col">
        <a href="product.html?id=${encodeURIComponent(p.id)}">
            <h3 class="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 hover:text-blue-600 transition-colors min-h-[40px]" title="${p.title}">
                ${p.title}
            </h3>
        </a>
        
        ${variantsHtml}

        <div class="mt-auto pt-2">
            <div class="flex flex-wrap items-baseline gap-2">
                <span class="text-lg font-bold ${isOutOfStock ? 'text-gray-500' : 'text-blue-600'}" id="price-card-${p.id}">${formatPrice(displayPrice)}</span>
                ${p.compare_at && p.compare_at > p.price ? `<span class="text-xs text-gray-400 line-through">${formatPrice(p.compare_at)}</span>` : ''}
            </div>
        </div>
      </div>

      <div class="flex gap-2 mt-4">
        <button class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1 ${btnBuyClass}"
          data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>
          ${isOutOfStock ? 'Hết hàng' : 'Mua ngay'}
        </button>
        
        <button class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors border border-transparent ${btnCartClass}" 
          title="Thêm vào giỏ" 
          id="btn-add-card-${p.id}"
          data-id="${p.id}" 
          data-variant-id="${defaultVariantId}"
          ${isOutOfStock ? 'disabled' : ''}>
          <i class="fa-solid fa-cart-plus"></i>
        </button>
      </div>
    </div>
  `;
}

// Helper: Map tên màu sang mã Hex để hiển thị nút tròn đẹp
function getColorHex(colorName) {
    if (!colorName) return '#e5e7eb';
    const map = {
        'đen': '#000000', 'black': '#000000',
        'trắng': '#ffffff', 'white': '#ffffff',
        'xanh': '#3b82f6', 'blue': '#3b82f6',
        'đỏ': '#ef4444', 'red': '#ef4444',
        'vàng': '#eab308', 'gold': '#eab308',
        'tím': '#a855f7', 'purple': '#a855f7',
        'bạc': '#d1d5db', 'silver': '#d1d5db',
        'xám': '#4b5563', 'grey': '#4b5563',
        'titan': '#9ca3af',
        'cam': '#f97316',
        'hồng': '#ec4899', 'pink': '#ec4899'
    };
    return map[colorName.toLowerCase()] || '#e5e7eb'; // Mặc định xám nhạt
}

// Helper: Render các nút Capacity dựa trên màu đã chọn
function renderCardCapacities(variants, selectedColor) {
    if (!selectedColor) return '';
    
    // Lọc variants theo màu (case-insensitive)
    const filtered = variants.filter(v => {
        let c = v.color;
        if ((!c || c.trim() === '') && v.attributes) {
            try {
                const attrs = typeof v.attributes === 'string'
                    ? JSON.parse(v.attributes)
                    : v.attributes;
                c = attrs && attrs.color ? attrs.color : '';
            } catch (e) {
                c = '';
            }
        }
        return c && c.toLowerCase() === selectedColor.toLowerCase();
    });

    return filtered.map((v, idx) => {
        const cap = getCardVariantCapacity(v);
        if (!cap) return '';
        const activeClass = idx === 0
            ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300';
        
        return `<button onclick="selectCardCapacity(this, ${v.product_id}, ${v.id}, ${v.price}, '${(v.image || '').replace(/'/g, "\\'")}')" 
                        class="px-1.5 py-0.5 rounded border transition ${activeClass}">
                    ${cap}
                </button>`;
    }).join('');
}

// --- GLOBAL FUNCTIONS CHO HTML INLINE GỌI ---

// Chọn màu trên card
window.selectCardColor = (btn, productId, color) => {
    const container = btn.parentElement;
    container.querySelectorAll('button').forEach(b => b.classList.remove('ring-blue-500', 'ring-offset-1'));
    btn.classList.add('ring-blue-500', 'ring-offset-1');

    const wrapper = document.getElementById(`card-vars-${productId}`);
    if (!wrapper) return;
    const variants = JSON.parse(wrapper.dataset.variants.replace(/&apos;/g, "'"));

    const capContainer = wrapper.querySelector('.capacity-container');
    capContainer.innerHTML = renderCardCapacities(variants, color);

    const firstCapBtn = capContainer.querySelector('button');
    if (firstCapBtn) {
        firstCapBtn.click();
    } else {
        const match = variants.find(v => {
            let c = v.color;
            if ((!c || c.trim() === '') && v.attributes) {
                try {
                    const attrs = typeof v.attributes === 'string'
                        ? JSON.parse(v.attributes)
                        : v.attributes;
                    c = attrs && attrs.color ? attrs.color : '';
                } catch (e) {
                    c = '';
                }
            }
            return c && c.toLowerCase() === color.toLowerCase();
        });
        if (match) updateCardDetails(productId, match.id, match.price, match.image);
    }
};

// Chọn cấu hình trên card
window.selectCardCapacity = (btn, productId, variantId, price, image) => {
    const container = btn.parentElement;
    container.querySelectorAll('button').forEach(b => {
        b.className = 'px-1.5 py-0.5 rounded border transition bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300';
    });
    btn.className = 'px-1.5 py-0.5 rounded border transition bg-blue-100 text-blue-700 border-blue-200 font-bold';

    updateCardDetails(productId, variantId, price, image);
};

// Cập nhật giá/ảnh/nút giỏ sau khi chọn variant trên card
function updateCardDetails(productId, variantId, price, image) {
    const priceEl = document.getElementById(`price-card-${productId}`);
    if (priceEl) priceEl.textContent = formatPrice(price);

    if (image && image !== 'null' && image !== '') {
        const imgEl = document.getElementById(`img-card-${productId}`);
        if (imgEl) imgEl.src = image;
    }

    const btnAdd = document.getElementById(`btn-add-card-${productId}`);
    if (btnAdd) btnAdd.dataset.variantId = variantId;
}

// Nút yêu thích (wishlist)
window.toggleWishlist = async (btn, productId) => {
    if (event) event.stopPropagation();
    
    if (!checkLogin()) return;

    const icon = btn.querySelector('i');

    try {
        await api.request('/wishlist', {
            method: 'POST',
            auth: true,
            body: { product_id: productId }
        });

        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'text-red-500', 'animate-ping-once');
        showToast('Đã thêm vào yêu thích', 'success');
        
        setTimeout(() => icon.classList.remove('animate-ping-once'), 500);

    } catch (e) {
        if (e.message && e.message.includes('Duplicate')) {
            showToast('Sản phẩm này đã có trong yêu thích', 'info');
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid', 'text-red-500');
        } else {
            showToast(e.message || 'Lỗi thêm yêu thích', 'error');
        }
    }
};

function attachProductEvents(container) {
    container.querySelectorAll('.add-to-cart-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddToCartClick(e.currentTarget, btn.dataset.id);
        })
    );
    container.querySelectorAll('.btn-buy-now').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBuyNowClick(btn.dataset.id);
        })
    );
}

// ============================================================
// 4. LOGIN CHECK + LOGIC CART CHO LISTING (HOME/CATEGORY)
// ============================================================

function checkLogin() {
    const token = getToken();
    if (!token) {
        showToast('Vui lòng đăng nhập', 'error');
        setTimeout(() => (window.location.href = 'login.html'), 800);
        return false;
    }
    return true;
}

// Thêm vào giỏ từ danh sách (dùng variant_id nếu có)
async function handleAddToCartClick(btnElement, productId) {
    if (!checkLogin()) return;

    const originalContent = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;

    const variantId = btnElement.dataset.variantId || null;

    try {
        await api.request('/cart', {
            method: 'POST',
            auth: true,
            body: {
                product_id: parseInt(productId),
                variant_id: variantId ? parseInt(variantId) : null,
                quantity: 1
            }
        });

        syncCartBadge();

        btnElement.classList.remove('bg-gray-100', 'text-gray-600');
        btnElement.classList.add('bg-green-600', 'text-white', 'border-green-600');
        btnElement.innerHTML = `<i class="fa-solid fa-check"></i>`;
        showToast('Đã thêm vào giỏ hàng', 'success');

        setTimeout(() => {
            btnElement.classList.remove('bg-green-600', 'text-white', 'border-green-600');
            btnElement.classList.add('bg-gray-100', 'text-gray-600');
            btnElement.innerHTML = originalContent;
            btnElement.disabled = false;
        }, 1500);
    } catch (err) {
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
        showToast(err.message || 'Lỗi thêm giỏ hàng', 'error');
    }
}

// Mua ngay từ listing: đưa sang trang chi tiết để chọn option kỹ hơn
async function handleBuyNowClick(productId) {
    if (!checkLogin()) return;
    window.location.href = `product.html?id=${productId}`;
}

// ============================================================
// 5. TAB + SPECS CHO TRANG CHI TIẾT
// ============================================================

function initProductTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    if (!tabs.length) return;

    tabs.forEach((t) => {
        const newTab = t.cloneNode(true);
        t.parentNode.replaceChild(newTab, t);
        newTab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((x) => {
                x.classList.remove('text-blue-600', 'border-blue-600');
                x.classList.add('text-gray-500', 'hover:text-gray-700', 'border-transparent');
            });
            newTab.classList.remove('text-gray-500', 'hover:text-gray-700', 'border-transparent');
            newTab.classList.add('text-blue-600', 'border-blue-600');

            contents.forEach((c) => c.classList.add('hidden'));
            const targetId = newTab.dataset.tab + '-content';
            document.getElementById(targetId)?.classList.remove('hidden');
        });
    });
}

function renderSpecs(specsJson, specsTemplateJson, category) {
    const container = document.getElementById('specs-container');
    if (!container) return;

    let specs = {};
    try {
        specs = typeof specsJson === 'string' ? JSON.parse(specsJson) : specsJson || {};
    } catch (e) {}

    let template = [];
    if (specsTemplateJson) {
        try {
            template = typeof specsTemplateJson === 'string' ? JSON.parse(specsTemplateJson) : specsTemplateJson;
        } catch (e) {}
    }
    if (!template || template.length === 0) {
        template = SPECS_MAPPING[category] || SPECS_MAPPING['default'];
    }

    if (!template || template.length === 0) {
        container.innerHTML = '<p class="p-4 text-center text-gray-500 italic">Chưa có thông số kỹ thuật.</p>';
        return;
    }

    let html = '';
    template.forEach((group) => {
        html += `
            <div class="px-4 py-2 bg-gray-100 font-bold text-gray-800 text-sm uppercase mt-2 first:mt-0 rounded-t">
                ${group.group}
            </div>
            <ul class="text-sm text-gray-700 bg-white border border-gray-100 rounded-b mb-4">
        `;
        if (group.fields) {
            group.fields.forEach((field) => {
                const key = field.k || field.key;
                const label = field.l || field.label;
                let value = specs[key] || '';

                const isEmpty = !value;
                const display = value || 'Đang cập nhật';

                html += `
                <li class="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 last:border-0">
                    <span class="col-span-5 text-gray-500 font-medium">${label}:</span>
                    <span
                        class="col-span-7 font-semibold text-gray-900 ${isEmpty ? 'text-gray-400 italic text-xs font-normal' : ''}"
                        id="spec-val-${key}"
                        data-spec-key="${key}"
                        data-original="${display}"
                    >${display}</span>
                </li>`;
            });
        }
        html += `</ul>`;
    });
    container.innerHTML = html;
}

// ============================================================
// 6. HELPER LẤY COLOR / CAPACITY TỪ attributes
// ============================================================

function getVariantColor(v) {
    if (v.attributes && v.attributes.color) return v.attributes.color;
    return v.color || null;
}

// Hàm này đã được nâng cấp để lấy mọi thuộc tính không phải là 'color'
function getVariantCapacity(v) {
    if (v.capacity && v.capacity.trim() !== '') return v.capacity;

    if (v.attributes) {
        if (v.attributes.capacity) return v.attributes.capacity;

        const otherValues = [];
        for (const [key, val] of Object.entries(v.attributes)) {
            if (key !== 'color' && val) {
                otherValues.push(val);
            }
        }
        if (otherValues.length > 0) {
            return otherValues.join(' / ');
        }
    }
    
    return null;
}

// ============================================================
// 7. VARIANT UI: MÀU → CẤU HÌNH (TRANG CHI TIẾT)
// ============================================================

function renderSelectors() {
    const container = document.getElementById('dynamic-variants');
    if (!container) return;
    
    container.classList.remove('hidden');
    container.innerHTML = '';

    // A. Danh sách màu (unique)
    const colors = [...new Set(
        productState.variants
            .map(v => getVariantColor(v))
            .filter(Boolean)
    )];

    if (colors.length > 0) {
        if (!productState.selectedColor) productState.selectedColor = colors[0];

        const colorDiv = document.createElement('div');
        colorDiv.className = 'mb-4';
        colorDiv.innerHTML =
            `<label class="block text-sm font-bold text-gray-700 mb-2">
                Màu sắc:
                <span class="font-normal text-gray-500" id="selected-color-label">${productState.selectedColor}</span>
             </label>`;

        const colorOptions = document.createElement('div');
        colorOptions.className = 'flex flex-wrap gap-2';

        colors.forEach(color => {
            const btn = document.createElement('button');
            const isActive = color === productState.selectedColor;

            btn.className = isActive
                ? 'px-4 py-2 border-2 border-blue-600 bg-blue-50 text-blue-700 rounded-lg font-bold transition'
                : 'px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:border-blue-400 transition';
            btn.textContent = color;

            btn.onclick = () => {
                productState.selectedColor = color;
                productState.selectedCapacity = null;
                productState.currentVariant = null;
                renderSelectors();
            };

            colorOptions.appendChild(btn);
        });

        colorDiv.appendChild(colorOptions);
        container.appendChild(colorDiv);
    }

    // B. Danh sách cấu hình theo màu
    if (productState.selectedColor) {
        const variantsByColor = productState.variants.filter(v =>
            getVariantColor(v) === productState.selectedColor
        );

        const capacities = [...new Set(
            variantsByColor
                .map(v => getVariantCapacity(v))
                .filter(Boolean)
        )];

        if (capacities.length > 0) {
            if (!productState.selectedCapacity) productState.selectedCapacity = capacities[0];

            const capDiv = document.createElement('div');
            capDiv.className = 'mb-4';
            capDiv.innerHTML =
                `<label class="block text-sm font-bold text-gray-700 mb-2">
                    Cấu hình:
                    <span class="font-normal text-gray-500">${productState.selectedCapacity}</span>
                 </label>`;

            const capOptions = document.createElement('div');
            capOptions.className = 'flex flex-wrap gap-2';

            capacities.forEach(cap => {
                const btn = document.createElement('button');
                const isActive = cap === productState.selectedCapacity;

                const v = variantsByColor.find(i => getVariantCapacity(i) === cap);

                btn.className = isActive
                    ? 'px-4 py-2 border-2 border-blue-600 bg-blue-50 text-blue-700 rounded-lg font-bold transition flex flex-col items-center min-w-[80px]'
                    : 'px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:border-blue-400 transition flex flex-col items-center min-w-[80px]';

                btn.innerHTML =
                    `<span>${cap}</span>
                     <span class="text-xs font-normal text-gray-500">${v ? formatPrice(v.price) : ''}</span>`;

                btn.onclick = () => {
                    productState.selectedCapacity = cap;
                    renderSelectors();
                };

                capOptions.appendChild(btn);
            });

            capDiv.appendChild(capOptions);
            container.appendChild(capDiv);
        }
    }

    // C. Tìm variant phù hợp + apply gallery/giá
    findAndApplyVariant();
}

// Cập nhật specs theo variant.attributes
function applyVariantSpecs(variant) {
    document.querySelectorAll('[id^="spec-val-"]').forEach(el => {
        const original = el.dataset.original || '';
        el.textContent = original;
        el.classList.remove('text-blue-600');
    });

    if (!variant || !variant.attributes) return;

    Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!value) return;
        const specEl = document.getElementById(`spec-val-${key}`);
        if (specEl) {
            specEl.textContent = value;
            specEl.classList.add('text-blue-600');
        }
    });
}

// Gallery
function renderProductGallery(images, activeImage) {
    const mainImg = document.getElementById('main-image');
    const galleryContainer = document.getElementById('gallery-container');
    if (!mainImg || !galleryContainer) return;

    if (!images || images.length === 0) {
        if (activeImage) images = [activeImage];
        else images = [];
    }

    if (!activeImage && images.length > 0) {
        activeImage = images[0];
    }

    if (activeImage) {
        mainImg.src = activeImage;
    }

    galleryContainer.innerHTML = images.map((imgUrl) => `
        <div class="w-16 h-16 border-2 ${imgUrl === activeImage ? 'border-blue-500' : 'border-transparent'} hover:border-blue-500 rounded-lg overflow-hidden cursor-pointer transition-all" onclick="changeMainImage(this, '${imgUrl}')">
            <img src="${imgUrl}" class="w-full h-full object-cover" />
        </div>
    `).join('');

    // Cho HTML inline dùng được
    window.changeMainImage = (el, src) => {
        const img = document.getElementById('main-image');
        if (img) img.src = src;
        document.querySelectorAll('#gallery-container > div').forEach(d => d.classList.remove('border-blue-500'));
        el.classList.add('border-blue-500');
    };
}

// ============================================================
// LOGIC MỚI: TÌM VÀ APPLY BIẾN THỂ + GALLERY THEO MÀU
// ============================================================

function findAndApplyVariant() {
    const variant = productState.variants.find(v =>
        getVariantColor(v) === productState.selectedColor &&
        getVariantCapacity(v) === productState.selectedCapacity
    );

    productState.currentVariant = variant || null;

    // Ảnh theo màu (color_galleries từ API)
    const colorGalleries = window.productData?.color_galleries || {};
    
    let images = [];
    const selectedColor = productState.selectedColor;

    if (selectedColor) {
        if (colorGalleries[selectedColor] && colorGalleries[selectedColor].length > 0) {
            images = colorGalleries[selectedColor];
        } else {
            const lowerSelected = selectedColor.toLowerCase().trim();
            const keyFound = Object.keys(colorGalleries).find(k => k.toLowerCase().trim() === lowerSelected);
            if (keyFound) {
                images = colorGalleries[keyFound];
            }
        }
    }

    if (images.length === 0) {
        if (variant && variant.image) {
            images = [variant.image];
        } else {
            images = productState.baseGallery;
        }
    }

    const activeImage = images && images.length > 0 ? images[0] : productState.baseImage;
    renderProductGallery(images, activeImage);

    // Giá / stock / nút mua
    if (variant) {
        const priceEl = document.getElementById('product-price');
        if (priceEl) priceEl.textContent = formatPrice(variant.price);

        applyVariantSpecs(variant);
        updateBuyButtonState(true, parseInt(variant.stock_quantity || 0));
    } else {
        if (productState.selectedColor) {
            applyVariantSpecs(null);
            updateBuyButtonState(false, 0); 
        } else {
            if (productState.baseGallery && productState.baseGallery.length > 0) {
                renderProductGallery(productState.baseGallery, productState.baseImage);
            }
            applyVariantSpecs(null);
            updateBuyButtonState(false, 0);
        }
    }
}

function updateBuyButtonState(isValid, stock) {
    const btnAdd = document.getElementById('btn-add-cart');
    const btnBuy = document.getElementById('btn-buy-now');
    const stockStatus = document.getElementById('product-stock-status');

    if (stockStatus) {
        if (!isValid) {
            stockStatus.innerHTML = '<span class="text-red-500">Phiên bản này không tồn tại.</span>';
        } else if (stock > 0) {
            stockStatus.innerHTML =
                `<span class="text-green-600 font-bold">
                    <i class="fa-solid fa-check"></i> Còn hàng (${stock})
                 </span>`;
        } else {
            stockStatus.innerHTML =
                `<span class="text-red-500 font-bold">
                    <i class="fa-solid fa-xmark"></i> Hết hàng
                 </span>`;
        }
    }

    if (!btnAdd || !btnBuy) return;

    if (!isValid) {
        btnAdd.disabled = true;
        btnAdd.textContent = 'Chọn phiên bản';
        btnAdd.className = "w-full bg-gray-200 text-gray-500 border-2 border-gray-300 p-3 rounded-lg font-bold cursor-not-allowed";
        btnBuy.disabled = true;
        btnBuy.className = "w-full bg-gray-300 text-gray-500 p-3 rounded-lg font-bold text-lg cursor-not-allowed shadow-none";
        return;
    }

    if (stock > 0) {
        btnAdd.disabled = false;
        btnAdd.textContent = 'Thêm vào giỏ';
        btnAdd.className = "w-full bg-white text-blue-600 border-2 border-blue-600 p-3 rounded-lg font-bold hover:bg-blue-50 transition";
        btnBuy.disabled = false;
        btnBuy.className = "w-full bg-red-600 text-white p-3 rounded-lg font-bold text-lg hover:bg-red-700 transition shadow-md active:scale-95";
    } else {
        btnAdd.disabled = true;
        btnAdd.textContent = 'Hết hàng';
        btnAdd.className = "w-full bg-gray-200 text-gray-500 border-2 border-gray-300 p-3 rounded-lg font-bold cursor-not-allowed";
        btnBuy.disabled = true;
        btnBuy.className = "w-full bg-gray-300 text-gray-500 p-3 rounded-lg font-bold text-lg cursor-not-allowed shadow-none";
    }
}

// ============================================================
// 8. DETAIL: ADD TO CART / BUY NOW (TRANG CHI TIẾT)
// ============================================================

async function detailAddToCart() {
    if (!checkLogin()) return;

    const productId = parseInt(getQueryParam('id'));
    if (!productId) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    let variantId = null;
    if (productState.variants.length > 0) {
        if (!productState.currentVariant) {
            showToast('Vui lòng chọn đầy đủ màu sắc và cấu hình', 'warning');
            return;
        }
        variantId = productState.currentVariant.id;
    }

    const btnAdd = document.getElementById('btn-add-cart');
    const originalText = btnAdd ? btnAdd.textContent : null;
    if (btnAdd) {
        btnAdd.disabled = true;
        btnAdd.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
    }

    try {
        await api.request('/cart', {
            method: 'POST',
            auth: true,
            body: {
                product_id: productId,
                variant_id: variantId,
                quantity: 1
            }
        });

        syncCartBadge();
        showToast('Đã thêm vào giỏ hàng', 'success');

        if (btnAdd && originalText) {
            btnAdd.innerHTML = originalText;
            btnAdd.disabled = false;
        }
    } catch (e) {
        if (btnAdd && originalText) {
            btnAdd.innerHTML = originalText;
            btnAdd.disabled = false;
        }
        showToast('Lỗi: ' + (e.message || 'Không thể thêm vào giỏ'), 'error');
    }
}

window.addToCart = detailAddToCart;

async function detailBuyNow() {
    await detailAddToCart();
    const productId = parseInt(getQueryParam('id'));
    if (!productId) return;
    localStorage.setItem('checkout_selected_items', JSON.stringify([productId]));
    window.location.href = 'checkout.html';
}

// ============================================================
// 9. INIT TRANG CHI TIẾT
// ============================================================

async function initProductDetailPage() {
    if (!document.querySelector('#product-title')) return;
    const id = getQueryParam('id');
    if (!id) return;

    initProductTabs();

    try {
        const product = await api.getProduct(id);
        window.productData = product;

        const breadcrumb = document.getElementById('breadcrumb-container');
        if (breadcrumb) {
            breadcrumb.innerHTML = `
                <a href="index.html" class="hover:text-blue-600">Trang chủ</a>
                <span class="text-gray-300 mx-2">/</span>
                <a href="category.html?slug=${product.category}" class="hover:text-blue-600 capitalize">
                    ${product.category_name || product.category || 'Sản phẩm'}
                </a>
                <span class="text-gray-300 mx-2">/</span>
                <span class="text-gray-700 font-medium truncate max-w-[200px]">${product.title}</span>
            `;
        }

        const titleEl = document.querySelector('#product-title');
        if (titleEl) titleEl.textContent = product.title;

        const priceEl = document.querySelector('#product-price');
        if (priceEl) priceEl.textContent = formatPrice(product.price);

        const compareEl = document.querySelector('#product-compare-price');
        if (compareEl) compareEl.textContent = product.compare_at ? formatPrice(product.compare_at) : '';

        const descEl = document.querySelector('#product-desc-content') || document.querySelector('#product-description');
        if (descEl) {
            descEl.innerHTML = product.description?.replace(/\n/g, '<br>') || 'Chưa có mô tả.';
        }

        const images = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];
        productState.baseGallery = images;
        productState.baseImage = product.image || images[0];

        renderProductGallery(images, productState.baseImage);
        renderSpecs(product.specs, product.specs_template, product.category);

        productState.variants = (product.variants || []).map(v => {
            if (typeof v.attributes === 'string') {
                try {
                    v.attributes = JSON.parse(v.attributes);
                } catch (e) {
                    v.attributes = {};
                }
            }
            return v;
        });
        productState.selectedColor = null;
        productState.selectedCapacity = null;
        productState.currentVariant = null;

        const variantsArea = document.getElementById('dynamic-variants');

        if (productState.variants.length > 0) {
            if (variantsArea) {
                variantsArea.innerHTML = '';
                variantsArea.classList.remove('hidden');
            }
            renderSelectors();
        } else {
            if (variantsArea) {
                variantsArea.classList.add('hidden');
            }
            const stockQty = parseInt(product.stock_quantity || 0);
            updateBuyButtonState(true, stockQty);
        }

        const btnAdd = document.getElementById('btn-add-cart');
        if (btnAdd) {
            btnAdd.onclick = (e) => {
                e.preventDefault();
                detailAddToCart();
            };
        }

        const btnBuy = document.getElementById('btn-buy-now');
        if (btnBuy) {
            btnBuy.onclick = (e) => {
                e.preventDefault();
                detailBuyNow();
            };
        }

    } catch (err) {
        console.error(err);
        showToast('Lỗi tải sản phẩm', 'error');
    }
}

// ============================================================
// 10. TRANG DANH MỤC / HOME
// ============================================================

let currentCategorySlug = 'all';

async function initCategoryPage() {
    if (!document.querySelector('#category-products')) return;

    const mobileBtn = document.getElementById('mobile-filter-toggle');
    const closeBtn = document.getElementById('close-filter-btn');
    const sidebar = document.getElementById('filter-sidebar');

    if (mobileBtn && sidebar) mobileBtn.addEventListener('click', () => sidebar.classList.add('active'));
    if (closeBtn && sidebar) closeBtn.addEventListener('click', () => sidebar.classList.remove('active'));

    const slug = getQueryParam('slug');
    currentCategorySlug = slug || 'all';

    const titleEl = document.querySelector('#category-title');
    if (titleEl) {
        titleEl.textContent =
            currentCategorySlug === 'all' ? 'Tất cả sản phẩm' : `Danh mục: ${currentCategorySlug.toUpperCase()}`;
    }

    await loadBrandFilter(currentCategorySlug);
    attachFilterEvents();
    loadProductsWithFilter();
}

async function loadBrandFilter(category) {
    const brandContainer = document.getElementById('brand-filters');
    if (!brandContainer) return;

    try {
        const res = await api.getBrands(category);
        const brands = res.data || [];

        if (brands.length === 0) {
            brandContainer.innerHTML = '<p class="text-sm text-gray-500">Không có thương hiệu</p>';
            return;
        }

        brandContainer.innerHTML = brands.map((brand) => `
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <input type="checkbox" name="brand-filter" value="${brand}" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <span class="text-sm text-gray-700">${brand}</span>
            </label>
        `).join('');
    } catch (err) {
        console.error('Lỗi tải brands:', err);
    }
}

function attachFilterEvents() {
    document.getElementById('filter-price-btn')?.addEventListener('click', loadProductsWithFilter);
    document.getElementById('brand-filters')?.addEventListener('change', loadProductsWithFilter);
    document.getElementById('sort-by')?.addEventListener('change', loadProductsWithFilter);
    document.getElementById('color-filters')?.addEventListener('change', loadProductsWithFilter);
}

async function loadProductsWithFilter() {
    const container = document.querySelector('#category-products');
    if (!container) return;

    container.innerHTML = renderSkeleton(6);

    const minPrice = document.getElementById('min-price')?.value;
    const maxPrice = document.getElementById('max-price')?.value;
    const sortBy = document.getElementById('sort-by')?.value;

    const checkedBrands = Array.from(document.querySelectorAll('input[name="brand-filter"]:checked')).map((cb) => cb.value);
    const checkedColors = Array.from(document.querySelectorAll('input[name="color-filter"]:checked')).map((cb) => cb.value);

    let params = {};
    if (currentCategorySlug !== 'all') params.category = currentCategorySlug;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (checkedBrands.length > 0) params.brand = checkedBrands.join(',');
    if (sortBy) params.sort = sortBy;
    if (checkedColors.length > 0) params.q = checkedColors.join(' ');

    try {
        const data = await api.getProducts(params);
        const products = data.data || data.items || data;

        if (!products.length) {
            container.innerHTML = `
                <div class="col-span-full text-center py-10">
                    <p class="text-gray-500 mb-2">Không tìm thấy sản phẩm phù hợp.</p>
                    <button onclick="location.reload()" class="text-blue-600 hover:underline text-sm">Xóa bộ lọc</button>
                </div>
            `;
            return;
        }

        container.innerHTML = products.map(productCardHTML).join('');
        attachProductEvents(container);
        document.getElementById('filter-sidebar')?.classList.remove('active');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Lỗi tải sản phẩm.</p>';
    }
}

// HOME

async function initHomeCategories() {
    const container = document.getElementById('home-categories-container');
    if (!container) return;

    try {
        const res = await api.getCategories();
        const categories = res.data || [];
        const count = categories.length;

        if (count === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">Chưa có danh mục.</p>';
            return;
        }

        let desktopCols = count;
        if (count > 6 && count <= 12) {
            desktopCols = Math.ceil(count / 2);
        } else if (count > 12) {
            desktopCols = Math.ceil(count / 3);
        }

        container.style.setProperty('--desktop-cols', desktopCols);
        container.className = 'grid grid-cols-2 md:grid-cols-[repeat(var(--desktop-cols),minmax(0,1fr))] gap-4 md:gap-6';

        const gradients = [
            'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
            'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
            'from-orange-50 to-orange-100 border-orange-200 text-orange-700',
            'from-green-50 to-green-100 border-green-200 text-green-700',
            'from-pink-50 to-pink-100 border-pink-200 text-pink-700',
            'from-teal-50 to-teal-100 border-teal-200 text-teal-700'
        ];

        const html = categories.map((cat, index) => {
            const styleClass = gradients[index % gradients.length];

            let iconHtml = `<span class="text-4xl drop-shadow-sm">${cat.icon || '📦'}</span>`;
            if (cat.icon && cat.icon.includes('fa-')) {
                iconHtml = `<i class="${cat.icon} text-3xl mb-2"></i>`;
            }

            return `
                <a href="category.html?slug=${cat.slug}"
                   class="group relative flex flex-col items-center justify-center p-6 rounded-2xl border bg-gradient-to-br ${styleClass} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-32 md:h-40">
                    <div class="mb-3 transform group-hover:scale-110 transition-transform duration-300">
                        ${iconHtml}
                    </div>
                    <h3 class="font-bold text-sm md:text-base text-gray-900 text-center leading-tight line-clamp-2">
                        ${cat.name}
                    </h3>
                </a>
            `;
        }).join('');

        container.innerHTML = html;
    } catch (e) {
        console.error('Lỗi tải danh mục:', e);
        container.innerHTML = '<p class="col-span-full text-center text-red-500">Lỗi tải danh mục.</p>';
    }
}

async function initHomePage() {
    if (!document.getElementById('hero-section')) return;

    const componentMap = {
        '#hero-section': 'components/_hero.html',
        '#feature-bar-section': 'components/_feature-bar.html',
        '#categories-section': 'components/_categories.html',
        '#best-sellers-section': 'components/_best-sellers.html',
        '#new-products-section': 'components/_new-products.html',
        '#promo-banners-section': 'components/_promo-banners.html',
        '#testimonials-section': 'components/_testimonials.html',
        '#newsletter-section': 'components/_newsletter.html'
    };

    try {
        await loadComponents(componentMap);
        initHomeCategories();
    } catch (e) {
        console.error(e);
    }

    const container = document.querySelector('#best-sellers');
    if (!container) return;

    container.innerHTML = renderSkeleton(4);

    try {
        const data = await api.getProducts({ page: 1, sort: 'newest' });
        const products = data.data || data.items || data;
        container.innerHTML = products.slice(0, 8).map(productCardHTML).join('');
        attachProductEvents(container);
    } catch (err) {
        container.innerHTML = `<p class="text-gray-500">Không tải được sản phẩm.</p>`;
    }
}

// ============================================================
// 11. BOOTSTRAP
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initHomePage();
    initCategoryPage();
    initProductDetailPage();
});
