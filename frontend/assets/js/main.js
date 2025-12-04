import { loadHeaderFooter } from "./utils/dom.js";
import { api } from "./api.js";
import { getToken } from "./utils/storage.js";

import {
    initMobileMenu,
    initUserDropdown,
    updateHeaderAuth,
    initHeaderCategories,
    initSearch,
    initMiniCart,
} from "./header.js";

import { initLiveSearch } from "./search.js";

export function initBackToTop() {
    const btn = document.getElementById("btn-back-to-top");
    if (!btn) return;

    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            btn.classList.remove("opacity-0", "invisible", "translate-y-4");
            btn.classList.add("opacity-100", "visible", "translate-y-0");
        } else {
            btn.classList.add("opacity-0", "invisible", "translate-y-4");
            btn.classList.remove("opacity-100", "visible", "translate-y-0");
        }
    });

    btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

export async function syncCartBadge() {
    const badge = document.querySelector("#cart-count-badge");
    if (!badge) return;

    const token = getToken();
    let count = 0;

    if (!token) {
        badge.textContent = "0";
        badge.classList.add("hidden");
        return;
    }

    try {
        const res = await api.getCart();
        const items = res.data || [];
        count = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    } catch (err) {
        console.error("Failed to sync cart badge:", err.message);
        count = 0;
    }

    badge.textContent = String(count);

    if (count > 0) {
        badge.classList.remove("hidden");
        badge.classList.add("animate-bounce");
        setTimeout(() => badge.classList.remove("animate-bounce"), 1000);
    } else {
        badge.classList.add("hidden");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadHeaderFooter();
    await initHeaderCategories();
    initSearch();
    initLiveSearch();
    initMiniCart();
    initMobileMenu();
    initUserDropdown();
    await updateHeaderAuth();
    syncCartBadge();
    initBackToTop();
});
