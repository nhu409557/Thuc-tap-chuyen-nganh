import { api } from './api.js';
import { showToast } from './ui/toast.js';

let debounceTimer = null;

function attachSearch(input, suggestionBox) {
  if (!input) return;

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
}

async function fetchSuggestions(query, box) {
  try {
    const res = await api.getProducts({ q: query });
    const products = res.data || res.items || res;

    if (!products.length) {
      box.innerHTML = `<p class="p-2 text-sm text-gray-500">Không tìm thấy sản phẩm</p>`;
      box.classList.remove('hidden');
      return;
    }

    box.innerHTML = products
      .slice(0, 5)
      .map(
        (p) => `
        <a href="product.html?id=${p.id}" class="flex items-center gap-3 p-2 hover:bg-gray-100 text-sm">
          <img src="${p.image}" class="w-10 h-10 rounded object-cover" />
          <span>${p.title}</span>
        </a>`
      )
      .join('');

    box.classList.remove('hidden');
  } catch (err) {
    showToast('Lỗi tìm kiếm', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  attachSearch(
    document.querySelector('#search-input'),
    document.querySelector('#search-suggestions')
  );

  // Mobile search
  const mobileBox = document.createElement('div');
  mobileBox.id = 'search-suggestions-mobile';
  mobileBox.className = 'absolute left-0 right-0 bg-white shadow rounded-lg hidden z-40';

  const mobileInput = document.querySelector('#search-input-mobile');
  if (mobileInput) {
    mobileInput.parentElement.appendChild(mobileBox);
    attachSearch(mobileInput, mobileBox);
  }
});
