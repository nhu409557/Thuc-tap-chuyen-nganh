<?php
namespace App\Models;

class NewsletterSubscriber extends BaseModel
{
    // Thêm email mới (nếu chưa tồn tại)
    public static function subscribe(string $email): bool
    {
        // Kiểm tra trùng
        $stmt = self::db()->prepare("SELECT id FROM newsletter_subscribers WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            return true; // Đã tồn tại coi như thành công
        }

        $stmt = self::db()->prepare("INSERT INTO newsletter_subscribers (email) VALUES (?)");
        return $stmt->execute([$email]);
    }

    // Lấy tất cả email để gửi
    public static function getAllEmails(): array
    {
        $stmt = self::db()->query("SELECT email FROM newsletter_subscribers");
        return $stmt->fetchAll(\PDO::FETCH_COLUMN); // Chỉ lấy cột email thành mảng phẳng
    }
}