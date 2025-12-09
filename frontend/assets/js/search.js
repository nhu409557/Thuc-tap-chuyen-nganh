import { api } from './api.js';

let debounceTimer = null;

// Helper định dạng giá
function formatPrice(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Helper xử lý ảnh cho Search (Fix lỗi ảnh không hiện)
function resolveSearchImage(img) {
    if (!img || img === 'null' || img === '') return 'https://via.placeholder.com/50';
    if (img.startsWith('http')) return img;
    // Đảm bảo không bị lỗi đường dẫn (loại bỏ dấu / ở đầu nếu có)
    return img.replace(/^\//, ''); 
}

// --- LOGIC DÀN PHẲNG BIẾN THỂ ---
function flattenProductVariants(products) {
    let flattened = [];
    if (!products) return [];
    
    const arr = Array.isArray(products) ? products : Object.values(products);

    arr.forEach(p => {
        let vars = [];
        if (p.variants) {
            vars = Array.isArray(p.variants) ? p.variants : Object.values(p.variants);
        }

        if (vars.length > 0) {
            // CÓ BIẾN THỂ
            vars.forEach(v => {
                let attrs = {};
                if (v.attributes) {
                    if (typeof v.attributes === 'object') attrs = v.attributes;
                    else if (typeof v.attributes === 'string') {
                        try { attrs = JSON.parse(v.attributes); } catch(e){}
                    }
                }

                let labelParts = [];
                let c = v.color || attrs.color;
                let s = v.capacity || attrs.capacity;

                if (c) labelParts.push(`Màu: ${c}`);
                if (s) labelParts.push(`Size: ${s}`);
                
                for (const [k, val] of Object.entries(attrs)) {
                    if (k !== 'color' && k !== 'capacity' && val) labelParts.push(`${k}: ${val}`);
                }

                flattened.push({
                    id: p.id,
                    variant_id: v.id, // ID để chọn sẵn biến thể
                    title: p.title,
                    variant_label: labelParts.join(' - '),
                    price: Number(v.price) || Number(p.price) || 0,
                    // Ưu tiên ảnh biến thể, fallback về ảnh cha
                    image: v.image || p.image, 
                    is_variant: true
                });
            });
        } else {
            // KHÔNG BIẾN THỂ
            flattened.push({
                id: p.id,
                variant_id: null,
                title: p.title,
                variant_label: '', 
                price: Number(p.price) || 0,
                image: p.image,
                is_variant: false
            });
        }
    });
    return flattened;
}

function attachSearch(input, suggestionBox) {
  if (!input || !suggestionBox) return;

  // Ẩn khi click ra ngoài
  document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
          suggestionBox.classList.add('hidden');
      }
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);

    if (!q) {
      suggestionBox.classList.add('hidden');
      suggestionBox.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(() => {
      fetchSuggestions(q, suggestionBox);
    }, 300);
  });
  
  input.addEventListener('focus', () => {
      if(input.value.trim() && suggestionBox.innerHTML !== '') {
          suggestionBox.classList.remove('hidden');
      }
  });
}

async function fetchSuggestions(query, box) {
  try {
    const res = await api.getProducts({ q: query });
    const rawProducts = res.data || res.items || res;

    const flattenedProducts = flattenProductVariants(rawProducts);

    if (!flattenedProducts.length) {
      box.innerHTML = `<p class="p-3 text-sm text-gray-500 text-center">Không tìm thấy sản phẩm</p>`;
      box.classList.remove('hidden');
      return;
    }

    // Render HTML
    box.innerHTML = flattenedProducts
      .slice(0, 8)
      .map(p => {
        const variantHtml = p.variant_label 
            ? `<span class="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block">${p.variant_label}</span>` 
            : '';

        // TẠO URL: Thêm tham số &v=... nếu là biến thể
        const linkUrl = p.variant_id 
            ? `product.html?id=${p.id}&v=${p.variant_id}` 
            : `product.html?id=${p.id}`;

        return `
        <a href="${linkUrl}" class="flex items-start gap-3 p-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors group">
          <div class="flex-shrink-0 border border-gray-200 rounded bg-white w-10 h-10 flex items-center justify-center overflow-hidden">
             <img src="${resolveSearchImage(p.image)}" class="w-full h-full object-contain p-0.5" onerror="this.src='https://via.placeholder.com/50'"/>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">${p.title}</p>
            ${variantHtml}
            <p class="text-xs font-bold text-red-600 mt-0.5">${formatPrice(p.price)}</p>
          </div>
        </a>`;
      })
      .join('');

    box.classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

export function initSearchSuggestions() {
    const desktopInput = document.getElementById('header-search-input');
    const desktopBox = document.getElementById('search-suggestions');
    if (desktopInput && desktopBox) attachSearch(desktopInput, desktopBox);

    const mobileInput = document.getElementById('mobile-search-input');
    const mobileBox = document.getElementById('mobile-search-suggestions');
    if (mobileInput && mobileBox) attachSearch(mobileInput, mobileBox);
}