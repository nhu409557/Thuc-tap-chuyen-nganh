<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Notification;
use App\Models\NewsletterSubscriber;
use App\Helpers\Email;
use App\Middleware\AdminMiddleware;

class NotificationController extends Controller
{
    // Lấy danh sách thông báo (Admin)
    public function index()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $data = Notification::getAll();
        $this->json(['data' => $data]);
    }

    // Tạo thông báo (Admin)
    public function store()
    {
        AdminMiddleware::guard($this->request, $this->response);
        $b = $this->request->body;
        
        if (empty($b['title']) || empty($b['content'])) {
            return $this->error('Vui lòng nhập tiêu đề và nội dung', 422);
        }

        if (Notification::create($b['title'], $b['content'])) {
            $this->json(['success' => true, 'message' => 'Tạo thông báo thành công']);
        } else {
            $this->error('Lỗi tạo thông báo');
        }
    }

    // Cập nhật (Admin)
    public function update($params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        $b = $this->request->body;

        if (Notification::update($id, $b['title'], $b['content'])) {
            $this->json(['success' => true, 'message' => 'Cập nhật thành công']);
        } else {
            $this->error('Lỗi cập nhật');
        }
    }

    // Xóa (Admin)
    public function destroy($params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];
        if (Notification::delete($id)) {
            $this->json(['success' => true, 'message' => 'Đã xóa thông báo']);
        } else {
            $this->error('Lỗi xóa');
        }
    }

    // Gửi thông báo cho TẤT CẢ Subscriber
    public function sendToSubscribers($params)
    {
        AdminMiddleware::guard($this->request, $this->response);
        $id = (int)$params['id'];

        // 1. Lấy nội dung thông báo
        $notification = Notification::findById($id);
        if (!$notification) {
            return $this->error('Thông báo không tồn tại', 404);
        }

        // 2. Lấy danh sách email đăng ký
        $emails = NewsletterSubscriber::getAllEmails();
        if (empty($emails)) {
            return $this->error('Chưa có ai đăng ký nhận tin', 400);
        }

        // 3. Gửi mail (Vòng lặp)
        // Lưu ý: Với danh sách lớn, nên dùng Queue. Ở đây demo gửi trực tiếp.
        $count = 0;
        foreach ($emails as $email) {
            // Sử dụng Helper Email bạn đã cung cấp
            if (Email::send($email, $notification['title'], $notification['content'])) {
                $count++;
            }
        }

        // 4. Cập nhật trạng thái đã gửi
        Notification::markAsSent($id);

        $this->json([
            'success' => true, 
            'message' => "Đã gửi email thành công cho $count người đăng ký."
        ]);
    }
}