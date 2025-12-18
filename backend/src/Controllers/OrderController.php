<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Order;
use App\Models\CartItem;
use App\Models\Coupon; 
use App\Middleware\AuthMiddleware;
use App\Helpers\MomoService;
use App\Middleware\AdminMiddleware;
use App\Config\Database;

class OrderController extends Controller
{
    // ======================================================
    // 1. API KHÁCH HÀNG (PUBLIC/USER)
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

        // 1. Validate
        foreach (['name', 'phone', 'address'] as $field) {
            if (empty($b[$field])) return $this->error("Thiếu thông tin: $field", 422);
        }

        $validMethods = ['cod', 'banking', 'momo'];
        $paymentMethod = $b['payment_method'] ?? 'cod';
        if (!in_array($paymentMethod, $validMethods)) return $this->error("Phương thức thanh toán không hợp lệ", 422);

        // 2. Lấy sản phẩm
        $checkoutItems = [];
        if (!empty($b['items']) && is_array($b['items'])) {
            $checkoutItems = $b['items'];
        } else if (!empty($b['selected_products']) && is_array($b['selected_products'])) {
            $selectedProductIds = $b['selected_products'];
            $fullCart = CartItem::allByUser($userId);
            foreach ($fullCart as $item) {
                if (in_array($item['product_id'], $selectedProductIds)) {
                    $checkoutItems[] = $item;
                }
            }
        }

        if (empty($checkoutItems)) return $this->error('Không tìm thấy sản phẩm nào để đặt hàng', 422);

        $db = Database::getConnection();
        
        try {
            $db->beginTransaction();

            // 3. KIỂM TRA TỒN KHO (NHƯNG CHƯA TRỪ)
            foreach ($checkoutItems as $item) {
                $qtyNeeded = (int)($item['quantity'] ?? 1);
                $pId = (int)$item['product_id'];
                $vId = !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null;
                $pName = $item['product_title'] ?? $item['title'] ?? "Sản phẩm #$pId";

                if ($vId) {
                    $stmtCheck = $db->prepare("SELECT stock_quantity FROM product_variants WHERE id = ?");
                    $stmtCheck->execute([$vId]);
                    $currentStock = $stmtCheck->fetchColumn();
                } else {
                    $stmtCheck = $db->prepare("SELECT stock_quantity FROM products WHERE id = ?");
                    $stmtCheck->execute([$pId]);
                    $currentStock = $stmtCheck->fetchColumn();
                }

                if ($currentStock === false) throw new \Exception("Sản phẩm '$pName' không tồn tại.");
                if ($currentStock < $qtyNeeded) throw new \Exception("Sản phẩm '$pName' chỉ còn $currentStock cái. Vui lòng cập nhật giỏ hàng.");
            }

            // 4. Tính tiền
            $tempTotal = 0;
            foreach ($checkoutItems as $item) {
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                $qty = $item['quantity'] ?? 1;
                $tempTotal += $price * $qty;
            }

            // 5. Coupon
            $discountAmount = 0;
            $couponCode = null;
            $couponId = null;

            if (!empty($b['coupon_code'])) {
                if (!class_exists('App\Models\Coupon')) throw new \Exception("Chưa cấu hình Coupon");
                $couponResult = Coupon::checkValid($b['coupon_code'], $userId, $tempTotal);
                if ($couponResult['valid']) {
                    $discountAmount = $couponResult['discount_amount'];
                    $couponCode = $b['coupon_code'];
                    $couponId = $couponResult['coupon']['id'];
                } else {
                    throw new \Exception("Mã giảm giá lỗi: " . $couponResult['message']);
                }
            }

            $finalTotal = $tempTotal - $discountAmount;
            if ($finalTotal < 0) $finalTotal = 0;

            // 6. Insert Order
            $stmt = $db->prepare(
                'INSERT INTO orders (user_id, name, phone, address, total_amount, discount_amount, coupon_code, payment_method, status, payment_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );

            $stmt->execute([
                $userId, $b['name'], $b['phone'], $b['address'],
                $finalTotal, $discountAmount, $couponCode,
                $paymentMethod, 'Pending', 'Unpaid'
            ]);

            $orderId = (int)$db->lastInsertId();

            // 7. Insert Order Items
            $itemStmt = $db->prepare(
                'INSERT INTO order_items (order_id, product_id, product_variant_id, product_title, selected_color, price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );

            foreach ($checkoutItems as $item) {
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                $qty = (int)($item['quantity'] ?? 1);
                $color = $item['variant_color'] ?? $item['selected_color'] ?? null;
                if (!$color && !empty($item['variant_attributes'])) {
                    $attrs = json_decode($item['variant_attributes'], true);
                    $color = $attrs['color'] ?? null;
                }
                $vId = !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null;

                $itemStmt->execute([
                    $orderId, $item['product_id'], $vId,
                    $item['product_title'] ?? $item['title'],
                    $color, $price, $qty,
                ]);
            }

            if ($couponId) Coupon::incrementUsage($couponId, $userId, $orderId);

            foreach ($checkoutItems as $item) {
                if (!empty($item['id'])) CartItem::remove((int)$item['id'], $userId);
            }

            $db->commit();

            // 8. Payment Gateway
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
                }
            }
            
            $this->json(['success' => true, 'order_id' => $orderId], 201);

        } catch (\Exception $e) {
            if ($db->inTransaction()) $db->rollBack();
            return $this->error($e->getMessage(), 400);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            return $this->error('Lỗi server: ' . $e->getMessage(), 500);
        }
    }

    public function cancel(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);

        $order = Order::findWithItems($orderId, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
        
        $currentStatus = strtolower($order['status']);

        // Cho phép hủy nếu chưa hoàn thành/đã hủy
        if (in_array($currentStatus, ['completed', 'cancelled', 'delivered', 'returned'])) {
            return $this->error('Không thể hủy đơn hàng ở trạng thái này.', 400);
        }

        $db = Database::getConnection();
        try {
            $db->beginTransaction();

            // Cập nhật trạng thái
            Order::updateStatus($orderId, 'Cancelled');

            // --- LOGIC HOÀN KHO ---
            // Chỉ hoàn kho nếu đơn hàng đã từng được Xác nhận (Confirmed) hoặc Đang giao (Shipping)
            // Vì lúc đó kho mới bị trừ. Nếu đơn vẫn Pending thì kho chưa bị trừ nên không cần hoàn.
            $stockWasDeducted = in_array($currentStatus, ['confirmed', 'shipping']);

            if ($stockWasDeducted) {
                $items = $order['items'] ?? [];
                $restoreVariantSql = $db->prepare("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?");
                $restoreProductSql = $db->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");

                foreach ($items as $item) {
                    $qty = (int)$item['quantity'];
                    $vId = !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null;
                    $pId = (int)$item['product_id'];

                    if ($vId) {
                        $restoreVariantSql->execute([$qty, $vId]);
                        // Đồng bộ lại số lượng cha
                        $db->prepare("UPDATE products SET stock_quantity = (SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = ?) WHERE id = ?")->execute([$pId, $pId]);
                    } else {
                        $restoreProductSql->execute([$qty, $pId]);
                    }
                }
            }

            $db->commit();
            $msg = $stockWasDeducted ? 'Đã hủy và hoàn lại tồn kho' : 'Đã hủy đơn hàng (Chưa trừ kho)';
            $this->json(['success' => true, 'message' => $msg]);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            $this->error('Lỗi hệ thống khi hủy đơn: ' . $e->getMessage(), 500);
        }
    }

    public function restoreToCart(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $orderId = (int)($params['id'] ?? 0);
        $order = Order::findWithItems($orderId, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);
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
            // Nếu đã Delivered và giờ mới Paid -> Update Time
            $order = Order::findById($orderId);
            if ($order && $order['status'] === 'Delivered') {
                Order::markDeliveredTimestamp($orderId);
            }
            $this->json(['success' => true, 'message' => 'Đã thanh toán']);
        } catch (\Throwable $e) { $this->error($e->getMessage(), 500); }
    }

    // ======================================================
    // 2. API ADMIN
    // ======================================================

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

    public function updateAdmin(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;
        
        $db = Database::getConnection();
        
        try {
            $db->beginTransaction();

            // 1. Lấy trạng thái hiện tại
            $currentOrder = Order::findByIdWithItems($id);
            if (!$currentOrder) throw new \Exception("Đơn hàng không tồn tại");

            $oldStatus = $currentOrder['status'];
            $newStatus = $b['status'] ?? $oldStatus;
            
            $oldPayment = $currentOrder['payment_status'];
            $newPayment = $b['payment_status'] ?? $oldPayment;

            // 2. Xử lý Logic Trừ Kho
            // Chỉ trừ kho khi chuyển từ (Pending/Unpaid) -> (Confirmed/Shipping)
            // Và đảm bảo chưa trừ kho trước đó (tránh trừ 2 lần)
            $isDeducting = ($newStatus === 'Confirmed' || $newStatus === 'Shipping') 
                           && ($oldStatus === 'Pending' || $oldStatus === 'Unpaid');

            if ($isDeducting) {
                $deductVariantSql = $db->prepare("UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?");
                $deductProductSql = $db->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");

                $items = $currentOrder['items'] ?? [];
                foreach ($items as $item) {
                    $qty = (int)$item['quantity'];
                    $vId = !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null;
                    $pId = (int)$item['product_id'];

                    // Kiểm tra tồn kho
                    if ($vId) {
                        $check = $db->query("SELECT stock_quantity FROM product_variants WHERE id = $vId")->fetchColumn();
                    } else {
                        $check = $db->query("SELECT stock_quantity FROM products WHERE id = $pId")->fetchColumn();
                    }

                    if ($check < $qty) {
                        throw new \Exception("Không thể xác nhận: Sản phẩm '{$item['product_title']}' không đủ tồn kho (Còn $check, cần $qty).");
                    }

                    // Trừ kho
                    if ($vId) {
                        $deductVariantSql->execute([$qty, $vId]);
                        $db->prepare("UPDATE products SET stock_quantity = (SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = ?) WHERE id = ?")->execute([$pId, $pId]);
                    } else {
                        $deductProductSql->execute([$qty, $pId]);
                    }
                }
            }

            // 3. Cập nhật Status
            if ($newStatus !== $oldStatus) {
                Order::updateStatus($id, $newStatus);
            }

            // 4. Cập nhật Payment Status
            if ($newPayment !== $oldPayment) {
                Order::updatePaymentStatus($id, $newPayment);
            }

            // 5. Cập nhật Thời gian Giao hàng (Nếu thỏa mãn điều kiện)
            // Điều kiện: Status là 'Delivered' VÀ Payment là 'Paid'
            if ($newStatus === 'Delivered' && $newPayment === 'Paid') {
                Order::markDeliveredTimestamp($id);
            }

            $db->commit();
            $this->json(['success' => true, 'message' => 'Cập nhật thành công']);

        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            $this->error($e->getMessage(), 500);
        }
    }
}