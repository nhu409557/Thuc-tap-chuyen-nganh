<?php

// ============================================================================
// 1. CẤU HÌNH CORS (Cross-Origin Resource Sharing) - FIX TRIỆT ĐỂ
// ============================================================================

// Cho phép Frontend (localhost:3400) gọi API
// Nếu bạn muốn cho phép tất cả, hãy đổi thành "*"
header("Access-Control-Allow-Origin: http://localhost:3400");
// header("Access-Control-Allow-Origin: *"); // Dùng dòng này nếu muốn mở public hoàn toàn

// Cho phép các method HTTP
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Cho phép các Headers tùy chỉnh (đặc biệt là Authorization để gửi Token)
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Xử lý Preflight Request (Trình duyệt gửi OPTIONS trước khi gửi POST/PUT thật)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit; // Dừng ngay, không chạy tiếp vào Router
}

// ============================================================================
// 2. KHỞI ĐỘNG ỨNG DỤNG
// ============================================================================

// Autoload composer
require __DIR__ . '/../vendor/autoload.php';

// Bootstrap (Load .env, config...)
require __DIR__ . '/../bootstrap.php';

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

// Khởi tạo request/response
$req = new Request();
$res = new Response();

// Router
$router = new Router($req, $res);

// Load routes
require __DIR__ . '/../src/Routes/api.php';

// Chạy router
$router->dispatch();