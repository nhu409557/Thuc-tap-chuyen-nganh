// assets/js/utils/storage.js

const TOKEN_KEY = 'ts_token';
const CART_KEY = 'ts_cart';
const WISHLIST_KEY = 'ts_wishlist';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

export function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart || []));
}

export function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

export function setWishlist(list) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list || []));
}
