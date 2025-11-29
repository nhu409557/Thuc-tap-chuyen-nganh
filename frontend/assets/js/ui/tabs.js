// assets/js/ui/tabs.js

function initTabsRoot(root) {
  const triggers = Array.from(root.querySelectorAll('[data-tab-trigger]'));
  const contents = Array.from(root.querySelectorAll('[data-tab-content]'));

  if (!triggers.length || !contents.length) return;

  // Xác định tab mặc định
  let defaultKey = null;
  const defaultTrigger = triggers.find((t) => t.hasAttribute('data-tab-default'));
  if (defaultTrigger) {
    defaultKey = defaultTrigger.getAttribute('data-tab-trigger');
  } else {
    defaultKey = triggers[0].getAttribute('data-tab-trigger');
  }

  function setActive(key) {
    // update triggers
    triggers.forEach((btn) => {
      const k = btn.getAttribute('data-tab-trigger');
      const isActive = k === key;
      btn.setAttribute('data-active', isActive ? 'true' : 'false');
    });

    // update contents
    contents.forEach((panel) => {
      const k = panel.getAttribute('data-tab-content');
      if (k === key) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });
  }

  // gán event click
  triggers.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-tab-trigger');
      setActive(key);
    });
  });

  // set default
  setActive(defaultKey);
}

export function initTabs() {
  document.querySelectorAll('[data-tabs-root]').forEach((root) => {
    initTabsRoot(root);
  });
}

// auto init
document.addEventListener('DOMContentLoaded', initTabs);
