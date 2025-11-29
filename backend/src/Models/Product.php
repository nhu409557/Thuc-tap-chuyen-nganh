<?php
namespace App\Models;

use PDO;

class Product extends BaseModel
{
    // ... (Hàm search và getAllBrands giữ nguyên) ...
    public static function search(?string $categorySlug, ?string $q, int $page = 1, int $perPage = 16, $minPrice = null, $maxPrice = null, $brandName = null, $sort = 'newest'): array
    {
        $where = [];
        $params = [];

        $joinSql = "
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
        ";

        if ($categorySlug && $categorySlug !== 'all') {
            $where[] = 'c.slug = ?';
            $params[] = $categorySlug;
        }
        if ($q) {
            $where[] = 'p.title LIKE ?';
            $params[] = '%' . $q . '%';
        }
        if ($minPrice !== null && $minPrice !== '') {
            $where[] = 'p.price >= ?';
            $params[] = $minPrice;
        }
        if ($maxPrice !== null && $maxPrice !== '') {
            $where[] = 'p.price <= ?';
            $params[] = $maxPrice;
        }
        if ($brandName) {
            $brands = explode(',', $brandName);
            $placeholders = implode(',', array_fill(0, count($brands), '?'));
            $where[] = "b.name IN ($placeholders)";
            $params = array_merge($params, $brands);
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        
        $orderBy = 'p.created_at DESC'; 
        switch ($sort) {
            case 'price_asc': $orderBy = 'p.price ASC'; break;
            case 'price_desc': $orderBy = 'p.price DESC'; break;
            default: $orderBy = 'p.created_at DESC'; break;
        }

        $offset = ($page - 1) * $perPage;

        $stmt = self::db()->prepare("SELECT COUNT(*) as cnt FROM products p $joinSql $whereSql");
        $stmt->execute($params);
        $total = (int)$stmt->fetch()['cnt'];

        $sql = "SELECT p.*, 
                       c.name as category_name, c.slug as category_slug,
                       b.name as brand_name 
                FROM products p 
                $joinSql 
                $whereSql 
                ORDER BY $orderBy 
                LIMIT $perPage OFFSET $offset";
        
        $stmt = self::db()->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['category'] = $item['category_slug'];
            $item['brand'] = $item['brand_name'];
        }

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_page' => ceil($total / $perPage),
        ];
    }

    public static function getAllBrands(?string $categorySlug = null): array
    {
        if ($categorySlug && $categorySlug !== 'all') {
            $sql = "SELECT b.name 
                    FROM brands b
                    JOIN brand_categories bc ON b.id = bc.brand_id
                    JOIN categories c ON bc.category_id = c.id
                    WHERE c.slug = ?
                    ORDER BY b.name ASC";
            $stmt = self::db()->prepare($sql);
            $stmt->execute([$categorySlug]);
        } else {
            $sql = "SELECT name FROM brands ORDER BY name ASC";
            $stmt = self::db()->query($sql);
        }
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // 👇 CẬP NHẬT QUAN TRỌNG: Lấy thêm specs_template
    public static function find(int $id): ?array
    {
        $sql = "SELECT p.*, 
                       c.name as category_name, 
                       c.slug as category_slug, 
                       c.specs_template,  -- <-- Lấy cột này
                       b.name as brand_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN brands b ON p.brand_id = b.id
                WHERE p.id = ?";
                
        $stmt = self::db()->prepare($sql);
        $stmt->execute([$id]);
        $product = $stmt->fetch();

        if (!$product) return null;

        $product['category'] = $product['category_slug'];
        $product['brand'] = $product['brand_name'];

        $stmtImg = self::db()->prepare('SELECT image_url FROM product_images WHERE product_id = ?');
        $stmtImg->execute([$id]);
        $images = $stmtImg->fetchAll(PDO::FETCH_COLUMN); 

        if ($product['image']) {
            array_unshift($images, $product['image']);
        }
        
        $product['gallery'] = array_unique($images);
        
        return $product;
    }

    // ... (Các hàm create, update, delete, helper giữ nguyên như lần trước) ...
    public static function create($data)
    {
        $categoryId = self::getCategoryIdBySlug($data['category'] ?? '');
        $brandId = self::getBrandIdByName($data['brand'] ?? '');

        if (isset($data['specs']) && is_array($data['specs'])) {
            $data['specs'] = json_encode($data['specs'], JSON_UNESCAPED_UNICODE);
        }

        $stmt = self::db()->prepare("
            INSERT INTO products (title, category_id, brand_id, price, stock_quantity, compare_at, image, description, specs) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['title'],
            $categoryId,
            $brandId,
            $data['price'],
            $data['stock_quantity'] ?? 0,
            $data['compare_at'] ?? null,
            $data['image'] ?? 'https://via.placeholder.com/300',
            $data['description'] ?? '',
            $data['specs'] ?? null
        ]);
        return self::db()->lastInsertId();
    }

    public static function update($id, $data)
    {
        if (isset($data['category'])) {
            $data['category_id'] = self::getCategoryIdBySlug($data['category']);
            unset($data['category']);
        }
        if (isset($data['brand'])) {
            $data['brand_id'] = self::getBrandIdByName($data['brand']);
            unset($data['brand']);
        }
        if (isset($data['specs']) && is_array($data['specs'])) {
            $data['specs'] = json_encode($data['specs'], JSON_UNESCAPED_UNICODE);
        }

        $fields = [];
        $values = [];
        $allowed = ['title', 'category_id', 'brand_id', 'price', 'stock_quantity', 'compare_at', 'image', 'description', 'specs'];
        
        foreach ($data as $key => $val) {
            if (in_array($key, $allowed)) {
                $fields[] = "$key = ?";
                $values[] = $val;
            }
        }
        
        if (empty($fields)) return;

        $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?";
        $values[] = $id;
        
        $stmt = self::db()->prepare($sql);
        $stmt->execute($values);
    }

    public static function delete($id)
    {
        $stmt = self::db()->prepare("DELETE FROM products WHERE id = ?");
        $stmt->execute([$id]);
    }

    private static function getCategoryIdBySlug($slug) {
        $stmt = self::db()->prepare("SELECT id FROM categories WHERE slug = ?");
        $stmt->execute([$slug]);
        return $stmt->fetchColumn() ?: null;
    }

    private static function getBrandIdByName($name) {
        $stmt = self::db()->prepare("SELECT id FROM brands WHERE name = ?");
        $stmt->execute([$name]);
        return $stmt->fetchColumn() ?: null;
    }
}