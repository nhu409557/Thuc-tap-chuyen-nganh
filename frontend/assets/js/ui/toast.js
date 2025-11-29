// assets/js/ui/toast.js

let toastId = 0;

export function showToast(message, type = 'default', options = {}) {
  const wrapper = document.querySelector('#toast-wrapper');
  if (!wrapper) return;

  const id = `toast-${++toastId}`;
  const duration = options.duration ?? 3000;

  const bg =
    type === 'success'
      ? 'bg-green-50 border-green-300'
      : type === 'error' || type === 'destructive'
      ? 'bg-red-50 border-red-300'
      : 'bg-white border-gray-200';

  const color =
    type === 'success'
      ? 'text-green-800'
      : type === 'error' || type === 'destructive'
      ? 'text-red-800'
      : 'text-gray-800';

  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast ${bg} ${color} shadow-lg border px-4 py-3 rounded-md flex items-start gap-3 w-72 animate-fade-in`;
  toast.innerHTML = `
    <div class="flex-1 text-sm">
      ${message}
    </div>
    <button class="text-gray-400 hover:text-gray-700 text-lg leading-none">&times;</button>
  `;

  const closeBtn = toast.querySelector('button');
  closeBtn.addEventListener('click', () => removeToast(toast));

  wrapper.appendChild(toast);

  setTimeout(() => {
    removeToast(toast);
  }, duration);
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.add('opacity-0', 'translate-y-2', 'transition');
  setTimeout(() => {
    toast.remove();
  }, 200);
}

export function initToastRoot() {
  // nothing extra for now
}
