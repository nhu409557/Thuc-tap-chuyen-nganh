import { api } from './api.js';
import { getQueryParam } from './utils/url.js';
import { getToken } from './utils/storage.js';
import { syncCartBadge } from './main.js';
import { loadComponents } from './utils/dom.js';
import { formatPrice, showToast } from './utils/common.js';
import { initReviews } from './reviews.js';

// ============================================================
// 1. STATE CHO TRANG CHI TIẾT SẢN PHẨM & DANH MỤC
// ============================================================
let productState = {
    variants: [],
    selectedColor: null,
    selectedCapacity: null,
    currentVariant: null,
    baseGallery: [],
    baseImage: null
};

let galleryState = { images: [], currentIndex: 0 };

// --- BIẾN QUẢN LÝ PHÂN TRANG DANH MỤC ---
let currentPage = 1; 
let currentCategorySlug = 'all';

// ============================================================
// HELPER: LẤY MÃ MÀU (HEX)
// ============================================================
function resolveColorHex(variant, colorName) {
    if (variant && variant.color_code) return variant.color_code;
    if (variant && variant.attributes && variant.attributes.color_code) return variant.attributes.color_code;
    const name = colorName ? colorName.toLowerCase().trim() : '';
    const map = {
        'đen': '#000000', 'black': '#000000',
        'trắng': '#ffffff', 'white': '#ffffff',
        'xanh': '#3b82f6', 'blue': '#3b82f6', 'xanh dương': '#3b82f6',
        'đỏ': '#ef4444', 'red': '#ef4444',
        'vàng': '#eab308', 'gold': '#eab308',
        'tím': '#a855f7', 'purple': '#a855f7',
        'bạc': '#d1d5db', 'silver': '#d1d5db',
        'xám': '#4b5563', 'grey': '#4b5563', 
        'xám titan': '#9ca3af', 'titan': '#9ca3af', 'titan tự nhiên': '#d4d4d0',
        'cam': '#f97316', 'orange': '#f97316',
        'hồng': '#ec4899', 'pink': '#ec4899',
        'xanh lá': '#22c55e', 'green': '#22c55e'
    };
    return map[name] || '#e5e7eb';
}

// ============================================================
// 2. UI LISTING (CARD SẢN PHẨM)
// ============================================================

function renderSkeleton(count = 6) {
    return Array(count).fill(0).map(() => `
      <div class="bg-white rounded-xl border border-gray-200 p-2 md:p-3 flex flex-col h-full animate-pulse">
        <div class="rounded-lg bg-gray-200 h-32 md:h-48 w-full mb-3"></div>
        <div class="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
        <div class="h-4 w-1/2 bg-gray-200 rounded mb-4"></div>
        <div class="mt-auto flex gap-2">
            <div class="h-9 flex-1 bg-gray-200 rounded"></div>
            <div class="h-9 w-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    `).join('');
}

function getCardVariantCapacity(v) {
    if (v.capacity && v.capacity.trim() !== '') return v.capacity;
    if (v.attributes) {
        try {
            const attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
            const vals = Object.entries(attrs)
                .filter(([k, val]) => k !== 'color' && k !== 'color_code' && val)
                .map(([k, val]) => val);
            if (vals.length > 0) return vals.join('/');
        } catch (e) {}
    }
    return '';
}

function productCardHTML(p) {
    const stock = parseInt(p.stock_quantity || 0);
    const isOutOfStock = stock <= 0;

    let displayPrice = p.price;
    let displayComparePrice = p.compare_at || 0; 
    let displayImage = p.image;
    let defaultVariantId = '';
    let variantsHtml = '';

    if (p.variants && p.variants.length > 0) {
        const firstVar = p.variants[0];
        defaultVariantId = firstVar.id;
        displayPrice = firstVar.price;
        if (firstVar.image) displayImage = firstVar.image;

        if (firstVar.compare_at && Number(firstVar.compare_at) > 0) {
            displayComparePrice = Number(firstVar.compare_at);
        }
    }

    let discountTagHtml = '';
    let discountPercent = 0;
    if (displayComparePrice > displayPrice) {
        discountPercent = Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100);
        discountTagHtml = `<div id="discount-tag-card-${p.id}" class="absolute top-2 left-2 bg-red-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded shadow-sm z-10">-${discountPercent}%</div>`;
    } else {
        discountTagHtml = `<div id="discount-tag-card-${p.id}" class="hidden absolute top-2 left-2 bg-red-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded shadow-sm z-10"></div>`;
    }

    if (p.variants && p.variants.length > 0) {
        const uniqueColors = {};
        p.variants.forEach(v => {
            let cName = v.color;
            if (!cName && v.attributes) {
                try {
                    const attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
                    cName = attrs.color;
                } catch(e){}
            }
            if (cName) {
                if (!uniqueColors[cName]) {
                    uniqueColors[cName] = resolveColorHex(v, cName);
                }
            }
        });
        const colorList = Object.keys(uniqueColors);

        let colorsHtml = '';
        if (colorList.length > 0) {
            colorsHtml = `
                <div class="flex gap-1 mb-2 overflow-x-auto pb-1 custom-scrollbar">
                    ${colorList.map((cName, idx) => `
                        <button onclick="selectCardColor(this, ${p.id})" 
                                class="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition focus:outline-none ring-1 ring-transparent focus:ring-blue-500 ${idx===0 ? 'ring-blue-500 ring-offset-1' : ''}" 
                                style="background-color: ${uniqueColors[cName]};" 
                                title="${cName}"
                                data-color="${cName}">
                        </button>
                    `).join('')}
                </div>`;
        }
        
        variantsHtml = `
            <div class="mt-2 px-1 card-variants-area" id="card-vars-${p.id}" 
                 data-variants='${JSON.stringify(p.variants).replace(/'/g, "&apos;")}'
                 data-base-compare='${p.compare_at || 0}'>
                ${colorsHtml}
                <div class="flex flex-wrap gap-1 text-[9px] md:text-[10px] capacity-container">
                    ${renderCardCapacities(p.variants, colorList[0], p.compare_at || 0)}
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

    const comparePriceClass = (displayComparePrice > displayPrice) ? "text-[10px] md:text-xs text-gray-400 line-through" : "hidden text-[10px] md:text-xs text-gray-400 line-through";

    return `
    <div class="bg-white rounded-xl border border-gray-200 p-2 md:p-3 flex flex-col h-full relative group hover:shadow-lg transition-shadow duration-300 product-card" id="product-card-${p.id}">
      <button onclick="toggleWishlist(this, ${p.id})" 
              class="absolute top-2 right-2 md:top-3 md:right-3 z-20 w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all hover:scale-110"
              title="Thêm vào yêu thích">
          <i class="fa-regular fa-heart text-base md:text-lg"></i>
      </button>
      
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="block relative overflow-hidden rounded-lg bg-gray-50">
        <img src="${displayImage}" id="img-card-${p.id}" alt="${p.title}" loading="lazy" 
             class="w-full h-36 md:h-48 object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105 ${isOutOfStock ? 'grayscale opacity-80' : ''}" 
             onerror="this.src='https://placehold.co/300x300?text=No+Image'"/>
        ${discountTagHtml}
        ${isOutOfStock ? '<div class="absolute inset-0 flex items-center justify-center bg-black/10"><span class="bg-black/70 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded">HẾT HÀNG</span></div>' : ''}
      </a>

      <div class="mt-2 md:mt-3 flex-1 flex flex-col">
        <a href="product.html?id=${encodeURIComponent(p.id)}">
            <h3 class="text-xs md:text-sm font-semibold text-gray-800 line-clamp-2 mb-1 hover:text-blue-600 transition-colors min-h-[32px] md:min-h-[40px]" title="${p.title}">
                ${p.title}
            </h3>
        </a>
        ${variantsHtml}
        <div class="mt-auto pt-2">
            <div class="flex flex-wrap items-baseline gap-1.5 md:gap-2">
                <span class="text-sm md:text-lg font-bold ${isOutOfStock ? 'text-gray-500' : 'text-blue-600'}" id="price-card-${p.id}">
                    ${formatPrice(displayPrice)}
                </span>
                <span class="${comparePriceClass}" id="compare-price-card-${p.id}">
                    ${formatPrice(displayComparePrice)}
                </span>
            </div>
        </div>
      </div>

      <div class="flex gap-1.5 md:gap-2 mt-3 md:mt-4">
        <button class="flex-1 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-1 ${btnBuyClass}"
          data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>
          ${isOutOfStock ? 'Hết' : 'Mua ngay'}
        </button>
        <button class="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg transition-colors border border-transparent ${btnCartClass}" 
          title="Thêm vào giỏ" id="btn-add-card-${p.id}" data-id="${p.id}" data-variant-id="${defaultVariantId}" ${isOutOfStock ? 'disabled' : ''}>
          <i class="fa-solid fa-cart-plus text-xs md:text-sm"></i>
        </button>
      </div>
    </div>`;
}

function renderCardCapacities(variants, selectedColor, baseComparePrice = 0) {
    if (!selectedColor) return '';
    const targetColor = selectedColor.trim().toLowerCase();
    
    const filtered = variants.filter(v => {
        let c = v.color;
        if (!c && v.attributes) {
            try {
                const attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
                c = attrs.color;
            } catch (e) { c = ''; }
        }
        return c && c.trim().toLowerCase() === targetColor;
    });

    const uniqueCaps = [];
    const distinctVariants = filtered.filter(v => {
        const cap = getCardVariantCapacity(v);
        if (cap && !uniqueCaps.includes(cap)) {
            uniqueCaps.push(cap);
            return true;
        }
        return false;
    });

    return distinctVariants.map((v, idx) => {
        const cap = getCardVariantCapacity(v);
        const activeClass = idx === 0 ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300';
        const safeImage = (v.image || '').replace(/'/g, "\\'");
        
        let variantCompare = 0;
        if (v.compare_at && Number(v.compare_at) > 0) {
            variantCompare = Number(v.compare_at);
        } else {
            variantCompare = Number(baseComparePrice);
        }

        return `<button onclick="selectCardCapacity(this, ${v.product_id}, ${v.id}, ${v.price}, ${variantCompare}, '${safeImage}')" 
                        class="px-1 py-0.5 md:px-1.5 md:py-0.5 rounded border transition ${activeClass} whitespace-nowrap">
                    ${cap}
                </button>`;
    }).join('');
}

window.selectCardColor = (btn, productId) => {
    const color = btn.getAttribute('data-color');
    const container = btn.parentElement;
    
    container.querySelectorAll('button').forEach(b => b.classList.remove('ring-blue-500', 'ring-offset-1'));
    btn.classList.add('ring-blue-500', 'ring-offset-1');

    const wrapper = document.getElementById(`card-vars-${productId}`);
    if (!wrapper) return;

    let variants = [];
    try { variants = JSON.parse(wrapper.dataset.variants.replace(/&apos;/g, "'")); } catch(e){ console.error('Parse variants error', e); return; }
    
    const baseComparePrice = Number(wrapper.dataset.baseCompare || 0);

    const targetColor = color.trim().toLowerCase();
    const variantMatch = variants.find(v => {
        let c = v.color;
        if (!c && v.attributes) {
            try {
                const attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
                c = attrs.color;
            } catch (e) { c = ''; }
        }
        return c && c.trim().toLowerCase() === targetColor;
    });

    if (variantMatch && variantMatch.image && variantMatch.image !== 'null' && variantMatch.image !== '') {
        const imgEl = document.getElementById(`img-card-${productId}`);
        if (imgEl) {
            imgEl.src = variantMatch.image;
        }
    }

    const capContainer = wrapper.querySelector('.capacity-container');
    capContainer.innerHTML = renderCardCapacities(variants, color, baseComparePrice);
    
    const firstCapBtn = capContainer.querySelector('button');
    if (firstCapBtn) firstCapBtn.click();
};

window.selectCardCapacity = (btn, productId, variantId, price, comparePrice, image) => {
    const container = btn.parentElement;
    container.querySelectorAll('button').forEach(b => {
        b.className = 'px-1 py-0.5 md:px-1.5 md:py-0.5 rounded border transition bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 whitespace-nowrap';
    });
    btn.className = 'px-1 py-0.5 md:px-1.5 md:py-0.5 rounded border transition bg-blue-100 text-blue-700 border-blue-200 font-bold whitespace-nowrap';
    
    updateCardDetails(productId, variantId, price, comparePrice, image);
};

function updateCardDetails(productId, variantId, price, comparePrice, image) {
    const priceEl = document.getElementById(`price-card-${productId}`);
    const compareEl = document.getElementById(`compare-price-card-${productId}`);
    const discountEl = document.getElementById(`discount-tag-card-${productId}`);

    if (priceEl) priceEl.textContent = formatPrice(price);
    
    if (compareEl) {
        if (comparePrice > price) {
            compareEl.textContent = formatPrice(comparePrice);
            compareEl.classList.remove('hidden');
            
            if (discountEl) {
                const percent = Math.round(((comparePrice - price) / comparePrice) * 100);
                discountEl.textContent = `-${percent}%`;
                discountEl.classList.remove('hidden');
            }
        } else {
            compareEl.classList.add('hidden');
            if (discountEl) discountEl.classList.add('hidden');
        }
    }

    if (image && image !== 'null' && image !== '') {
        const imgEl = document.getElementById(`img-card-${productId}`);
        if (imgEl) imgEl.src = image;
    }

    const btnAdd = document.getElementById(`btn-add-card-${productId}`);
    if (btnAdd) btnAdd.dataset.variantId = variantId;
}

window.toggleWishlist = async (btn, productId) => {
    if (event) event.stopPropagation();
    if (!checkLogin()) return;
    const icon = btn.querySelector('i');
    
    icon.className = "fa-solid fa-spinner fa-spin text-red-500";

    try {
        await api.request('/wishlist', { method: 'POST', auth: true, body: { product_id: productId } });
        icon.className = "fa-solid fa-heart text-red-500 animate-ping-once";
        showToast('Đã thêm vào yêu thích', 'success');
        setTimeout(() => icon.classList.remove('animate-ping-once'), 500);
    } catch (e) {
        if (e.message && e.message.includes('Duplicate')) {
            showToast('Sản phẩm này đã có trong yêu thích', 'info');
            icon.className = "fa-solid fa-heart text-red-500";
        } else {
            icon.className = "fa-regular fa-heart text-gray-400"; 
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
// 3. LOGIN & CART LOGIC
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

async function handleAddToCartClick(btnElement, productId) {
    if (!checkLogin()) return;
    const originalContent = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>`;
    const variantId = btnElement.dataset.variantId || null;

    try {
        await api.request('/cart', {
            method: 'POST',
            auth: true,
            body: { product_id: parseInt(productId), variant_id: variantId ? parseInt(variantId) : null, quantity: 1 }
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

async function handleBuyNowClick(productId) {
    if (!checkLogin()) return;
    window.location.href = `product.html?id=${productId}`;
}

// ============================================================
// 4. TRANG CHI TIẾT (DETAIL)
// ============================================================
function initProductTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    if (!tabs.length) return;
    tabs.forEach((t) => {
        const newTab = t.cloneNode(true);
        t.parentNode.replaceChild(newTab, t);
        newTab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((x) => x.classList.remove('active'));
            newTab.classList.add('active');
            contents.forEach((c) => c.classList.add('hidden'));
            const targetId = newTab.dataset.tab + '-content';
            const targetEl = document.getElementById(targetId);
            if(targetEl) targetEl.classList.remove('hidden');
        });
    });
}

function renderSpecs(specsJson, specsTemplateJson, category) {
    const container = document.getElementById('specs-container');
    if (!container) return;

    let specs = {};
    try { specs = typeof specsJson === 'string' ? JSON.parse(specsJson) : specsJson || {}; } catch (e) {}

    let template = [];
    if (specsTemplateJson) {
        try { template = typeof specsTemplateJson === 'string' ? JSON.parse(specsTemplateJson) : specsTemplateJson; } catch (e) {}
    }

    if (!template || template.length === 0) {
        container.innerHTML = '<p class="p-4 text-center text-gray-500 italic">Đang cập nhật thông số...</p>';
        return;
    }

    let html = '';
    template.forEach((group) => {
        if (!group.fields) return;
        let groupItemsHtml = '';
        group.fields.forEach((field) => {
            const key = field.k || field.key;
            const label = field.l || field.label;
            const value = specs[key];
            if (value && String(value).trim() !== '') {
                groupItemsHtml += `
                    <li class="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <span class="col-span-5 text-gray-500 font-medium">${label}:</span>
                        <span class="col-span-7 font-semibold text-gray-900" id="spec-val-${key}" data-spec-key="${key}" data-original="${value}">${value}</span>
                    </li>`;
            }
        });
        if (groupItemsHtml !== '') {
            html += `<div class="px-4 py-2 bg-gray-100 font-bold text-gray-800 text-sm uppercase mt-0 border-t first:border-t-0">${group.group}</div>`;
            html += `<ul class="text-sm text-gray-700 bg-white">`;
            html += groupItemsHtml;
            html += `</ul>`;
        }
    });

    if (html === '') container.innerHTML = '<p class="p-4 text-center text-gray-500 italic">Chưa có thông số chi tiết.</p>';
    else container.innerHTML = html;
}

function getVariantColor(v) {
    if (v.attributes && v.attributes.color) return v.attributes.color;
    return v.color || null;
}

function getVariantCapacity(v) {
    if (v.capacity && v.capacity.trim() !== '') return v.capacity;
    if (v.attributes) {
        if (v.attributes.capacity) return v.attributes.capacity;
        const otherValues = [];
        for (const [key, val] of Object.entries(v.attributes)) {
            if (key !== 'color' && key !== 'color_code' && val) otherValues.push(val);
        }
        if (otherValues.length > 0) return otherValues.join(' / ');
    }
    return null;
}

function renderSelectors() {
    const container = document.getElementById('dynamic-variants');
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = '';
    const colors = [...new Set(productState.variants.map(v => getVariantColor(v)).filter(Boolean))];

    if (colors.length > 0) {
        if (!productState.selectedColor) productState.selectedColor = colors[0];
        const colorDiv = document.createElement('div');
        colorDiv.className = 'mb-2';
        colorDiv.innerHTML = `<label class="block text-sm font-bold text-gray-800 mb-3">Màu sắc: <span class="font-normal text-blue-600">${productState.selectedColor}</span></label>`;
        const colorOptions = document.createElement('div');
        colorOptions.className = 'flex flex-wrap gap-3'; 
        colors.forEach(color => {
            const btn = document.createElement('button');
            const isActive = color === productState.selectedColor;
            const representativeVariant = productState.variants.find(v => getVariantColor(v) === color);
            const hexCode = resolveColorHex(representativeVariant, color);
            const baseClass = "px-4 py-3 rounded-xl border-2 transition flex items-center gap-2 min-w-[100px] justify-center shadow-sm text-sm font-medium";
            const activeClass = "border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-md";
            const inactiveClass = "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gray-50";
            
            btn.className = `${baseClass} ${isActive ? activeClass : inactiveClass}`;
            btn.innerHTML = `<span class="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style="background-color: ${hexCode}"></span><span>${color}</span>`;
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

    if (productState.selectedColor) {
        const targetColor = productState.selectedColor.trim().toLowerCase();
        const variantsByColor = productState.variants.filter(v => {
            const c = getVariantColor(v);
            return c && c.trim().toLowerCase() === targetColor;
        });
        const capacities = [...new Set(variantsByColor.map(v => getVariantCapacity(v)).filter(Boolean))];

        if (capacities.length > 0) {
            if (!productState.selectedCapacity) productState.selectedCapacity = capacities[0];
            const capDiv = document.createElement('div');
            capDiv.className = 'mt-4';
            capDiv.innerHTML = `<label class="block text-sm font-bold text-gray-800 mb-3">Cấu hình: <span class="font-normal text-blue-600">${productState.selectedCapacity}</span></label>`;
            const capOptions = document.createElement('div');
            capOptions.className = 'grid grid-cols-2 sm:grid-cols-3 gap-3';
            capacities.forEach(cap => {
                const btn = document.createElement('button');
                const isActive = cap === productState.selectedCapacity;
                const v = variantsByColor.find(i => getVariantCapacity(i) === cap);
                const baseClass = "p-3 rounded-xl border-2 transition flex flex-col items-center justify-center text-center";
                const activeClass = "border-blue-600 bg-blue-50 text-blue-700 shadow-md";
                const inactiveClass = "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gray-50";

                btn.className = `${baseClass} ${isActive ? activeClass : inactiveClass}`;
                btn.innerHTML = `<span class="font-bold text-sm">${cap}</span><span class="text-xs mt-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}">${v ? formatPrice(v.price) : ''}</span>`;
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
    findAndApplyVariant();
}

function applyVariantSpecs(variant) {
    document.querySelectorAll('[id^="spec-val-"]').forEach(el => {
        const original = el.dataset.original || '';
        el.textContent = original;
        el.classList.remove('text-blue-600');
    });
    if (!variant || !variant.attributes) return;
    Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!value || key === 'color' || key === 'color_code') return;
        const specEl = document.getElementById(`spec-val-${key}`);
        if (specEl) { specEl.textContent = value; specEl.classList.add('text-blue-600'); }
    });
}

function renderProductGallery(images, activeImage) {
    const mainImg = document.getElementById('main-image');
    const galleryContainer = document.getElementById('gallery-container');
    const btnPrevMain = document.getElementById('btn-prev-main');
    const btnNextMain = document.getElementById('btn-next-main');
    const btnPrevThumb = document.getElementById('btn-prev-thumb');
    const btnNextThumb = document.getElementById('btn-next-thumb');

    if (!mainImg || !galleryContainer) return;

    if (!images || images.length === 0) {
        images = activeImage ? [activeImage] : [];
    }
    galleryState.images = images;
    
    let startIndex = 0;
    if (activeImage) {
        startIndex = images.indexOf(activeImage);
        if (startIndex === -1) startIndex = 0;
    }
    galleryState.currentIndex = startIndex;

    mainImg.src = images[startIndex] || 'https://via.placeholder.com/600x600?text=No+Image';

    galleryContainer.innerHTML = images.map((imgUrl, idx) => `
        <div class="gallery-thumb w-16 h-16 sm:w-20 sm:h-20 p-1 rounded-lg border-2 ${idx === startIndex ? 'border-blue-600 shadow-md' : 'border-gray-200 hover:border-blue-300'} cursor-pointer transition-all flex-shrink-0 bg-white snap-center overflow-hidden" 
             onclick="selectGalleryImage(${idx})">
            <img src="${imgUrl}" class="w-full h-full object-contain rounded-md" loading="lazy"/>
        </div>
    `).join('');

    if(btnPrevMain) btnPrevMain.onclick = (e) => { e.preventDefault(); changeImageByStep(-1); };
    if(btnNextMain) btnNextMain.onclick = (e) => { e.preventDefault(); changeImageByStep(1); };

    if(btnPrevThumb) btnPrevThumb.onclick = (e) => { e.preventDefault(); galleryContainer.scrollBy({ left: -100, behavior: 'smooth' }); };
    if(btnNextThumb) btnNextThumb.onclick = (e) => { e.preventDefault(); galleryContainer.scrollBy({ left: 100, behavior: 'smooth' }); };

    window.selectGalleryImage = (index) => {
        galleryState.currentIndex = index;
        updateGalleryUI();
    };

    const displayNav = images.length > 1 ? 'flex' : 'none';
    if(btnPrevMain) btnPrevMain.style.display = displayNav;
    if(btnNextMain) btnNextMain.style.display = displayNav;
}

function changeImageByStep(step) {
    const total = galleryState.images.length;
    if (total <= 1) return;
    let newIndex = galleryState.currentIndex + step;
    if (newIndex >= total) newIndex = 0;
    if (newIndex < 0) newIndex = total - 1;
    galleryState.currentIndex = newIndex;
    updateGalleryUI();
}

function updateGalleryUI() {
    const { images, currentIndex } = galleryState;
    const mainImg = document.getElementById('main-image');
    
    if (mainImg && images[currentIndex]) {
        mainImg.style.opacity = '0.8';
        mainImg.src = images[currentIndex];
        setTimeout(() => mainImg.style.opacity = '1', 150);
    }

    const thumbs = document.querySelectorAll('#gallery-container .gallery-thumb');
    thumbs.forEach((t, idx) => {
        if (idx === currentIndex) {
            t.classList.remove('border-gray-200', 'hover:border-blue-300');
            t.classList.add('border-blue-600', 'shadow-md');
            t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            t.classList.remove('border-blue-600', 'shadow-md');
            t.classList.add('border-gray-200', 'hover:border-blue-300');
        }
    });
}

function findAndApplyVariant() {
    const targetColor = productState.selectedColor ? productState.selectedColor.trim().toLowerCase() : '';
    const variant = productState.variants.find(v => {
        const c = getVariantColor(v);
        return c && c.trim().toLowerCase() === targetColor &&
               getVariantCapacity(v) === productState.selectedCapacity;
    });

    productState.currentVariant = variant || null;
    
    let images = [];
    const colorGalleries = window.productData?.color_galleries || {};
    const selectedColor = productState.selectedColor;

    if (selectedColor && colorGalleries[selectedColor] && colorGalleries[selectedColor].length > 0) {
        images = colorGalleries[selectedColor];
    } else if (variant && variant.image && variant.image !== 'null' && variant.image.trim() !== '') {
        images = [variant.image];
    } else {
        images = productState.baseGallery;
    }

    const activeImage = images[0];
    renderProductGallery(images, activeImage);

    if (variant) {
        const priceEl = document.getElementById('product-price');
        if (priceEl) priceEl.textContent = formatPrice(variant.price);
        
        applyVariantSpecs(variant);
        updateBuyButtonState(true, parseInt(variant.stock_quantity || 0));

        let comparePrice = 0;
        if (variant.compare_at && Number(variant.compare_at) > 0) {
            comparePrice = Number(variant.compare_at);
        } else if (window.productData.compare_at && Number(window.productData.compare_at) > 0) {
            comparePrice = Number(window.productData.compare_at);
        }

        const compareEl = document.getElementById('product-compare-price');
        const badgeEl = document.getElementById('discount-badge');

        if (compareEl) {
            if (comparePrice > variant.price) {
                compareEl.textContent = formatPrice(comparePrice);
                compareEl.classList.remove('hidden');

                if (badgeEl) {
                    const percent = Math.round(((comparePrice - variant.price) / comparePrice) * 100);
                    badgeEl.textContent = `-${percent}%`;
                    badgeEl.classList.remove('hidden');
                }
            } else {
                compareEl.textContent = '';
                compareEl.classList.add('hidden');
                if (badgeEl) badgeEl.classList.add('hidden');
            }
        }

    } else {
        applyVariantSpecs(null);
        updateBuyButtonState(false, 0); 
    }
}

function updateBuyButtonState(isValid, stock) {
    const btnAdd = document.getElementById('btn-add-cart');
    const btnBuy = document.getElementById('btn-buy-now');
    const stockStatus = document.getElementById('product-stock-status');

    if (stockStatus) {
        if (!isValid) stockStatus.innerHTML = '<span class="text-red-500">Phiên bản này không tồn tại.</span>';
        else if (stock > 0) stockStatus.innerHTML = `<span class="text-green-600 font-bold flex items-center gap-1"><i class="fa-solid fa-check"></i> Còn hàng (${stock})</span>`;
        else stockStatus.innerHTML = `<span class="text-red-500 font-bold flex items-center gap-1"><i class="fa-solid fa-xmark"></i> Hết hàng</span>`;
    }

    if (!btnAdd || !btnBuy) return;

    if (!isValid || stock <= 0) {
        btnAdd.disabled = true;
        btnAdd.textContent = stock <= 0 ? 'Hết hàng' : 'Chọn phiên bản';
        btnAdd.className = "w-full bg-gray-200 text-gray-500 border-2 border-gray-300 py-4 rounded-xl font-bold cursor-not-allowed";
        
        btnBuy.disabled = true;
        btnBuy.className = "w-full bg-gray-300 text-gray-500 py-4 rounded-xl font-bold text-lg cursor-not-allowed shadow-none";
    } else {
        btnAdd.disabled = false;
        btnAdd.innerHTML = '<i class="fa-solid fa-cart-plus"></i> THÊM VÀO GIỎ';
        btnAdd.className = "btn-press w-full bg-white text-blue-600 border-2 border-blue-600 py-4 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2";
        
        btnBuy.disabled = false;
        btnBuy.className = "btn-press w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-4 rounded-xl font-bold text-lg hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2";
    }
}

async function detailAddToCart() {
    if (!checkLogin()) return;
    const productId = parseInt(getQueryParam('id'));
    if (!productId) { showToast('Không tìm thấy sản phẩm', 'error'); return; }

    let variantId = null;
    if (productState.variants.length > 0) {
        if (!productState.currentVariant) { showToast('Vui lòng chọn đầy đủ màu sắc và cấu hình', 'warning'); return; }
        variantId = productState.currentVariant.id;
    }

    const btnAdd = document.getElementById('btn-add-cart');
    const originalText = btnAdd ? btnAdd.textContent : null;
    if (btnAdd) { btnAdd.disabled = true; btnAdd.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`; }

    try {
        await api.request('/cart', { method: 'POST', auth: true, body: { product_id: productId, variant_id: variantId, quantity: 1 } });
        syncCartBadge();
        showToast('Đã thêm vào giỏ hàng', 'success');
        if (btnAdd && originalText) { btnAdd.innerHTML = originalText; btnAdd.disabled = false; }
    } catch (e) {
        if (btnAdd && originalText) { btnAdd.innerHTML = originalText; btnAdd.disabled = false; }
        showToast(e.message || 'Không thể thêm vào giỏ', 'error');
    }
}

window.addToCart = detailAddToCart;

async function detailBuyNow() {
    try {
        await detailAddToCart();
    } catch(e) {
        return; 
    }

    const productId = parseInt(getQueryParam('id'));
    if (!productId) return;
    localStorage.setItem('checkout_selected_items', JSON.stringify([productId]));
    window.location.href = 'checkout.html';
}

async function initProductDetailPage() {
    if (!document.querySelector('#product-title')) return;
    const id = getQueryParam('id');
    if (!id) return;
    initProductTabs();
    initReviews(id); 
    
    const btnWishlist = document.getElementById('btn-wishlist');
    if (btnWishlist) {
        btnWishlist.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(btnWishlist, id);
        });
    }

    try {
        const product = await api.getProduct(id);
        window.productData = product;

        const breadcrumb = document.getElementById('breadcrumb-container');
        if (breadcrumb) {
            breadcrumb.innerHTML = `<a href="index.html" class="hover:text-blue-600">Trang chủ</a><span class="text-gray-300 mx-2">/</span><a href="category.html?slug=${product.category}" class="hover:text-blue-600 capitalize">${product.category_name || product.category || 'Sản phẩm'}</a><span class="text-gray-300 mx-2">/</span><span class="text-gray-700 font-medium truncate max-w-[200px]">${product.title}</span>`;
        }

        const titleEl = document.querySelector('#product-title'); if (titleEl) titleEl.textContent = product.title;
        const priceEl = document.querySelector('#product-price'); if (priceEl) priceEl.textContent = formatPrice(product.price);
        const compareEl = document.querySelector('#product-compare-price'); if (compareEl) compareEl.textContent = product.compare_at ? formatPrice(product.compare_at) : '';
        const descEl = document.querySelector('#product-desc-content') || document.querySelector('#product-description');
        if (descEl) descEl.innerHTML = product.description?.replace(/\n/g, '<br>') || 'Chưa có mô tả.';
        
        if(product.compare_at && product.compare_at > product.price) {
            const badge = document.getElementById('discount-badge');
            if(badge) {
                const percent = Math.round(((product.compare_at - product.price) / product.compare_at) * 100);
                badge.textContent = `-${percent}%`;
                badge.classList.remove('hidden');
            }
        }

        let images = [];
        if (product.shared_gallery && product.shared_gallery.length > 0) images = product.shared_gallery;
        else if (product.gallery && product.gallery.length > 0) images = product.gallery;
        else images = [product.image];

        productState.baseGallery = images;
        productState.baseImage = product.image || images[0];

        renderProductGallery(images, productState.baseImage);
        renderSpecs(product.specs, product.specs_template, product.category);

        productState.variants = (product.variants || []).map(v => {
            if (typeof v.attributes === 'string') { try { v.attributes = JSON.parse(v.attributes); } catch (e) { v.attributes = {}; } }
            return v;
        });

        const preSelectedVariantId = getQueryParam('v');
        let preSelectedVariant = null;

        if (preSelectedVariantId) {
            preSelectedVariant = productState.variants.find(v => v.id == preSelectedVariantId);
        }

        if (preSelectedVariant) {
            productState.selectedColor = getVariantColor(preSelectedVariant);
            productState.selectedCapacity = getVariantCapacity(preSelectedVariant);
        } else {
            productState.selectedColor = null;
            productState.selectedCapacity = null;
        }
        productState.currentVariant = null; 
        
        const variantsArea = document.getElementById('dynamic-variants');
        if (productState.variants.length > 0) {
            if (variantsArea) { variantsArea.innerHTML = ''; variantsArea.classList.remove('hidden'); }
            renderSelectors();
        } else {
            if (variantsArea) variantsArea.classList.add('hidden');
            updateBuyButtonState(true, parseInt(product.stock_quantity || 0));
        }

        const btnAdd = document.getElementById('btn-add-cart');
        if (btnAdd) { btnAdd.onclick = (e) => { e.preventDefault(); detailAddToCart(); }; }
        const btnBuy = document.getElementById('btn-buy-now');
        if (btnBuy) { btnBuy.onclick = (e) => { e.preventDefault(); detailBuyNow(); }; }

    } catch (err) { console.error(err); showToast('Lỗi tải sản phẩm', 'error'); }
}

// ============================================================
// 5. TRANG DANH MỤC & TÌM KIẾM
// ============================================================

function initPriceSlider() {
    const rangeInput = document.querySelectorAll(".range-input input");
    const priceInput = document.querySelectorAll("#min-price, #max-price");
    const range = document.getElementById("range-selected");
    if(!range || rangeInput.length === 0) return;
    let priceGap = 1000000;
    rangeInput.forEach(input => {
        input.addEventListener("input", e => {
            let minVal = parseInt(rangeInput[0].value);
            let maxVal = parseInt(rangeInput[1].value);
            if ((maxVal - minVal) < priceGap) {
                if (e.target.className === "min-range") rangeInput[0].value = maxVal - priceGap;
                else rangeInput[1].value = minVal + priceGap;
            } else {
                priceInput[0].value = minVal;
                priceInput[1].value = maxVal;
                range.style.left = ((minVal / rangeInput[0].max) * 100) + "%";
                range.style.right = (100 - (maxVal / rangeInput[1].max) * 100) + "%";
            }
        });
    });
    priceInput.forEach(input => {
        input.addEventListener("input", e => {
            let minPrice = parseInt(priceInput[0].value);
            let maxPrice = parseInt(priceInput[1].value);
            if ((maxPrice - minPrice >= priceGap) && maxPrice <= rangeInput[1].max) {
                if (e.target.id === "min-price") {
                    rangeInput[0].value = minPrice;
                    range.style.left = ((minPrice / rangeInput[0].max) * 100) + "%";
                } else {
                    rangeInput[1].value = maxPrice;
                    range.style.right = (100 - (maxPrice / rangeInput[1].max) * 100) + "%";
                }
            }
        });
    });
}

async function initCategoryPage() {
    if (!document.querySelector('#category-products')) return;
    const slug = getQueryParam('slug');
    const q = getQueryParam('q'); 
    currentCategorySlug = slug || 'all';
    
    const titleEl = document.querySelector('#category-title');
    if (titleEl) {
        if (q) titleEl.innerHTML = `Kết quả tìm kiếm: "<span class="text-blue-600">${q}</span>"`;
        else titleEl.textContent = currentCategorySlug === 'all' ? 'Tất cả sản phẩm' : `Danh mục: ${currentCategorySlug.toUpperCase()}`;
    }
    initPriceSlider();
    await loadBrandFilter(currentCategorySlug);
    attachFilterEvents();
    
    // --- LOAD LẦN ĐẦU (Reset trang về 1) ---
    loadProductsWithFilter(false);
}

async function loadBrandFilter(category) {
    const brandContainer = document.getElementById('brand-filters');
    if (!brandContainer) return;
    try {
        const res = await api.getBrands(category);
        const brands = res.data || [];
        if (brands.length === 0) { brandContainer.innerHTML = '<p class="text-sm text-gray-500">Không có thương hiệu</p>'; return; }
        brandContainer.innerHTML = brands.map((brand) => `<label class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" name="brand-filter" value="${brand}" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /><span class="text-sm text-gray-700">${brand}</span></label>`).join('');
    } catch (err) { console.error('Lỗi tải brands:', err); }
}

function attachFilterEvents() {
    document.getElementById('filter-price-btn')?.addEventListener('click', () => loadProductsWithFilter(false));
    document.getElementById('brand-filters')?.addEventListener('change', () => loadProductsWithFilter(false));
    document.getElementById('sort-by')?.addEventListener('change', () => loadProductsWithFilter(false));
    
    // --- SỰ KIỆN NÚT LOAD MORE ---
    document.getElementById('btn-load-more')?.addEventListener('click', () => loadProductsWithFilter(true));
}

// --- LOGIC MỚI CHO LOAD MORE ---
async function loadProductsWithFilter(isAppend = false) {
    const container = document.querySelector('#category-products');
    const oldEmptyState = document.getElementById('empty-state');
    const btnLoadMore = document.getElementById('btn-load-more');

    if (oldEmptyState) oldEmptyState.classList.add('hidden');
    if (!container) return;

    // Nếu không phải append (tức là lọc/sort), reset lại nội dung và trang
    if (!isAppend) {
        container.classList.remove('hidden', 'flex', 'flex-col', 'items-center', 'justify-center', 'py-12');
        container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6 min-h-[300px]"; 
        container.innerHTML = renderSkeleton(6);
        currentPage = 1; // Reset trang
        if(btnLoadMore) btnLoadMore.classList.add('hidden');
    } else {
        // Nếu là Load More, tăng trang lên
        if(btnLoadMore) {
            btnLoadMore.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
            btnLoadMore.disabled = true;
        }
        currentPage++;
    }

    const minPrice = document.getElementById('min-price')?.value;
    const maxPrice = document.getElementById('max-price')?.value;
    const sortBy = document.getElementById('sort-by')?.value;
    const checkedBrands = Array.from(document.querySelectorAll('input[name="brand-filter"]:checked')).map((cb) => cb.value);
    const q = getQueryParam('q');

    let params = {};
    if (currentCategorySlug !== 'all') params.category = currentCategorySlug;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (checkedBrands.length > 0) params.brand = checkedBrands.join(',');
    if (sortBy) params.sort = sortBy;
    if (q) params.q = q;
    
    // Thêm tham số page
    params.page = currentPage;

    try {
        const data = await api.getProducts(params);
        const products = data.data || data.items || data;
        const totalPage = data.total_page || 1;

        if (!products || products.length === 0) {
            if (!isAppend) {
                container.className = "flex flex-col items-center justify-center py-16 w-full col-span-full";
                container.innerHTML = `
                    <div class="text-center p-4 max-w-sm mx-auto">
                        <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-solid fa-magnifying-glass text-3xl text-gray-400"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-800 mb-2">Không tìm thấy sản phẩm</h3>
                        <p class="text-gray-500 mb-6 text-sm">Rất tiếc, không có sản phẩm nào phù hợp với tiêu chí lọc của bạn.</p>
                        <button onclick="window.resetPageFilter()" class="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition active:scale-95">
                            Xóa bộ lọc & Tải lại
                        </button>
                    </div>`;
                if(btnLoadMore) btnLoadMore.classList.add('hidden');
            } else {
                // Hết sản phẩm để load thêm
                if(btnLoadMore) btnLoadMore.classList.add('hidden');
            }
            return;
        }

        const newHtml = products.map(productCardHTML).join('');

        if (isAppend) {
            container.insertAdjacentHTML('beforeend', newHtml);
        } else {
            container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6";
            container.innerHTML = newHtml;
        }
        
        attachProductEvents(container);
        
        // Xử lý hiển thị nút Load More
        if (btnLoadMore) {
            if (currentPage >= totalPage) {
                btnLoadMore.classList.add('hidden');
            } else {
                btnLoadMore.classList.remove('hidden');
                btnLoadMore.disabled = false;
                btnLoadMore.innerHTML = `Xem thêm 20 sản phẩm <i class="fa-solid fa-chevron-down ml-2 transition-transform group-hover:translate-y-1"></i>`;
            }
        }
        
        document.getElementById('filter-sidebar')?.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';

    } catch (err) {
        console.error(err);
        if (!isAppend) {
            container.className = "flex flex-col items-center justify-center py-12 w-full col-span-full";
            container.innerHTML = '<p class="text-center text-red-500">Lỗi tải dữ liệu. Vui lòng thử lại.</p>';
        } else {
            if(btnLoadMore) {
                btnLoadMore.innerHTML = 'Thử lại';
                btnLoadMore.disabled = false;
            }
        }
    }
}

window.resetPageFilter = () => {
    const min = document.getElementById('min-price');
    const max = document.getElementById('max-price');
    if(min) min.value = '';
    if(max) max.value = '';
    document.querySelectorAll('input[name="brand-filter"]').forEach(el => el.checked = false);
    if (window.location.search.includes('?')) {
        const slug = getQueryParam('slug') || 'all';
        window.location.href = `category.html?slug=${slug}`;
    } else {
        loadProductsWithFilter(false);
    }
};

// ============================================================
// 6. TRANG CHỦ (HOME)
// ============================================================
async function initHomeCategories() {
    const container = document.getElementById('home-categories-container');
    if (!container) return;
    try {
        const res = await api.getCategories();
        const categories = res.data || [];
        const count = categories.length;
        if (count === 0) { container.innerHTML = '<p class="col-span-full text-center text-gray-500">Chưa có danh mục.</p>'; return; }
        let desktopCols = count;
        if (count > 6 && count <= 12) desktopCols = Math.ceil(count / 2);
        else if (count > 12) desktopCols = Math.ceil(count / 3);
        container.style.setProperty('--desktop-cols', desktopCols);
        container.className = 'grid grid-cols-2 md:grid-cols-[repeat(var(--desktop-cols),minmax(0,1fr))] gap-4 md:gap-6';
        const gradients = ['from-blue-50 to-blue-100 border-blue-200 text-blue-700', 'from-purple-50 to-purple-100 border-purple-200 text-purple-700', 'from-orange-50 to-orange-100 border-orange-200 text-orange-700', 'from-green-50 to-green-100 border-green-200 text-green-700', 'from-pink-50 to-pink-100 border-pink-200 text-pink-700', 'from-teal-50 to-teal-100 border-teal-200 text-teal-700'];
        const html = categories.map((cat, index) => {
            const styleClass = gradients[index % gradients.length];
            let iconHtml = `<span class="text-4xl drop-shadow-sm">${cat.icon || '📦'}</span>`;
            if (cat.icon && cat.icon.includes('fa-')) iconHtml = `<i class="${cat.icon} text-3xl mb-2"></i>`;
            return `<a href="category.html?slug=${cat.slug}" class="group relative flex flex-col items-center justify-center p-6 rounded-2xl border bg-gradient-to-br ${styleClass} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-32 md:h-40"><div class="mb-3 transform group-hover:scale-110 transition-transform duration-300">${iconHtml}</div><h3 class="font-bold text-sm md:text-base text-gray-900 text-center leading-tight line-clamp-2">${cat.name}</h3></a>`;
        }).join('');
        container.innerHTML = html;
    } catch (e) { console.error('Lỗi tải danh mục:', e); container.innerHTML = '<p class="col-span-full text-center text-red-500">Lỗi tải danh mục.</p>'; }
}

async function initHomePage() {
    if (!document.getElementById('hero-section')) return;
    const componentMap = { '#hero-section': 'components/_hero.html', '#feature-bar-section': 'components/_feature-bar.html', '#categories-section': 'components/_categories.html', '#best-sellers-section': 'components/_best-sellers.html', '#new-products-section': 'components/_new-products.html', '#promo-banners-section': 'components/_promo-banners.html', '#testimonials-section': 'components/_testimonials.html', '#newsletter-section': 'components/_newsletter.html' };
    try { await loadComponents(componentMap); initHomeCategories(); } catch (e) { console.error(e); }
    
    const container = document.querySelector('#best-sellers');
    if (!container) return;
    container.className = "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6";
    container.innerHTML = renderSkeleton(4);
    try {
        const data = await api.getProducts({ page: 1, sort: 'newest' });
        const products = data.data || data.items || data;
        container.innerHTML = products.slice(0, 8).map(productCardHTML).join('');
        attachProductEvents(container);
    } catch (err) { container.innerHTML = `<p class="text-gray-500">Không tải được sản phẩm.</p>`; }
}

function setupMobileCtaBar() {
  const bar = document.getElementById("mobile-cta-bar");
  const barBuy = document.getElementById("mobile-btn-buy-now");
  const barCart = document.getElementById("mobile-btn-add-cart");
  const barPrice = document.getElementById("mobile-price");
  const buyBtn = document.getElementById("btn-buy-now");
  const cartBtn = document.getElementById("btn-add-cart");
  const ctaWrap = document.getElementById("main-cta");
  const priceEl = document.getElementById("product-price");

  if (!bar || !buyBtn || !cartBtn || !ctaWrap) { setTimeout(setupMobileCtaBar, 200); return; }
  barBuy?.addEventListener("click", () => buyBtn.click());
  barCart?.addEventListener("click", () => cartBtn.click());
  const syncPrice = () => { if (barPrice && priceEl) barPrice.textContent = (priceEl.textContent || "...").trim(); };
  syncPrice();
  if (priceEl) {
    const mo = new MutationObserver(syncPrice);
    mo.observe(priceEl, { childList: true, characterData: true, subtree: true });
  }
  const mq = window.matchMedia("(max-width: 1023px)");
  const setBarVisible = (visible) => {
    if (!mq.matches) { bar.classList.add("hidden"); return; }
    bar.classList.toggle("hidden", !visible);
  };
  const io = new IntersectionObserver(([entry]) => { setBarVisible(!entry.isIntersecting); }, { root: null, threshold: 0.15 });
  io.observe(ctaWrap);
  mq.addEventListener("change", () => {
    setTimeout(() => {
      const rect = ctaWrap.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      setBarVisible(!inView);
    }, 60);
  });
}

document.addEventListener('DOMContentLoaded', () => {
    initHomePage();
    initCategoryPage();
    initProductDetailPage();
    setupMobileCtaBar();
});