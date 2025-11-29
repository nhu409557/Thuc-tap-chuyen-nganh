<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\User;
use App\Models\PasswordReset;
use App\Models\RegistrationAttempt;
use App\Helpers\JwtHelper;
use App\Helpers\Email;
use App\Middleware\AuthMiddleware;

class AuthController extends Controller
{
    private function sendVerificationEmail(string $email, string $code)
    {
        $subject = "Mã xác thực TechHub của bạn";
        $body = "Mã xác thực của bạn là: <h2>$code</h2> Mã này có hiệu lực trong 5 phút.";
        Email::send($email, $subject, $body);
    }

    private function sendPasswordResetEmail(string $email, string $code)
    {
        $subject = "Mã khôi phục mật khẩu TechHub";
        $body = "Mã khôi phục mật khẩu của bạn là: <h2>$code</h2> Mã này có hiệu lực trong 5 phút.";
        Email::send($email, $subject, $body);
    }

    // HÀM REGISTER
    public function register()
    {
        $b = $this->request->body;
        if (empty($b['name']) || empty($b['email']) || empty($b['password'])) {
            return $this->error('Thiếu thông tin', 422);
        }

        if (User::findByEmail($b['email'])) {
            return $this->error('Email đã tồn tại', 422);
        }

        $code = Email::generateCode();
        $hash = password_hash($b['password'], PASSWORD_BCRYPT);

        // 1. Lưu tạm thông tin vào CSDL
        RegistrationAttempt::create($b['name'], $b['email'], $hash, $code);

        // 2. Gửi email
        $this->sendVerificationEmail($b['email'], $code);

        $this->json([
            'success' => true,
            'message' => 'Mã xác thực đã được gửi đến email của bạn.',
        ], 200);
    }

    // HÀM VERIFY REGISTER
    public function verifyRegister()
    {
        $b = $this->request->body;
        if (empty($b['email']) || empty($b['code'])) {
            return $this->error('Thiếu email hoặc mã xác thực', 422);
        }

        // 1. Tìm bản lưu tạm
        $attempt = RegistrationAttempt::findByEmailAndCode($b['email'], $b['code']);
        if (!$attempt) {
            return $this->error('Mã không hợp lệ hoặc đã hết hạn', 401);
        }

        // 2. Tạo user thật
        User::createFromHash($attempt['name'], $attempt['email'], $attempt['password_hash']);

        // 3. Xóa bản lưu tạm
        RegistrationAttempt::deleteByEmail($b['email']);

        $this->json(['success' => true, 'message' => 'Đăng ký thành công!'], 201);
    }
    
    // HÀM RESEND CODE
    public function resendCode()
    {
        $b = $this->request->body;
        if (empty($b['email'])) {
            return $this->error('Thiếu email', 422);
        }
        
        $attempt = RegistrationAttempt::findPendingByEmail($b['email']);
        
        if ($attempt) {
             $code = Email::generateCode();
             RegistrationAttempt::updateCode($b['email'], $code);
             $this->sendVerificationEmail($b['email'], $code);
        }
        
        $this->json(['success' => true, 'message' => 'Mã mới đã được gửi (nếu email tồn tại).']);
    }

    // HÀM LOGIN (ĐÃ CẬP NHẬT ROLE)
    public function login()
    {
        $b = $this->request->body;
        if (empty($b['email']) || empty($b['password'])) {
            return $this->error('Thiếu email hoặc mật khẩu', 422);
        }

        $user = User::findByEmail($b['email']);
        if (!$user || !password_verify($b['password'], $user['password_hash'])) {
            return $this->error('Sai email hoặc mật khẩu', 401);
        }

        $token = JwtHelper::encode(['user_id' => $user['id']]);

        $this->json([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'] // 👈 THÊM DÒNG NÀY ĐỂ FRONTEND ADMIN BIẾT
            ],
        ]);
    }

    // HÀM ME
    public function me()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $user = User::findById($userId);
        if (!$user) return $this->error('Không tìm thấy user', 404);

        $this->json([
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'], // Trả về cả role ở đây
            'created_at' => $user['created_at'],
        ]);
    }

    // HÀM FORGOTPASSWORD
    public function forgotPassword()
    {
        $b = $this->request->body;
        if (empty($b['email'])) {
            return $this->error('Thiếu email', 422);
        }

        $user = User::findByEmail($b['email']);
        if ($user) {
            $code = Email::generateCode();
            // 1. Lưu mã vào CSDL
            PasswordReset::create($user['email'], $code);
            // 2. Gửi email
            $this->sendPasswordResetEmail($user['email'], $code);
        }

        $this->json(['success' => true, 'message' => 'Nếu email tồn tại, mã khôi phục đã được gửi.']);
    }

    // HÀM RESETPASSWORD
    public function resetPassword()
    {
        $b = $this->request->body;
        if (empty($b['email']) || empty($b['code']) || empty($b['password'])) {
            return $this->error('Thiếu thông tin', 422);
        }

        // 1. Kiểm tra mã
        $resetRequest = PasswordReset::findByEmailAndCode($b['email'], $b['code']);
        if (!$resetRequest) {
            return $this->error('Mã không hợp lệ hoặc đã hết hạn', 401);
        }

        // 2. Cập nhật mật khẩu
        User::updatePasswordByEmail($b['email'], $b['password']);

        // 3. Xóa mã đã dùng
        PasswordReset::deleteByEmail($b['email']);

        $this->json(['success' => true, 'message' => 'Đổi mật khẩu thành công.']);
    }
    // 👇 HÀM MỚI: CHANGE PASSWORD
    public function changePassword()
    {
        // 1. Lấy User ID từ Token (Yêu cầu phải đăng nhập)
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        // 2. Validate đầu vào
        if (empty($b['old_password']) || empty($b['new_password']) || empty($b['confirm_password'])) {
            return $this->error('Vui lòng điền đầy đủ thông tin', 422);
        }

        if ($b['new_password'] !== $b['confirm_password']) {
            return $this->error('Mật khẩu xác nhận không khớp', 422);
        }

        if (strlen($b['new_password']) < 6) {
            return $this->error('Mật khẩu mới phải có ít nhất 6 ký tự', 422);
        }

        // 3. Lấy thông tin user hiện tại để check mật khẩu cũ
        $user = User::findById($userId);
        if (!$user) return $this->error('User không tồn tại', 404);

        // 4. Kiểm tra mật khẩu cũ
        if (!password_verify($b['old_password'], $user['password_hash'])) {
            return $this->error('Mật khẩu cũ không chính xác', 401);
        }

        // 5. Cập nhật mật khẩu mới
        $newHash = password_hash($b['new_password'], PASSWORD_BCRYPT);
        User::updatePassword($userId, $newHash);

        $this->json(['success' => true, 'message' => 'Đổi mật khẩu thành công']);
    }
}