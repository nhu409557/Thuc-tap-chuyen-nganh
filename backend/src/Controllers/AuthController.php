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

        RegistrationAttempt::create($b['name'], $b['email'], $hash, $code);
        $this->sendVerificationEmail($b['email'], $code);

        $this->json([
            'success' => true,
            'message' => 'Mã xác thực đã được gửi đến email của bạn.',
        ], 200);
    }

    public function verifyRegister()
    {
        $b = $this->request->body;
        if (empty($b['email']) || empty($b['code'])) {
            return $this->error('Thiếu email hoặc mã xác thực', 422);
        }

        $attempt = RegistrationAttempt::findByEmailAndCode($b['email'], $b['code']);
        if (!$attempt) {
            return $this->error('Mã không hợp lệ hoặc đã hết hạn', 401);
        }

        User::createFromHash($attempt['name'], $attempt['email'], $attempt['password_hash']);
        RegistrationAttempt::deleteByEmail($b['email']);

        $this->json(['success' => true, 'message' => 'Đăng ký thành công!'], 201);
    }
    
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

    public function login()
    {
        $b = $this->request->body;
        if (empty($b['email']) || empty($b['password'])) {
            return $this->error('Thiếu email hoặc mật khẩu', 422);
        }

        $user = User::findByEmail($b['email']);
        
        // Kiểm tra User tồn tại và mật khẩu đúng
        if (!$user || !password_verify($b['password'], $user['password_hash'])) {
            return $this->error('Sai email hoặc mật khẩu', 401);
        }

        // Kiểm tra xem tài khoản có bị khóa không
        if (isset($user['is_locked']) && $user['is_locked'] == 1) {
            return $this->error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.', 403);
        }

        $token = JwtHelper::encode(['user_id' => $user['id']]);

        $this->json([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'] 
            ],
        ]);
    }

    public function loginGoogle()
    {
        $b = $this->request->body;
        $credential = $b['credential'] ?? null;

        if (!$credential) {
            return $this->error('Không tìm thấy Google Token', 400);
        }

        // 1. Xác thực Token với Google Server
        $url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . $credential;
        $response = @file_get_contents($url);

        if ($response === false) {
            return $this->error('Token Google không hợp lệ hoặc lỗi kết nối', 401);
        }

        $payload = json_decode($response, true);
        if (!$payload || !isset($payload['email'])) {
            return $this->error('Không lấy được thông tin từ Google', 401);
        }
        
        $email = $payload['email'];
        $name = $payload['name'] ?? 'Google User';
        
        // 2. Tìm User trong DB
        $user = User::findByEmail($email);

        if (!$user) {
            // 3. Nếu chưa có -> Tạo mới
            $randomPassword = bin2hex(random_bytes(16)); 
            $userId = User::create($name, $email, $randomPassword);
            $user = User::findById($userId);
        }

        // Kiểm tra xem tài khoản có bị khóa không
        if (isset($user['is_locked']) && $user['is_locked'] == 1) {
            return $this->error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.', 403);
        }

        // 4. Tạo JWT
        $token = JwtHelper::encode(['user_id' => $user['id']]);

        $this->json([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role']
            ],
        ]);
    }

    public function me()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $user = User::findById($userId);
        if (!$user) return $this->error('Không tìm thấy user', 404);

        if (isset($user['is_locked']) && $user['is_locked'] == 1) {
            return $this->error('Tài khoản đã bị khóa', 403);
        }

        // [CẬP NHẬT] Trả về thêm Gender và Birthday
        $this->json([
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'gender' => $user['gender'] ?? 'other',     // Mới
            'birthday' => $user['birthday'] ?? null,    // Mới
            'created_at' => $user['created_at'],
        ]);
    }

    // [MỚI] Hàm cập nhật thông tin cá nhân (Tên, Giới tính, Ngày sinh)
    public function updateProfile()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $data = $this->request->body;

        $name = $data['name'] ?? '';
        $gender = $data['gender'] ?? 'other';
        $birthday = $data['birthday'] ?? null;

        // 1. Validate Tên
        if (empty($name)) {
            return $this->error('Tên không được để trống', 422);
        }

        // 2. Validate Giới tính (Chỉ nhận male, female, other)
        if (!in_array($gender, ['male', 'female', 'other'])) {
            $gender = 'other';
        }

        // 3. Validate Ngày sinh (> 16 tuổi)
        if ($birthday) {
            try {
                $bdayObj = new \DateTime($birthday);
                $now = new \DateTime();
                
                // Tính khoảng cách tuổi (năm trọn vẹn)
                $age = $now->diff($bdayObj)->y;

                if ($age < 16) {
                    return $this->error('Bạn phải trên 16 tuổi mới được cập nhật thông tin này.', 400);
                }
            } catch (\Exception $e) {
                return $this->error('Định dạng ngày sinh không hợp lệ', 422);
            }
        } else {
            return $this->error('Vui lòng chọn ngày sinh', 422);
        }

        // 4. Gọi Model cập nhật
        $success = User::updateProfile($userId, [
            'name' => $name,
            'gender' => $gender,
            'birthday' => $birthday
        ]);

        if ($success) {
            $this->json(['success' => true, 'message' => 'Cập nhật hồ sơ thành công']);
        } else {
            $this->error('Lỗi khi cập nhật hồ sơ', 500);
        }
    }

    public function forgotPassword()
    {
        $b = $this->request->body;
        if (empty($b['email'])) {
            return $this->error('Thiếu email', 422);
        }

        $user = User::findByEmail($b['email']);
        
        if ($user && isset($user['is_locked']) && $user['is_locked'] == 1) {
             return $this->error('Tài khoản đã bị khóa, không thể khôi phục mật khẩu.', 403);
        }

        if ($user) {
            $code = Email::generateCode();
            PasswordReset::create($user['email'], $code);
            $this->sendPasswordResetEmail($user['email'], $code);
        }

        $this->json(['success' => true, 'message' => 'Nếu email tồn tại, mã khôi phục đã được gửi.']);
    }

    public function resetPassword()
    {
        $b = $this->request->body;
        if (empty($b['email']) || empty($b['code']) || empty($b['password'])) {
            return $this->error('Thiếu thông tin', 422);
        }

        $resetRequest = PasswordReset::findByEmailAndCode($b['email'], $b['code']);
        if (!$resetRequest) {
            return $this->error('Mã không hợp lệ hoặc đã hết hạn', 401);
        }

        User::updatePasswordByEmail($b['email'], $b['password']);
        PasswordReset::deleteByEmail($b['email']);

        $this->json(['success' => true, 'message' => 'Đổi mật khẩu thành công.']);
    }
    
    public function changePassword()
    {
        $userId = AuthMiddleware::userIdOrFail($this->request, $this->response);
        $b = $this->request->body;

        if (empty($b['old_password']) || empty($b['new_password']) || empty($b['confirm_password'])) {
            return $this->error('Vui lòng điền đầy đủ thông tin', 422);
        }

        if ($b['new_password'] !== $b['confirm_password']) {
            return $this->error('Mật khẩu xác nhận không khớp', 422);
        }

        if (strlen($b['new_password']) < 6) {
            return $this->error('Mật khẩu mới phải có ít nhất 6 ký tự', 422);
        }

        $user = User::findById($userId);
        if (!$user) return $this->error('User không tồn tại', 404);

        if (!password_verify($b['old_password'], $user['password_hash'])) {
            return $this->error('Mật khẩu cũ không chính xác', 401);
        }

        $newHash = password_hash($b['new_password'], PASSWORD_BCRYPT);
        User::updatePassword($userId, $newHash);

        $this->json(['success' => true, 'message' => 'Đổi mật khẩu thành công']);
    }
}