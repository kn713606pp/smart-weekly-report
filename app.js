// ----------------------------------------------------------------
// Firebase SDK 匯入
// ----------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// ----------------------------------------------------------------
// Firebase 設定
// TODO: 請將此處的設定物件替換成您自己的 Firebase 專案設定
// ----------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCit5N1bBjQcCYal-WvvXJ26RIS0MUOTZc",
    authDomain: "smart-weekly-report.firebaseapp.com",
    projectId: "smart-weekly-report",
    storageBucket: "smart-weekly-report.appspot.com",
    messagingSenderId: "696359926670",
    appId: "1:696359926670:web:3faca23cefa6d76f3e42df",
    measurementId: "G-H97W9ESTWL"
};

// ----------------------------------------------------------------
// 初始化 Firebase
// ----------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----------------------------------------------------------------
// DOM 元素選取
// ----------------------------------------------------------------
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
const authError = document.getElementById('auth-error');

const logoutBtn = document.getElementById('logout-btn');
const userDisplayName = document.getElementById('user-display-name');

const addTaskForm = document.getElementById('add-task-form');
const taskTitleInput = document.getElementById('task-title');
const taskList = document.getElementById('task-list');

const generateReportBtn = document.getElementById('generate-report-btn');
const reportOutput = document.getElementById('report-output');
const reportContent = document.getElementById('report-content');
const copyReportBtn = document.getElementById('copy-report-btn');

// ----------------------------------------------------------------
// 狀態管理
// ----------------------------------------------------------------
let currentUser = null;
let unsubscribeTasks = null; // 用於取消 Firestore 的監聽器

// ----------------------------------------------------------------
// UI 切換邏輯
// ----------------------------------------------------------------
showRegisterBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    showLoginBtn.classList.remove('text-indigo-600', 'border-indigo-600');
    showLoginBtn.classList.add('text-gray-500');
    showRegisterBtn.classList.add('text-indigo-600', 'border-indigo-600');
    showRegisterBtn.classList.remove('text-gray-500');
    authError.textContent = '';
});

showLoginBtn.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    showRegisterBtn.classList.remove('text-indigo-600', 'border-indigo-600');
    showRegisterBtn.classList.add('text-gray-500');
    showLoginBtn.classList.add('text-indigo-600', 'border-indigo-600');
    showLoginBtn.classList.remove('text-gray-500');
    authError.textContent = '';
});

// ----------------------------------------------------------------
// 使用者身份驗證
// ----------------------------------------------------------------

// 監聽認證狀態變化
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 使用者已登入
        currentUser = user;
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userDisplayName.textContent = currentUser.displayName || currentUser.email;
        fetchTasks(currentUser.uid);
    } else {
        // 使用者已登出
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        userDisplayName.textContent = '';
        // 如果存在監聽器，取消它
        if (unsubscribeTasks) {
            unsubscribeTasks();
        }
        taskList.innerHTML = ''; // 清空任務列表
    }
});

// 註冊邏輯
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    authError.textContent = '';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // 為了讓 onAuthStateChanged 更新 displayName，我們手動更新 currentUser
        userCredential.user.displayName = displayName;
        onAuthStateChanged(auth, () => {}); // 觸發更新

    } catch (error) {
        console.error("註冊失敗:", error);
        authError.textContent = "註冊失敗：" + error.message;
    }
});

// 登入邏輯
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authError.textContent = '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("登入失敗:", error);
        authError.textContent = "登入失敗：帳號或密碼錯誤。";
    }
});

// 登出邏輯
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("登出失敗:", error);
    }
});


// ----------------------------------------------------------------
// 任務管理 (Firestore)
// ----------------------------------------------------------------

// 新增任務
addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (title && currentUser) {
        try {
            await addDoc(collection(db, "tasks"), {
                title: title,
                status: "todo", // 'todo', 'in_progress', 'done'
                creatorId: currentUser.uid,
                assigneeId: currentUser.uid, // MVP 版本預設指派給自己
                createdAt: serverTimestamp(),
                completedAt: null
            });
            taskTitleInput.value = '';
        } catch (error) {
            console.error("新增任務失敗:", error);
        }
    }
});

// 取得並監聽任務
function fetchTasks(userId) {
    if (!userId) return;
    
    const tasksRef = collection(db, "tasks");
    const q = query(tasksRef, where("assigneeId", "==", userId), orderBy("createdAt", "desc"));

    // onSnapshot 會建立一個即時監聽器
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const tasks = [];
        snapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        renderTasks(tasks);
    }, (error) => {
        console.error("取得任務失敗:", error);
    });
}

// 渲染任務到畫面上
function renderTasks(tasks) {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-gray-500 text-center">目前沒有任務。</p>';
        return;
    }

    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `p-3 rounded-lg flex items-center justify-between transition ${task.status === 'done' ? 'bg-green-100 text-gray-500' : 'bg-gray-50'}`;
        taskElement.innerHTML = `
            <span class="${task.status === 'done' ? 'line-through' : ''}">${task.title}</span>
            <div class="flex items-center gap-2">
                <select data-id="${task.id}" class="task-status-select border-gray-300 rounded-md text-sm">
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>待處理</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>進行中</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>已完成</option>
                </select>
                <button data-id="${task.id}" class="delete-task-btn text-red-500 hover:text-red-700">&#x2715;</button>
            </div>
        `;
        taskList.appendChild(taskElement);
    });
}

// 事件代理：處理任務列表中的點擊事件
taskList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-task-btn')) {
        const taskId = e.target.dataset.id;
        deleteTask(taskId);
    }
});

taskList.addEventListener('change', (e) => {
    if (e.target.classList.contains('task-status-select')) {
        const taskId = e.target.dataset.id;
        const newStatus = e.target.value;
        updateTaskStatus(taskId, newStatus);
    }
});


// 更新任務狀態
async function updateTaskStatus(taskId, newStatus) {
    const taskRef = doc(db, "tasks", taskId);
    const updateData = { status: newStatus };
    if (newStatus === 'done') {
        updateData.completedAt = serverTimestamp();
    } else {
        updateData.completedAt = null;
    }
    try {
        await updateDoc(taskRef, updateData);
    } catch (error) {
        console.error("更新任務狀態失敗:", error);
    }
}

// 刪除任務
async function deleteTask(taskId) {
    if (confirm("確定要刪除這個任務嗎？")) {
        try {
            await deleteDoc(doc(db, "tasks", taskId));
        } catch (error) {
            console.error("刪除任務失敗:", error);
        }
    }
}

// ----------------------------------------------------------------
// 週報生成
// ----------------------------------------------------------------
generateReportBtn.addEventListener('click', () => {
    if (!currentUser) return;

    // 計算一週前的日期
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const tasksRef = collection(db, "tasks");
    const q = query(
        tasksRef, 
        where("assigneeId", "==", currentUser.uid),
        where("status", "==", "done"),
        where("completedAt", ">=", oneWeekAgo)
    );

    // 這裡我們使用 onSnapshot，但只取一次資料。
    // 在真實應用中，也可以用 getDocs 來只取一次。
    const unsubscribe = onSnapshot(q, (snapshot) => {
        let reportText = `本週 (${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}) 已完成任務：\n\n`;
        if (snapshot.empty) {
            reportText += "- 無";
        } else {
            snapshot.forEach((doc, index) => {
                reportText += `${index + 1}. ${doc.data().title}\n`;
            });
        }
        
        reportContent.value = reportText;
        reportOutput.classList.remove('hidden');

        // 取得資料後就取消監聽，避免不必要的更新
        unsubscribe();
    });
});

copyReportBtn.addEventListener('click', () => {
    reportContent.select();
    document.execCommand('copy');
    copyReportBtn.textContent = '已複製！';
    setTimeout(() => {
        copyReportBtn.textContent = '複製內容';
    }, 2000);
});

