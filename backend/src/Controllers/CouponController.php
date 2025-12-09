<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Coupon;
use App\Models\CartItem;
use App\Middleware\AuthMiddleware;
use App\Middleware\AdminMiddleware;

class CouponController extends Controller
{
    // === API ADMIN ===
    public function index() {
        AdminMiddleware::guard($this->request, $this->response);
        try {
            $coupons = Coupon::getAll();
            $this->json(['data' => $coupons]);
        } catch (\Throwable $e) {
            $this->error('Lỗi tải danh sách: ' . $e->getMessage(), 500);
        }
    }

    public function store() {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        
        if (empty($b['code']) || empty($b['percent'])) {
            return $this->error('Vui lòng nhập Mã code và % Giảm giá', 422);
        }
        
        // Kiểm tra xem bảng coupons đã tồn tại chưa bằng cách try catch DB
        try {
            if (Coupon::findByCode($b['code'])) {
                return $this->error('Mã giảm giá này (' . $b['code'] . ') đã tồn tại', 400);
            }
            
            Coupon::create($b);
            $this->json(['success' => true, 'message' => 'Tạo mã thành công']);
        } catch (\PDOException $e) {
            // Lỗi database chi tiết
            return $this->error('Lỗi Database: ' . $e->getMessage(), 500);
        } catch (\Throwable $e) {
            return $this->error('Lỗi Server: ' . $e->getMessage(), 500);
        }
    }

    public function update(array $params) {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        try {
            Coupon::update($id, $this->request->body);
            $this->json(['success' => true]);
        } catch (\Throwable $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    public function destroy(array $params) {
        AdminMiddleware::guard($this->request, $this->response);
        try {
            Coupon::delete((int)$params['id']);
            $this->json(['success' => true]);
        } catch (\Throwable $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    // === API USER CHECK MÃ ===
    public function check() {
        // ... (Giữ nguyên logic check cũ của bạn ở đây)
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $code = $this->request->body['code'] ?? '';
        
        $cart = CartItem::allByUser($userId);
        $total = 0;
        foreach ($cart as $item) {
            $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
            $total += $price * $item['quantity'];
        }

        $result = Coupon::checkValid($code, $userId, $total);

        if (!$result['valid']) {
            return $this->error($result['message'], 400);
        }

        $this->json([
            'success' => true,
            'discount_amount' => $result['discount_amount'],
            'final_total' => $total - $result['discount_amount'],
            'message' => 'Áp dụng mã thành công'
        ]);
    }
}