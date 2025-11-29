<?php
namespace App\Models;

class CartItem extends BaseModel
{
    public static function allByUser(int $userId): array
    {
        $stmt = self::db()->prepare(
            'SELECT c.id, c.quantity, p.id as product_id, p.title, p.price, p.image
             FROM cart_items c
             JOIN products p ON p.id = c.product_id
             WHERE c.user_id = ?'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public static function addOrUpdate(int $userId, int $productId, int $qty): void
    {
        // nếu tồn tại thì update
        $stmt = self::db()->prepare(
            'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)'
        );
        $stmt->execute([$userId, $productId, $qty]);
    }

    public static function updateQuantity(int $id, int $qty, int $userId): void
    {
        if ($qty <= 0) {
            $stmt = self::db()->prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $userId]);
        } else {
            $stmt = self::db()->prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?');
            $stmt->execute([$qty, $id, $userId]);
        }
    }

    public static function remove(int $id, int $userId): void
    {
        $stmt = self::db()->prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
    }

    public static function clearByUser(int $userId): void
    {
        $stmt = self::db()->prepare('DELETE FROM cart_items WHERE user_id = ?');
        $stmt->execute([$userId]);
    }
}
