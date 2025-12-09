<?php
namespace App\Models;

use PDO;

class Review extends BaseModel
{
    // =================================================================
    // PHẦN DÀNH CHO NGƯỜI DÙNG (USER) - GIỮ NGUYÊN
    // =================================================================

    public static function getExistingReview(int $userId, int $productId)
    {
        $stmt = self::db()->prepare(
            'SELECT * FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1'
        );
        $stmt->execute([$userId, $productId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function upsert(int $userId, int $productId, int $orderId, int $rating, string $comment): void
    {
        $sql = "INSERT INTO reviews (user_id, product_id, order_id, rating, comment, created_at, is_deleted, is_hidden, admin_reply) 
                VALUES (?, ?, ?, ?, ?, NOW(), 0, 0, NULL)
                ON DUPLICATE KEY UPDATE 
                order_id = VALUES(order_id),
                rating = VALUES(rating),
                comment = VALUES(comment),
                created_at = NOW(),
                is_deleted = 0,
                is_hidden = 0,
                admin_reply = NULL,
                replied_at = NULL"; 
        
        $stmt = self::db()->prepare($sql);
        $stmt->execute([$userId, $productId, $orderId, $rating, $comment]);
    }

    public static function getByProduct(int $productId) 
    {
        $stmt = self::db()->prepare(
            'SELECT r.*, u.name as user_name 
             FROM reviews r 
             JOIN users u ON r.user_id = u.id 
             WHERE r.product_id = ? AND r.is_hidden = 0
             ORDER BY r.created_at DESC'
        );
        $stmt->execute([$productId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // =================================================================
    // PHẦN DÀNH CHO ADMIN (QUẢN TRỊ) - CẬP NHẬT MỚI
    // =================================================================

    /**
     * [MỚI] Helper: Tạo câu query WHERE và Params dùng chung
     * Giúp đồng bộ logic giữa việc lấy dữ liệu và đếm tổng trang
     */
    private static function buildAdminQuery($rating = null, $status = null, $keyword = null)
    {
        $where = ["1=1"];
        $params = [];

        // 1. Lọc theo số sao
        if ($rating !== null && $rating !== '') {
            $where[] = "r.rating = ?";
            $params[] = (int)$rating;
        }

        // 2. Lọc theo trạng thái
        if ($status === 'hidden') {
            $where[] = "r.is_hidden = 1";
        } elseif ($status === 'visible') {
            $where[] = "r.is_hidden = 0";
        }

        // 3. Tìm kiếm (Ưu tiên Tên sản phẩm, Người dùng, Mã đơn)
        if ($keyword) {
            $k = "%" . trim($keyword) . "%";
            $where[] = "(p.title LIKE ? OR u.name LIKE ? OR r.order_id LIKE ?)";
            $params[] = $k;
            $params[] = $k;
            $params[] = $k;
        }

        return ['sql' => implode(' AND ', $where), 'params' => $params];
    }

    // Lấy danh sách (Cập nhật dùng buildAdminQuery)
    public static function getAllForAdmin($limit, $offset, $rating = null, $status = null, $keyword = null)
    {
        $queryBuild = self::buildAdminQuery($rating, $status, $keyword);
        $whereSql = $queryBuild['sql'];
        $params = $queryBuild['params'];

        $sql = "SELECT r.*, 
                       u.name as user_name, 
                       p.title as product_name, 
                       p.image as product_image 
                FROM reviews r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN products p ON r.product_id = p.id
                WHERE $whereSql
                ORDER BY r.created_at DESC 
                LIMIT ? OFFSET ?";
        
        $stmt = self::db()->prepare($sql);
        
        // Bind params WHERE
        foreach ($params as $i => $val) {
            $stmt->bindValue($i + 1, $val);
        }
        
        // Bind LIMIT/OFFSET
        $stmt->bindValue(count($params) + 1, (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(count($params) + 2, (int)$offset, PDO::PARAM_INT);
        
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Đếm tổng số lượng (Cập nhật dùng buildAdminQuery)
    public static function countAllForAdmin($rating = null, $status = null, $keyword = null)
    {
        $queryBuild = self::buildAdminQuery($rating, $status, $keyword);
        $whereSql = $queryBuild['sql'];
        $params = $queryBuild['params'];

        $sql = "SELECT COUNT(*) as total 
                FROM reviews r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN products p ON r.product_id = p.id
                WHERE $whereSql";
        
        $stmt = self::db()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    // Các hàm admin khác giữ nguyên
    public static function adminReply(int $reviewId, string $reply) {
        $stmt = self::db()->prepare("UPDATE reviews SET admin_reply = ?, replied_at = NOW() WHERE id = ?");
        $stmt->execute([$reply, $reviewId]);
    }

    public static function toggleVisibility(int $reviewId, int $isHidden) {
        $stmt = self::db()->prepare("UPDATE reviews SET is_hidden = ? WHERE id = ?");
        $stmt->execute([$isHidden, $reviewId]);
    }

    public static function softDelete(int $reviewId) {
        $stmt = self::db()->prepare("UPDATE reviews SET is_deleted = 1, is_hidden = 1 WHERE id = ?");
        $stmt->execute([$reviewId]);
    }
}