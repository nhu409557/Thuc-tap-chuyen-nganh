<?php
namespace App\Models;

class Wishlist extends BaseModel
{
    public static function allByUser(int $userId): array
    {
        // 👇 Đã thêm p.color
        $stmt = self::db()->prepare(
            'SELECT w.id, p.id as product_id, p.title, p.price, p.compare_at, p.image, p.color
             FROM wishlist_items w
             JOIN products p ON p.id = w.product_id
             WHERE w.user_id = ?
             ORDER BY w.created_at DESC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public static function add(int $userId, int $productId): void
    {
        $stmt = self::db()->prepare(
            'INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)'
        );
        $stmt->execute([$userId, $productId]);
    }

    public static function remove(int $id, int $userId): void
    {
        $stmt = self::db()->prepare('DELETE FROM wishlist_items WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
    }
}