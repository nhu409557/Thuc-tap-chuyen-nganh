<?php
namespace App\Models;

class Coupon extends BaseModel
{
    public static function findByCode(string $code)
    {
        $stmt = self::db()->prepare("SELECT * FROM coupons WHERE code = ?");
        $stmt->execute([$code]);
        return $stmt->fetch();
    }

    public static function create(array $data) {
        $sql = "INSERT INTO coupons (code, percent, max_discount_amount, min_order_value, usage_limit, usage_per_user, start_date, end_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $code = strtoupper(trim($data['code']));
        // Xử lý NULL cho ngày tháng
        $startDate = !empty($data['start_date']) ? $data['start_date'] : null;
        $endDate = !empty($data['end_date']) ? $data['end_date'] : null;

        self::db()->prepare($sql)->execute([
            $code, 
            (int)$data['percent'], 
            (int)($data['max_discount_amount'] ?? 0), 
            (int)($data['min_order_value'] ?? 0), 
            (int)($data['usage_limit'] ?? 0), 
            (int)($data['usage_per_user'] ?? 1),
            $startDate,
            $endDate
        ]);
    }

    public static function update(int $id, array $data) {
        $sql = "UPDATE coupons SET percent=?, max_discount_amount=?, min_order_value=?, usage_limit=?, usage_per_user=?, start_date=?, end_date=? WHERE id=?";
        
        $startDate = !empty($data['start_date']) ? $data['start_date'] : null;
        $endDate = !empty($data['end_date']) ? $data['end_date'] : null;

        self::db()->prepare($sql)->execute([
            (int)$data['percent'], 
            (int)($data['max_discount_amount'] ?? 0), 
            (int)($data['min_order_value'] ?? 0), 
            (int)($data['usage_limit'] ?? 0), 
            (int)($data['usage_per_user'] ?? 1),
            $startDate,
            $endDate,
            $id
        ]);
    }

    public static function getAll() {
        return self::db()->query("SELECT * FROM coupons ORDER BY id DESC")->fetchAll();
    }

    public static function delete(int $id) {
        self::db()->prepare("DELETE FROM coupons WHERE id = ?")->execute([$id]);
    }

    // Logic kiểm tra mã hợp lệ
    public static function checkValid(string $code, int $userId, float $orderTotal)
    {
        $coupon = self::findByCode($code);
        if (!$coupon) return ['valid' => false, 'message' => 'Mã giảm giá không tồn tại'];

        $now = date('Y-m-d H:i:s');
        if ($coupon['start_date'] && $now < $coupon['start_date']) return ['valid' => false, 'message' => 'Mã chưa bắt đầu'];
        if ($coupon['end_date'] && $now > $coupon['end_date']) return ['valid' => false, 'message' => 'Mã đã hết hạn'];
        if ($coupon['usage_limit'] > 0 && $coupon['used_count'] >= $coupon['usage_limit']) return ['valid' => false, 'message' => 'Mã đã hết lượt dùng'];
        if ($orderTotal < $coupon['min_order_value']) return ['valid' => false, 'message' => 'Đơn hàng chưa đủ điều kiện tối thiểu'];

        $stmt = self::db()->prepare("SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = ? AND user_id = ?");
        $stmt->execute([$coupon['id'], $userId]);
        if ($stmt->fetchColumn() >= $coupon['usage_per_user']) return ['valid' => false, 'message' => 'Bạn đã dùng hết số lần cho phép'];

        $discount = ($orderTotal * $coupon['percent']) / 100;
        if ($coupon['max_discount_amount'] > 0 && $discount > $coupon['max_discount_amount']) $discount = $coupon['max_discount_amount'];

        return ['valid' => true, 'coupon' => $coupon, 'discount_amount' => (int)$discount];
    }

    public static function incrementUsage(int $couponId, int $userId, int $orderId)
    {
        self::db()->prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?")->execute([$couponId]);
        self::db()->prepare("INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES (?, ?, ?)")->execute([$couponId, $userId, $orderId]);
    }
}