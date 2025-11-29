// assets/js/api.js

import { getToken } from './utils/storage.js';
// 👇 Import cấu hình chung
import { API_BASE } from './utils/common.js';

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};

  // 1. Token Auth
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // 2. Xử lý Content-Type
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions = {
    method,
    headers,
  };

  // 3. Xử lý Body
  if (body) {
    fetchOptions.body = (body instanceof FormData) ? body : JSON.stringify(body);
  }

  // Sử dụng API_BASE được import
  const res = await fetch(API_BASE + path, fetchOptions);

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('❌ Lỗi Parse JSON:', text);
    throw new Error('Server trả về lỗi không xác định (HTML/PHP Error)');
  }

  if (!res.ok) {
    // 👇 BẢO MẬT: Tự động đăng xuất nếu Token hết hạn hoặc không hợp lệ
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('ts_token'); // Xóa token rác
        
        // Kiểm tra đang ở trang Admin hay User để redirect đúng chỗ
        if (window.location.pathname.includes('/admin')) {
            window.location.href = 'login.html';
        } else {
            window.location.href = 'login.html';
        }
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    }

    const msg = data?.error || 'Lỗi kết nối server';
    throw new Error(msg);
  }

  return data;
}

export const api = {
  // ============= PRODUCTS (PUBLIC) =============
  getProducts(params = {}) {
    const search = new URLSearchParams(params).toString();
    const path = search ? `/products?${search}` : '/products';
    return request(path);
  },
  getBrands(category) {
    let path = '/products/brands';
    if (category && category !== 'all') {
        path += `?category=${category}`;
    }
    return request(path);
  },
  getProduct(id) {
    return request(`/products/${id}`);
  },

  // ============= PRODUCTS (ADMIN) =============
  createProduct(data) {
    return request('/products', { method: 'POST', auth: true, body: data });
  },
  updateProduct(id, data) {
    return request(`/products/${id}`, { method: 'PUT', auth: true, body: data });
  },
  deleteProduct(id) {
    return request(`/products/${id}`, { method: 'DELETE', auth: true });
  },
  uploadProductImage(id, formData) {
    return request(`/products/${id}/upload`, { method: 'POST', auth: true, body: formData });
  },
  deleteProductImage(imageUrl) {
    return request('/products/delete-image', { method: 'POST', auth: true, body: { image_url: imageUrl } });
  },

  // ============= BRANDS (ADMIN) =============
  getAllBrandsAdmin() {
    return request('/brands', { auth: true });
  },
  createBrand(data) {
    return request('/brands', { method: 'POST', auth: true, body: data });
  },
  updateBrand(id, data) {
    return request(`/brands/${id}`, { method: 'PUT', auth: true, body: data });
  },
  deleteBrand(id) {
    return request(`/brands/${id}`, { method: 'DELETE', auth: true });
  },

  // ============= AUTH =============
  login(email, password) {
    return request('/auth/login', { method: 'POST', body: { email, password } });
  },
  register(name, email, password) {
    return request('/auth/register', { method: 'POST', body: { name, email, password } });
  },
  verifyRegister(email, code) {
    return request('/auth/verify-register', { method: 'POST', body: { email, code } });
  },
  resendCode(email) {
    return request('/auth/resend-code', { method: 'POST', body: { email } });
  },
  me() {
    return request('/auth/me', { auth: true });
  },
  forgotPassword(email) {
    return request('/auth/forgot-password', { method: 'POST', body: { email } });
  },
  resetPassword(email, code, password) {
    return request('/auth/reset-password', { method: 'POST', body: { email, code, password } });
  },

  // ============= CART =============
  getCart() {
    return request('/cart', { auth: true });
  },
  addToCart(productId, quantity) {
    return request('/cart', { method: 'POST', auth: true, body: { product_id: productId, quantity } });
  },
  updateCartItem(itemId, quantity) {
    return request(`/cart/${itemId}`, { method: 'PUT', auth: true, body: { quantity } });
  },
  removeCartItem(itemId) {
    return request(`/cart/${itemId}`, { method: 'DELETE', auth: true });
  },

  // ============= WISHLIST =============
  getWishlist() {
    return request('/wishlist', { auth: true });
  },
  addWishlist(productId) {
    return request('/wishlist', { method: 'POST', auth: true, body: { product_id: productId } });
  },
  removeWishlist(itemId) {
    return request(`/wishlist/${itemId}`, { method: 'DELETE', auth: true });
  },

  // ============= ORDERS =============
  getOrders() {
    return request('/orders', { auth: true });
  },
  cancelOrder(orderId) {
    return request(`/orders/${orderId}/cancel`, { method: 'POST', auth: true });
  },
  getOrder(id) {
    return request(`/orders/${id}`, { auth: true });
  },
  createOrder(payload) {
    return request('/orders', { method: 'POST', auth: true, body: payload });
  },
  restoreOrderToCart(orderId) {
    return request(`/orders/${orderId}/restore-cart`, { method: 'POST', auth: true });
  },
  confirmOrderPayment(orderId) {
    return request(`/orders/${orderId}/confirm-payment`, { method: 'POST', auth: true });
  },

  // ============= ADDRESS =============
  getAddresses() {
    return request('/account/addresses', { auth: true });
  },
  addAddress(data) {
    return request('/account/addresses', { method: 'POST', auth: true, body: data });
  },
  updateAddress(id, data) {
    return request(`/account/addresses/${id}`, { method: 'PUT', auth: true, body: data });
  },
  deleteAddress(id) {
    return request(`/account/addresses/${id}`, { method: 'DELETE', auth: true });
  },
  setDefaultAddress(id) {
    return request(`/account/addresses/${id}/default`, { method: 'PUT', auth: true });
  },

  // ============= REVIEWS =============
  createReview(data) {
    return request('/reviews', { method: 'POST', auth: true, body: data });
  },

  // ============= ORDERS (ADMIN) =============
  getOrdersAdmin(params = {}) {
    const search = new URLSearchParams(params).toString();
    return request(`/admin/orders?${search}`, { auth: true });
  },
  getOrderAdmin(id) {
    return request(`/admin/orders/${id}`, { auth: true });
  },
  updateOrderAdmin(id, data) {
    return request(`/admin/orders/${id}`, { method: 'PUT', auth: true, body: data });
  },
  // ============= CATEGORIES =============
  getCategories() {
    return request('/categories');
  },
  // 👇 MỚI: Lấy chi tiết 1 danh mục
  getCategory(id) {
    return request(`/categories/${id}`); 
  },
  createCategory(data) {
    return request('/categories', { method: 'POST', auth: true, body: data });
  },
  // 👇 QUAN TRỌNG: Hàm update phải có
  updateCategory(id, data) {
    return request(`/categories/${id}`, { method: 'PUT', auth: true, body: data });
  },
  deleteCategory(id) {
    return request(`/categories/${id}`, { method: 'DELETE', auth: true });
  },
  changePassword(data) {
    return request('/auth/change-password', { method: 'POST', auth: true, body: data });
  },
};