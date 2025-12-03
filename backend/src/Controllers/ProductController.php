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
    // =================================================================
    // HELPER
    // =================================================================
    private function normalizeColorInput($colorInput)
    {
        if ($colorInput === null || $colorInput === '') return null;

        if (is_array($colorInput)) {
            return json_encode(
                array_values(array_filter(array_map('trim', $colorInput))),
                JSON_UNESCAPED_UNICODE
            );
        }

        return json_encode(
            array_values(array_filter(array_map('trim', explode(',', $colorInput)))),
            JSON_UNESCAPED_UNICODE
        );
    }

    // =================================================================
    // PUBLIC APIS - LIST / FILTER
    // =================================================================

    public function index()
    {
        $q        = $this->request->query['q'] ?? null;
        $category = $this->request->query['category'] ?? null;
        $page     = (int)($this->request->query['page'] ?? 1);
        
        $res = Product::search(
            $category, 
            $q, 
            $page, 
            16, 
            $this->request->query['min_price'] ?? null, 
            $this->request->query['max_price'] ?? null, 
            $this->request->query['brand'] ?? null, 
            $this->request->query['sort'] ?? 'newest'
        );

        $this->json([
            'data'       => $res['items'],
            'page'       => $res['page'],
            'per_page'   => $res['per_page'],
            'total'      => $res['total'],
            'total_page' => $res['total_page'],
        ]);
    }

    public function getBrands()
    {
        $brands = Product::getAllBrands($this->request->query['category'] ?? null);
        $this->json(['data' => $brands]);
    }

    // =================================================================
    // PUBLIC APIS - SHOW PRODUCT (NHÓM ẢNH THEO MÀU)
    // =================================================================

    public function show(array $params)
    {
        $id = (int)$params['id'];
        $product = Product::find($id);
        
        if (!$product) {
            return $this->error('Product not found', 404);
        }

        // --- LOGIC MỚI: NHÓM ẢNH THEO MÀU ---
        // Lấy tất cả ảnh variant của sản phẩm
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT pi.image_url, pv.color, pv.attributes
            FROM product_images pi
            JOIN product_variants pv ON pi.product_variant_id = pv.id
            WHERE pi.product_id = ?
        ");
        $stmt->execute([$id]);
        $variantImages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Tạo map: 'Màu sắc' => [list image_url...]
        $colorGalleries = [];
        foreach ($variantImages as $img) {
            // Lấy màu từ cột color hoặc từ JSON attributes
            $color = $img['color'];

            if (!$color && !empty($img['attributes'])) {
                $attrs = json_decode($img['attributes'], true);
                $color = $attrs['color'] ?? 'default';
            }

            $color = $color ?: 'default'; // fallback nếu vẫn không có

            if (!isset($colorGalleries[$color])) {
                $colorGalleries[$color] = [];
            }

            // Tránh duplicate cùng 1 màu
            if (!in_array($img['image_url'], $colorGalleries[$color])) {
                $colorGalleries[$color][] = $img['image_url'];
            }
        }

        // Gắn thêm key color_galleries vào product
        $product['color_galleries'] = $colorGalleries;

        $this->json($product);
    }

    // =================================================================
    // ADMIN APIS - CRUD PRODUCT
    // =================================================================

    public function store()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        
        if (empty($b['title']) || empty($b['price'])) {
            return $this->error('Thiếu thông tin', 422);
        }

        if (isset($b['color'])) {
            $b['color'] = $this->normalizeColorInput($b['color']);
        }

        try {
            $id = Product::create($b);
            $this->json([
                'success' => true,
                'message' => 'Thêm thành công',
                'id'      => $id
            ], 201);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    public function update(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b  = $this->request->body;
        
        if (!Product::find($id)) {
            return $this->error('Không tồn tại', 404);
        }

        if (isset($b['color'])) {
            $b['color'] = $this->normalizeColorInput($b['color']);
        }

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
            $p = Product::find($id);
            if (!$p) {
                return $this->error('Không tồn tại', 404);
            }

            // Xóa ảnh chính
            if (!empty($p['image']) && !str_contains($p['image'], 'http')) {
                @unlink(__DIR__ . '/../../../frontend/' . $p['image']);
            }

            // Nếu trong bảng products có field gallery (mảng json) thì xử lý thêm ở đây
            if (!empty($p['gallery']) && is_array($p['gallery'])) {
                foreach ($p['gallery'] as $img) {
                    if (!str_contains($img, 'http')) {
                        @unlink(__DIR__ . '/../../../frontend/' . $img);
                    }
                }
            }

            Product::delete($id);
            $this->json(['success' => true, 'message' => 'Đã xóa']);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    // =================================================================
    // IMAGE HANDLING (CÓ GẮN VARIANT / MÀU)
    // =================================================================

    public function uploadImage(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];  // product_id

        // Nhận thêm variant_id (nếu có) từ form-data
        $variantId = !empty($_POST['variant_id']) ? (int)$_POST['variant_id'] : null;

        if (empty($_FILES['image'])) {
            return $this->error('Chưa chọn file', 400);
        }
        
        $file = $_FILES['image'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
            return $this->error('File lỗi', 400);
        }
        
        // Tên file: p{id}_v{variantId}_timestamp.ext (nếu có variant)
        $vTag     = $variantId ? "_v{$variantId}" : "";
        $fileName = "p{$id}{$vTag}_" . time() . rand(1000, 9999) . "." . $ext;
        $uploadDir = __DIR__ . '/../../../frontend/assets/images/products/';
        
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        if (move_uploaded_file($file['tmp_name'], $uploadDir . $fileName)) {
            $url = "assets/images/products/$fileName";

            $db = Database::getConnection();
            
            // Insert vào bảng product_images
            $stmt = $db->prepare("
                INSERT INTO product_images (product_id, product_variant_id, image_url)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$id, $variantId, $url]);

            // Nếu upload cho variant (tức là cho một màu/biến thể)
            if ($variantId) {
                // Tìm màu của variant hiện tại
                $stmtColor = $db->prepare("SELECT color, attributes FROM product_variants WHERE id = ?");
                $stmtColor->execute([$variantId]);
                $currentRow = $stmtColor->fetch(PDO::FETCH_ASSOC);
                
                if ($currentRow) {
                    $color = $currentRow['color'];

                    // Nếu cột color đang trống thì đọc trong attributes JSON
                    if (!$color && !empty($currentRow['attributes'])) {
                        $attrs = json_decode($currentRow['attributes'], true);
                        $color = $attrs['color'] ?? '';
                    }

                    if ($color) {
                        // Cập nhật ảnh đại diện cho variant hiện tại nếu chưa có
                        $db->prepare("
                            UPDATE product_variants 
                            SET image = ? 
                            WHERE id = ? AND (image IS NULL OR image = '')
                        ")->execute([$url, $variantId]);

                        // (Tuỳ chọn) Có thể update ảnh cho các variant khác cùng màu,
                        // nếu muốn đồng bộ thumbnail theo màu.
                    }
                }
            } else {
                // Upload ảnh chung cho product
                $p = Product::find($id);
                if (empty($p['image']) || str_contains($p['image'], 'placeholder')) {
                    Product::update($id, ['image' => $url]);
                }
            }

            $this->json(['success' => true, 'url' => $url]);
        } else {
            $this->error('Lỗi lưu file', 500);
        }
    }

    public function deleteImage() 
    {
        // Logic giữ nguyên nhưng dùng bảng product_images
        AdminMiddleware::guard($this->request, $this->response);
        $url = $this->request->body['image_url'] ?? null;

        if (!$url) {
            return $this->error('Thiếu URL');
        }

        try {
            $db = Database::getConnection();
            $db->prepare("DELETE FROM product_images WHERE image_url = ?")->execute([$url]);

            if (!str_contains($url, 'http')) {
                @unlink(__DIR__ . '/../../../frontend/' . $url);
            }

            $this->json(['success' => true]);
        } catch (\Exception $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    // =================================================================
    // VARIANT MANAGEMENT (ADMIN)
    // =================================================================

    public function getVariants(array $params)
    {
        $id = (int)$params['id'];
        $variants = ProductVariant::getByProductId($id);
        $db = Database::getConnection();

        // Lấy tất cả ảnh variant (có product_variant_id)
        $stmt = $db->prepare("
            SELECT image_url, product_variant_id 
            FROM product_images 
            WHERE product_id = ? AND product_variant_id IS NOT NULL
        ");
        $stmt->execute([$id]);
        $allImages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($variants as &$v) {
            // Decode attributes JSON -> array
            $v['attributes'] = !empty($v['attributes'])
                ? json_decode($v['attributes'], true)
                : [];

            // Gắn gallery cho từng variant theo product_variant_id
            $v['gallery'] = array_values(
                array_map(
                    fn($img) => $img['image_url'],
                    array_filter(
                        $allImages,
                        fn($img) => $img['product_variant_id'] == $v['id']
                    )
                )
            );
        }

        $this->json(['data' => $variants]);
    }

    public function saveVariants(array $params)
    {
        // Logic mới: lưu color/capacity riêng, dọn product_images khi xóa variant
        AdminMiddleware::guard($this->request, $this->response);
        $productId = (int)$params['id'];
        $b         = $this->request->body;

        if (!is_array($b)) {
            return $this->error('Dữ liệu lỗi', 422);
        }

        try {
            $db = Database::getConnection();
            $db->beginTransaction();

            $current    = ProductVariant::getByProductId($productId);
            $currentIds = array_column($current, 'id');
            $sentIds    = [];

            foreach ($b as $item) {
                if (empty($item['price'])) {
                    continue;
                }

                // attributes là JSON tổng hợp (color, capacity, …)
                $attrs = !empty($item['attributes'])
                    ? json_encode($item['attributes'], JSON_UNESCAPED_UNICODE)
                    : null;

                // Lưu riêng color, capacity để query cho nhanh
                $colorVal = $item['attributes']['color']    ?? '';
                $capVal   = $item['attributes']['capacity'] ?? '';

                $data = [
                    $attrs,                        // attributes
                    $colorVal,                     // color
                    $capVal,                       // capacity
                    (float)$item['price'],         // price
                    (int)($item['stock_quantity'] ?? 0), // stock_quantity
                    $item['sku']   ?? null,        // sku
                    $item['image'] ?? null         // image
                ];

                if (isset($item['id']) && in_array($item['id'], $currentIds)) {
                    // UPDATE
                    $sql = "
                        UPDATE product_variants
                        SET attributes = ?, color = ?, capacity = ?, 
                            price = ?, stock_quantity = ?, sku = ?, image = ?
                        WHERE id = ?
                    ";
                    $db->prepare($sql)->execute([...$data, $item['id']]);
                    $sentIds[] = $item['id'];
                } else {
                    // INSERT
                    $sql = "
                        INSERT INTO product_variants 
                            (product_id, attributes, color, capacity, price, stock_quantity, sku, image)
                        VALUES 
                            (?, ?, ?, ?, ?, ?, ?, ?)
                    ";
                    $db->prepare($sql)->execute([$productId, ...$data]);
                    $sentIds[] = $db->lastInsertId();
                }
            }

            // Xóa những variant không còn trong payload
            $toDelete = array_diff($currentIds, $sentIds);
            if (!empty($toDelete)) {
                $ids = implode(',', array_map('intval', $toDelete));
                // Xóa variant
                $db->exec("DELETE FROM product_variants WHERE id IN ($ids)");
                // Xóa luôn ảnh gắn với các variant này
                $db->exec("DELETE FROM product_images WHERE product_variant_id IN ($ids)");
            }

            // Cập nhật tổng tồn kho cho product
            $total = $db->query("
                SELECT SUM(stock_quantity) 
                FROM product_variants 
                WHERE product_id = {$productId}
            ")->fetchColumn();

            $db->prepare("
                UPDATE products 
                SET stock_quantity = ? 
                WHERE id = ?
            ")->execute([(int)$total, $productId]);

            $db->commit();
            $this->json(['success' => true]);
        } catch (\Exception $e) {
            if (isset($db)) {
                $db->rollBack();
            }
            $this->error($e->getMessage(), 500);
        }
    }
}
