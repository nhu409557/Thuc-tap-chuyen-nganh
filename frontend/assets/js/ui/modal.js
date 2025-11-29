// assets/js/ui/modal.js

function openModalById(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex'); // vì ta dùng hidden + flex items-center justify-center
  document.body.classList.add('overflow-hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

export function initModals() {
  // Nút mở modal: data-modal-target="modal-id"
  document.querySelectorAll('[data-modal-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-modal-target');
      if (!id) return;
      openModalById(id);
    });
  });

  // Nút đóng trong modal: data-modal-close
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('[data-modal-backdrop]');
      if (modal) closeModal(modal);
    });
  });

  // Click nền (backdrop): data-modal-backdrop
  document.querySelectorAll('[data-modal-backdrop]').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // ESC để đóng modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('[data-modal-backdrop]').forEach((modal) => {
        if (!modal.classList.contains('hidden')) {
          closeModal(modal);
        }
      });
    }
  });
}

// auto init
document.addEventListener('DOMContentLoaded', initModals);
