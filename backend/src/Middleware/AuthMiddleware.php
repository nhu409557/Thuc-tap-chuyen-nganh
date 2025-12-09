<?php
namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\JwtHelper;

class AuthMiddleware
{
    public static function userIdOrFail(Request $req, Response $res): int
    {
        $token = null;

        // CÁCH 1: Lấy chuẩn từ thư viện Request (nếu server hỗ trợ)
        $token = $req->bearerToken();

        // CÁCH 2: [FIX CHO HOSTING FREE] Lấy từ biến môi trường do .htaccess tạo ra
        if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            if (preg_match('/Bearer\s(\S+)/', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
                $token = $matches[1];
            }
        }

        // CÁCH 3: Lấy từ $_SERVER thông thường
        if (!$token && isset($_SERVER['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $_SERVER['Authorization'], $matches)) {
                $token = $matches[1];
            }
        }

        // CÁCH 4: Dùng hàm apache_request_headers (dự phòng)
        if (!$token && function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
            if (isset($requestHeaders['Authorization'])) {
                if (preg_match('/Bearer\s(\S+)/', $requestHeaders['Authorization'], $matches)) {
                    $token = $matches[1];
                }
            }
        }

        // Nếu vẫn không tìm thấy token -> Báo lỗi
        if (!$token) {
            $res->json(['error' => 'Unauthorized - Token Missing'], 401);
            exit; 
        }

        // Giải mã Token
        $payload = JwtHelper::decode($token);
        if (!$payload || !isset($payload['user_id'])) {
            $res->json(['error' => 'Invalid or Expired Token'], 401);
            exit;
        }

        return (int)$payload['user_id'];
    }
}