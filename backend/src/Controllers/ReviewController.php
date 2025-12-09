<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Review;
use App\Models\Order;
use App\Middleware\AuthMiddleware;
use App\Middleware\AdminMiddleware;

class ReviewController extends Controller
{
    // =================================================================
    // PHẦN CỦA USER (KHÁCH HÀNG) - GIỮ NGUYÊN
    // =================================================================

    public function store()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        if (empty($b['product_id']) || empty($b['order_id']) || empty($b['rating'])) {
            return $this->error('Vui lòng nhập đầy đủ thông tin.', 422);
        }

        $orderId = (int)$b['order_id'];
        $productId = (int)$b['product_id'];
        $rating = (int)$b['rating'];
        $comment = trim($b['comment'] ?? '');

        $order = Order::findWithItems($orderId, $userId);
        if (!$order) return $this->error('Đơn hàng không tồn tại.', 404);

        $allowedStatus = ['Delivered', 'Completed', 'Shipping'];
        $isPaid = ($order['payment_status'] === 'Paid');

        if (!in_array($order['status'], $allowedStatus) && !$isPaid) {
             return $this->error('Chỉ đánh giá khi đã thanh toán hoặc đang giao.', 403);
        }

        $isValidProduct = false;
        if (!empty($order['items'])) {
            foreach ($order['items'] as $item) {
                if ($item['product_id'] == $productId) {
                    $isValidProduct = true;
                    break;
                }
            }
        }
        if (!$isValidProduct) return $this->error('Sản phẩm không có trong đơn hàng.', 400);

        $orderTime = strtotime($order['created_at']);
        if ((time() - $orderTime) > (7 * 24 * 60 * 60)) {
            return $this->error('Đã quá hạn 7 ngày đánh giá.', 403);
        }

        $existingReview = Review::getExistingReview($userId, $productId); 
        if ($existingReview && $existingReview['order_id'] == $orderId && $existingReview['is_deleted'] == 1) {
            return $this->error('Đánh giá đã bị xóa do vi phạm.', 403);
        }

        try {
            Review::upsert($userId, $productId, $orderId, $rating, $comment);
            $msg = ($existingReview) ? 'Đánh giá đã cập nhật!' : 'Cảm ơn bạn đã đánh giá!';
            $this->json(['success' => true, 'message' => $msg]);
        } catch (\Throwable $e) {
            error_log("Review Error: " . $e->getMessage());
            $this->error('Lỗi hệ thống.', 500);
        }
    }

    // =================================================================
    // PHẦN CỦA ADMIN (QUẢN TRỊ VIÊN)
    // =================================================================

    public function reply() 
    {
        AdminMiddleware::guard($this->request, $this->response);
        $rawInput = file_get_contents('php://input');
        $jsonData = json_decode($rawInput, true);
        $body = is_array($jsonData) ? $jsonData : (array)$this->request->body;

        $id = isset($body['id']) ? (int)$body['id'] : null;
        $reply = isset($body['reply']) ? trim($body['reply']) : '';
        
        if (empty($id)) return $this->error('Lỗi: Không tìm thấy ID.', 400);
        if ($reply === '') return $this->error('Vui lòng nhập nội dung.', 400);
        
        try {
            Review::adminReply($id, $reply);
            $this->json(['success' => true, 'message' => 'Đã gửi câu trả lời']);
        } catch (\Throwable $e) {
            $this->error('Lỗi hệ thống: ' . $e->getMessage(), 500);
        }
    }

    public function toggleHidden() 
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = $this->request->body['id'] ?? null;
        $isHidden = isset($this->request->body['is_hidden']) ? (int)$this->request->body['is_hidden'] : 0;
        
        if (!$id) return $this->error('Thiếu ID.', 400);

        try {
            Review::toggleVisibility($id, $isHidden);
            $this->json(['success' => true, 'message' => $isHidden ? 'Đã ẩn đánh giá.' : 'Đã hiển thị đánh giá.']);
        } catch (\Throwable $e) {
            $this->error('Lỗi: ' . $e->getMessage(), 500);
        }
    }

    public function delete() 
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = $this->request->body['id'] ?? null;
        if (!$id) return $this->error('Thiếu ID.', 400);

        try {
            Review::softDelete($id);
            $this->json(['success' => true, 'message' => 'Đã xóa đánh giá.']);
        } catch (\Throwable $e) {
            $this->error('Lỗi: ' . $e->getMessage(), 500);
        }
    }
    
    // [CẬP NHẬT] Hàm lấy danh sách admin với bộ lọc chuẩn
    public function indexAdmin()
    {
        AdminMiddleware::guard($this->request, $this->response);
        
        $page    = (int)($this->request->query['page'] ?? 1);
        $limit   = (int)($this->request->query['limit'] ?? 10);
        
        // Xử lý tham số lọc
        $ratingInput = $this->request->query['rating'] ?? '';
        $rating  = ($ratingInput !== '') ? (int)$ratingInput : null;
        
        $status  = $this->request->query['status'] ?? null;
        $keyword = $this->request->query['q'] ?? null;
        
        $offset = ($page - 1) * $limit;

        try {
            $reviews = Review::getAllForAdmin($limit, $offset, $rating, $status, $keyword);
            $total   = Review::countAllForAdmin($rating, $status, $keyword);
            $totalPages = ($limit > 0) ? ceil($total / $limit) : 1;

            $this->json([
                'data' => $reviews,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages'  => $totalPages,
                    'total_records'=> $total,
                    'limit'        => $limit
                ]
            ]);
        } catch (\Throwable $e) {
            $this->error('Lỗi tải danh sách: ' . $e->getMessage(), 500);
        }
    }

    public function indexPublic($params)
    {
        $productId = (int)$params['id'];
        try {
            $reviews = Review::getByProduct($productId);
            $total = count($reviews);
            $avg = 0;
            if ($total > 0) {
                $sum = array_sum(array_column($reviews, 'rating'));
                $avg = round($sum / $total, 1);
            }
            $this->json([
                'success' => true,
                'data' => $reviews,
                'summary' => ['total_reviews' => $total, 'average_rating' => $avg]
            ]);
        } catch (\Throwable $e) {
            $this->error('Lỗi tải đánh giá: ' . $e->getMessage(), 500);
        }
    }
}