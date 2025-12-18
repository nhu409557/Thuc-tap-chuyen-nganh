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

    // THÊM VÀO GIỎ
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

        // 1. Kiểm tra tồn kho thực tế của sản phẩm/biến thể
        $stock = $this->checkStock($productId, $variantId);

        if ($stock === false) {
            return $this->error('Sản phẩm không tồn tại', 404);
        }

        // 2. Lấy số lượng sản phẩm này ĐANG CÓ trong giỏ hàng
        $currentInCart = CartItem::getQuantity($userId, $productId, $variantId);

        // 3. RÀNG BUỘC CHẶT CHẼ: (Trong giỏ + Muốn mua thêm) không được quá tồn kho
        if (($currentInCart + $qty) > $stock) {
            $availableToAdd = $stock - $currentInCart;
            if ($availableToAdd <= 0) {
                return $this->error("Sản phẩm đã hết hàng (Bạn đang giữ {$currentInCart} trong giỏ).", 400);
            }
            return $this->error("Kho chỉ còn {$stock}. Bạn đã có {$currentInCart} trong giỏ, chỉ có thể thêm tối đa {$availableToAdd}.", 400);
        }

        CartItem::addOrUpdate($userId, $productId, $qty, $variantId);
        
        $this->json(['success' => true, 'message' => 'Đã thêm vào giỏ']);
    }

    // CẬP NHẬT SỐ LƯỢNG (KHI BẤM NÚT +/- Ở GIỎ HÀNG)
    public function update(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        $b = $this->request->body;
        
        if (!isset($b['quantity'])) return $this->error('Thiếu quantity', 422);
        
        $newQty = (int)$b['quantity'];

        // 🛡️ BẢO MẬT: Phải check tồn kho trước khi cho update
        $db = \App\Config\Database::getConnection();
        $stmt = $db->prepare("SELECT product_id, product_variant_id FROM cart_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        $item = $stmt->fetch();

        if (!$item) {
            return $this->error('Không tìm thấy sản phẩm trong giỏ', 404);
        }

        if ($newQty > 0) {
            $stock = $this->checkStock($item['product_id'], $item['product_variant_id']);
            if ($newQty > $stock) {
                 return $this->error("Kho chỉ còn $stock sản phẩm", 400);
            }
        }

        CartItem::updateQuantity($id, $newQty, $userId);
        $this->json(['success' => true]);
    }

    public function destroy(array $params) {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        CartItem::remove($id, $userId);
        $this->json(['success' => true]);
    }

    // Helper function để lấy tồn kho nhanh
    private function checkStock($productId, $variantId) {
        $db = \App\Config\Database::getConnection();
        if ($variantId) {
            $stmt = $db->prepare("SELECT stock_quantity FROM product_variants WHERE id = ?");
            $stmt->execute([$variantId]);
        } else {
            $stmt = $db->prepare("SELECT stock_quantity FROM products WHERE id = ?");
            $stmt->execute([$productId]);
        }
        return $stmt->fetchColumn(); 
    }
}