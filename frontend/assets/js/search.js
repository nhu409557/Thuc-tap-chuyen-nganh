import { api } from "./api.js";
import { showToast } from "./ui/toast.js";

let debounceTimer = null;

// Gợi ý tìm kiếm
export function initLiveSearch() {
    const desktopInput = document.getElementById("header-search-input");
    const desktopBox = document.getElementById("search-suggestions");

    if (desktopInput && desktopBox) {
        attachSearch(desktopInput, desktopBox);
    }

    const mobileInput = document.getElementById("mobile-search-input");

    if (mobileInput) {
        let mobileBox = document.getElementById("search-suggestions-mobile");

        if (!mobileBox) {
            mobileBox = document.createElement("div");
            mobileBox.id = "search-suggestions-mobile";
            mobileBox.className =
                "absolute left-0 right-0 bg-white shadow-xl rounded-b-lg hidden z-50 mt-1 max-h-60 overflow-y-auto border-t border-gray-100";
            if (mobileInput.parentNode) {
                mobileInput.parentNode.style.position = "relative";
                mobileInput.parentNode.appendChild(mobileBox);
            }
        }

        attachSearch(mobileInput, mobileBox);
    }
}

function attachSearch(input, suggestionBox) {
    if (!input) return;

    // Xử lý sự kiện nhập liệu (Input)
    input.addEventListener("input", () => {
        const q = input.value.trim();
        clearTimeout(debounceTimer);

        if (!q) {
            suggestionBox.classList.add("hidden");
            suggestionBox.innerHTML = "";
            return;
        }

        // Debounce: Chờ 300ms sau khi ngừng gõ mới gọi API
        debounceTimer = setTimeout(() => {
            fetchSuggestions(q, suggestionBox);
        }, 300);
    });

    // Xử lý sự kiện Focus: Hiện lại gợi ý cũ nếu ô input vẫn có chữ
    input.addEventListener("focus", () => {
        if (input.value.trim() && suggestionBox.innerHTML.trim() !== "") {
            suggestionBox.classList.remove("hidden");
        }
    });

    // Xử lý sự kiện Click ra ngoài: Ẩn gợi ý
    document.addEventListener("click", (e) => {
        // Nếu click không trúng input và không trúng box gợi ý -> Ẩn
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.add("hidden");
        }
    });
}

async function fetchSuggestions(query, box) {
    try {
        const res = await api.getProducts({ q: query });
        const products = res.data || res.items || res;

        if (!products || !products.length) {
            box.innerHTML = `<p class="p-3 text-sm text-gray-500 text-center">Không tìm thấy sản phẩm</p>`;
            box.classList.remove("hidden");
            return;
        }

        // Render tối đa 5 sản phẩm
        box.innerHTML = products
            .slice(0, 5)
            .map(
                (p) => `
        <a href="product.html?id=${
            p.id
        }" class="flex items-center gap-3 p-2 hover:bg-gray-50 text-sm border-b last:border-0 transition-colors">
          <img src="${
              p.image
          }" class="w-10 h-10 rounded object-cover border border-gray-100 shrink-0" alt="${
                    p.title
                }" />
          <div class="flex-1 min-w-0">
             <p class="font-medium text-gray-800 truncate">${p.title}</p>
             <p class="text-xs text-blue-600 font-bold mt-0.5">
                ${parseInt(p.price).toLocaleString("vi-VN")}đ
             </p>
          </div>
        </a>`
            )
            .join("");

        box.classList.remove("hidden");
    } catch (err) {
        console.error("Lỗi live search:", err);
    }
}
