<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Middleware\AdminMiddleware;

class DashboardController extends Controller
{
    public function index()
    {
        // Bảo vệ route này
        AdminMiddleware::guard($this->request, $this->response);

        $db = \App\Config\Database::getConnection();

        // 1. Tổng doanh thu (Chỉ tính đơn đã thanh toán/hoàn thành)
        $revenue = $db->query("SELECT SUM(total_amount) FROM orders WHERE status IN ('Paid', 'Completed', 'Delivered')")->fetchColumn();

        // 2. Tổng đơn hàng
        $totalOrders = $db->query("SELECT COUNT(*) FROM orders")->fetchColumn();

        // 3. Tổng sản phẩm
        $totalProducts = $db->query("SELECT COUNT(*) FROM products")->fetchColumn();

        // 4. Đơn hàng mới nhất
        $recentOrders = $db->query("SELECT id, name, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5")->fetchAll();

        $this->json([
            'revenue' => $revenue ?? 0,
            'total_orders' => $totalOrders,
            'total_products' => $totalProducts,
            'recent_orders' => $recentOrders
        ]);
    }
}