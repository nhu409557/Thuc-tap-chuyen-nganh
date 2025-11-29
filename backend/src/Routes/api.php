<?php
// Tệp này được 'require' từ index.php

use App\Core\Router;
use App\Controllers\AuthController;
use App\Controllers\ProductController;
use App\Controllers\CartController;
use App\Controllers\OrderController;
use App\Controllers\WishlistController;
use App\Controllers\AddressController;
use App\Controllers\MomoController;
use App\Controllers\ReviewController;
use App\Controllers\DashboardController;
use App\Controllers\BrandController;
use App\Controllers\CategoryController;
/** @var Router $router */

// Auth
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/verify-register', [AuthController::class, 'verifyRegister']);
$router->post('/auth/resend-code', [AuthController::class, 'resendCode']);
$router->post('/auth/login', [AuthController::class, 'login']);
$router->get('/auth/me', [AuthController::class, 'me']);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/auth/reset-password', [AuthController::class, 'resetPassword']);
// 👇 THÊM DÒNG NÀY
$router->post('/auth/change-password', [AuthController::class, 'changePassword']);

// Products
$router->get('/products', [ProductController::class, 'index']);
$router->get('/products/brands', [ProductController::class, 'getBrands']); // <-- THÊM DÒNG NÀY
$router->get('/products/{id}', [ProductController::class, 'show']);

// Cart
$router->get('/cart', [CartController::class, 'index']);
$router->post('/cart', [CartController::class, 'store']);
$router->put('/cart/{id}', [CartController::class, 'update']);
$router->delete('/cart/{id}', [CartController::class, 'destroy']);

// Orders
$router->get('/orders', [OrderController::class, 'index']);
$router->get('/orders/{id}', [OrderController::class, 'show']);
$router->post('/orders', [OrderController::class, 'store']);

// Wishlist
$router->get('/wishlist', [WishlistController::class, 'index']);
$router->post('/wishlist', [WishlistController::class, 'store']);
$router->delete('/wishlist/{id}', [WishlistController::class, 'destroy']);
// ===== THÊM CÁC ROUTE MỚI CHO ĐỊA CHỈ =====
$router->get('/account/addresses',    [AddressController::class, 'index']);
$router->post('/account/addresses',   [AddressController::class, 'store']);
$router->put('/account/addresses/{id}', [AddressController::class, 'update']);
$router->delete('/account/addresses/{id}', [AddressController::class, 'destroy']);
$router->put('/account/addresses/{id}/default', [AddressController::class, 'setDefault']);
$router->post('/payment/momo-ipn', [MomoController::class, 'ipn']);
$router->post('/reviews', [ReviewController::class, 'store']);
$router->post('/orders/{id}/cancel', [OrderController::class, 'cancel']);
$router->post('/orders/{id}/restore-cart', [OrderController::class, 'restoreToCart']);
// 👇 THÊM DÒNG NÀY
$router->post('/orders/{id}/confirm-payment', [OrderController::class, 'confirmPayment']);
$router->get('/admin/stats', [DashboardController::class, 'index']);
// PRODUCT ROUTES (ADMIN)
$router->post('/products', [\App\Controllers\ProductController::class, 'store']);
$router->put('/products/{id}', [\App\Controllers\ProductController::class, 'update']);
$router->delete('/products/{id}', [\App\Controllers\ProductController::class, 'destroy']);
// Upload ảnh cho sản phẩm ID cụ thể
$router->post('/products/{id}/upload', [\App\Controllers\ProductController::class, 'uploadImage']);
// 👇 THÊM ROUTE NÀY
$router->post('/products/delete-image', [\App\Controllers\ProductController::class, 'deleteImage']);
// ===== BRANDS (MỚI) =====
$router->get('/brands', [BrandController::class, 'index']);
$router->post('/brands', [BrandController::class, 'store']);
$router->put('/brands/{id}', [BrandController::class, 'update']);
$router->delete('/brands/{id}', [BrandController::class, 'destroy']);
// ===== ORDERS (ADMIN) =====
$router->get('/admin/orders', [OrderController::class, 'indexAdmin']);
$router->get('/admin/orders/{id}', [OrderController::class, 'showAdmin']);
$router->put('/admin/orders/{id}', [OrderController::class, 'updateAdmin']);
// ===== CATEGORIES (QUẢN LÝ DANH MỤC) =====
$router->get('/categories', [\App\Controllers\CategoryController::class, 'index']);

// 👇 THÊM DÒNG NÀY ĐỂ LẤY CHI TIẾT DANH MỤC (API Show)
$router->get('/categories/{id}', [\App\Controllers\CategoryController::class, 'show']); 

$router->post('/categories', [\App\Controllers\CategoryController::class, 'store']);
// 👇 Đảm bảo route update cũng đúng method PUT
$router->put('/categories/{id}', [\App\Controllers\CategoryController::class, 'update']); 
$router->delete('/categories/{id}', [\App\Controllers\CategoryController::class, 'destroy']);