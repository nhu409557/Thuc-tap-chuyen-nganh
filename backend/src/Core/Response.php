<?php
namespace App\Core;

class Response
{
    public function json($data, int $status = 200): void
    {
        // 1. Set mã trạng thái HTTP (200, 400, 404, 500...)
        http_response_code($status);

        // 2. Chỉ set Content-Type là JSON
        header('Content-Type: application/json; charset=utf-8');

        // ❌ ĐÃ XÓA CÁC DÒNG CORS Ở ĐÂY ĐỂ TRÁNH XUNG ĐỘT VỚI INDEX.PHP ❌
        // header('Access-Control-Allow-Origin: *');
        // ...

        // 3. Trả về dữ liệu
        echo json_encode($data);
        exit;
    }
}