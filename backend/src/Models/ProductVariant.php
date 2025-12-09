<?php
namespace App\Models;

class ProductVariant extends BaseModel
{
    // Lấy tất cả biến thể của 1 sản phẩm gốc
    public static function getByProductId(int $productId): array
    {
        $stmt = self::db()->prepare("
            SELECT * FROM product_variants 
            WHERE product_id = ? 
            ORDER BY price ASC
        ");
        $stmt->execute([$productId]);
        return $stmt->fetchAll();
    }

    // Tìm biến thể theo ID
    public static function find(int $id): ?array
    {
        $stmt = self::db()->prepare("SELECT * FROM product_variants WHERE id = ?");
        $stmt->execute([$id]);
        $res = $stmt->fetch();
        return $res ?: null;
    }
}