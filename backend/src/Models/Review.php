<?php
namespace App\Models;

class Review extends BaseModel
{
    // Kiểm tra xem đã có đánh giá cho sản phẩm trong đơn hàng này chưa
    public static function hasReviewed(int $userId, int $orderId, int $productId): bool
    {
        $stmt = self::db()->prepare(
            'SELECT id FROM reviews WHERE user_id = ? AND order_id = ? AND product_id = ? LIMIT 1'
        );
        $stmt->execute([$userId, $orderId, $productId]);
        return (bool)$stmt->fetch();
    }

    // Tạo đánh giá mới
    public static function create(int $userId, int $productId, int $orderId, int $rating, string $comment): void
    {
        $stmt = self::db()->prepare(
            'INSERT INTO reviews (user_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $productId, $orderId, $rating, $comment]);
    }
    
    // Lấy danh sách đánh giá của 1 sản phẩm (để hiển thị trang chi tiết - làm sau)
    public static function getByProduct(int $productId): array 
    {
        $stmt = self::db()->prepare(
            'SELECT r.*, u.name as user_name 
             FROM reviews r 
             JOIN users u ON r.user_id = u.id 
             WHERE r.product_id = ? 
             ORDER BY r.created_at DESC'
        );
        $stmt->execute([$productId]);
        return $stmt->fetchAll();
    }
}