<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Category;
use App\Middleware\AdminMiddleware;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::all();
        $this->json(['data' => $categories]);
    }
    
    // 👇 THÊM API SHOW ĐỂ LẤY CHI TIẾT (Dùng khi bấm nút Sửa)
    public function show(array $params)
    {
        $id = (int)$params['id'];
        $category = Category::find($id);
        if (!$category) return $this->error('Không tìm thấy', 404);
        
        // Decode JSON specs_template ra lại mảng để Frontend dễ dùng
        if (!empty($category['specs_template'])) {
            $category['specs_template'] = json_decode($category['specs_template'], true);
        }
        
        $this->json($category);
    }

    public function store()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        if (empty($b['name']) || empty($b['slug'])) return $this->error('Thiếu tên hoặc slug', 422);

        $specs = $b['specs_template'] ?? null;
        $icon = $b['icon'] ?? '📦'; // Mặc định

        try {
            Category::create($b['name'], $b['slug'], $specs, $icon);
            $this->json(['success' => true, 'message' => 'Đã thêm danh mục']);
        } catch (\Exception $e) { $this->error($e->getMessage(), 500); }
    }

    public function update(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;
        if (empty($b['name']) || empty($b['slug'])) return $this->error('Thiếu tên hoặc slug', 422);

        $specs = $b['specs_template'] ?? null;
        $icon = $b['icon'] ?? '📦';

        try {
            Category::update($id, $b['name'], $b['slug'], $specs, $icon);
            $this->json(['success' => true, 'message' => 'Cập nhật thành công']);
        } catch (\Exception $e) { $this->error($e->getMessage(), 500); }
    }

    public function destroy(array $params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        Category::delete($id);
        $this->json(['success' => true, 'message' => 'Đã xóa danh mục']);
    }
}