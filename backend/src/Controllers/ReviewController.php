<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Review;
use App\Models\Order;
use App\Middleware\AuthMiddleware;

class ReviewController extends Controller
{
    public function store()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        // 1. Validate dữ liệu đầu vào
        if (empty($b['product_id']) || empty($b['order_id']) || empty($b['rating'])) {
            return $this->error('Thiếu thông tin đánh giá', 422);
        }

        $orderId = (int)$b['order_id'];
        $productId = (int)$b['product_id'];
        $rating = (int)$b['rating'];
        $comment = $b['comment'] ?? '';

        // 2. Kiểm tra đơn hàng có tồn tại và thuộc về user không
        $order = Order::findWithItems($orderId, $userId);
        if (!$order) {
            return $this->error('Đơn hàng không tồn tại', 404);
        }

        // 3. QUAN TRỌNG: Kiểm tra trạng thái đơn hàng (Chỉ cho phép khi đã thanh toán/hoàn thành)
        // Các trạng thái cho phép: 'Paid', 'Delivered', 'Completed'
        $allowedStatus = ['Paid', 'Delivered', 'Completed'];
        if (!in_array($order['status'], $allowedStatus)) {
            return $this->error('Bạn chỉ có thể đánh giá khi đơn hàng đã hoàn thành hoặc đã thanh toán', 403);
        }

        // 4. Kiểm tra sản phẩm có nằm trong đơn hàng này không
        $isValidProduct = false;
        foreach ($order['items'] as $item) {
            if ($item['product_id'] == $productId) {
                $isValidProduct = true;
                break;
            }
        }
        if (!$isValidProduct) {
            return $this->error('Sản phẩm không có trong đơn hàng này', 400);
        }

        // 5. Kiểm tra đã đánh giá chưa (Mỗi đơn chỉ 1 lần cho 1 sản phẩm)
        if (Review::hasReviewed($userId, $orderId, $productId)) {
            return $this->error('Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi', 409);
        }

        // 6. Lưu đánh giá
        try {
            Review::create($userId, $productId, $orderId, $rating, $comment);
            $this->json(['success' => true, 'message' => 'Cảm ơn bạn đã đánh giá!']);
        } catch (\Throwable $e) {
            $this->error('Lỗi khi lưu đánh giá: ' . $e->getMessage(), 500);
        }
    }
}