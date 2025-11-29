<?php
namespace App\Models;

use PDO;

class Brand extends BaseModel
{
    // Lấy danh sách hãng kèm các danh mục (nối chuỗi slug)
    public static function all(): array
    {
        $sql = "
            SELECT b.*, 
            (
                SELECT GROUP_CONCAT(c.slug) 
                FROM brand_categories bc 
                JOIN categories c ON bc.category_id = c.id 
                WHERE bc.brand_id = b.id
            ) as categories
            FROM brands b 
            ORDER BY b.name ASC
        ";
        $stmt = self::db()->query($sql);
        return $stmt->fetchAll();
    }

    public static function create(string $name, array $categorySlugs): int
    {
        $db = self::db();
        $db->beginTransaction(); 

        try {
            // 1. Tạo Brand
            $stmt = $db->prepare("INSERT INTO brands (name) VALUES (?)");
            $stmt->execute([$name]);
            $brandId = (int)$db->lastInsertId();

            // 2. Thêm vào bảng trung gian
            self::syncCategories($brandId, $categorySlugs, $db);

            $db->commit();
            return $brandId;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function update(int $id, string $name, array $categorySlugs): bool
    {
        $db = self::db();
        $db->beginTransaction();

        try {
            // 1. Update tên
            $stmt = $db->prepare("UPDATE brands SET name = ? WHERE id = ?");
            $stmt->execute([$name, $id]);

            // 2. Xóa cũ và thêm mới bảng trung gian
            $db->prepare("DELETE FROM brand_categories WHERE brand_id = ?")->execute([$id]);
            self::syncCategories($id, $categorySlugs, $db);

            $db->commit();
            return true;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function delete(int $id): bool
    {
        $stmt = self::db()->prepare("DELETE FROM brands WHERE id = ?");
        return $stmt->execute([$id]);
    }

    // Helper: Map Slug -> ID và Insert vào bảng trung gian
    private static function syncCategories($brandId, $slugs, $db) {
        if (empty($slugs)) return;

        // Lấy ID của các slug
        $placeholders = implode(',', array_fill(0, count($slugs), '?'));
        $stmtCat = $db->prepare("SELECT id FROM categories WHERE slug IN ($placeholders)");
        $stmtCat->execute($slugs);
        $catIds = $stmtCat->fetchAll(PDO::FETCH_COLUMN);

        if (empty($catIds)) return;

        // Insert batch
        $insertQuery = "INSERT INTO brand_categories (brand_id, category_id) VALUES ";
        $insertValues = [];
        $params = [];
        
        foreach ($catIds as $catId) {
            $insertValues[] = "(?, ?)";
            $params[] = $brandId;
            $params[] = $catId;
        }

        $insertQuery .= implode(',', $insertValues);
        $db->prepare($insertQuery)->execute($params);
    }
}