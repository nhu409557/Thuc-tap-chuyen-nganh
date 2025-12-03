<?php
namespace App\Models;

use PDO;

class Product extends BaseModel
{
    /**
     * TÌM KIẾM SẢN PHẨM (Đã nâng cấp: Lấy full variants để chọn nhanh)
     */
    public static function search(?string $categorySlug, ?string $q, int $page = 1, int $perPage = 16, $minPrice = null, $maxPrice = null, $brandName = null, $sort = 'newest'): array
    {
        $where = [];
        $params = [];

        $joinSql = "
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
        ";

        // 1. Xây dựng điều kiện lọc
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
        
        // 2. Sắp xếp
        $orderBy = 'p.created_at DESC'; 
        switch ($sort) {
            case 'price_asc': $orderBy = 'p.price ASC'; break;
            case 'price_desc': $orderBy = 'p.price DESC'; break;
            default: $orderBy = 'p.created_at DESC'; break;
        }

        // 3. Phân trang
        $offset = ($page - 1) * $perPage;

        // 4. Query tổng số lượng (để tính trang)
        $stmt = self::db()->prepare("SELECT COUNT(*) as cnt FROM products p $joinSql $whereSql");
        $stmt->execute($params);
        $total = (int)$stmt->fetch()['cnt'];

        // 5. Query lấy danh sách sản phẩm
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

        // 6. LOGIC MỚI: Lấy thông tin biến thể (Variants) cho từng sản phẩm
        // Để hiển thị nút chọn màu/cấu hình ngay bên ngoài
        foreach ($items as &$item) {
            $item['category'] = $item['category_slug'];
            $item['brand'] = $item['brand_name'];

            // Query lấy danh sách biến thể của sản phẩm này
            $vStmt = self::db()->prepare("
                SELECT id, product_id, price, stock_quantity, image, color, capacity, attributes 
                FROM product_variants 
                WHERE product_id = ? 
                ORDER BY price ASC
            ");
            $vStmt->execute([$item['id']]);
            $variants = $vStmt->fetchAll();

            // Gán variants vào item để frontend dùng
            $item['variants'] = $variants;

            // Logic cũ: Tổng hợp màu sắc để hiển thị (nếu cần fallback)
            if (count($variants) > 0) {
                $colors = [];
                foreach ($variants as $v) {
                    $attrs = !empty($v['attributes']) ? json_decode($v['attributes'], true) : [];
                    if (!empty($attrs['color'])) {
                        $colors[] = $attrs['color'];
                    } elseif (!empty($v['color'])) {
                        $colors[] = $v['color'];
                    }
                }
                if (!empty($colors)) {
                    $item['color'] = json_encode(array_unique($colors), JSON_UNESCAPED_UNICODE);
                }
            }
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
            $sql = "SELECT b.name FROM brands b JOIN brand_categories bc ON b.id = bc.brand_id JOIN categories c ON bc.category_id = c.id WHERE c.slug = ? ORDER BY b.name ASC";
            $stmt = self::db()->prepare($sql);
            $stmt->execute([$categorySlug]);
        } else {
            $sql = "SELECT name FROM brands ORDER BY name ASC";
            $stmt = self::db()->query($sql);
        }
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function find(int $id): ?array
    {
        $sql = "SELECT p.*, c.name as category_name, c.slug as category_slug, c.specs_template, b.name as brand_name
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
        if ($product['image']) array_unshift($images, $product['image']);
        $product['gallery'] = array_unique($images);

        // Lấy variants chi tiết
        $stmtVar = self::db()->prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY price ASC");
        $stmtVar->execute([$id]);
        $product['variants'] = $stmtVar->fetchAll();
        
        foreach ($product['variants'] as &$v) {
            $v['attributes'] = !empty($v['attributes']) ? json_decode($v['attributes'], true) : [];
        }

        return $product;
    }

    public static function create($data)
    {
        $categoryId = $data['category_id'] ?? self::getCategoryIdBySlug($data['category'] ?? '');
        $brandId = $data['brand_id'] ?? self::getBrandIdByName($data['brand'] ?? '');
        $specs = (isset($data['specs']) && is_array($data['specs'])) ? json_encode($data['specs'], JSON_UNESCAPED_UNICODE) : null;

        $stmt = self::db()->prepare("
            INSERT INTO products (title, category_id, brand_id, price, color, stock_quantity, compare_at, image, description, specs) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['title'], $categoryId, $brandId, $data['price'], 
            $data['color'] ?? null, $data['stock_quantity'] ?? 0, 
            $data['compare_at'] ?? null, $data['image'] ?? 'https://via.placeholder.com/300', 
            $data['description'] ?? '', $specs
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

        $fields = []; $values = [];
        $allowed = ['title', 'category_id', 'brand_id', 'price', 'color', 'stock_quantity', 'compare_at', 'image', 'description', 'specs'];
        
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