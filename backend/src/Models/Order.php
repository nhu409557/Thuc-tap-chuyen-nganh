<?php
namespace App\Models;

class Order extends BaseModel
{
    public static function create(int $userId, array $payload, array $cart, string $paymentMethod): int
    {
        $db = self::db();
        $db->beginTransaction();

        try {
            // 1. Tính tổng tiền (Sử dụng giá của variant nếu có)
            $total = 0;
            foreach ($cart as $item) {
                // Ưu tiên lấy giá variant, nếu không có thì lấy giá base
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                $total += $price * $item['quantity'];
            }

            // 2. Insert orders
            $stmt = $db->prepare(
                'INSERT INTO orders (user_id, name, phone, address, total_amount, payment_method, status, payment_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );

            $stmt->execute([
                $userId, $payload['name'], $payload['phone'], $payload['address'],
                $total, $paymentMethod, 'Pending', 'Unpaid'
            ]);

            $orderId = (int)$db->lastInsertId();

            // 3. Insert order_items (CÓ CẬP NHẬT: variant_id)
            $itemStmt = $db->prepare(
                'INSERT INTO order_items (order_id, product_id, product_variant_id, product_title, selected_color, price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );

            foreach ($cart as $item) {
                $price = $item['variant_price'] ?? $item['base_price'] ?? $item['price'];
                
                // Xác định tên màu để lưu snapshot (nếu variant bị xóa sau này)
                $color = $item['variant_color'] ?? $item['selected_color'] ?? null;
                
                // Nếu dùng attributes JSON để lưu màu, thử parse ra
                if (!$color && !empty($item['variant_attributes'])) {
                    $attrs = json_decode($item['variant_attributes'], true);
                    $color = $attrs['color'] ?? null;
                }

                $itemStmt->execute([
                    $orderId,
                    $item['product_id'],
                    $item['product_variant_id'] ?? null, // 👇 QUAN TRỌNG: Lưu ID biến thể
                    $item['product_title'] ?? $item['title'],
                    $color,
                    $price,
                    $item['quantity'],
                ]);
                
                // (Tùy chọn: Ở đây bạn có thể trừ tồn kho của Variant luôn nếu muốn)
            }

            $db->commit();
            return $orderId;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // Khi xem chi tiết đơn hàng, join lại bảng variants để lấy thông tin chi tiết (nếu cần hiển thị ảnh variant)
    public static function findWithItems(int $id, int $userId): ?array
    {
        $db = self::db();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $order = $stmt->fetch();
        if (!$order) return null;

        // Join để lấy thêm attributes hiện tại (nếu variant chưa bị xóa)
        $sqlItems = "
            SELECT oi.*, 
                   p.image as product_image, 
                   pv.image as variant_image,
                   pv.attributes as variant_attributes
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
            WHERE oi.order_id = ?
        ";
        
        $itemStmt = $db->prepare($sqlItems);
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll();

        return $order;
    }

    // ... (Giữ nguyên các hàm findById, updateStatus, updatePaymentStatus, allByUser, search, findByIdWithItems)
    // CHÚ Ý: Cập nhật findByIdWithItems (cho admin) tương tự findWithItems ở trên để admin cũng thấy chi tiết.
    
    public static function findById(int $id): ?array { /* Giữ nguyên */
        $stmt = self::db()->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }
    public static function updateStatus(int $orderId, string $status): void { /* Giữ nguyên */
        self::db()->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $orderId]);
    }
    public static function updatePaymentStatus(int $orderId, string $paymentStatus): void { /* Giữ nguyên */
        self::db()->prepare('UPDATE orders SET payment_status = ? WHERE id = ?')->execute([$paymentStatus, $orderId]);
    }
    public static function allByUser(int $userId): array { /* Giữ nguyên */
        $stmt = self::db()->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }
    public static function search(?string $q, ?string $status, int $page = 1, int $perPage = 10): array { /* Giữ nguyên */
        // ... Code cũ ...
        $where = []; $params = [];
        if ($q) { $where[] = '(id LIKE ? OR name LIKE ? OR phone LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; }
        if ($status && $status !== 'all') { $where[] = 'status = ?'; $params[] = $status; }
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $offset = ($page - 1) * $perPage;
        $stmt = self::db()->prepare("SELECT COUNT(*) as cnt FROM orders $whereSql");
        $stmt->execute($params);
        $total = (int)$stmt->fetch()['cnt'];
        $stmt = self::db()->prepare("SELECT * FROM orders $whereSql ORDER BY created_at DESC LIMIT $perPage OFFSET $offset");
        $stmt->execute($params);
        return ['items' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $perPage, 'total_page' => ceil($total / $perPage)];
    }
    public static function findByIdWithItems(int $id): ?array {
        $db = self::db();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) return null;
        // Updated Join query for Admin
        $sqlItems = "SELECT oi.*, p.image as product_image, pv.image as variant_image, pv.attributes as variant_attributes 
                     FROM order_items oi JOIN products p ON oi.product_id = p.id 
                     LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id WHERE oi.order_id = ?";
        $itemStmt = $db->prepare($sqlItems);
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll();
        return $order;
    }
}