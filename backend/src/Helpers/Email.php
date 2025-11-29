<?php
namespace App\Helpers;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

class Email
{
    // CẤU HÌNH GMAIL CỦA BẠN TẠI ĐÂY
    private static $smtpHost = 'smtp.gmail.com';
    private static $smtpUsername = 'nhu409557@gmail.com'; // <-- Sửa email của bạn
    private static $smtpPassword = 'jadd zumh jcye fiuk'; // <-- Sửa mật khẩu ỨNG DỤNG 16 chữ số
    private static $smtpPort = 587; // hoặc 465
    private static $smtpSecure = PHPMailer::ENCRYPTION_STARTTLS; // hoặc ENCRYPTION_SMTPS

    public static function send(string $to, string $subject, string $body): bool
    {
        $mail = new PHPMailer(true);
        try {
            // Cấu hình Server
            $mail->isSMTP();
            $mail->Host       = self::$smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = self::$smtpUsername;
            $mail->Password   = self::$smtpPassword;
            $mail->SMTPSecure = self::$smtpSecure;
            $mail->Port       = self::$smtpPort;
            $mail->CharSet = 'UTF-8';

            // Người gửi
            $mail->setFrom(self::$smtpUsername, 'TechHub');

            // Người nhận
            $mail->addAddress($to);

            // Nội dung
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $body;

            $mail->send();
            return true;
        } catch (\Exception $e) {
            // Có thể log lỗi ra file: error_log("Mailer Error: {$mail->ErrorInfo}");
            return false;
        }
    }

    public static function generateCode(): string
    {
        // Tạo mã 6 chữ số
        return str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}