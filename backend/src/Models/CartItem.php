<?php
namespace App\Models;

class CartItem extends BaseModel
{
    /**
     * Lấy toàn bộ sản phẩm trong giỏ của 1 user
     * Kèm theo thông tin tồn kho (stock) để frontend giới hạn
     */
    public static function allByUser(int $userId): array
    {
        $sql = "
            SELECT 
                c.id,
                c.quantity,
                c.product_id,
                c.product_variant_id,
                c.selected_color,

                p.title AS product_title,
                p.image AS product_image,
                p.price AS base_price,
                p.stock_quantity AS product_stock,

                pv.color AS variant_color,
                pv.price AS variant_price,
                pv.image AS variant_image,
                pv.attributes AS variant_attributes,
                pv.stock_quantity AS variant_stock
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

    /**
     * Thêm hoặc cập nhật sản phẩm trong giỏ
     * Sửa đổi: Trả về ID của cart item (int)
     */
    public static function addOrUpdate(int $userId, int $productId, int $qty, ?int $variantId = null): int
    {
        // Check trùng: sản phẩm giống nhau + variant giống nhau
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
            return (int)$existing['id']; // Trả về ID cũ
        } else {
            $stmt = self::db()->prepare("
                INSERT INTO cart_items (user_id, product_id, quantity, product_variant_id) 
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $productId, $qty, $variantId]);
            return (int)self::db()->lastInsertId(); // Trả về ID mới tạo
        }
    }
    
    // Hàm lấy số lượng hiện tại của sản phẩm trong giỏ
    public static function getQuantity(int $userId, int $productId, ?int $variantId = null): int
    {
        $sql = "SELECT quantity FROM cart_items 
                WHERE user_id = ? AND product_id = ? 
                AND (product_variant_id = ? OR (product_variant_id IS NULL AND ? IS NULL))";
        $stmt = self::db()->prepare($sql);
        $stmt->execute([$userId, $productId, $variantId, $variantId]);
        return (int)$stmt->fetchColumn();
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