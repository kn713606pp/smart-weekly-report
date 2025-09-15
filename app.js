// ----------------------------------------------------------------
// 診斷版 app.js
// 目標：只處理驗證，並在每一步都輸出詳細日誌到 Console。
// ----------------------------------------------------------------

console.log("app.js 腳本已載入。");

// 匯入 Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

console.log("Firebase SDK 模組已匯入。");

// DOM 元素
const statusPanel = document.getElementById('status-panel');
const authError = document.getElementById('auth-error');
const googleSigninBtn = document.getElementById('google-signin-btn');
const loginForm = document.getElementById('login-form');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const userDisplayName = document.getElementById('user-display-name');
const userUid = document.getElementById('user-uid');
const logoutBtn = document.getElementById('logout-btn');

// Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyCit5N1bBjQcCYal-WvvXJ26RIS0MUOTZc",
    authDomain: "smart-weekly-report.firebaseapp.com",
    projectId: "smart-weekly-report",
    storageBucket: "smart-weekly-report.appspot.com",
    messagingSenderId: "696359926670",
    appId: "1:696359926670:web:3faca23cefa6d76f3e42df",
    measurementId: "G-H97W9ESTWL"
};

// 更新狀態顯示
function updateStatus(message, isError = false) {
    console.log(`[STATUS] ${message}`);
    authError.textContent = message;
    statusPanel.className = `mb-4 p-3 rounded-lg text-center text-sm ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
}

// 主程式
try {
    console.log("準備初始化 Firebase...");
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const googleProvider = new GoogleAuthProvider();
    console.log("Firebase 初始化成功。");

    updateStatus("Firebase 已就緒，請登入。");

    // 啟用按鈕
    googleSigninBtn.disabled = false;
    loginSubmitBtn.disabled = false;

    // 處理 Google 登入重新導向
    console.log("正在檢查 Google 重新導向結果...");
    getRedirectResult(auth)
        .then((result) => {
            if (result) {
                console.log("偵測到 Google 登入結果。", result);
                updateStatus(`歡迎 ${result.user.displayName}！`);
            } else {
                console.log("沒有偵測到 Google 登入重新導向結果。");
            }
        })
        .catch((error) => {
            console.error("處理 Google 重新導向時發生錯誤：", error);
            updateStatus(`Google 登入錯誤： ${error.code}`, true);
        });

    // 監聽登入狀態變化
    onAuthStateChanged(auth, (user) => {
        console.log("Auth 狀態改變，目前使用者：", user ? user.uid : "無");
        if (user) {
            // 已登入
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            userDisplayName.textContent = user.displayName || user.email;
            userUid.textContent = user.uid;
        } else {
            // 已登出
            appContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
        }
    });

    // 綁定事件
    googleSigninBtn.addEventListener('click', () => {
        console.log("Google 登入按鈕被點擊。");
        updateStatus("正在重新導向至 Google...");
        signInWithRedirect(auth, googleProvider).catch(error => {
            console.error("啟動 Google 重新導向失敗：", error);
            updateStatus(`無法啟動 Google 登入：${error.code}`, true);
        });
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("Email 登入表單已送出。");
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        updateStatus("正在嘗試 Email 登入...");

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("Email 登入成功。", userCredential.user);
                updateStatus("登入成功！");
            })
            .catch((error) => {
                console.error("Email 登入失敗：", error);
                updateStatus(`登入失敗：${error.code}`, true);
            });
    });

    logoutBtn.addEventListener('click', () => {
        console.log("登出按鈕被點擊。");
        signOut(auth);
    });

} catch (error) {
    console.error("【嚴重錯誤】Firebase 初始化失敗：", error);
    updateStatus("嚴重錯誤：無法連接至後端服務。", true);
}

