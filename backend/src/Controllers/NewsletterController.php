<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\NewsletterSubscriber;
use App\Helpers\Email; // <-- Import class Email bạn đã có

class NewsletterController extends Controller
{
    public function subscribe()
    {
        $b = $this->request->body;
        $email = $b['email'] ?? '';

        // 1. Validate Email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('Email không hợp lệ', 400);
        }

        // 2. Lưu vào Database
        // Hàm subscribe trả về true nếu thành công hoặc email đã tồn tại
        if (NewsletterSubscriber::subscribe($email)) {
            
            // 3. Gửi Email thông báo kèm mã giảm giá (Dùng Helper Email có sẵn)
            $this->sendCouponEmail($email);

            $this->json(['success' => true, 'message' => 'Đăng ký thành công! Vui lòng kiểm tra email để nhận mã giảm giá.']);
        } else {
            $this->error('Lỗi hệ thống', 500);
        }
    }

    /**
     * Hàm riêng để xử lý nội dung và gửi email qua App\Helpers\Email
     */
    private function sendCouponEmail($email)
    {
        $subject = "TechHub: Tặng bạn mã giảm giá 15%";
        
        // Mã giảm giá cố định theo yêu cầu
        $couponCode = "NEWSALE15";

        // Nội dung Email (HTML)
        $content = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;'>
            <h2 style='color: #2563eb; text-align: center;'>Chào mừng bạn đến với TechHub!</h2>
            
            <p>Xin chào,</p>
            <p>Cảm ơn bạn đã đăng ký nhận bản tin công nghệ từ chúng tôi.</p>
            <p>Như một món quà làm quen, TechHub gửi tặng bạn mã giảm giá đặc biệt:</p>
            
            <div style='background-color: #f0f9ff; padding: 20px; text-align: center; margin: 25px 0; border: 2px dashed #2563eb; border-radius: 8px;'>
                <p style='margin: 0; color: #555; font-size: 14px;'>Mã giảm giá của bạn:</p>
                <strong style='font-size: 28px; color: #d946ef; display: block; margin-top: 10px; letter-spacing: 2px;'>$couponCode</strong>
                <p style='margin-top: 10px; color: #666; font-size: 13px;'>Giảm 15% cho đơn hàng tiếp theo</p>
            </div>

            <p>Bạn có thể sử dụng mã này ngay tại bước thanh toán.</p>
            
            <div style='text-align: center; margin-top: 30px;'>
                <a href='http://localhost:3000' style='background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;'>Mua sắm ngay</a>
            </div>
            
            <hr style='border: 0; border-top: 1px solid #eee; margin: 30px 0;'>
            <p style='font-size: 12px; color: #999; text-align: center;'>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </div>
        ";

        // Gọi hàm send từ class App\Helpers\Email
        // Class này đã có sẵn try/catch nên ở đây gọi trực tiếp là được
        Email::send($email, $subject, $content);
    }
}