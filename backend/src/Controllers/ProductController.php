<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Product;
use App\Middleware\AdminMiddleware;

class ProductController extends Controller
{
    // 1. LẤY DANH SÁCH SẢN PHẨM (SEARCH & FILTER)
    public function index()
    {
        $q = $this->request->query['q'] ?? null;
        $category = $this->request->query['category'] ?? null;
        $page = (int)($this->request->query['page'] ?? 1);
        
        $minPrice = $this->request->query['min_price'] ?? null;
        $maxPrice = $this->request->query['max_price'] ?? null;
        $brand = $this->request->query['brand'] ?? null;
        
        // 👇 NHẬN THAM SỐ SORT
        $sort = $this->request->query['sort'] ?? 'newest'; 

        // Gọi Model xử lý (truyền thêm biến $sort)
        $res = Product::search($category, $q, $page, 16, $minPrice, $maxPrice, $brand, $sort);

        $this->json([
            'data' => $res['items'],
            'page' => $res['page'],
            'per_page' => $res['per_page'],
            'total' => $res['total'],
            'total_page' => $res['total_page'],
        ]);
    }

    // 2. LẤY DANH SÁCH THƯƠNG HIỆU
    public function getBrands()
    {
        $category = $this->request->query['category'] ?? null;
        $brands = Product::getAllBrands($category);
        $this->json(['data' => $brands]);
    }

    // 3. XEM CHI TIẾT MỘT SẢN PHẨM
    public function show(array $params)
    {
        $id = (int)($params['id'] ?? 0);
        $product = Product::find($id);
        
        if (!$product) {
            return $this->error('Product not found', 404);
        }
        $this->json($product);
    }

    // 4. THÊM SẢN PHẨM MỚI (ADMIN)
    public function store()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        
        if (empty($b['title']) || empty($b['price'])) {
            return $this->error('Tên và giá sản phẩm là bắt buộc', 422);
        }

        $id = Product::create($b);
        
        $this->json([
            'success' => true, 
            'message' => 'Thêm sản phẩm thành công', 
            'id' => $id
        ], 201);
    }

    // 5. CẬP NHẬT SẢN PHẨM (ADMIN)
    public function update(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;

        $product = Product::find($id);
        if (!$product) return $this->error('Sản phẩm không tồn tại', 404);

        Product::update($id, $b);
        
        $this->json(['success' => true, 'message' => 'Cập nhật thành công']);
    }

    // 6. XÓA SẢN PHẨM (ADMIN)
    public function destroy(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $product = Product::find($id);

        if (!$product) return $this->error('Sản phẩm không tồn tại', 404);

        if (!empty($product['image']) && strpos($product['image'], 'http') === false) {
            $filePath = __DIR__ . '/../../../frontend/' . $product['image'];
            if (file_exists($filePath)) unlink($filePath);
        }

        if (!empty($product['gallery']) && is_array($product['gallery'])) {
            foreach ($product['gallery'] as $img) {
                if (strpos($img, 'http') === false) {
                    $filePath = __DIR__ . '/../../../frontend/' . $img;
                    if (file_exists($filePath)) unlink($filePath);
                }
            }
        }

        Product::delete($id);
        $this->json(['success' => true, 'message' => 'Đã xóa sản phẩm và ảnh liên quan']);
    }

    // 7. UPLOAD ẢNH SẢN PHẨM
    public function uploadImage(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $product = Product::find($id);
        
        if (!$product) return $this->error('Sản phẩm không tồn tại', 404);

        if (!isset($_FILES['image'])) {
            return $this->error('Không tìm thấy file "image"', 400);
        }
        
        if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            return $this->error("Lỗi Upload: " . $_FILES['image']['error'], 400);
        }

        $targetDir = __DIR__ . '/../../../frontend/assets/images/products/';

        if (!file_exists($targetDir)) {
            if (!mkdir($targetDir, 0777, true)) {
                return $this->error('Lỗi Server: Không thể tạo thư mục lưu ảnh', 500);
            }
        }

        $extension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $fileName = 'p' . $id . '_' . time() . '.' . $extension; 
        $destPath = $targetDir . $fileName;

        if (move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
            $publicUrl = 'assets/images/products/' . $fileName;
            
            $db = \App\Config\Database::getConnection();
            $stmt = $db->prepare("INSERT INTO product_images (product_id, image_url) VALUES (?, ?)");
            $stmt->execute([$id, $publicUrl]);

            if (empty($product['image']) || strpos($product['image'], 'placeholder') !== false) {
                $stmtUpdate = $db->prepare("UPDATE products SET image = ? WHERE id = ?");
                $stmtUpdate->execute([$publicUrl, $id]);
            }

            $this->json([
                'success' => true, 
                'message' => 'Upload thành công', 
                'url' => $publicUrl
            ]);
        } else {
            return $this->error('Lỗi: Không thể di chuyển file.', 500);
        }
    }

    // 8. XÓA ẢNH PHỤ
    public function deleteImage(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        $imageUrl = $b['image_url'] ?? null;
        
        if (empty($imageUrl)) return $this->error('Thiếu đường dẫn ảnh', 422);

        $db = \App\Config\Database::getConnection();

        $stmt = $db->prepare("SELECT id FROM product_images WHERE image_url = ?");
        $stmt->execute([$imageUrl]);
        $img = $stmt->fetch();

        if ($img) {
            $stmtDel = $db->prepare("DELETE FROM product_images WHERE id = ?");
            $stmtDel->execute([$img['id']]);
        } else {
            $stmtProd = $db->prepare("SELECT id FROM products WHERE image = ?");
            $stmtProd->execute([$imageUrl]);
            $prod = $stmtProd->fetch();
            
            if ($prod) {
                $defaultImg = 'https://via.placeholder.com/300';
                $stmtUpdate = $db->prepare("UPDATE products SET image = ? WHERE id = ?");
                $stmtUpdate->execute([$defaultImg, $prod['id']]);
            }
        }

        if (strpos($imageUrl, 'http') === false) { 
            $filePath = __DIR__ . '/../../../frontend/' . $imageUrl;
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }

        $this->json(['success' => true, 'message' => 'Đã xóa ảnh']);
    }
}