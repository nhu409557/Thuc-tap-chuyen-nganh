<?php
namespace App\Models;

class Wishlist extends BaseModel
{
    /**
     * Lấy tất cả sản phẩm yêu thích của user
     */
    public static function allByUser(int $userId): array
    {
        $stmt = self::db()->prepare(
            'SELECT w.id, p.id as product_id, p.title, p.price, p.compare_at, p.image
             FROM wishlist_items w
             JOIN products p ON p.id = w.product_id
             WHERE w.user_id = ?
             ORDER BY w.created_at DESC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    /**
     * Thêm sản phẩm vào yêu thích (ĐÃ SỬA)
     * Dùng INSERT IGNORE để tự động bỏ qua nếu đã có trong danh sách
     */
    public static function add(int $userId, int $productId): void
    {
        $stmt = self::db()->prepare(
            'INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)'
        );
        $stmt->execute([$userId, $productId]);
    }

    /**
     * Xóa 1 item khỏi yêu thích
     */
    public static function remove(int $id, int $userId): void
    {
        $stmt = self::db()->prepare('DELETE FROM wishlist_items WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
    }
}