// assets/js/ui/back-to-top.js

export function initBackToTop() {
  let btn = document.querySelector('#back-to-top');

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.className =
      'hidden fixed bottom-6 right-6 z-40 rounded-full bg-blue-600 text-white shadow-lg w-10 h-10 flex items-center justify-center text-xl';
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 250) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
