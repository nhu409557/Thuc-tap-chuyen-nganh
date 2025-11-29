<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Address;
use App\Middleware\AuthMiddleware;

class AddressController extends Controller
{
    public function index()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $items = Address::allByUser($userId);
        $this->json(['data' => $items]);
    }

    public function store()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;
        
        $requiredFields = ['full_name', 'phone', 'province', 'district', 'ward', 'street_address'];
        foreach ($requiredFields as $field) {
            if (empty($b[$field])) {
                return $this->error("Vui lòng điền đầy đủ thông tin", 422);
            }
        }

        $id = Address::create($userId, $b);
        $this->json(['success' => true, 'id' => $id], 201);
    }

    public function update(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        $b = $this->request->body;

        Address::update($id, $userId, $b);
        $this->json(['success' => true]);
    }

    public function destroy(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        Address::delete($id, $userId);
        $this->json(['success' => true]);
    }

    public function setDefault(array $params)
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $id = (int)($params['id'] ?? 0);
        Address::setDefault($id, $userId);
        $this->json(['success' => true]);
    }
}