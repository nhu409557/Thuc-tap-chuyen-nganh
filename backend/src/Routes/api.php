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

// --- Test Route ---
$router->get('/', function($req, $res) {
    $res->json(['status' => 'OK', 'message' => 'TechHub API Ready']);
});

// --- AUTH ---
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/verify-register', [AuthController::class, 'verifyRegister']);
$router->post('/auth/login', [AuthController::class, 'login']);
$router->get('/auth/me', [AuthController::class, 'me']);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/auth/reset-password', [AuthController::class, 'resetPassword']);
$router->post('/auth/resend-code', [AuthController::class, 'resendCode']);
$router->post('/auth/change-password', [AuthController::class, 'changePassword']);

// --- PRODUCTS (Public) ---
$router->get('/products', [ProductController::class, 'index']);
$router->get('/products/brands', [ProductController::class, 'getBrands']); // API lấy brands theo category
$router->get('/products/{id}', [ProductController::class, 'show']);

// --- CATEGORIES (Public) ---
$router->get('/categories', [CategoryController::class, 'index']);
$router->get('/categories/{id}', [CategoryController::class, 'show']);

// --- BRANDS (Public) ---
$router->get('/brands', [BrandController::class, 'index']);


// --- CART (User) ---
$router->get('/cart', [CartController::class, 'index']);
$router->post('/cart', [CartController::class, 'store']);
$router->put('/cart/{id}', [CartController::class, 'update']);
$router->delete('/cart/{id}', [CartController::class, 'destroy']);

// --- WISHLIST (User) ---
$router->get('/wishlist', [WishlistController::class, 'index']);
$router->post('/wishlist', [WishlistController::class, 'store']);
$router->delete('/wishlist/{id}', [WishlistController::class, 'destroy']);

// --- ADDRESS (User) ---
$router->get('/account/addresses', [AddressController::class, 'index']);
$router->post('/account/addresses', [AddressController::class, 'store']);
$router->put('/account/addresses/{id}', [AddressController::class, 'update']);
$router->delete('/account/addresses/{id}', [AddressController::class, 'destroy']);
$router->put('/account/addresses/{id}/default', [AddressController::class, 'setDefault']);

// --- ORDERS (User) ---
$router->get('/orders', [OrderController::class, 'index']);
$router->post('/orders', [OrderController::class, 'store']);
$router->get('/orders/{id}', [OrderController::class, 'show']);
$router->post('/orders/{id}/cancel', [OrderController::class, 'cancel']);
$router->post('/orders/{id}/restore-cart', [OrderController::class, 'restoreToCart']);
$router->post('/orders/{id}/confirm-payment', [OrderController::class, 'confirmPayment']);

// --- REVIEWS ---
$router->post('/reviews', [ReviewController::class, 'store']);

// --- MOMO IPN ---
$router->post('/momo/ipn', [MomoController::class, 'ipn']);

// ==========================================================
// ==================== ADMIN ROUTES ========================
// ==========================================================

// Dashboard
$router->get('/admin/stats', [DashboardController::class, 'index']);

// Admin Orders
$router->get('/admin/orders', [OrderController::class, 'indexAdmin']);
$router->get('/admin/orders/{id}', [OrderController::class, 'showAdmin']);
$router->put('/admin/orders/{id}', [OrderController::class, 'updateAdmin']);

// Admin Products
$router->post('/products', [ProductController::class, 'store']);
$router->put('/products/{id}', [ProductController::class, 'update']);
$router->delete('/products/{id}', [ProductController::class, 'destroy']);
$router->post('/products/{id}/upload', [ProductController::class, 'uploadImage']);
$router->post('/products/delete-image', [ProductController::class, 'deleteImage']);

// 👇 [MỚI] QUẢN LÝ BIẾN THỂ (bảng product_variants)
$router->get('/products/{id}/variants', [ProductController::class, 'getVariants']);
$router->post('/products/{id}/variants/save', [ProductController::class, 'saveVariants']);

// 👇 API cũ: tạo biến thể màu (Clone product) – nếu không dùng nữa có thể xóa sau
$router->post('/products/{id}/variants', [ProductController::class, 'createVariant']);

// Admin Categories
$router->post('/categories', [CategoryController::class, 'store']);
$router->put('/categories/{id}', [CategoryController::class, 'update']);
$router->delete('/categories/{id}', [CategoryController::class, 'destroy']);

// Admin Brands
$router->post('/brands', [BrandController::class, 'store']);
$router->put('/brands/{id}', [BrandController::class, 'update']);
$router->delete('/brands/{id}', [BrandController::class, 'destroy']);
