// assets/js/auth.js

import { api } from "./api.js";
import { setToken, removeToken } from "./utils/storage.js";
import { showToast } from "./ui/toast.js";

// === HÀM INITLOGIN ===
function initLogin() {
    const form = document.querySelector("#login-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const [emailInput, passwordInput] = form.querySelectorAll("input");
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showToast("Vui lòng nhập email và mật khẩu", "error");
            return;
        }

        // Hiệu ứng loading
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Đang xử lý...";

        try {
            const res = await api.login(email, password);
            setToken(res.token);

            // 2. Kiểm tra Role để điều hướng
            if (res.user && res.user.role === "admin") {
                // Nếu là ADMIN -> Chuyển vào trang quản trị
                showToast("Xin chào Admin!", "success");
                setTimeout(() => {
                    window.location.href = "admin/index.html";
                }, 800);
            } else {
                // Nếu là USER thường -> Chuyển về trang chủ bán hàng
                showToast("Đăng nhập thành công", "success");
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 800);
            }
        } catch (err) {
            console.error("Login Error:", err);
            showToast(err.message || "Đăng nhập thất bại", "error");
        } finally {
            // Reset nút bấm
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

// === HÀM INITREGISTER ===
function initRegister() {
    const step1Form = document.querySelector("#register-form");
    const step2Form = document.querySelector("#verify-form");
    const step1Div = document.querySelector("#step1-register");
    const step2Div = document.querySelector("#step2-verify");
    const resendBtn = document.querySelector("#resend-code-btn");
    const emailDisplay = document.querySelector("#verify-email-display");
    const backBtn = document.querySelector("#btn-back-to-register");

    if (!step1Form || !step2Form) return;

    let pendingEmail = "";

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            step2Div.classList.add("hidden");
            step1Div.classList.remove("hidden");
        });
    }

    step1Form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputs = step1Form.querySelectorAll("input");
        const name = inputs[0].value.trim();
        const email = inputs[1].value.trim();
        const password = inputs[2].value.trim();
        const password2 = inputs[3].value.trim();

        if (!name || !email || !password || !password2) {
            showToast("Vui lòng điền đầy đủ thông tin", "error");
            return;
        }
        if (password !== password2) {
            showToast("Mật khẩu nhập lại không khớp", "error");
            return;
        }

        const btn = step1Form.querySelector("button");
        btn.disabled = true;
        btn.textContent = "Đang gửi mã...";

        try {
            await api.register(name, email, password);
            pendingEmail = email;
            emailDisplay.textContent = email;

            step1Div.classList.add("hidden");
            step2Div.classList.remove("hidden");
            showToast("Mã xác thực đã được gửi", "success");
        } catch (err) {
            console.error(err);
            showToast(err.message || "Đăng ký thất bại", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Nhận mã xác thực";
        }
    });

    step2Form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = step2Form.querySelector("input").value.trim();
        if (!code || !pendingEmail) {
            showToast("Vui lòng nhập mã xác thực", "error");
            return;
        }

        try {
            await api.verifyRegister(pendingEmail, code);
            showToast("Đăng ký thành công, hãy đăng nhập", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 800);
        } catch (err) {
            console.error(err);
            showToast(err.message || "Mã không đúng hoặc đã hết hạn", "error");
        }
    });

    resendBtn?.addEventListener("click", async () => {
        if (!pendingEmail) return;
        try {
            await api.resendCode(pendingEmail);
            showToast("Đã gửi lại mã (nếu email tồn tại)", "success");
        } catch (err) {
            showToast("Có lỗi xảy ra", "error");
        }
    });
}

// === HÀM FORGOT PASSWORD ===
function initForgotPassword() {
    const form = document.querySelector("#forgot-form");
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get("email");
    const emailInput = form.querySelector('input[name="email"]');
    if (emailFromUrl && emailInput) {
        emailInput.value = emailFromUrl;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        if (!email) {
            showToast("Vui lòng nhập email", "error");
            return;
        }

        const btn = form.querySelector("button");
        btn.disabled = true;

        try {
            const res = await api.forgotPassword(email);
            showToast(res.message || "Yêu cầu đã được gửi", "success");

            setTimeout(() => {
                window.location.href = `reset-password.html?email=${encodeURIComponent(
                    email
                )}`;
            }, 1000);
        } catch (err) {
            // Vì lý do bảo mật, đôi khi vẫn báo thành công kể cả email không tồn tại
            showToast("Yêu cầu đã được gửi (nếu email tồn tại)", "success");
            setTimeout(() => {
                window.location.href = `reset-password.html?email=${encodeURIComponent(
                    email
                )}`;
            }, 1000);
        } finally {
            btn.disabled = false;
        }
    });
}

// === HÀM RESET PASSWORD ===
function initResetPassword() {
    const form = document.querySelector("#reset-form");
    const displayEmail = document.querySelector("#reset-email-display");
    const hiddenEmail = document.querySelector("#reset-email-input");
    const backLink = document.querySelector("#link-back-to-forgot");

    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get("email");

    if (emailFromUrl) {
        if (displayEmail) displayEmail.textContent = emailFromUrl;
        if (hiddenEmail) hiddenEmail.value = emailFromUrl;
        if (backLink)
            backLink.href = `forgot-password.html?email=${encodeURIComponent(
                emailFromUrl
            )}`;
    } else {
        if (displayEmail) displayEmail.textContent = "Không xác định";
        showToast("Lỗi: Không tìm thấy email. Vui lòng thử lại.", "error");
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const emailVal = hiddenEmail.value.trim();
        const codeVal = form.querySelector('input[name="code"]').value.trim();
        const passVal = form
            .querySelector('input[name="password"]')
            .value.trim();
        const pass2Val = form
            .querySelector('input[name="password2"]')
            .value.trim();

        if (!emailVal || !codeVal || !passVal || !pass2Val) {
            showToast("Vui lòng điền đầy đủ thông tin", "error");
            return;
        }
        if (passVal !== pass2Val) {
            showToast("Mật khẩu nhập lại không khớp", "error");
            return;
        }

        try {
            await api.resetPassword(emailVal, codeVal, passVal);
            showToast("Đổi mật khẩu thành công!", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);
        } catch (err) {
            console.error(err);
            showToast(err.message || "Mã không hợp lệ", "error");
        }
    });
}

// === HÀM INITLOGOUTBUTTON ===
export function initLogoutButton() {
    const btn = document.querySelector("#btn-logout");
    if (!btn) return;
    btn.addEventListener("click", () => {
        removeToken();
        showToast("Đã đăng xuất", "default");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);
    });
}

// === DOMCONTENTLOADED ===
document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    initRegister();
    initForgotPassword();
    initResetPassword();
});
