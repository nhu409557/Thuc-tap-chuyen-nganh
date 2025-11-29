<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Brand;
use App\Middleware\AdminMiddleware;

class BrandController extends Controller
{
    public function index()
    {
        $brands = Brand::all();
        $this->json(['data' => $brands]);
    }

    public function store()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;

        if (empty($b['name'])) {
            return $this->error('Tên hãng là bắt buộc', 422);
        }

        // Xử lý categories (frontend có thể gửi mảng hoặc chuỗi)
        $cats = [];
        if (!empty($b['categories'])) {
            $cats = is_array($b['categories']) ? $b['categories'] : explode(',', $b['categories']);
        }

        Brand::create($b['name'], $cats);
        $this->json(['success' => true, 'message' => 'Đã thêm hãng mới']);
    }

    public function update(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;

        if (empty($b['name'])) {
            return $this->error('Tên hãng là bắt buộc', 422);
        }

        $cats = [];
        if (!empty($b['categories'])) {
            $cats = is_array($b['categories']) ? $b['categories'] : explode(',', $b['categories']);
        }

        Brand::update($id, $b['name'], $cats);
        $this->json(['success' => true, 'message' => 'Cập nhật thành công']);
    }

    public function destroy(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        Brand::delete($id);
        $this->json(['success' => true, 'message' => 'Đã xóa hãng']);
    }
}