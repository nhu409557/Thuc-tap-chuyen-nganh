<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Order;
use App\Middleware\AuthMiddleware;
use App\Middleware\AdminMiddleware;
use App\Config\Database;

class OrderReturnController extends Controller
{
    // ==========================================================
    // USER: GỬI YÊU CẦU TRẢ HÀNG
    // ==========================================================
    public function requestReturn()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        $orderId = (int)($b['order_id'] ?? 0);
        $returnItems = $b['items'] ?? []; // Mảng: [{product_id, variant_id, quantity, reason}, ...]

        // 1. Validate Đơn hàng
        $order = Order::findWithItems($orderId, $userId); 
        if (!$order) return $this->error('Đơn hàng không tồn tại', 404);

        if (strtolower($order['status']) !== 'delivered' || strtolower($order['payment_status']) !== 'paid') {
            return $this->error('Đơn hàng chưa đủ điều kiện trả hàng (Phải Giao thành công & Đã thanh toán).', 400);
        }
        
        // Check 7 ngày
        if (empty($order['delivered_at'])) return $this->error('Chưa có ngày giao hàng', 400);
        $diff = (new \DateTime())->diff(new \DateTime($order['delivered_at']))->days;
        if ($diff > 7) return $this->error('Đã quá hạn trả hàng 7 ngày.', 400);

        // Check duplicate request
        $db = Database::getConnection();
        $stmtCheck = $db->prepare("SELECT id FROM order_returns WHERE order_id = ? AND status = 'pending'");
        $stmtCheck->execute([$orderId]);
        if ($stmtCheck->fetch()) return $this->error('Đơn này đang có yêu cầu trả hàng chưa xử lý.', 400);

        if (empty($returnItems)) return $this->error('Vui lòng chọn ít nhất 1 sản phẩm để trả.', 400);

        // 2. Tính toán & Validate chi tiết
        $totalRefund = 0;
        $insertData = [];

        // Map order items gốc để lấy giá tiền chính xác
        $originalItemsMap = [];
        foreach ($order['items'] as $oi) {
            $key = $oi['product_id'] . '_' . ($oi['product_variant_id'] ?? 'null');
            $originalItemsMap[$key] = $oi;
        }

        foreach ($returnItems as $item) {
            $pId = $item['product_id'];
            $vId = $item['variant_id'] ?? null;
            $qty = (int)$item['quantity'];
            $reason = $item['reason']; // 'defective' hoặc 'other'

            if ($qty <= 0) continue; 

            $key = $pId . '_' . ($vId ?? 'null');
            
            if (!isset($originalItemsMap[$key])) {
                return $this->error("Sản phẩm ID $pId không có trong đơn hàng này.", 400);
            }

            $originalItem = $originalItemsMap[$key];
            
            if ($qty > $originalItem['quantity']) {
                return $this->error("Số lượng trả vượt quá số lượng mua của sản phẩm {$originalItem['product_title']}", 400);
            }

            // Tính tiền hoàn cho món này
            $unitPrice = (int)$originalItem['price'];
            $itemTotal = $unitPrice * $qty;
            
            if ($reason === 'other') {
                $itemRefund = $itemTotal * 0.8; // Trừ 20% nếu đổi ý
            } else {
                $itemRefund = $itemTotal; // 100% nếu lỗi
            }

            $totalRefund += $itemRefund;
            
            $insertData[] = [
                'product_id' => $pId,
                'product_variant_id' => $vId,
                'quantity' => $qty,
                'reason' => $reason,
                'refund_amount' => $itemRefund
            ];
        }

        if (empty($insertData)) return $this->error('Vui lòng nhập số lượng trả hợp lệ.', 400);

        // 3. Lưu vào DB (Transaction)
        try {
            $db->beginTransaction();

            // Insert Header
            $stmtHeader = $db->prepare("INSERT INTO order_returns (order_id, user_id, total_refund_amount, status) VALUES (?, ?, ?, 'pending')");
            $stmtHeader->execute([$orderId, $userId, $totalRefund]);
            $returnId = $db->lastInsertId();

            // Insert Items
            $stmtItem = $db->prepare("INSERT INTO order_return_items (return_id, product_id, product_variant_id, quantity, reason, refund_amount) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($insertData as $d) {
                $stmtItem->execute([
                    $returnId, $d['product_id'], $d['product_variant_id'], 
                    $d['quantity'], $d['reason'], $d['refund_amount']
                ]);
            }

            // Update Order Status
            $db->prepare("UPDATE orders SET status = 'Return Requested' WHERE id = ?")->execute([$orderId]);

            $db->commit();
            $this->json(['success' => true, 'message' => 'Gửi yêu cầu thành công. Tổng hoàn dự kiến: ' . number_format($totalRefund) . 'đ']);

        } catch (\Exception $e) {
            if ($db->inTransaction()) $db->rollBack();
            $this->error('Lỗi hệ thống: ' . $e->getMessage(), 500);
        }
    }

    // ==========================================================
    // ADMIN: XỬ LÝ DUYỆT/TỪ CHỐI TRẢ HÀNG
    // ==========================================================
    public function processReturn(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response); // Chỉ admin được gọi
        
        $returnId = (int)($params['id'] ?? 0);
        $body = $this->request->body;
        $action = $body['action'] ?? ''; // 'approve' hoặc 'reject'
        $adminNote = $body['admin_note'] ?? '';

        if (!in_array($action, ['approve', 'reject'])) {
            return $this->error('Hành động không hợp lệ (chỉ approve hoặc reject)', 400);
        }

        $db = Database::getConnection();

        try {
            $db->beginTransaction();

            // 1. Lấy thông tin phiếu trả
            $stmt = $db->prepare("SELECT * FROM order_returns WHERE id = ?");
            $stmt->execute([$returnId]);
            $returnRequest = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$returnRequest) throw new \Exception("Không tìm thấy phiếu trả hàng");
            if ($returnRequest['status'] !== 'pending') throw new \Exception("Phiếu này đã được xử lý rồi");

            $orderId = $returnRequest['order_id'];

            if ($action === 'reject') {
                // TỪ CHỐI -> Đổi trạng thái phiếu thành rejected, đơn hàng quay lại Delivered
                $db->prepare("UPDATE order_returns SET status = 'rejected', admin_note = ? WHERE id = ?")->execute([$adminNote, $returnId]);
                $db->prepare("UPDATE orders SET status = 'Delivered' WHERE id = ?")->execute([$orderId]);
                
                $message = "Đã từ chối yêu cầu trả hàng.";
            } 
            else {
                // DUYỆT (APPROVE) -> Đổi trạng thái, hoàn kho (trừ hàng lỗi)
                $db->prepare("UPDATE order_returns SET status = 'approved', admin_note = ? WHERE id = ?")->execute([$adminNote, $returnId]);
                
                // Cập nhật đơn hàng: Returned + Refunded
                $db->prepare("UPDATE orders SET status = 'Returned', payment_status = 'Refunded' WHERE id = ?")->execute([$orderId]);

                // --- LOGIC HOÀN KHO (RESTOCK) ---
                $itemsStmt = $db->prepare("SELECT * FROM order_return_items WHERE return_id = ?");
                $itemsStmt->execute([$returnId]);
                $items = $itemsStmt->fetchAll(\PDO::FETCH_ASSOC);

                $restoreVariantSql = $db->prepare("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?");
                $restoreProductSql = $db->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
                
                // Query để cập nhật lại tổng stock của cha nếu dùng biến thể
                $syncProductStock = $db->prepare("UPDATE products SET stock_quantity = (SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = ?) WHERE id = ?");

                foreach ($items as $item) {
                    // [LOGIC MỚI] Nếu lý do là lỗi (defective) -> KHÔNG CỘNG KHO
                    if ($item['reason'] === 'defective') {
                        continue; 
                    }

                    $qty = (int)$item['quantity'];
                    $vId = !empty($item['product_variant_id']) ? (int)$item['product_variant_id'] : null;
                    $pId = (int)$item['product_id'];

                    if ($vId) {
                        $restoreVariantSql->execute([$qty, $vId]);
                        $syncProductStock->execute([$pId, $pId]);
                    } else {
                        $restoreProductSql->execute([$qty, $pId]);
                    }
                }
                
                $message = "Đã duyệt trả hàng. (Các sản phẩm lỗi không được cộng lại kho)";
            }

            $db->commit();
            $this->json(['success' => true, 'message' => $message]);

        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            $this->error('Lỗi xử lý: ' . $e->getMessage(), 500);
        }
    }
}