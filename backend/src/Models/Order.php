<?php
namespace App\Models;

class Order extends BaseModel
{
    // Tạo đơn hàng mới (Đã thêm payment_status)
    public static function create(int $userId, array $payload, array $cart, string $paymentMethod): int
    {
        $db = self::db();
        $db->beginTransaction();

        try {
            $total = 0;
            foreach ($cart as $item) {
                $total += $item['price'] * $item['quantity'];
            }

            // 1. Xác định trạng thái ban đầu
            // Status (Quy trình): Luôn là Pending (Chờ xác nhận)
            $status = 'Pending'; 
            
            // Payment Status (Thanh toán): Mặc định là Unpaid
            // Kể cả MoMo cũng là Unpaid cho đến khi IPN báo về thành công
            $paymentStatus = 'Unpaid'; 

            $stmt = $db->prepare(
                'INSERT INTO orders (user_id, name, phone, address, total_amount, payment_method, status, payment_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );

            $stmt->execute([
                $userId,
                $payload['name'],
                $payload['phone'],
                $payload['address'],
                $total,
                $paymentMethod,
                $status,
                $paymentStatus // <-- Cột mới
            ]);

            $orderId = (int)$db->lastInsertId();

            // 2. Lưu chi tiết sản phẩm
            $itemStmt = $db->prepare(
                'INSERT INTO order_items (order_id, product_id, product_title, price, quantity)
                 VALUES (?, ?, ?, ?, ?)'
            );

            foreach ($cart as $item) {
                $itemStmt->execute([
                    $orderId,
                    $item['product_id'],
                    $item['title'],
                    $item['price'],
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

    // Cập nhật trạng thái quy trình (Pending -> Shipping -> Delivered)
    public static function updateStatus(int $orderId, string $status): void
    {
        $stmt = self::db()->prepare('UPDATE orders SET status = ? WHERE id = ?');
        $stmt->execute([$status, $orderId]);
    }

    // 👇 HÀM MỚI: Chỉ cập nhật trạng thái thanh toán (Unpaid -> Paid)
    public static function updatePaymentStatus(int $orderId, string $paymentStatus): void
    {
        $stmt = self::db()->prepare('UPDATE orders SET payment_status = ? WHERE id = ?');
        $stmt->execute([$paymentStatus, $orderId]);
    }

    public static function allByUser(int $userId): array
    {
        $stmt = self::db()->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public static function findWithItems(int $id, int $userId): ?array
    {
        $db = self::db();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $order = $stmt->fetch();
        if (!$order) return null;

        $itemStmt = $db->prepare('SELECT * FROM order_items WHERE order_id = ?');
        $itemStmt->execute([$id]);
        $items = $itemStmt->fetchAll();
        $order['items'] = $items;

        return $order;
    }

    public static function findById(int $id): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        return $order ?: null;
    }
    // 👇 HÀM MỚI: TÌM KIẾM & PHÂN TRANG CHO ADMIN
    public static function search(?string $q, ?string $status, int $page = 1, int $perPage = 10): array
    {
        $where = [];
        $params = [];

        // 1. Tìm theo Mã đơn hoặc Tên khách hàng
        if ($q) {
            $where[] = '(id LIKE ? OR name LIKE ? OR phone LIKE ?)';
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
        }

        // 2. Lọc theo trạng thái
        if ($status && $status !== 'all') {
            $where[] = 'status = ?';
            $params[] = $status;
        }

        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $offset = ($page - 1) * $perPage;

        // Query đếm tổng
        $stmt = self::db()->prepare("SELECT COUNT(*) as cnt FROM orders $whereSql");
        $stmt->execute($params);
        $total = (int)$stmt->fetch()['cnt'];

        // Query lấy dữ liệu
        $stmt = self::db()->prepare("SELECT * FROM orders $whereSql ORDER BY created_at DESC LIMIT $perPage OFFSET $offset");
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_page' => ceil($total / $perPage),
        ];
    }

    // 👇 HÀM MỚI: LẤY CHI TIẾT ĐẦY ĐỦ CHO ADMIN (Không check user_id)
    public static function findByIdWithItems(int $id): ?array
    {
        $db = self::db();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) return null;

        $itemStmt = $db->prepare('SELECT * FROM order_items WHERE order_id = ?');
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll();

        return $order;
    }
}