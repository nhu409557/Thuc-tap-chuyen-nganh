<?php
namespace App\Models;

class Address extends BaseModel
{
    // Lấy tất cả địa chỉ của user
    public static function allByUser(int $userId): array
    {
        $stmt = self::db()->prepare('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC');
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    // Lấy 1 địa chỉ
    public static function find(int $id, int $userId): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        return $stmt->fetch() ?: null;
    }

    // Thêm địa chỉ mới
    public static function create(int $userId, array $data): int
    {
        $stmt = self::db()->prepare(
            'INSERT INTO user_addresses (user_id, full_name, phone, province, district, ward, street_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $data['full_name'],
            $data['phone'],
            $data['province'],
            $data['district'],
            $data['ward'],
            $data['street_address']
        ]);
        return (int)self::db()->lastInsertId();
    }

    // Cập nhật địa chỉ
    public static function update(int $id, int $userId, array $data): bool
    {
        $stmt = self::db()->prepare(
            'UPDATE user_addresses SET full_name = ?, phone = ?, province = ?, district = ?, ward = ?, street_address = ? 
             WHERE id = ? AND user_id = ?'
        );
        return $stmt->execute([
            $data['full_name'],
            $data['phone'],
            $data['province'],
            $data['district'],
            $data['ward'],
            $data['street_address'],
            $id,
            $userId
        ]);
    }

    // Xóa địa chỉ
    public static function delete(int $id, int $userId): bool
    {
        $stmt = self::db()->prepare('DELETE FROM user_addresses WHERE id = ? AND user_id = ?');
        return $stmt->execute([$id, $userId]);
    }

    // Đặt làm mặc định
    public static function setDefault(int $id, int $userId): void
    {
        $db = self::db();
        $db->beginTransaction();
        try {
            // Reset tất cả về 0
            $stmt = $db->prepare('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?');
            $stmt->execute([$userId]);
            
            // Set cái được chọn là 1
            $stmt = $db->prepare('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?');
            $stmt->execute([$id, $userId]);
            
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }
}