<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Wishlist;
use App\Middleware\AuthMiddleware;

class WishlistController extends Controller
{
    public function index()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $items = Wishlist::allByUser($userId);
        $this->json(['data' => $items]);
    }

    public function store()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        if (empty($b['product_id'])) {
            return $this->error('Thiếu product_id', 422);
        }

        Wishlist::add($userId, (int)$b['product_id']);
        $this->json(['success' => true]);
    }

    public function destroy(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        Wishlist::remove($id, $userId);
        $this->json(['success' => true]);
    }
}