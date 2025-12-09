<?php
namespace App\Models;

use PDO;
use Exception;

class Product extends BaseModel
{
    // =================================================================
    // TÌM KIẾM SẢN PHẨM (Public & Admin)
    // =================================================================
    public static function search(?string $categorySlug, ?string $q, int $page = 1, int $perPage = 16, $minPrice = null, $maxPrice = null, $brandName = null, $sort = 'newest', $status = 'active'): array
    {
        $where = [];
        $params = [];

        // Join bảng để lấy tên danh mục và thương hiệu
        $joinSql = "
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
        ";

        // 1. Lọc theo trạng thái
        // 'active': Chỉ lấy sp đang kinh doanh (cho khách)
        // 'inactive': Chỉ lấy sp ngừng kinh doanh
        // 'all': Lấy tất cả (cho admin)
        if ($status === 'active') {
            $where[] = 'p.is_active = 1';
        } elseif ($status === 'inactive') {
            $where[] = 'p.is_active = 0';
        }

        // 2. Lọc theo Danh mục
        if ($categorySlug && $categorySlug !== 'all') {
            $where[] = 'c.slug = ?';
            $params[] = $categorySlug;
        }

        // 3. Tìm kiếm từ khóa (Tên, Hãng, Mô tả)
        if ($q) {
            $keyword = '%' . trim($q) . '%';
            $where[] = '(p.title LIKE ? OR b.name LIKE ? OR p.description LIKE ?)';
            $params[] = $keyword;
            $params[] = $keyword;
            $params[] = $keyword;
        }

        // 4. Lọc khoảng giá
        if ($minPrice !== null && $minPrice !== '') {
            $where[] = 'p.price >= ?';
            $params[] = (int)$minPrice;
        }
        if ($maxPrice !== null && $maxPrice !== '') {
            $where[] = 'p.price <= ?';
            $params[] = (int)$maxPrice;
        }

        // 5. Lọc thương hiệu (chấp nhận nhiều brand cách nhau dấu phẩy)
        if ($brandName) {
            $brands = explode(',', $brandName);
            $placeholders = implode(',', array_fill(0, count($brands), '?'));
            $where[] = "b.name IN ($placeholders)";
            foreach ($brands as $brand) {
                $params[] = trim($brand);
            }
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        
        // Sắp xếp
        $orderBy = 'p.created_at DESC'; 
        switch ($sort) {
            case 'price_asc': $orderBy = 'p.price ASC'; break;
            case 'price_desc': $orderBy = 'p.price DESC'; break;
            default: $orderBy = 'p.created_at DESC'; break;
        }

        $offset = ($page - 1) * $perPage;

        try {
            // A. Đếm tổng số lượng (để phân trang)
            $stmt = self::db()->prepare("SELECT COUNT(*) as cnt FROM products p $joinSql $whereSql");
            $stmt->execute($params);
            $total = (int)$stmt->fetch()['cnt'];

            // B. Lấy danh sách sản phẩm
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
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // C. Lấy Variants (Biến thể) kèm theo
            if (!empty($items)) {
                $productIds = array_column($items, 'id');
                
                if (!empty($productIds)) {
                    $inQuery = implode(',', array_fill(0, count($productIds), '?'));
                    $vStmt = self::db()->prepare("SELECT * FROM product_variants WHERE product_id IN ($inQuery) ORDER BY price ASC");
                    $vStmt->execute($productIds);
                    $allVariants = $vStmt->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($items as &$item) {
                        $item['category'] = $item['category_slug'] ?? null;
                        $item['brand'] = $item['brand_name'] ?? null;
                        
                        // Lọc variants của sản phẩm hiện tại
                        $variantsRaw = array_filter($allVariants, function($v) use ($item) {
                            return $v['product_id'] == $item['id'];
                        });

                        $item['variants'] = array_values($variantsRaw);
                        
                        // VÒNG LẶP 1: Decode JSON attributes
                        // Dùng tham chiếu &$v để sửa trực tiếp mảng
                        foreach ($item['variants'] as &$v) {
                            if (!empty($v['attributes']) && is_string($v['attributes'])) {
                                $decoded = json_decode($v['attributes'], true);
                                $v['attributes'] = (json_last_error() === JSON_ERROR_NONE) ? $decoded : [];
                            } else {
                                $v['attributes'] = [];
                            }
                        }
                        // --- FIX QUAN TRỌNG: Ngắt tham chiếu để tránh lỗi nhân đôi dòng cuối ---
                        unset($v); 
                        
                        // VÒNG LẶP 2: Lấy danh sách màu sắc có sẵn
                        $colors = [];
                        foreach ($item['variants'] as $v) {
                            // Ưu tiên cột color, fallback vào attributes
                            $c = $v['color'] ?? ($v['attributes']['color'] ?? null);
                            if ($c) $colors[] = $c;
                        }
                        $item['color_list'] = array_unique($colors);
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

        } catch (\Throwable $e) {
            error_log("Search Error: " . $e->getMessage());
            return [
                'items' => [], 'total' => 0, 'page' => 1, 'per_page' => $perPage, 'total_page' => 0, 'error' => $e->getMessage()
            ];
        }
    }

    // =================================================================
    // CÁC HÀM TIỆN ÍCH KHÁC
    // =================================================================

    public static function getAllBrands(?string $categorySlug = null): array {
        if ($categorySlug && $categorySlug !== 'all') {
            $sql = "SELECT b.name FROM brands b JOIN brand_categories bc ON b.id = bc.brand_id JOIN categories c ON bc.category_id = c.id WHERE c.slug = ? ORDER BY b.name ASC";
            $stmt = self::db()->prepare($sql); $stmt->execute([$categorySlug]);
        } else {
            $sql = "SELECT name FROM brands ORDER BY name ASC";
            $stmt = self::db()->query($sql);
        }
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function find(int $id): ?array {
        $sql = "SELECT p.*, c.name as category_name, c.slug as category_slug, c.specs_template, b.name as brand_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = ?";
        $stmt = self::db()->prepare($sql); $stmt->execute([$id]); $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) return null;
        
        $product['category'] = $product['category_slug']; 
        $product['brand'] = $product['brand_name'];
        
        // Lấy ảnh
        $stmtImg = self::db()->prepare('SELECT image_url FROM product_images WHERE product_id = ?'); 
        $stmtImg->execute([$id]); 
        $images = $stmtImg->fetchAll(PDO::FETCH_COLUMN);
        
        if (!empty($product['image'])) array_unshift($images, $product['image']); 
        $product['gallery'] = array_unique($images);
        
        // Lấy variants
        try {
            $stmtVar = self::db()->prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY price ASC"); 
            $stmtVar->execute([$id]); 
            $product['variants'] = $stmtVar->fetchAll(PDO::FETCH_ASSOC);
            foreach ($product['variants'] as &$v) { 
                $v['attributes'] = !empty($v['attributes']) ? json_decode($v['attributes'], true) : []; 
            }
        } catch (\Throwable $e) { $product['variants'] = []; }
        
        return $product;
    }

    // --- CREATE SẢN PHẨM (Đã có is_active) ---
    public static function create($data) {
        $categoryId = !empty($data['category']) ? self::getCategoryIdBySlug($data['category']) : ($data['category_id'] ?? null);
        $brandId = !empty($data['brand']) ? self::getBrandIdByName($data['brand']) : ($data['brand_id'] ?? null);
        $specs = (isset($data['specs']) && is_array($data['specs'])) ? json_encode($data['specs'], JSON_UNESCAPED_UNICODE) : null;
        $price = !empty($data['price']) ? (int)$data['price'] : 0; 
        $stock = !empty($data['stock_quantity']) ? (int)$data['stock_quantity'] : 0;
        
        // Mặc định là kinh doanh (1)
        $isActive = isset($data['is_active']) ? (int)$data['is_active'] : 1;

        $stmt = self::db()->prepare("INSERT INTO products (title, category_id, brand_id, price, color, stock_quantity, compare_at, image, description, specs, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['title'], $categoryId, $brandId, $price, $data['color'] ?? null, 
            $stock, $data['compare_at']??null, $data['image']??'', $data['description']??'', $specs, $isActive
        ]);
        return self::db()->lastInsertId();
    }

    // --- UPDATE SẢN PHẨM (Đã có is_active) ---
    public static function update($id, $data) {
        if (isset($data['category'])) { $data['category_id'] = self::getCategoryIdBySlug($data['category']); unset($data['category']); }
        if (isset($data['brand'])) { $data['brand_id'] = self::getBrandIdByName($data['brand']); unset($data['brand']); }
        if (isset($data['specs']) && is_array($data['specs'])) { $data['specs'] = json_encode($data['specs'], JSON_UNESCAPED_UNICODE); }
        
        $fields = []; $values = []; 
        $allowed = ['title', 'category_id', 'brand_id', 'price', 'color', 'stock_quantity', 'compare_at', 'image', 'description', 'specs', 'is_active'];
        
        foreach ($data as $key => $val) { 
            if (in_array($key, $allowed)) { 
                $fields[] = "$key = ?"; 
                $values[] = $val; 
            } 
        }
        
        if (empty($fields)) return;
        
        $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?"; 
        $values[] = $id; 
        self::db()->prepare($sql)->execute($values);
    }

    public static function delete($id) { 
        self::db()->prepare("DELETE FROM products WHERE id = ?")->execute([$id]); 
    }

    // Helper functions
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