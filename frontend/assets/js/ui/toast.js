// assets/js/ui/toast.js

let toastCounter = 0;

const TYPE_CONFIG = {
    success: {
        border: 'border-green-300',
        bg: 'bg-green-50',
        text: 'text-green-800',
        icon: 'fa-circle-check'
    },
    error: {
        border: 'border-red-300',
        bg: 'bg-red-50',
        text: 'text-red-800',
        icon: 'fa-circle-exclamation'
    },
    warning: {
        border: 'border-yellow-300',
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        icon: 'fa-triangle-exclamation'
    },
    info: {
        border: 'border-sky-300',
        bg: 'bg-sky-50',
        text: 'text-sky-800',
        icon: 'fa-circle-info'
    },
    default: {
        border: 'border-gray-200',
        bg: 'bg-white',
        text: 'text-gray-800',
        icon: 'fa-circle-info'
    }
};

/**
 * Lấy / tạo container để hiển thị toast.
 * Ưu tiên: #toast-root (đúng với HTML của bạn).
 */
function getToastWrapper() {
    // Ưu tiên dùng #toast-root
    let wrapper = document.querySelector('#toast-root');

    // Nếu chưa có, fallback #toast-wrapper (phòng khi project cũ dùng id này)
    if (!wrapper) {
        wrapper = document.querySelector('#toast-wrapper');
    }

    // Nếu vẫn chưa có, tự tạo mới
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'toast-root';
        wrapper.className = 'fixed top-5 right-5 z-[9999] flex flex-col gap-3';
        document.body.appendChild(wrapper);
    }

    return wrapper;
}

/**
 * Hàm xóa toast với hiệu ứng mờ dần
 */
function removeToast(toastEl, delay = 200) {
    if (!toastEl) return;
    toastEl.classList.add('opacity-0', 'translate-y-2', 'transition', 'duration-200');
    setTimeout(() => {
        if (toastEl && toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
        }
    }, delay);
}

/**
 * Hiển thị toast
 * @param {string} message - Nội dung thông báo
 * @param {'success'|'error'|'info'|'warning'|'default'} type
 * @param {object} options - { duration: number }
 */
export function showToast(message, type = 'default', options = {}) {
    const wrapper = getToastWrapper();
    if (!wrapper) {
        // Trường hợp cực đoan: vẫn có message cho user
        alert(message);
        return;
    }

    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.default;
    const duration = typeof options.duration === 'number' ? options.duration : 3000;
    const id = `toast-${++toastCounter}`;

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = [
        'toast-item',
        'min-w-[220px]',
        'max-w-sm',
        'border',
        cfg.border,
        cfg.bg,
        cfg.text,
        'shadow-lg',
        'rounded-lg',
        'px-4',
        'py-3',
        'flex',
        'items-start',
        'gap-3',
        'text-sm',
        'animate-fade-in'
    ].join(' ');

    toast.innerHTML = `
        <div class="mt-0.5">
            <i class="fa-solid ${cfg.icon} text-xs"></i>
        </div>
        <div class="flex-1 leading-snug">
            ${message}
        </div>
        <button type="button"
                class="ml-2 text-gray-400 hover:text-gray-700 text-lg leading-none">
            &times;
        </button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => removeToast(toast));

    wrapper.appendChild(toast);

    // Tự động ẩn sau duration ms
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }
}

/**
 * Hàm init (không bắt buộc phải gọi),
 * nhưng bạn có thể gọi tại layout admin để đảm bảo wrapper tồn tại.
 */
export function initToastRoot() {
    getToastWrapper();
}
