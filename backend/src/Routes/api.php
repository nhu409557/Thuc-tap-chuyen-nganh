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
use App\Controllers\NewsletterController;
use App\Controllers\NotificationController;
use App\Controllers\OrderReturnController; 

// ==========================================================
// FIX HOSTING FREE (METHOD SPOOFING - PHIÊN BẢN MỚI)
// ==========================================================

if (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
    $_SERVER['REQUEST_METHOD'] = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
}
elseif (isset($_GET['_method'])) {
    $_SERVER['REQUEST_METHOD'] = strtoupper($_GET['_method']);
}

$requestUri = $_SERVER['REQUEST_URI'];
if (strpos($requestUri, '?') !== false) {
    $requestUri = substr($requestUri, 0, strpos($requestUri, '?'));
    $_SERVER['REQUEST_URI'] = $requestUri; 
}


// --- Test Route ---
$router->get('/', function($req, $res) {
    $res->json(['status' => 'OK', 'message' => 'TechHub API Ready']);
});

// ==========================================================
// ======================= AUTH (XÁC THỰC) ==================
// ==========================================================

$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/verify-register', [AuthController::class, 'verifyRegister']);
$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/login-google', [AuthController::class, 'loginGoogle']);
$router->get('/auth/me', [AuthController::class, 'me']);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/auth/reset-password', [AuthController::class, 'resetPassword']);
$router->post('/auth/resend-code', [AuthController::class, 'resendCode']);
$router->post('/auth/change-password', [AuthController::class, 'changePassword']);
$router->post('/auth/update-profile', [AuthController::class, 'updateProfile']);

// ==========================================================
// ===================== PRODUCTS (PUBLIC) ==================
// ==========================================================

$router->get('/products', [ProductController::class, 'index']);
$router->get('/products/brands', [ProductController::class, 'getBrands']);
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
$router->post('/orders', [OrderController::class, 'store']);
$router->get('/orders/{id}', [OrderController::class, 'show']);
$router->post('/orders/{id}/cancel', [OrderController::class, 'cancel']);
$router->post('/orders/{id}/restore-cart', [OrderController::class, 'restoreToCart']);
$router->post('/orders/{id}/confirm-payment', [OrderController::class, 'confirmPayment']);

// [USER] YÊU CẦU TRẢ HÀNG
$router->post('/orders/return', [OrderReturnController::class, 'requestReturn']);

// ==========================================================
// ===================== REVIEWS (USER) =====================
// ==========================================================

$router->post('/reviews', [ReviewController::class, 'store']);
$router->get('/reviews/product/{id}', [ReviewController::class, 'indexPublic']);

// ==========================================================
// ===================== COUPONS (USER) =====================
// ==========================================================

$router->post('/coupons/check', [CouponController::class, 'check']);

// ==========================================================
// ==================== NEWSLETTER (USER) ===================
// ==========================================================

$router->post('/newsletter/subscribe', [NewsletterController::class, 'subscribe']);

// ==========================================================
// ========================= MOMO IPN =======================
// ==========================================================

$router->post('/momo/ipn', [MomoController::class, 'ipn']);


// ##########################################################
// #################### ADMIN ROUTES ########################
// ##########################################################

$router->get('/admin/stats', [DashboardController::class, 'index']);

$router->get('/admin/orders', [OrderController::class, 'indexAdmin']);
$router->get('/admin/orders/{id}', [OrderController::class, 'showAdmin']);
$router->put('/admin/orders/{id}', [OrderController::class, 'updateAdmin']);

// 👇👇👇 [QUAN TRỌNG] ROUTE NÀY ĐANG BỊ THIẾU GÂY LỖI 404 👇👇👇
$router->post('/admin/returns/{id}/process', [OrderReturnController::class, 'processReturn']);

$router->get('/admin/reviews', [ReviewController::class, 'indexAdmin']);
$router->post('/admin/reviews/reply', [ReviewController::class, 'reply']);
$router->post('/admin/reviews/toggle', [ReviewController::class, 'toggleHidden']);
$router->post('/admin/reviews/delete', [ReviewController::class, 'delete']);

$router->post('/products', [ProductController::class, 'store']);
$router->put('/products/{id}', [ProductController::class, 'update']);
$router->delete('/products/{id}', [ProductController::class, 'destroy']);
$router->post('/products/{id}/upload', [ProductController::class, 'uploadImage']);
$router->post('/products/delete-image', [ProductController::class, 'deleteImage']);

$router->get('/products/{id}/variants', [ProductController::class, 'getVariants']);
$router->post('/products/{id}/variants/save', [ProductController::class, 'saveVariants']);
$router->post('/products/{id}/variants', [ProductController::class, 'createVariant']);

$router->post('/categories', [CategoryController::class, 'store']);
$router->put('/categories/{id}', [CategoryController::class, 'update']);
$router->delete('/categories/{id}', [CategoryController::class, 'destroy']);

$router->post('/brands', [BrandController::class, 'store']);
$router->put('/brands/{id}', [BrandController::class, 'update']);
$router->delete('/brands/{id}', [BrandController::class, 'destroy']);

$router->get('/admin/users', [UserController::class, 'index']);
$router->post('/admin/users/{id}/block', [UserController::class, 'toggleBlock']);
$router->post('/admin/users/{id}/delete', [UserController::class, 'destroy']);

$router->get('/admin/coupons', [CouponController::class, 'index']);
$router->post('/admin/coupons', [CouponController::class, 'store']);
$router->put('/admin/coupons/{id}', [CouponController::class, 'update']);
$router->delete('/admin/coupons/{id}', [CouponController::class, 'destroy']);

$router->get('/admin/notifications', [NotificationController::class, 'index']);
$router->post('/admin/notifications', [NotificationController::class, 'store']);
$router->put('/admin/notifications/{id}', [NotificationController::class, 'update']);
$router->delete('/admin/notifications/{id}', [NotificationController::class, 'destroy']);
$router->post('/admin/notifications/{id}/send', [NotificationController::class, 'sendToSubscribers']);
// 👇 THÊM DÒNG NÀY:
$router->get('/admin/stats/export', [DashboardController::class, 'exportRevenue']);
