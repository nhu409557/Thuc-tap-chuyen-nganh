<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\CartItem;
use App\Middleware\AuthMiddleware;

class CartController extends Controller
{
    public function index()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $items = CartItem::allByUser($userId);
        $this->json(['data' => $items]);
    }

    public function store()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        if (empty($b['product_id']) || empty($b['quantity'])) {
            return $this->error('Thiếu product_id hoặc quantity', 422);
        }

        $productId = (int)$b['product_id'];
        $qty = (int)$b['quantity'];
        $variantId = !empty($b['variant_id']) ? (int)$b['variant_id'] : null;

        // 👇 BỔ SUNG: KIỂM TRA TỒN KHO TRƯỚC KHI THÊM
        $db = \App\Config\Database::getConnection();
        
        if ($variantId) {
            // Kiểm tra tồn kho của biến thể
            $stmt = $db->prepare("SELECT stock_quantity FROM product_variants WHERE id = ?");
            $stmt->execute([$variantId]);
            $stock = $stmt->fetchColumn();
        } else {
            // Kiểm tra tồn kho của sản phẩm gốc (nếu không có biến thể)
            $stmt = $db->prepare("SELECT stock_quantity FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $stock = $stmt->fetchColumn();
        }

        if ($stock === false) {
            return $this->error('Sản phẩm không tồn tại', 404);
        }

        if ($stock < $qty) {
            return $this->error("Sản phẩm này đã hết hàng (Còn: $stock)", 400);
        }
        // 👆 KẾT THÚC KIỂM TRA

        CartItem::addOrUpdate($userId, $productId, $qty, $variantId);
        
        $this->json(['success' => true, 'message' => 'Đã thêm vào giỏ']);
    }

    // ... (Giữ nguyên update, destroy như cũ)
    public function update(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        $b = $this->request->body;
        if (!isset($b['quantity'])) return $this->error('Thiếu quantity', 422);
        CartItem::updateQuantity($id, (int)$b['quantity'], $userId);
        $this->json(['success' => true]);
    }

    public function destroy(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        CartItem::remove($id, $userId);
        $this->json(['success' => true]);
    }
}