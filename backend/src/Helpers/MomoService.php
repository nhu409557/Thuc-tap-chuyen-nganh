<?php
namespace App\Helpers;

class MomoService
{
    public static function createPayment(int $orderId, int $amount)
    {
        $endpoint = $_ENV['MOMO_ENDPOINT'];
        $partnerCode = $_ENV['MOMO_PARTNER_CODE'];
        $accessKey = $_ENV['MOMO_ACCESS_KEY'];
        $secretKey = $_ENV['MOMO_SECRET_KEY'];
        
        // Lưu ý: requestId phải là duy nhất.
        $requestId = (string)time() . "_" . $orderId; 
        $orderInfo = "Thanh toan don hang #" . $orderId;
        
        // Redirect về trang account sau khi thanh toán
        $redirectUrl = $_ENV['APP_URL'] . "/account.html"; 
        $ipnUrl = $_ENV['APP_URL'] . "/payment/momo-ipn"; 
        
        $extraData = "";

        // Tạo chữ ký
        $rawHash = "accessKey=" . $accessKey . 
                   "&amount=" . $amount . 
                   "&extraData=" . $extraData . 
                   "&ipnUrl=" . $ipnUrl . 
                   "&orderId=" . $requestId . 
                   "&orderInfo=" . $orderInfo . 
                   "&partnerCode=" . $partnerCode . 
                   "&redirectUrl=" . $redirectUrl . 
                   "&requestId=" . $requestId . 
                   "&requestType=captureWallet";

        $signature = hash_hmac("sha256", $rawHash, $secretKey);

        $data = [
            'partnerCode' => $partnerCode,
            'partnerName' => "TechHub Store",
            'storeId' => "MomoTestStore",
            'requestId' => $requestId,
            'amount' => $amount,
            'orderId' => $requestId,
            'orderInfo' => $orderInfo,
            'redirectUrl' => $redirectUrl,
            'ipnUrl' => $ipnUrl,
            'lang' => 'vi',
            'extraData' => $extraData,
            'requestType' => 'captureWallet',
            'signature' => $signature
        ];

        $result = self::execPostRequest($endpoint, json_encode($data));
        return json_decode($result, true);
    }

    private static function execPostRequest($url, $data)
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($data)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20); // Tăng timeout lên 20s
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
        
        // ⚠️ QUAN TRỌNG: Tắt kiểm tra SSL khi chạy Localhost (Fix lỗi cURL Error)
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        
        $result = curl_exec($ch);
        
        // Kiểm tra lỗi cURL
        if (curl_errno($ch)) {
            $error_msg = curl_error($ch);
            curl_close($ch);
            // Trả về chuỗi JSON báo lỗi để Controller bắt được
            return json_encode(['message' => 'cURL Error: ' . $error_msg]);
        }
        
        curl_close($ch);
        return $result;
    }
}