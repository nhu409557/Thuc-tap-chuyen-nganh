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

        CartItem::addOrUpdate($userId, (int)$b['product_id'], (int)$b['quantity']);
        $this->json(['success' => true]);
    }

    public function update(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        $b = $this->request->body;

        if (!isset($b['quantity'])) {
            return $this->error('Thiếu quantity', 422);
        }

        CartItem::updateQuantity($id, (int)$b['quantity'], $userId);
        $this->json(['success' => true]);
    }

    public function destroy(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        CartItem::remove($id, $userId);
        $this->json(['success' => true]);
    }
}
