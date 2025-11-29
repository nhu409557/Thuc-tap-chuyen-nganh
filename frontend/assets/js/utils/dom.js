// assets/js/utils/dom.js

/**
 * Helper: Tải HTML từ một đường dẫn và chèn vào một selector
 */
export async function injectHTML(selector, path) {
  const el = document.querySelector(selector);
  if (!el) {
    // Không log warn để tránh rác console nếu trang không có phần tử đó
    return;
  }
  
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path} (status: ${res.status})`);
    const html = await res.text();
    el.innerHTML = html;
  } catch (err) {
    console.error(`Lỗi tải ${path}:`, err);
    el.innerHTML = `<p class="text-red-500 text-xs p-2">Lỗi tải component</p>`;
  }
}

/**
 * Hàm phụ: Tải và gắn Toast Container vào cuối body
 * (Khắc phục lỗi không hiện thông báo)
 */
async function loadToastContainer() {
    // Kiểm tra xem đã có chưa để tránh trùng lặp
    if (document.getElementById('toast-wrapper')) return;

    try {
        // Đường dẫn này phải trỏ đúng về file html trong thư mục partials
        const res = await fetch('partials/toast-container.html');
        if (res.ok) {
            const html = await res.text();
            // Chèn vào cuối body để luôn nằm trên cùng các phần tử khác
            document.body.insertAdjacentHTML('beforeend', html);
        } else {
            console.error("Không tìm thấy file partials/toast-container.html");
        }
    } catch (e) {
        console.error("Lỗi mạng khi tải toast container", e);
    }
}

/**
 * Tải Header, Footer VÀ Toast Container
 */
export async function loadHeaderFooter() {
  await Promise.all([
    injectHTML('#site-header', 'partials/header.html'),
    injectHTML('#site-footer', 'partials/footer.html'),
    
    // 👇 QUAN TRỌNG: Nạp khung thông báo lỗi
    loadToastContainer() 
  ]);
}

/**
 * Tải nhiều component HTML (cho trang chủ)
 * @param {Object} componentMap - { '#div-id': 'path/to/component.html' }
 */
export async function loadComponents(componentMap) {
  const promises = Object.entries(componentMap).map(async ([selector, url]) => {
    const el = document.querySelector(selector);
    if (!el) return; // Bỏ qua nếu không tìm thấy ID
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const html = await res.text();
      el.innerHTML = html;
    } catch (err) {
      console.error(err);
      el.innerHTML = `<p class="text-red-500 text-center p-4">Lỗi tải component: ${url}</p>`;
    }
  });

  // Chờ tất cả component tải xong
  await Promise.all(promises);
}

/**
 * Helper: QuerySelector (Giống jQuery $)
 */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Helper: QuerySelectorAll (trả về Array)
 */
export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}