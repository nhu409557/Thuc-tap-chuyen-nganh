<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Config\Database;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Middleware\AdminMiddleware;
use PDO;

class ProductController extends Controller
{
    // ... (Giữ nguyên phần normalizeColorInput) ...
    private function normalizeColorInput($colorInput)
    {
        if ($colorInput === null || $colorInput === '') return null;
        if (is_array($colorInput)) {
            return json_encode(array_values(array_filter(array_map('trim', $colorInput))), JSON_UNESCAPED_UNICODE);
        }
        return json_encode(array_values(array_filter(array_map('trim', explode(',', $colorInput)))), JSON_UNESCAPED_UNICODE);
    }

    // =================================================================
    // PUBLIC APIS
    // =================================================================

    public function index()
    {
        $q        = $this->request->query['q'] ?? null;
        $category = $this->request->query['category'] ?? null;
        $page     = (int)($this->request->query['page'] ?? 1);
        $minPrice = $this->request->query['min_price'] ?? null;
        $maxPrice = $this->request->query['max_price'] ?? null;
        $brand    = $this->request->query['brand'] ?? null;
        $sort     = $this->request->query['sort'] ?? 'newest';
        $status   = $this->request->query['status'] ?? 'active'; 
        
        // --- THAY ĐỔI Ở ĐÂY: Đổi 16 thành 20 ---
        $res = Product::search($category, $q, $page, 20, $minPrice, $maxPrice, $brand, $sort, $status);

        $this->json([
            'data'       => $res['items'],
            'page'       => $res['page'],
            'per_page'   => $res['per_page'],
            'total'      => $res['total'],
            'total_page' => $res['total_page'],
        ]);
    }

    // ... (Giữ nguyên các hàm còn lại: getBrands, show, store, update, destroy...) ...
    public function getBrands()
    {
        $brands = Product::getAllBrands($this->request->query['category'] ?? null);
        $this->json(['data' => $brands]);
    }

    public function show(array $params)
    {
        $id = (int)$params['id'];
        $product = Product::find($id);
        
        if (!$product) return $this->error('Product not found', 404);

        $db = Database::getConnection();

        // 1. Ảnh chung
        $stmtShared = $db->prepare("SELECT image_url FROM product_images WHERE product_id = ? AND product_variant_id IS NULL");
        $stmtShared->execute([$id]);
        $sharedGallery = $stmtShared->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($product['image']) && !in_array($product['image'], $sharedGallery)) {
            array_unshift($sharedGallery, $product['image']);
        }

        // 2. Ảnh biến thể
        $stmtVarImg = $db->prepare("
            SELECT pi.image_url, pv.color, pv.attributes
            FROM product_images pi
            JOIN product_variants pv ON pi.product_variant_id = pv.id
            WHERE pi.product_id = ?
        ");
        $stmtVarImg->execute([$id]);
        $variantImages = $stmtVarImg->fetchAll(PDO::FETCH_ASSOC);

        $colorGalleries = [];
        foreach ($variantImages as $img) {
            $color = $img['color'];
            if (!$color && !empty($img['attributes'])) {
                $attrs = json_decode($img['attributes'], true);
                $color = $attrs['color'] ?? 'default';
            }
            $color = $color ?: 'default';

            if (!isset($colorGalleries[$color])) $colorGalleries[$color] = [];
            if (!in_array($img['image_url'], $colorGalleries[$color])) $colorGalleries[$color][] = $img['image_url'];
        }

        if (!empty($product['variants'])) {
            foreach ($product['variants'] as $v) {
                $attrs = !empty($v['attributes']) ? $v['attributes'] : [];
                $c = $v['color'] ?? ($attrs['color'] ?? 'default');
                if (empty($colorGalleries[$c])) $colorGalleries[$c] = $sharedGallery;
            }
        }

        $product['shared_gallery'] = $sharedGallery;
        $product['color_galleries'] = $colorGalleries;

        $this->json($product);
    }

    public function store()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        
        if (empty($b['title'])) return $this->error('Thiếu tên sản phẩm', 422);

        if (isset($b['color'])) $b['color'] = $this->normalizeColorInput($b['color']);
        if (isset($b['is_active'])) $b['is_active'] = (int)$b['is_active'];

        try {
            $id = Product::create($b);
            $this->json(['success' => true, 'message' => 'Thêm thành công', 'id' => $id], 201);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    public function update(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b  = $this->request->body;
        
        if (!Product::find($id)) return $this->error('Không tồn tại', 404);

        try {
            $variants = ProductVariant::getByProductId($id);
            if (!empty($variants)) {
                if (isset($b['stock_quantity'])) unset($b['stock_quantity']);
                $db = Database::getConnection();
                $totalStock = $db->query("SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = $id")->fetchColumn();
                $b['stock_quantity'] = (int)$totalStock;
            }
        } catch (\Exception $e) {}

        if (isset($b['color'])) $b['color'] = $this->normalizeColorInput($b['color']);
        if (isset($b['is_active'])) $b['is_active'] = (int)$b['is_active'];

        try {
            Product::update($id, $b);
            $this->json(['success' => true, 'message' => 'Cập nhật thành công']);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    public function destroy(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        
        try {
            if (!Product::find($id)) return $this->error('Không tồn tại', 404);
            Product::delete($id);
            $this->json(['success' => true, 'message' => 'Đã xóa sản phẩm']);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    public function uploadImage(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $variantId = !empty($_POST['variant_id']) ? (int)$_POST['variant_id'] : null;

        if (empty($_FILES['image'])) return $this->error('Chưa chọn file', 400);
        
        $file = $_FILES['image'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) return $this->error('File không hợp lệ', 400);
        
        $vTag     = $variantId ? "_v{$variantId}" : "_shared";
        $fileName = "p{$id}{$vTag}_" . time() . rand(1000, 9999) . "." . $ext;
        $uploadDir = __DIR__ . '/../../../frontend/assets/images/products/';
        
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        
        if (move_uploaded_file($file['tmp_name'], $uploadDir . $fileName)) {
            $url = "assets/images/products/$fileName";
            $db = Database::getConnection();
            
            $stmt = $db->prepare("INSERT INTO product_images (product_id, product_variant_id, image_url) VALUES (?, ?, ?)");
            $stmt->execute([$id, $variantId, $url]);

            if ($variantId) {
                $db->prepare("UPDATE product_variants SET image = ? WHERE id = ? AND (image IS NULL OR image = '')")->execute([$url, $variantId]);
            } else {
                $p = Product::find($id);
                if (empty($p['image']) || str_contains($p['image'], 'placehold')) {
                    Product::update($id, ['image' => $url]);
                }
            }
            $this->json(['success' => true, 'url' => $url]);
        } else {
            $this->error('Lỗi lưu file trên server', 500);
        }
    }

    public function deleteImage() 
    {
        AdminMiddleware::guard($this->request, $this->response);
        $url = $this->request->body['image_url'] ?? null;
        if (!$url) return $this->error('Thiếu URL ảnh');

        try {
            $db = Database::getConnection();
            $db->prepare("DELETE FROM product_images WHERE image_url = ?")->execute([$url]);
            $db->prepare("UPDATE products SET image = NULL WHERE image = ?")->execute([$url]);
            $db->prepare("UPDATE product_variants SET image = NULL WHERE image = ?")->execute([$url]);

            if (!str_contains($url, 'http://') && !str_contains($url, 'https://')) {
                $baseDir = __DIR__ . '/../../../frontend/';
                $cleanUrl = ltrim($url, '/\\');
                $filePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $baseDir . $cleanUrl);
                if (file_exists($filePath)) unlink($filePath);
            }
            $this->json(['success' => true]);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    public function getVariants(array $params)
    {
        $id = (int)$params['id'];
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY price ASC");
        $stmt->execute([$id]);
        $variants = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtImg = $db->prepare("SELECT image_url, product_variant_id FROM product_images WHERE product_id = ? AND product_variant_id IS NOT NULL");
        $stmtImg->execute([$id]);
        $allImages = $stmtImg->fetchAll(PDO::FETCH_ASSOC);

        foreach ($variants as &$v) {
            $v['attributes'] = !empty($v['attributes']) ? json_decode($v['attributes'], true) : [];
            $v['gallery'] = array_values(array_map(
                fn($img) => $img['image_url'],
                array_filter($allImages, fn($img) => $img['product_variant_id'] == $v['id'])
            ));
        }
        $this->json(['data' => $variants]);
    }

    public function saveVariants(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $productId = (int)$params['id'];
        $b         = $this->request->body;

        if (!is_array($b)) return $this->error('Dữ liệu lỗi format', 422);

        try {
            $db = Database::getConnection();
            $db->beginTransaction();

            $stmtCurrent = $db->prepare("SELECT id FROM product_variants WHERE product_id = ?");
            $stmtCurrent->execute([$productId]);
            $currentIds = $stmtCurrent->fetchAll(PDO::FETCH_COLUMN);
            
            $sentIds = [];

            foreach ($b as $item) {
                if (!isset($item['price'])) continue;

                $rawColorCode = $item['color_code'] ?? ($item['attributes']['color_code'] ?? null);
                $colorCode = ($rawColorCode === '' || $rawColorCode === 'null') ? null : $rawColorCode;

                $attributesData = $item['attributes'] ?? [];
                if (isset($attributesData['color_code'])) unset($attributesData['color_code']);
                $attrs = !empty($attributesData) ? json_encode($attributesData, JSON_UNESCAPED_UNICODE) : null;

                $colorVal = $item['attributes']['color'] ?? ($item['color'] ?? '');
                $capVal   = $item['attributes']['capacity'] ?? ($item['capacity'] ?? '');
                
                $compareAt = isset($item['compare_at']) && $item['compare_at'] !== '' ? (float)$item['compare_at'] : null;

                $data = [
                    $attrs, 
                    $colorVal,
                    $colorCode,
                    $capVal, 
                    (float)$item['price'],
                    $compareAt,
                    (int)($item['stock_quantity'] ?? 0), 
                    $item['sku'] ?? null, 
                    $item['image'] ?? null
                ];

                if (isset($item['id']) && in_array($item['id'], $currentIds)) {
                    $sql = "UPDATE product_variants SET attributes=?, color=?, color_code=?, capacity=?, price=?, compare_at=?, stock_quantity=?, sku=?, image=? WHERE id=?";
                    $db->prepare($sql)->execute([...$data, $item['id']]);
                    $sentIds[] = $item['id'];
                } else {
                    $sql = "INSERT INTO product_variants (product_id, attributes, color, color_code, capacity, price, compare_at, stock_quantity, sku, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    $db->prepare($sql)->execute([$productId, ...$data]);
                    $sentIds[] = $db->lastInsertId();
                }
            }

            $toDelete = array_diff($currentIds, $sentIds);
            if (!empty($toDelete)) {
                $ids = implode(',', array_map('intval', $toDelete));
                $db->exec("DELETE FROM product_variants WHERE id IN ($ids)");
            }

            $total = $db->query("SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = {$productId}")->fetchColumn();
            $db->prepare("UPDATE products SET stock_quantity = ? WHERE id = ?")->execute([(int)$total, $productId]);

            $db->commit();
            $this->json(['success' => true]);
        } catch (\Exception $e) {
            if (isset($db)) $db->rollBack();
            $this->error($e->getMessage(), 500);
        }
    }
}