<?php

use App\Controllers\AuthController;
use App\Controllers\ProductController;
use App\Controllers\CategoryController;
use App\Controllers\BrandController;
use App\Controllers\CartController;
use App\Controllers\AddressController;
use App\Controllers\OrderController;
use App\Controllers\MomoController;
use App\Controllers\DashboardController;
use App\Controllers\ReviewController;
use App\Controllers\WishlistController;
use App\Controllers\UserController;
use App\Controllers\CouponController;

// --- Test Route (Kiểm tra server) ---
$router->get('/', function($req, $res) {
    $res->json(['status' => 'OK', 'message' => 'TechHub API Ready']);
});

// ==========================================================
// ======================= AUTH (XÁC THỰC) ==================
// ==========================================================

$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/verify-register', [AuthController::class, 'verifyRegister']);
$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/login-google', [AuthController::class, 'loginGoogle']); // Login Google
$router->get('/auth/me', [AuthController::class, 'me']);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/auth/reset-password', [AuthController::class, 'resetPassword']);
$router->post('/auth/resend-code', [AuthController::class, 'resendCode']);
$router->post('/auth/change-password', [AuthController::class, 'changePassword']);

// ==========================================================
// ===================== PRODUCTS (PUBLIC) ==================
// ==========================================================

$router->get('/products', [ProductController::class, 'index']);
$router->get('/products/brands', [ProductController::class, 'getBrands']); // Lấy brand theo category
$router->get('/products/{id}', [ProductController::class, 'show']);

// ==========================================================
// ==================== CATEGORIES (PUBLIC) =================
// ==========================================================

$router->get('/categories', [CategoryController::class, 'index']);
$router->get('/categories/{id}', [CategoryController::class, 'show']);

// ==========================================================
// ====================== BRANDS (PUBLIC) ===================
// ==========================================================

$router->get('/brands', [BrandController::class, 'index']);

// ==========================================================
// ======================== CART (USER) =====================
// ==========================================================

$router->get('/cart', [CartController::class, 'index']);
$router->post('/cart', [CartController::class, 'store']);
$router->put('/cart/{id}', [CartController::class, 'update']);
$router->delete('/cart/{id}', [CartController::class, 'destroy']);

// ==========================================================
// ====================== WISHLIST (USER) ===================
// ==========================================================

$router->get('/wishlist', [WishlistController::class, 'index']);
$router->post('/wishlist', [WishlistController::class, 'store']);
$router->delete('/wishlist/{id}', [WishlistController::class, 'destroy']);

// ==========================================================
// ====================== ADDRESS (USER) ====================
// ==========================================================

$router->get('/account/addresses', [AddressController::class, 'index']);
$router->post('/account/addresses', [AddressController::class, 'store']);
$router->put('/account/addresses/{id}', [AddressController::class, 'update']);
$router->delete('/account/addresses/{id}', [AddressController::class, 'destroy']);
$router->put('/account/addresses/{id}/default', [AddressController::class, 'setDefault']);

// ==========================================================
// ======================= ORDERS (USER) ====================
// ==========================================================

$router->get('/orders', [OrderController::class, 'index']);
$router->post('/orders', [OrderController::class, 'store']); // Tạo đơn
$router->get('/orders/{id}', [OrderController::class, 'show']);
$router->post('/orders/{id}/cancel', [OrderController::class, 'cancel']);
$router->post('/orders/{id}/restore-cart', [OrderController::class, 'restoreToCart']);
$router->post('/orders/{id}/confirm-payment', [OrderController::class, 'confirmPayment']);

// ==========================================================
// ===================== REVIEWS (USER) =====================
// ==========================================================

$router->post('/reviews', [ReviewController::class, 'store']); // Gửi đánh giá

// ==========================================================
// ===================== COUPONS (USER) =====================
// ==========================================================

$router->post('/coupons/check', [CouponController::class, 'check']);

// ==========================================================
// ========================= MOMO IPN =======================
// ==========================================================

$router->post('/momo/ipn', [MomoController::class, 'ipn']);


// ##########################################################
// #################### ADMIN ROUTES ########################
// ##########################################################

// --- Dashboard (Thống kê) ---
$router->get('/admin/stats', [DashboardController::class, 'index']);

// --- Admin Orders ---
$router->get('/admin/orders', [OrderController::class, 'indexAdmin']);
$router->get('/admin/orders/{id}', [OrderController::class, 'showAdmin']);
$router->put('/admin/orders/{id}', [OrderController::class, 'updateAdmin']);

// --- Admin Reviews (Quản lý đánh giá - Đã sửa lỗi 404) ---
$router->get('/admin/reviews', [ReviewController::class, 'indexAdmin']); // Lấy danh sách
$router->post('/admin/reviews/reply', [ReviewController::class, 'reply']); // Trả lời
$router->post('/admin/reviews/toggle', [ReviewController::class, 'toggleHidden']); // Ẩn/Hiện
$router->post('/admin/reviews/delete', [ReviewController::class, 'delete']); // Xóa mềm

// --- Admin Products ---
$router->post('/products', [ProductController::class, 'store']);
$router->put('/products/{id}', [ProductController::class, 'update']);
$router->delete('/products/{id}', [ProductController::class, 'destroy']);
$router->post('/products/{id}/upload', [ProductController::class, 'uploadImage']);
$router->post('/products/delete-image', [ProductController::class, 'deleteImage']);

// Quản lý biến thể (Variants)
$router->get('/products/{id}/variants', [ProductController::class, 'getVariants']);
$router->post('/products/{id}/variants/save', [ProductController::class, 'saveVariants']);
$router->post('/products/{id}/variants', [ProductController::class, 'createVariant']); // (Legacy)

// --- Admin Categories ---
$router->post('/categories', [CategoryController::class, 'store']);
$router->put('/categories/{id}', [CategoryController::class, 'update']);
$router->delete('/categories/{id}', [CategoryController::class, 'destroy']);

// --- Admin Brands ---
$router->post('/brands', [BrandController::class, 'store']);
$router->put('/brands/{id}', [BrandController::class, 'update']);
$router->delete('/brands/{id}', [BrandController::class, 'destroy']);

// --- Admin Users ---
$router->get('/admin/users', [UserController::class, 'index']);
$router->post('/admin/users/{id}/block', [UserController::class, 'toggleBlock']);
$router->post('/admin/users/{id}/delete', [UserController::class, 'destroy']);

// --- Admin Coupons ---
$router->get('/admin/coupons', [CouponController::class, 'index']);
$router->post('/admin/coupons', [CouponController::class, 'store']);
$router->put('/admin/coupons/{id}', [CouponController::class, 'update']);
$router->delete('/admin/coupons/{id}', [CouponController::class, 'destroy']);
// ... Các route cũ ...

// ==========================================================
// ===================== REVIEWS (PUBLIC) ===================
// ==========================================================

// Route này cho phép ai cũng xem được đánh giá của sản phẩm
$router->get('/reviews/product/{id}', [ReviewController::class, 'indexPublic']);

// ==========================================================
// ===================== REVIEWS (USER) =====================
// ==========================================================
$router->post('/reviews', [ReviewController::class, 'store']);