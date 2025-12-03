<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Order;
use App\Models\CartItem;
use App\Middleware\AuthMiddleware;
use App\Helpers\MomoService;
use App\Middleware\AdminMiddleware;

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

        // 1. Validate thông tin người nhận
        foreach (['name', 'phone', 'address'] as $field) {
            if (empty($b[$field])) return $this->error("Thiếu thông tin: $field", 422);
        }

        $validMethods = ['cod', 'banking', 'momo'];
        $paymentMethod = $b['payment_method'] ?? 'cod';
        if (!in_array($paymentMethod, $validMethods)) return $this->error("Phương thức thanh toán không hợp lệ", 422);

        $checkoutItems = [];

        // 2. Xử lý danh sách sản phẩm (QUAN TRỌNG)
        // Ưu tiên lấy từ 'items' do frontend gửi lên (chứa đầy đủ thông tin variant)
        if (!empty($b['items']) && is_array($b['items'])) {
            $checkoutItems = $b['items'];
        } 
        // Fallback: Nếu frontend cũ gửi selected_products (Product ID) - Dễ bị lỗi gộp, nhưng giữ để tương thích
        else if (!empty($b['selected_products']) && is_array($b['selected_products'])) {
            $selectedProductIds = $b['selected_products'];
            $fullCart = CartItem::allByUser($userId);
            foreach ($fullCart as $item) {
                if (in_array($item['product_id'], $selectedProductIds)) {
                    $checkoutItems[] = $item;
                }
            }
        }

        if (empty($checkoutItems)) return $this->error('Không tìm thấy sản phẩm nào để đặt hàng', 422);

        try {
            // 3. Tạo đơn hàng (Transaction DB)
            $orderId = Order::create($userId, $b, $checkoutItems, $paymentMethod);

            // 4. Xóa sản phẩm đã mua khỏi giỏ hàng
            foreach ($checkoutItems as $item) {
                // 'id' ở đây là ID của dòng trong bảng cart_items (frontend phải gửi lên)
                if (!empty($item['id'])) {
                    CartItem::remove((int)$item['id'], $userId);
                }
            }

            // 5. Xử lý thanh toán MoMo (nếu chọn)
            if ($paymentMethod === 'momo') {
                $totalAmount = 0;
                foreach ($checkoutItems as $item) {
                    $price = $item['price'] ?? 0;
                    $qty = $item['quantity'] ?? 1;
                    $totalAmount += $price * $qty;
                }

                $momoRes = MomoService::createPayment($orderId, $totalAmount);

                if (isset($momoRes['payUrl'])) {
                    $this->json([
                        'success' => true,
                        'order_id' => $orderId,
                        'payment_url' => $momoRes['payUrl'],
                        'message' => 'Vui lòng thanh toán qua MoMo'
                    ], 201);
                    return;
                } else {
                    $msg = $momoRes['message'] ?? 'Lỗi kết nối MoMo';
                    return $this->error('Lỗi tạo giao dịch MoMo: ' . $msg, 500);
                }
            }
            
            // Trả về thành công
            $this->json(['success' => true, 'order_id' => $orderId], 201);

        } catch (\Throwable $e) {
            $this->error('Lỗi server: ' . $e->getMessage(), 500);
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

    // Các method khác giữ nguyên (restoreToCart, confirmPayment, admin routes...)
    public function restoreToCart(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);
        $order = Order::findWithItems($orderId, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
        if ($order['status'] !== 'Pending') return $this->error('Không thể khôi phục', 400);
        try {
            foreach ($order['items'] as $item) {
                CartItem::addOrUpdate($userId, (int)$item['product_id'], (int)$item['quantity'], !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null);
            }
            Order::updateStatus($orderId, 'Cancelled');
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