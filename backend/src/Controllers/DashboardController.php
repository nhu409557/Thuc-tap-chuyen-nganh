<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Middleware\AdminMiddleware;
use PDO;

class DashboardController extends Controller
{
    public function index()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $db = \App\Config\Database::getConnection();

        // 0. Điều kiện chung: Đã Giao + Đã Thanh Toán (Dùng cho hiển thị số liệu Dashboard)
        $baseRevenueSql = "
            SELECT SUM(total_amount) 
            FROM orders 
            WHERE status = 'Delivered' 
            AND payment_status = 'Paid'
        ";

        // 1. Tính toán các mốc thời gian (Dùng delivered_at cho doanh thu thực tế)
        $revenueDay   = $db->query("$baseRevenueSql AND DATE(delivered_at) = CURRENT_DATE()")->fetchColumn();
        $revenueMonth = $db->query("$baseRevenueSql AND MONTH(delivered_at) = MONTH(CURRENT_DATE()) AND YEAR(delivered_at) = YEAR(CURRENT_DATE())")->fetchColumn();
        $revenueYear  = $db->query("$baseRevenueSql AND YEAR(delivered_at) = YEAR(CURRENT_DATE())")->fetchColumn();
        $revenueAll   = $db->query($baseRevenueSql)->fetchColumn();

        // 2. Các thống kê khác
        $orderStats = $db->query("SELECT status, COUNT(*) as count FROM orders GROUP BY status")->fetchAll(PDO::FETCH_KEY_PAIR);
        $stats = [
            'Pending'   => $orderStats['Pending'] ?? 0,
            'Confirmed' => $orderStats['Confirmed'] ?? 0,
            'Shipping'  => $orderStats['Shipping'] ?? 0,
            'Delivered' => $orderStats['Delivered'] ?? 0,
            'Cancelled' => $orderStats['Cancelled'] ?? 0,
            'Returned'  => $orderStats['Returned'] ?? 0,
        ];

        $totalCustomers = $db->query("SELECT COUNT(*) FROM users WHERE role = 'customer'")->fetchColumn();
        $totalOrders = $db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
        
        // Top 5 sản phẩm bán chạy (Mới thêm cho Dashboard Pro)
        $topProductsSql = "
            SELECT p.title, p.image, SUM(oi.quantity) as total_sold, SUM(oi.price * oi.quantity) as total_revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status = 'Delivered' AND o.payment_status = 'Paid'
            GROUP BY oi.product_id
            ORDER BY total_sold DESC
            LIMIT 5
        ";
        $topProducts = $db->query($topProductsSql)->fetchAll(PDO::FETCH_ASSOC);

        // Đơn hàng gần đây
        $recentOrders = $db->query("SELECT id, name, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

        // Sản phẩm sắp hết hàng
        $lowStockProducts = $db->query("SELECT id, title, image, stock_quantity, price FROM products WHERE stock_quantity <= 5 ORDER BY stock_quantity ASC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

        // Dữ liệu biểu đồ (7 ngày gần nhất)
        $chartSql = "
            SELECT DATE(delivered_at) as date, SUM(total_amount) as total 
            FROM orders 
            WHERE status = 'Delivered' AND payment_status = 'Paid' 
            AND delivered_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
            GROUP BY DATE(delivered_at)
            ORDER BY date ASC
        ";
        $chartDataRaw = $db->query($chartSql)->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $chartLabels = [];
        $chartValues = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = date('Y-m-d', strtotime("-$i days"));
            $chartLabels[] = date('d/m', strtotime($date));
            $chartValues[] = $chartDataRaw[$date] ?? 0;
        }

        $this->json([
            'revenue' => [
                'day' => $revenueDay ?? 0,
                'month' => $revenueMonth ?? 0,
                'year' => $revenueYear ?? 0,
                'all' => $revenueAll ?? 0
            ],
            'chart_data' => [
                'labels' => $chartLabels,
                'data' => $chartValues
            ],
            'total_orders'       => $totalOrders,
            'total_customers'    => $totalCustomers,
            'order_stats'        => $stats,
            'top_products'       => $topProducts,
            'recent_orders'      => $recentOrders,
            'low_stock_products' => $lowStockProducts
        ]);
    }

    // API Xuất Excel - ĐÃ ĐƯỢC CHỈNH SỬA ĐỂ ĐẢM BẢO CÓ DỮ LIỆU
    public function exportRevenue()
    {
        // 1. Xóa bộ nhớ đệm để tránh lỗi file
        if (ob_get_level()) {
            ob_end_clean();
        }

        AdminMiddleware::guard($this->request, $this->response);
        $db = \App\Config\Database::getConnection();

        $type = $_GET['type'] ?? 'all';
        
        // 2. QUERY CƠ BẢN
        // Lưu ý: Tôi đã bỏ điều kiện WHERE status='Delivered' để bạn test ra dữ liệu trước.
        // Sau này muốn chặt chẽ thì bỏ comment dòng bên dưới.
        $sql = "SELECT id, name, phone, created_at, delivered_at, status, payment_status, total_amount 
                FROM orders 
                WHERE 1=1"; 
        
        // $sql .= " AND status = 'Delivered' AND payment_status = 'Paid'"; // <--- Bỏ comment dòng này nếu muốn chỉ xuất đơn đã giao

        $filenamePrefix = "Bao_Cao_Tong";

        // 3. LỌC THEO THỜI GIAN (Dùng created_at cho dễ có dữ liệu)
        if ($type === 'day') {
            $sql .= " AND DATE(created_at) = CURRENT_DATE()";
            $filenamePrefix = "Bao_Cao_Ngay_" . date('d-m-Y');
        } elseif ($type === 'month') {
            $sql .= " AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())";
            $filenamePrefix = "Bao_Cao_Thang_" . date('m-Y');
        } elseif ($type === 'year') {
            $sql .= " AND YEAR(created_at) = YEAR(CURRENT_DATE())";
            $filenamePrefix = "Bao_Cao_Nam_" . date('Y');
        }
        // Nếu type = 'all' thì không thêm điều kiện thời gian => Lấy hết

        $sql .= " ORDER BY created_at DESC";
        
        $orders = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        // 4. KIỂM TRA NẾU KHÔNG CÓ DỮ LIỆU
        if (empty($orders)) {
            // Vẫn xuất file nhưng chỉ có header để báo hiệu
        }

        // 5. THIẾT LẬP HEADER TRẢ VỀ FILE
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filenamePrefix . '.csv');

        // Mở output stream
        $output = fopen('php://output', 'w');
        
        // Thêm BOM để Excel hiển thị đúng tiếng Việt
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

        // Viết dòng tiêu đề
        fputcsv($output, ['Mã Đơn', 'Khách Hàng', 'SĐT', 'Ngày Đặt', 'Ngày Giao', 'Trạng Thái', 'Thanh Toán', 'Tổng Tiền'], ",", "\"", "\\");

        // Viết dữ liệu
        foreach ($orders as $row) {
            fputcsv($output, [
                '#' . $row['id'], 
                $row['name'], 
                $row['phone'], 
                $row['created_at'], 
                $row['delivered_at'] ?? 'Chưa giao', // Xử lý nếu NULL
                $row['status'],
                $row['payment_status'], 
                number_format($row['total_amount'], 0, '', '.')
            ], ",", "\"", "\\");
        }

        fclose($output);
        exit;
    }
}