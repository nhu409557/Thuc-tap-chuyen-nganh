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

        // Validate thông tin cơ bản
        foreach (['name', 'phone', 'address'] as $field) {
            if (empty($b[$field])) return $this->error("Thiếu thông tin: $field", 422);
        }

        $validMethods = ['cod', 'banking', 'momo'];
        $paymentMethod = $b['payment_method'] ?? 'cod';
        if (!in_array($paymentMethod, $validMethods)) return $this->error("Phương thức thanh toán không hợp lệ", 422);

        $checkoutItems = [];

        // TRƯỜNG HỢP 1: ADMIN TẠO ĐƠN (Gửi trực tiếp danh sách items)
        if (!empty($b['items']) && is_array($b['items'])) {
            $checkoutItems = $b['items'];
        } 
        // TRƯỜNG HỢP 2: KHÁCH MUA TỪ GIỎ HÀNG (Gửi selected_products)
        else {
            if (empty($b['selected_products']) || !is_array($b['selected_products'])) {
                return $this->error('Vui lòng chọn sản phẩm', 422);
            }
            
            $selectedProductIds = $b['selected_products'];
            $fullCart = CartItem::allByUser($userId);
            
            foreach ($fullCart as $item) {
                if (in_array($item['product_id'], $selectedProductIds)) {
                    $checkoutItems[] = $item;
                }
            }
        }

        if (empty($checkoutItems)) return $this->error('Không tìm thấy sản phẩm hợp lệ', 422);

        try {
            // 1. Tạo đơn hàng
            $orderId = Order::create($userId, $b, $checkoutItems, $paymentMethod);

            // 2. Xóa giỏ hàng (CHỈ KHI KHÁCH TỰ MUA TỪ GIỎ)
            if (empty($b['items'])) {
                foreach ($checkoutItems as $item) {
                    if (isset($item['id'])) {
                        CartItem::remove($item['id'], $userId);
                    }
                }
            }

            // 3. Xử lý MoMo
            if ($paymentMethod === 'momo') {
                $totalAmount = 0;
                foreach ($checkoutItems as $item) {
                    $totalAmount += $item['price'] * $item['quantity'];
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
                    $msg = $momoRes['message'] ?? 'Lỗi không xác định từ MoMo';
                    return $this->error('Lỗi tạo giao dịch MoMo: ' . $msg, 500);
                }
            }
            
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

        $currentStatus = strtolower($order['status']);
        if ($currentStatus !== 'pending') {
            return $this->error('Đơn hàng đã xử lý, không thể hủy.', 400);
        }

        try {
            Order::updateStatus($orderId, 'Cancelled');
            $this->json(['success' => true, 'message' => 'Đã hủy đơn hàng']);
        } catch (\Throwable $e) {
            $this->error('Lỗi hệ thống: ' . $e->getMessage(), 500);
        }
    }

    public function restoreToCart(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);

        $order = Order::findWithItems($orderId, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);

        if ($order['status'] !== 'Pending') return $this->error('Không thể khôi phục', 400);

        try {
            foreach ($order['items'] as $item) {
                CartItem::addOrUpdate($userId, $item['product_id'], $item['quantity']);
            }
            Order::updateStatus($orderId, 'Cancelled');
            $this->json(['success' => true, 'message' => 'Đã khôi phục giỏ hàng']);
        } catch (\Throwable $e) {
            $this->error('Lỗi khôi phục: ' . $e->getMessage(), 500);
        }
    }

    public function confirmPayment(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);

        $order = Order::findById($orderId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);

        try {
            Order::updatePaymentStatus($orderId, 'Paid');
            $this->json(['success' => true, 'message' => 'Xác nhận thanh toán thành công']);
        } catch (\Throwable $e) {
            $this->error('Lỗi cập nhật: ' . $e->getMessage(), 500);
        }
    }

    // ======================================================
    // ============ API ADMIN (QUẢN LÝ ĐƠN HÀNG) ============
    // ======================================================

    public function indexAdmin()
    {
        AdminMiddleware::guard($this->request, $this->response);

        $q = $this->request->query['q'] ?? null;
        $status = $this->request->query['status'] ?? null;
        $page = (int)($this->request->query['page'] ?? 1);

        // Sử dụng hàm search trong Model Order
        $result = Order::search($q, $status, $page, 20); 
        $this->json($result);
    }

    public function showAdmin(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        
        $order = Order::findByIdWithItems($id);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
        
        $this->json($order);
    }

    public function updateAdmin(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;

        $order = Order::findById($id);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);

        // Cập nhật trạng thái đơn (Quy trình)
        if (!empty($b['status'])) {
            Order::updateStatus($id, $b['status']);
        }

        // Cập nhật trạng thái thanh toán (Tiền nong)
        if (!empty($b['payment_status'])) {
            Order::updatePaymentStatus($id, $b['payment_status']);
        }

        $this->json(['success' => true, 'message' => 'Cập nhật đơn hàng thành công']);
    }
}