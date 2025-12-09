<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\User;
use App\Middleware\AdminMiddleware;

class UserController extends Controller
{
    // Lấy danh sách (Có phân trang)
    public function index()
    {
        // Chỉ admin mới được xem danh sách user
        AdminMiddleware::guard($this->request, $this->response);
        
        // 1. Lấy trang hiện tại (mặc định là 1)
        $page = isset($this->request->query['page']) ? (int)$this->request->query['page'] : 1;
        if ($page < 1) $page = 1;

        // 2. Cấu hình số lượng mỗi trang
        $limit  = 10;
        $offset = ($page - 1) * $limit;

        // 3. Lấy dữ liệu và tổng số
        $users      = User::getCustomersOnly($limit, $offset);
        $totalUsers = User::countCustomers();
        $totalPages = $totalUsers > 0 ? (int)ceil($totalUsers / $limit) : 1;

        // 4. Trả về cấu trúc JSON mới
        $this->json([
            'data' => $users,
            'pagination' => [
                'current_page'   => $page,
                'total_pages'    => $totalPages,
                'total_records'  => $totalUsers,
                'limit'          => $limit,
            ],
        ]);
    }

    // Chặn hoặc mở khóa
    public function toggleBlock($params)
    {
        AdminMiddleware::guard($this->request, $this->response);

        $id     = (int)$params['id'];
        $status = (int)($this->request->body['is_locked'] ?? 0);

        // [BẢO MẬT] Kiểm tra xem user này có phải là admin không?
        $targetUser = User::findById($id);
        if (!$targetUser) {
            $this->error('Người dùng không tồn tại', 404);
        }
        if ($targetUser['role'] === 'admin') {
            $this->error('Không được phép chặn tài khoản Quản trị viên!', 403);
        }

        if (User::toggleLock($id, $status)) {
            $msg = $status ? 'Đã chặn khách hàng' : 'Đã mở khóa khách hàng';
            $this->json(['message' => $msg]);
        } else {
            $this->error('Lỗi hệ thống');
        }
    }

    // Xóa user
    public function destroy($params)
    {
        AdminMiddleware::guard($this->request, $this->response);

        $id = (int)$params['id'];

        // [BẢO MẬT] Không cho xóa admin
        $targetUser = User::findById($id);
        if (!$targetUser) {
            $this->error('Người dùng không tồn tại', 404);
        }
        if ($targetUser['role'] === 'admin') {
            $this->error('Không được phép xóa tài khoản Quản trị viên!', 403);
        }

        if (User::delete($id)) {
            $this->json(['message' => 'Đã xóa tài khoản khách hàng']);
        } else {
            $this->error('Lỗi khi xóa tài khoản');
        }
    }
}
