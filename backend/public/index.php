<?php

// ============================================================================
// 1. CẤU HÌNH CORS & FIX METHOD (QUAN TRỌNG: PHẢI ĐỂ ĐẦU TIÊN)
// ============================================================================

// Cho phép Frontend gọi API
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-HTTP-Method-Override");
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');

// Xử lý Preflight Request (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- FIX HOSTING FREE: METHOD SPOOFING (Giả lập PUT/DELETE) ---
// Logic này phải chạy trước khi khởi tạo Router

// Cách 1: Kiểm tra Header (Ưu tiên)
if (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
    $_SERVER['REQUEST_METHOD'] = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
}
// Cách 2: Kiểm tra tham số trên URL (?_method=DELETE)
elseif (isset($_GET['_method'])) {
    $_SERVER['REQUEST_METHOD'] = strtoupper($_GET['_method']);
}

// --- FIX URL (Tránh lỗi 404 do query string hoặc thư mục con) ---
// Lấy URI gốc
$requestUri = $_SERVER['REQUEST_URI'];

// 1. Cắt bỏ Query String (?_method=DELETE...)
if (strpos($requestUri, '?') !== false) {
    $requestUri = substr($requestUri, 0, strpos($requestUri, '?'));
}

// 2. Cắt bỏ đường dẫn thư mục con (Nếu web nằm trong /backend/public)
// Dòng này giúp Router luôn nhận được đường dẫn sạch (ví dụ: /cart/90)
$scriptName = dirname($_SERVER['SCRIPT_NAME']); // Trả về /backend/public
if (strpos($requestUri, $scriptName) === 0) {
    $requestUri = substr($requestUri, strlen($scriptName));
}

// Gán lại URI đã làm sạch để Router xử lý
$_SERVER['REQUEST_URI'] = $requestUri;


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