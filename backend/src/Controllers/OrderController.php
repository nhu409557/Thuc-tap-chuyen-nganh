<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Order;
use App\Models\CartItem;
use App\Models\Coupon; // [QUAN TRỌNG] Phải có file Model này
use App\Middleware\AuthMiddleware;
use App\Helpers\MomoService;
use App\Middleware\AdminMiddleware;
use App\Config\Database; // [QUAN TRỌNG] Dùng đúng file Database bạn gửi

class OrderController extends Controller
{
    // ======================================================
    // ============ API USER (KHÁCH HÀNG) ===================
    // ======================================================

    public function index()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orders = Order::allByUser($userId);
        $this->json(['data' => $orders]);
    }

    public function show(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        $order = Order::findWithItems($id, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
        $this->json($order);
    }

    public function store()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        // 1. Validate thông tin
        foreach (['name', 'phone', 'address'] as $field) {
            if (empty($b[$field])) return $this->error("Thiếu thông tin: $field", 422);
        }

        $validMethods = ['cod', 'banking', 'momo'];
        $paymentMethod = $b['payment_method'] ?? 'cod';
        if (!in_array($paymentMethod, $validMethods)) return $this->error("Phương thức thanh toán không hợp lệ", 422);

        // 2. Lấy danh sách sản phẩm mua
        $checkoutItems = [];
        if (!empty($b['items']) && is_array($b['items'])) {
            $checkoutItems = $b['items'];
        } else if (!empty($b['selected_products']) && is_array($b['selected_products'])) {
            // Fallback cho code cũ
            $selectedProductIds = $b['selected_products'];
            $fullCart = CartItem::allByUser($userId);
            foreach ($fullCart as $item) {
                if (in_array($item['product_id'], $selectedProductIds)) {
                    $checkoutItems[] = $item;
                }
            }
        }

        if (empty($checkoutItems)) return $this->error('Không tìm thấy sản phẩm nào để đặt hàng', 422);

        // KẾT NỐI DB
        $db = Database::getConnection();
        
        try {
            $db->beginTransaction();

            // 3. Tính tổng tiền tạm tính (Chưa giảm)
            $tempTotal = 0;
            foreach ($checkoutItems as $item) {
                // Ưu tiên lấy giá variant, nếu không có thì lấy giá base
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                $qty = $item['quantity'] ?? 1;
                $tempTotal += $price * $qty;
            }

            // 4. Xử lý Mã giảm giá (Coupon)
            $discountAmount = 0;
            $couponCode = null;
            $couponId = null;

            // Chỉ chạy logic này nếu user có gửi mã lên và class Coupon tồn tại
            if (!empty($b['coupon_code'])) {
                if (!class_exists('App\Models\Coupon')) {
                     throw new \Exception("Chưa cấu hình hệ thống Coupon (Thiếu Model)");
                }

                // Kiểm tra mã
                $couponResult = Coupon::checkValid($b['coupon_code'], $userId, $tempTotal);
                
                if ($couponResult['valid']) {
                    $discountAmount = $couponResult['discount_amount'];
                    $couponCode = $b['coupon_code'];
                    $couponId = $couponResult['coupon']['id'];
                } else {
                    $db->rollBack();
                    return $this->error("Mã giảm giá lỗi: " . $couponResult['message'], 400);
                }
            }

            // 5. Tính tổng tiền cuối cùng
            $finalTotal = $tempTotal - $discountAmount;
            if ($finalTotal < 0) $finalTotal = 0;

            // 6. INSERT ORDERS (Viết SQL trực tiếp để đảm bảo cột coupon_code được lưu)
            // Lưu ý: Đảm bảo bảng orders đã có cột: discount_amount, coupon_code
            $stmt = $db->prepare(
                'INSERT INTO orders (user_id, name, phone, address, total_amount, discount_amount, coupon_code, payment_method, status, payment_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );

            $stmt->execute([
                $userId, 
                $b['name'], 
                $b['phone'], 
                $b['address'],
                $finalTotal,      // Tổng tiền sau khi trừ
                $discountAmount,  // Số tiền đã giảm
                $couponCode,      // Mã code
                $paymentMethod, 
                'Pending', 
                'Unpaid'
            ]);

            $orderId = (int)$db->lastInsertId();

            // 7. INSERT ORDER ITEMS
            $itemStmt = $db->prepare(
                'INSERT INTO order_items (order_id, product_id, product_variant_id, product_title, selected_color, price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );

            foreach ($checkoutItems as $item) {
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                
                // Lấy màu
                $color = $item['variant_color'] ?? $item['selected_color'] ?? null;
                if (!$color && !empty($item['variant_attributes'])) {
                    $attrs = json_decode($item['variant_attributes'], true);
                    $color = $attrs['color'] ?? null;
                }

                $itemStmt->execute([
                    $orderId,
                    $item['product_id'],
                    $item['product_variant_id'] ?? null,
                    $item['product_title'] ?? $item['title'],
                    $color,
                    $price,
                    $item['quantity'] ?? 1,
                ]);
            }

            // 8. Cập nhật lượt dùng Coupon (Nếu có dùng)
            if ($couponId) {
                Coupon::incrementUsage($couponId, $userId, $orderId);
            }

            // 9. Xóa giỏ hàng
            foreach ($checkoutItems as $item) {
                if (!empty($item['id'])) {
                    CartItem::remove((int)$item['id'], $userId);
                }
            }

            $db->commit();

            // 10. Xử lý thanh toán MoMo
            if ($paymentMethod === 'momo') {
                $momoRes = MomoService::createPayment($orderId, $finalTotal);
                if (isset($momoRes['payUrl'])) {
                    $this->json([
                        'success' => true,
                        'order_id' => $orderId,
                        'payment_url' => $momoRes['payUrl'],
                        'message' => 'Vui lòng thanh toán qua MoMo'
                    ], 201);
                    return;
                } else {
                    // Log lỗi nhưng không rollback vì đơn đã tạo thành công
                    // Có thể return lỗi để frontend biết
                    return $this->error('Tạo đơn thành công nhưng lỗi MoMo: ' . ($momoRes['message'] ?? 'Unknown'), 500);
                }
            }
            
            // Trả về thành công
            $this->json(['success' => true, 'order_id' => $orderId], 201);

        } catch (\PDOException $e) {
            if ($db->inTransaction()) $db->rollBack();
            // Lỗi này thường do chưa chạy SQL thêm cột
            if (strpos($e->getMessage(), 'Unknown column') !== false) {
                return $this->error('Lỗi Database: Chưa cập nhật bảng orders (thiếu cột coupon)', 500);
            }
            return $this->error('Lỗi CSDL: ' . $e->getMessage(), 500);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            return $this->error('Lỗi server: ' . $e->getMessage(), 500);
        }
    }

    public function cancel(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);

        $order = Order::findById($orderId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
        if ($order['user_id'] !== $userId) return $this->error('Không có quyền', 403);

        if (strtolower($order['status']) !== 'pending') {
            return $this->error('Đơn hàng đã xử lý, không thể hủy.', 400);
        }

        try {
            Order::updateStatus($orderId, 'Cancelled');
            $this->json(['success' => true, 'message' => 'Đã hủy đơn hàng']);
        } catch (\Throwable $e) {
            $this->error('Lỗi hệ thống: ' . $e->getMessage(), 500);
        }
    }

    public function restoreToCart(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);
        $order = Order::findWithItems($orderId, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
        
        // Logic phục hồi
        try {
            foreach ($order['items'] as $item) {
                CartItem::addOrUpdate($userId, (int)$item['product_id'], (int)$item['quantity'], !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null);
            }
            $this->json(['success' => true, 'message' => 'Đã khôi phục giỏ hàng']);
        } catch (\Throwable $e) { $this->error('Lỗi: ' . $e->getMessage(), 500); }
    }

    public function confirmPayment(array $params) {
        $orderId = (int)($params['id'] ?? 0);
        try {
            Order::updatePaymentStatus($orderId, 'Paid');
            $this->json(['success' => true, 'message' => 'Đã thanh toán']);
        } catch (\Throwable $e) { $this->error($e->getMessage(), 500); }
    }

    // ADMIN ROUTES
    public function indexAdmin() {
        AdminMiddleware::guard($this->request, $this->response);
        $result = Order::search($this->request->query['q']??null, $this->request->query['status']??null, (int)($this->request->query['page']??1), 20);
        $this->json($result);
    }
    public function showAdmin(array $params) {
        AdminMiddleware::guard($this->request, $this->response);
        $order = Order::findByIdWithItems((int)$params['id']);
        if (!$order) return $this->error('Không tìm thấy', 404);
        $this->json($order);
    }
    public function updateAdmin(array $params) {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;
        if (!empty($b['status'])) Order::updateStatus($id, $b['status']);
        if (!empty($b['payment_status'])) Order::updatePaymentStatus($id, $b['payment_status']);
        $this->json(['success' => true]);
    }
}