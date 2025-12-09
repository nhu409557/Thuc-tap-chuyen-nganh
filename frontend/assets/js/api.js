// assets/js/api.js

import { getToken } from './utils/storage.js';
import { API_BASE } from './utils/common.js';

// Hàm request nội bộ
async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions = { method, headers };

  if (body) {
    fetchOptions.body = (body instanceof FormData) ? body : JSON.stringify(body);
  }

  const res = await fetch(API_BASE + path, fetchOptions);
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('❌ Lỗi Parse JSON:', text);
    throw new Error('Server trả về lỗi không xác định');
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('ts_token');
      // Redirect về login nếu token hết hạn (xử lý riêng cho admin/user nếu cần)
      if (window.location.pathname.includes('/admin')) {
        window.location.href = '../login.html'; 
      } else {
        window.location.href = 'login.html';
      }
      throw new Error('Phiên đăng nhập hết hạn.');
    }
    const msg = data?.error || 'Lỗi kết nối server';
    throw new Error(msg);
  }

  return data;
}

export const api = {
  request,

  // ============= AUTH =============
  login(email, password) { return request('/auth/login', { method: 'POST', body: { email, password } }); },
  loginGoogle(credential) { return request('/auth/login-google', { method: 'POST', body: { credential } }); },
  register(name, email, password) { return request('/auth/register', { method: 'POST', body: { name, email, password } }); },
  verifyRegister(email, code) { return request('/auth/verify-register', { method: 'POST', body: { email, code } }); },
  resendCode(email) { return request('/auth/resend-code', { method: 'POST', body: { email } }); },
  me() { return request('/auth/me', { auth: true }); },
  forgotPassword(email) { return request('/auth/forgot-password', { method: 'POST', body: { email } }); },
  resetPassword(email, code, password) { return request('/auth/reset-password', { method: 'POST', body: { email, code, password } }); },
  changePassword(data) { return request('/auth/change-password', { method: 'POST', auth: true, body: data }); },

  // ============= USERS (ADMIN) =============
  getAdminUsers(page = 1) {
    return request(`/admin/users?page=${page}`, { auth: true });
  },
  toggleUserBlock(id, isLocked) {
    // isLocked: 1 (khóa), 0 (mở)
    return request(`/admin/users/${id}/block`, {
      method: 'POST',      
      auth: true,
      body: { is_locked: isLocked }
    });
  },
  deleteUser(id) {
    return request(`/admin/users/${id}/delete`, {
      method: 'POST',      
      auth: true
    });
  },

  // ============= PRODUCTS =============
  // Public
  getProducts(params = {}) {
    const search = new URLSearchParams(params).toString();
    return request(search ? `/products?${search}` : '/products');
  },
  getBrands(category) {
    let path = '/products/brands';
    if (category && category !== 'all') path += `?category=${category}`;
    return request(path);
  },
  getProduct(id) { return request(`/products/${id}`); },

  // Admin Products
  createProduct(data) { return request('/products', { method: 'POST', auth: true, body: data }); },
  updateProduct(id, data) { return request(`/products/${id}`, { method: 'PUT', auth: true, body: data }); },
  deleteProduct(id) { return request(`/products/${id}`, { method: 'DELETE', auth: true }); },
  uploadProductImage(id, formData) { return request(`/products/${id}/upload`, { method: 'POST', auth: true, body: formData }); },
  deleteProductImage(imageUrl) { return request('/products/delete-image', { method: 'POST', auth: true, body: { image_url: imageUrl } }); },
  
  // Variants (Admin)
  getProductVariants(id) { return request(`/products/${id}/variants`); },
  saveProductVariants(id, data) { return request(`/products/${id}/variants/save`, { method: 'POST', auth: true, body: data }); },

  // ============= CATEGORIES & BRANDS (ADMIN) =============
  getCategories() { return request('/categories'); },
  getCategory(id) { return request(`/categories/${id}`); },
  createCategory(data) { return request('/categories', { method: 'POST', auth: true, body: data }); },
  updateCategory(id, data) { return request(`/categories/${id}`, { method: 'PUT', auth: true, body: data }); },
  deleteCategory(id) { return request(`/categories/${id}`, { method: 'DELETE', auth: true }); },

  getAllBrandsAdmin() { return request('/brands', { auth: true }); },
  createBrand(data) { return request('/brands', { method: 'POST', auth: true, body: data }); },
  updateBrand(id, data) { return request(`/brands/${id}`, { method: 'PUT', auth: true, body: data }); },
  deleteBrand(id) { return request(`/brands/${id}`, { method: 'DELETE', auth: true }); },

  // ============= PRODUCT GROUPS =============
  getProductGroups() { return request('/product-groups', { auth: true }); },
  createProductGroup(data) { return request('/product-groups', { method: 'POST', auth: true, body: data }); },
  updateProductGroup(id, data) { return request(`/product-groups/${id}`, { method: 'PUT', auth: true, body: data }); },
  deleteProductGroup(id) { return request(`/product-groups/${id}`, { method: 'DELETE', auth: true }); },

  // ============= CART & WISHLIST (USER) =============
  getCart() { return request('/cart', { auth: true }); },
  addToCart(productId, quantity, color = null) {
    return request('/cart', { method: 'POST', auth: true, body: { product_id: productId, quantity, selected_color: color } });
  },
  updateCartItem(itemId, quantity) { return request(`/cart/${itemId}`, { method: 'PUT', auth: true, body: { quantity } }); },
  removeCartItem(itemId) { return request(`/cart/${itemId}`, { method: 'DELETE', auth: true }); },

  getWishlist() { return request('/wishlist', { auth: true }); },
  addWishlist(productId) { return request('/wishlist', { method: 'POST', auth: true, body: { product_id: productId } }); },
  removeWishlist(itemId) { return request(`/wishlist/${itemId}`, { method: 'DELETE', auth: true }); },

  // ============= ADDRESS (USER) =============
  getAddresses() { return request('/account/addresses', { auth: true }); },
  addAddress(data) { return request('/account/addresses', { method: 'POST', auth: true, body: data }); },
  updateAddress(id, data) { return request(`/account/addresses/${id}`, { method: 'PUT', auth: true, body: data }); },
  deleteAddress(id) { return request(`/account/addresses/${id}`, { method: 'DELETE', auth: true }); },
  setDefaultAddress(id) { return request(`/account/addresses/${id}/default`, { method: 'PUT', auth: true }); },

  // ============= ORDERS =============
  // User
  getOrders() { return request('/orders', { auth: true }); },
  getOrder(id) { return request(`/orders/${id}`, { auth: true }); },
  createOrder(payload) { return request('/orders', { method: 'POST', auth: true, body: payload }); },
  cancelOrder(orderId) { return request(`/orders/${orderId}/cancel`, { method: 'POST', auth: true }); },
  restoreOrderToCart(orderId) { return request(`/orders/${orderId}/restore-cart`, { method: 'POST', auth: true }); },
  confirmOrderPayment(orderId) { return request(`/orders/${orderId}/confirm-payment`, { method: 'POST', auth: true }); },
  
  // Admin
  getOrdersAdmin(params = {}) {
    const search = new URLSearchParams(params).toString();
    return request(`/admin/orders?${search}`, { auth: true });
  },
  getOrderAdmin(id) { return request(`/admin/orders/${id}`, { auth: true }); },
  updateOrderAdmin(id, data) { return request(`/admin/orders/${id}`, { method: 'PUT', auth: true, body: data }); },

  // ============= REVIEWS =============
  // User
  createReview(data) { return request('/reviews', { method: 'POST', auth: true, body: data }); },

  // Admin Reviews
  getReviewsAdmin(params = {}) {
    const search = new URLSearchParams(params).toString();
    return request(`/admin/reviews?${search}`, { auth: true });
  },
  adminReplyReview(id, reply) {
    return request('/admin/reviews/reply', { method: 'POST', auth: true, body: { id, reply } });
  },
  adminToggleReview(id, isHidden) {
    // isHidden: 1 (ẩn), 0 (hiện)
    return request('/admin/reviews/toggle', { method: 'POST', auth: true, body: { id, is_hidden: isHidden } });
  },
  adminDeleteReview(id) {
    return request('/admin/reviews/delete', { method: 'POST', auth: true, body: { id } });
  },

  // ============= COUPONS (MÃ GIẢM GIÁ) =============
  // Admin
  getCouponsAdmin() { 
    return request('/admin/coupons', { auth: true }); 
  },
  createCoupon(data) { 
    return request('/admin/coupons', { method: 'POST', auth: true, body: data }); 
  },
  updateCoupon(id, data) { 
    return request(`/admin/coupons/${id}`, { method: 'PUT', auth: true, body: data }); 
  },
  deleteCoupon(id) { 
    return request(`/admin/coupons/${id}`, { method: 'DELETE', auth: true }); 
  },
// [MỚI] Lấy đánh giá công khai theo ID sản phẩm
  getProductReviews(productId) {
    return request(`/reviews/product/${productId}`);
  },
  // User
  checkCoupon(code) { 
    return request('/coupons/check', { method: 'POST', auth: true, body: { code } }); 
  },
};