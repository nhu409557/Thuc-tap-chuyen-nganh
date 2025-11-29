<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Order;

class MomoController extends Controller
{
    // Hàm này MoMo sẽ gọi tự động (Webhook)
    public function ipn()
    {
        $data = $this->request->body;

        // Kiểm tra trạng thái giao dịch (resultCode = 0 là thành công)
        if (isset($data['resultCode']) && $data['resultCode'] == 0) {
            $fullOrderId = $data['orderId']; // Dạng: 173210000_15
            
            // Tách lấy ID đơn hàng thật
            $parts = explode('_', $fullOrderId);
            $orderId = end($parts); 

            // 3. Cập nhật trạng thái THANH TOÁN thành 'Paid'
            // Trạng thái đơn hàng (status) vẫn giữ nguyên là Pending để Admin duyệt
            Order::updatePaymentStatus($orderId, 'Paid');
        }

        // Trả về cho MoMo biết đã nhận tin
        http_response_code(204);
    }
}