<?php
namespace App\Models;

class CartItem extends BaseModel
{
    /**
     * Lấy toàn bộ sản phẩm trong giỏ của 1 user
     * Kèm theo thông tin product + variant đầy đủ
     */
    public static function allByUser(int $userId): array
    {
        $sql = "
            SELECT 
                c.id,
                c.quantity,
                c.product_id,
                c.product_variant_id,
                c.selected_color, -- Lấy màu đã lưu lúc add to cart (fallback)

                p.title AS product_title,
                p.image AS product_image,
                p.price AS base_price,

                pv.color AS variant_color,
                pv.price AS variant_price,
                pv.image AS variant_image,
                pv.attributes AS variant_attributes -- 👇 LẤY THÊM CỘT NÀY
            FROM cart_items c
            JOIN products p ON c.product_id = p.id
            LEFT JOIN product_variants pv ON c.product_variant_id = pv.id
            WHERE c.user_id = ?
            ORDER BY c.id DESC
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    // ... (Các hàm addOrUpdate, updateQuantity, remove, clearByUser giữ nguyên như cũ)
    public static function addOrUpdate(int $userId, int $productId, int $qty, ?int $variantId = null): void
    {
        // Logic check trùng: sản phẩm giống nhau + variant giống nhau
        $sqlCheck = "
            SELECT id FROM cart_items 
            WHERE user_id = ? AND product_id = ? 
            AND (product_variant_id = ? OR (product_variant_id IS NULL AND ? IS NULL))
        ";
        $stmtCheck = self::db()->prepare($sqlCheck);
        $stmtCheck->execute([$userId, $productId, $variantId, $variantId]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $stmt = self::db()->prepare("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?");
            $stmt->execute([$qty, $existing['id']]);
        } else {
            // Khi insert, lưu ý selected_color sẽ được lưu nếu controller gửi xuống (nhưng ở đây ta dùng variant_id là chính)
            $stmt = self::db()->prepare("
                INSERT INTO cart_items (user_id, product_id, quantity, product_variant_id) 
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $productId, $qty, $variantId]);
        }
    }
    
    // ... Copy lại các hàm updateQuantity, remove, clearByUser từ file cũ của bạn
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