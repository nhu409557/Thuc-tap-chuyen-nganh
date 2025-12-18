<?php
namespace App\Models;

class Notification extends BaseModel
{
    // Lấy danh sách thông báo
    public static function getAll(): array
    {
        $stmt = self::db()->query("SELECT * FROM notifications ORDER BY created_at DESC");
        return $stmt->fetchAll();
    }

    // Tạo thông báo mới
    public static function create(string $title, string $content): bool
    {
        $stmt = self::db()->prepare("INSERT INTO notifications (title, content) VALUES (?, ?)");
        return $stmt->execute([$title, $content]);
    }

    // Cập nhật thông báo
    public static function update(int $id, string $title, string $content): bool
    {
        $stmt = self::db()->prepare("UPDATE notifications SET title = ?, content = ? WHERE id = ?");
        return $stmt->execute([$title, $content, $id]);
    }

    // Xóa thông báo
    public static function delete(int $id): bool
    {
        $stmt = self::db()->prepare("DELETE FROM notifications WHERE id = ?");
        return $stmt->execute([$id]);
    }

    // Đánh dấu là đã gửi
    public static function markAsSent(int $id): bool
    {
        $stmt = self::db()->prepare("UPDATE notifications SET is_sent = 1, sent_at = NOW() WHERE id = ?");
        return $stmt->execute([$id]);
    }
    
    // Tìm theo ID
    public static function findById(int $id): ?array
    {
        $stmt = self::db()->prepare("SELECT * FROM notifications WHERE id = ?");
        $stmt->execute([$id]);
        $res = $stmt->fetch();
        return $res ?: null;
    }
}