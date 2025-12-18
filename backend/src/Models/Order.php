<?php
namespace App\Models;

use PDO;

class Order extends BaseModel
{
    // ==========================================================
    // 1. TẠO ĐƠN HÀNG (USER)
    // ==========================================================
    public static function create(int $userId, array $payload, array $cart, string $paymentMethod): int
    {
        $db = self::db();
        $db->beginTransaction();

        try {
            $total = 0;
            foreach ($cart as $item) {
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                $total += $price * $item['quantity'];
            }

            // Lấy thông tin giảm giá nếu có (được truyền từ Controller)
            $discount = $payload['discount_amount'] ?? 0;
            $coupon = $payload['coupon_code'] ?? null;
            $finalTotal = max(0, $total - $discount);

            $stmt = $db->prepare(
                'INSERT INTO orders (user_id, name, phone, address, total_amount, discount_amount, coupon_code, payment_method, status, payment_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );

            $stmt->execute([
                $userId, $payload['name'], $payload['phone'], $payload['address'],
                $finalTotal, $discount, $coupon, $paymentMethod, 'Pending', 'Unpaid'
            ]);

            $orderId = (int)$db->lastInsertId();

            $itemStmt = $db->prepare(
                'INSERT INTO order_items (order_id, product_id, product_variant_id, product_title, selected_color, price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );

            foreach ($cart as $item) {
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                $color = $item['variant_color'] ?? $item['selected_color'] ?? null;
                
                // Parse attributes để lấy màu nếu selected_color null
                if (!$color && !empty($item['variant_attributes'])) {
                    $attrs = is_string($item['variant_attributes']) ? json_decode($item['variant_attributes'], true) : $item['variant_attributes'];
                    $color = $attrs['color'] ?? null;
                }

                $itemStmt->execute([
                    $orderId,
                    $item['product_id'],
                    $item['product_variant_id'] ?? null,
                    $item['product_title'] ?? $item['title'],
                    $color,
                    $price,
                    $item['quantity'],
                ]);
            }

            $db->commit();
            return $orderId;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // ==========================================================
    // 2. CÁC HÀM TRA CỨU & CẬP NHẬT CƠ BẢN
    // ==========================================================

    public static function findById(int $id): ?array 
    {
        $stmt = self::db()->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public static function updateStatus(int $orderId, string $status): void 
    {
        self::db()->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $orderId]);
    }

    public static function updatePaymentStatus(int $orderId, string $paymentStatus): void 
    {
        self::db()->prepare('UPDATE orders SET payment_status = ? WHERE id = ?')->execute([$paymentStatus, $orderId]);
    }

    public static function markDeliveredTimestamp(int $id): bool
    {
        $stmt = self::db()->prepare("UPDATE orders SET delivered_at = NOW() WHERE id = ? AND delivered_at IS NULL");
        return $stmt->execute([$id]);
    }

    public static function allByUser(int $userId): array 
    {
        $stmt = self::db()->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // --- HÀM CHI TIẾT CHO USER (Kèm thông tin trả hàng để xem trạng thái) ---
    public static function findWithItems(int $id, int $userId): ?array
    {
        $db = self::db();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) return null;

        $sqlItems = "SELECT oi.*, p.image as product_image, pv.image as variant_image, pv.attributes as variant_attributes
                     FROM order_items oi JOIN products p ON oi.product_id = p.id
                     LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
                     WHERE oi.order_id = ?";
        
        $itemStmt = $db->prepare($sqlItems);
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        // Lấy thông tin trả hàng (Return Request)
        $returnStmt = $db->prepare("SELECT * FROM order_returns WHERE order_id = ? ORDER BY created_at DESC LIMIT 1");
        $returnStmt->execute([$id]);
        $returnRequest = $returnStmt->fetch(PDO::FETCH_ASSOC);

        if ($returnRequest) {
            $order['return_request'] = $returnRequest;
            $returnItemsStmt = $db->prepare("SELECT * FROM order_return_items WHERE return_id = ?");
            $returnItemsStmt->execute([$returnRequest['id']]);
            $returnItemsRaw = $returnItemsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Map lại để frontend dễ dùng: Key = product_id_variant_id
            $mapped = [];
            foreach($returnItemsRaw as $ri) {
                $key = $ri['product_id'] . '_' . ($ri['product_variant_id'] ?? '');
                $mapped[$key] = $ri;
            }
            $order['return_items_map'] = $mapped;
        } else {
            $order['return_request'] = null;
            $order['return_items_map'] = [];
        }

        return $order;
    }

    // ==========================================================
    // 3. CÁC HÀM DÀNH CHO ADMIN
    // ==========================================================

    public static function search(?string $q, ?string $status, int $page = 1, int $perPage = 10): array 
    {
        $where = []; 
        $params = [];
        
        if ($q) { 
            $where[] = '(id LIKE ? OR name LIKE ? OR phone LIKE ?)'; 
            $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; 
        }
        
        if ($status && $status !== 'all') { 
            $where[] = 'status = ?'; 
            $params[] = $status; 
        }
        
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $offset = ($page - 1) * $perPage;
        
        $stmt = self::db()->prepare("SELECT COUNT(*) as cnt FROM orders $whereSql");
        $stmt->execute($params);
        $total = (int)$stmt->fetch(PDO::FETCH_ASSOC)['cnt'];
        
        $stmt = self::db()->prepare("SELECT * FROM orders $whereSql ORDER BY created_at DESC LIMIT $perPage OFFSET $offset");
        $stmt->execute($params);
        
        return [
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC), 
            'total' => $total, 
            'page' => $page, 
            'per_page' => $perPage, 
            'total_page' => ceil($total / $perPage)
        ];
    }

    // [QUAN TRỌNG] Hàm lấy chi tiết đơn hàng cho Admin (Kèm thông tin Return Request)
    public static function findByIdWithItems(int $id): ?array 
    {
        $db = self::db();
        
        // 1. Lấy đơn hàng
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) return null;
        
        // 2. Lấy Items
        $sqlItems = "SELECT oi.*, p.image as product_image, pv.image as variant_image, pv.attributes as variant_attributes 
                     FROM order_items oi JOIN products p ON oi.product_id = p.id 
                     LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id WHERE oi.order_id = ?";
        
        $itemStmt = $db->prepare($sqlItems);
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Lấy thông tin phiếu trả hàng (Return Request) cho Admin xem xét
        $returnStmt = $db->prepare("SELECT * FROM order_returns WHERE order_id = ? ORDER BY created_at DESC LIMIT 1");
        $returnStmt->execute([$id]);
        $returnRequest = $returnStmt->fetch(PDO::FETCH_ASSOC);

        if ($returnRequest) {
            $order['return_request'] = $returnRequest;
            
            // Lấy chi tiết các món trả
            $returnItemsStmt = $db->prepare("SELECT * FROM order_return_items WHERE return_id = ?");
            $returnItemsStmt->execute([$returnRequest['id']]);
            $returnItemsRaw = $returnItemsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Map lại theo key
            $mapped = [];
            foreach ($returnItemsRaw as $ri) {
                $key = $ri['product_id'] . '_' . ($ri['product_variant_id'] ?? '');
                $mapped[$key] = $ri;
            }
            $order['return_items_map'] = $mapped;
        } else {
            $order['return_request'] = null;
            $order['return_items_map'] = [];
        }

        return $order;
    }
}