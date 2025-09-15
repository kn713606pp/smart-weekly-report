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
    updateProfile,
    GoogleAuthProvider,
    signInWithRedirect, // 改用 Redirect
    getRedirectResult   // 新增，用來接收 Redirect 結果
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
    orderBy,
    Timestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ----------------------------------------------------------------
// Firebase 設定 (維持不變)
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
const googleProvider = new GoogleAuthProvider();

// ----------------------------------------------------------------
// DOM 元素選取
// ----------------------------------------------------------------
const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const googleSigninBtn = document.getElementById('google-signin-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
const authError = document.getElementById('auth-error');
// 其餘 DOM 元素維持不變
const appContainer = document.getElementById('app-container');
const logoutBtn = document.getElementById('logout-btn');
const userDisplayName = document.getElementById('user-display-name');
const taskList = document.getElementById('task-list');
const taskLoader = document.getElementById('task-loader');
const viewToggleContainer = document.getElementById('view-toggle-container');
const filterContainer = document.getElementById('filter-container');
const addNewTaskBtn = document.getElementById('add-new-task-btn');
const taskModal = document.getElementById('task-modal');
const modalTitle = document.getElementById('modal-title');
const modalTaskForm = document.getElementById('modal-task-form');
const modalTaskId = document.getElementById('modal-task-id');
const modalTaskTitle = document.getElementById('modal-task-title');
const modalTaskAssignee = document.getElementById('modal-task-assignee');
const modalTaskDesc = document.getElementById('modal-task-desc');
const modalTaskDueDate = document.getElementById('modal-task-due-date');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const taskDetailModal = document.getElementById('task-detail-modal');
const detailModalTitle = document.getElementById('detail-modal-title');
const detailModalBody = document.getElementById('detail-modal-body');
const detailModalCloseBtn = document.getElementById('detail-modal-close-btn');
const addCommentForm = document.getElementById('add-comment-form');
const commentInput = document.getElementById('comment-input');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

// ----------------------------------------------------------------
// 狀態管理 (維持不變)
// ----------------------------------------------------------------
let currentUser = null;
let allUsers = [];
let allTasks = [];
let currentView = 'assigned';
let currentFilter = 'all';
let unsubscribeTasks = null;
let unsubscribeComments = null;

// ----------------------------------------------------------------
// 輔助函式
// ----------------------------------------------------------------
function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    if (isLoading) {
        button.disabled = true;
        btnText.style.visibility = 'hidden';
        btnText.style.opacity = '0';
        spinner.style.display = 'inline-block';
    } else {
        button.disabled = false;
        btnText.style.visibility = 'visible';
        btnText.style.opacity = '1';
        spinner.style.display = 'none';
    }
}

function showGlobalLoader(text = '處理中...') {
    loaderText.textContent = text;
    globalLoader.classList.remove('hidden');
}

function hideGlobalLoader() {
    globalLoader.classList.add('hidden');
}

// ----------------------------------------------------------------
// 使用者身份驗證 & 資料同步
// ----------------------------------------------------------------

// 1. 頁面載入時，立即檢查是否有從 Google 登入跳轉回來的結果
getRedirectResult(auth)
    .then((result) => {
        if (result) {
            // 如果有 result，代表是從 Google 登入成功跳轉回來的
            // onAuthStateChanged 會自動被觸發，所以這裡不用做特別的事
            // 可以在這裡顯示一個短暫的歡迎訊息
            showGlobalLoader('Google 登入成功，載入資料中...');
        }
    })
    .catch((error) => {
        console.error("Google Redirect 錯誤:", error);
        authError.textContent = `Google 登入失敗: ${error.message}`;
    })
    .finally(() => {
        // 不論成功失敗，都隱藏載入畫面，讓 onAuthStateChanged 接手
        // 延遲一點隱藏，讓使用者看到訊息
        setTimeout(hideGlobalLoader, 500);
    });

// 2. 監聽使用者登入狀態的變化
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        // 使用 setDoc + merge:true 來建立或更新使用者資料
        await setDoc(userRef, {
            displayName: user.displayName,
            email: user.email
        }, { merge: true });

        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userDisplayName.textContent = currentUser.displayName || currentUser.email;
        
        await fetchUsers();
        fetchTasks();
    } else {
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        if (unsubscribeTasks) unsubscribeTasks();
        if (unsubscribeComments) unsubscribeComments();
        allTasks = [];
        allUsers = [];
        taskList.innerHTML = '';
    }
    // 確保所有流程跑完後，載入畫面是隱藏的
    hideGlobalLoader();
});

// 表單切換
showLoginBtn.addEventListener('click', () => { /* ... (維持不變) ... */ });
showRegisterBtn.addEventListener('click', () => { /* ... (維持不變) ... */ });

// 註冊邏輯
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // 絕對要放在第一行
    setButtonLoading(registerSubmitBtn, true);
    authError.textContent = '';
    
    const displayName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
    } catch (error) {
        console.error("註冊錯誤:", error);
        authError.textContent = "註冊失敗：" + error.message;
    } finally {
        setButtonLoading(registerSubmitBtn, false);
    }
});

// 登入邏輯
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // 絕對要放在第一行
    setButtonLoading(loginSubmitBtn, true);
    authError.textContent = '';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("登入錯誤:", error);
        authError.textContent = "登入失敗：帳號或密碼錯誤。";
    } finally {
        setButtonLoading(loginSubmitBtn, false);
    }
});

// Google 登入邏輯 (改用 Redirect)
googleSigninBtn.addEventListener('click', async () => {
    authError.textContent = '';
    showGlobalLoader('正在重新導向至 Google 登入...');
    try {
        // 這會直接導向到 Google 頁面，頁面會刷新
        await signInWithRedirect(auth, googleProvider);
    } catch (error) {
        console.error("Google Redirect 啟動失敗:", error);
        authError.textContent = "無法啟動 Google 登入流程。";
        hideGlobalLoader();
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// 取得所有使用者資料
async function fetchUsers() { /* ... (維持不變) ... */ }

// --- 後續所有 Modal 和任務管理的程式碼都維持不變 ---
// --- 為了簡潔，此處省略，但請確保您的檔案中包含所有功能 ---
showLoginBtn.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    showRegisterBtn.classList.remove('text-indigo-600', 'border-indigo-600');
    showRegisterBtn.classList.add('text-gray-500');
    showLoginBtn.classList.add('text-indigo-600', 'border-indigo-600');
    showLoginBtn.classList.remove('text-gray-500');
    authError.textContent = '';
});
showRegisterBtn.addEventListener('click', () => {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    showLoginBtn.classList.remove('text-indigo-600', 'border-indigo-600');
    showLoginBtn.classList.add('text-gray-500');
    showRegisterBtn.classList.add('text-indigo-600', 'border-indigo-600');
    showRegisterBtn.classList.remove('text-gray-500');
    authError.textContent = '';
});
async function fetchUsers() {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("displayName"));
    
    onSnapshot(q, (snapshot) => {
        allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateAssigneeDropdown();
    });
}
function openModal(modalElement) { modalElement.classList.remove('hidden'); }
function closeModal(modalElement) { modalElement.classList.add('hidden'); }
addNewTaskBtn.addEventListener('click', () => {
    modalTaskForm.reset();
    modalTaskId.value = '';
    modalTitle.textContent = '新增任務';
    populateAssigneeDropdown();
    openModal(taskModal);
});
function openEditModal(task) {
    modalTaskForm.reset();
    modalTitle.textContent = '編輯任務';
    modalTaskId.value = task.id;
    modalTaskTitle.value = task.title;
    modalTaskDesc.value = task.description || '';
    if (task.dueDate && task.dueDate.toDate) {
       modalTaskDueDate.value = task.dueDate.toDate().toISOString().split('T')[0];
    }
    populateAssigneeDropdown(task.assigneeId);
    openModal(taskModal);
}
async function openDetailModal(task) {
    if(unsubscribeComments) unsubscribeComments();

    detailModalTitle.textContent = task.title;
    detailModalBody.innerHTML = `<div class="mb-4"><p class="text-sm text-gray-500">詳細描述</p><p class="p-2 bg-gray-100 rounded">${task.description || '無'}</p></div><div class="grid grid-cols-2 gap-4 mb-4 text-sm"><div><p class="text-gray-500">建立者</p><p>${task.creatorName || 'N/A'}</p></div><div><p class="text-gray-500">指派給</p><p>${task.assigneeName || 'N/A'}</p></div><div><p class="text-gray-500">截止日期</p><p>${task.dueDate ? task.dueDate.toDate().toLocaleDateString() : '無'}</p></div><div><p class="text-gray-500">狀態</p><p>${task.status}</p></div></div><hr><h3 class="font-semibold mt-4 mb-2">溝通與回報</h3><div id="comments-container" class="space-y-3 max-h-60 overflow-y-auto comment-box"><p class="text-gray-400 text-center">載入中...</p></div>`;
    addCommentForm.dataset.taskId = task.id;
    openModal(taskDetailModal);

    const commentsRef = collection(db, `tasks/${task.id}/comments`);
    const q = query(commentsRef, orderBy("createdAt", "asc"));
    unsubscribeComments = onSnapshot(q, (snapshot) => {
        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '';
        if(snapshot.empty) {
            commentsContainer.innerHTML = '<p class="text-gray-400 text-center">尚無回報</p>';
        } else {
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentEl = document.createElement('div');
                const isCurrentUser = comment.authorId === currentUser.uid;
                commentEl.className = `flex gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`;
                commentEl.innerHTML = `<div class="max-w-xs md:max-w-md"><p class="text-xs text-gray-500 ${isCurrentUser ? 'text-right' : ''}">${comment.authorName} - ${comment.createdAt.toDate().toLocaleString()}</p><p class="p-2 rounded-lg ${isCurrentUser ? 'bg-indigo-100' : 'bg-gray-100'}">${comment.text}</p></div>`;
                commentsContainer.appendChild(commentEl);
            });
            commentsContainer.scrollTop = commentsContainer.scrollHeight;
        }
    });
}
modalCancelBtn.addEventListener('click', () => closeModal(taskModal));
detailModalCloseBtn.addEventListener('click', () => {
    closeModal(taskDetailModal);
    if(unsubscribeComments) unsubscribeComments();
});
deleteCancelBtn.addEventListener('click', () => closeModal(deleteConfirmModal));
document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });
});
function populateAssigneeDropdown(selectedId = null) {
    modalTaskAssignee.innerHTML = '<option value="">選擇指派對象</option>';
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.displayName;
        if (user.id === selectedId) {
            option.selected = true;
        }
        modalTaskAssignee.appendChild(option);
    });
}
modalTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const selectedAssignee = allUsers.find(u => u.id === modalTaskAssignee.value);
    if (!selectedAssignee) {
        alert("請選擇指派對象");
        return;
    }

    const id = modalTaskId.value;
    const taskData = {
        title: modalTaskTitle.value.trim(),
        description: modalTaskDesc.value.trim(),
        assigneeId: selectedAssignee.id,
        assigneeName: selectedAssignee.displayName,
        dueDate: modalTaskDueDate.value ? Timestamp.fromDate(new Date(modalTaskDueDate.value)) : null,
        updatedAt: serverTimestamp(),
    };

    try {
        if (id) {
            await updateDoc(doc(db, "tasks", id), taskData);
        } else {
            await addDoc(collection(db, "tasks"), {
                ...taskData,
                status: "todo",
                creatorId: currentUser.uid,
                creatorName: currentUser.displayName,
                createdAt: serverTimestamp(),
            });
        }
        closeModal(taskModal);
    } catch (error) {
        console.error("儲存任務失敗:", error);
    }
});
addCommentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = e.target.dataset.taskId;
    const text = commentInput.value.trim();
    if (!text || !taskId) return;

    try {
        const commentsRef = collection(db, `tasks/${taskId}/comments`);
        await addDoc(commentsRef, {
            text,
            authorId: currentUser.uid,
            authorName: currentUser.displayName,
            createdAt: serverTimestamp(),
        });
        commentInput.value = '';
    } catch (error) {
        console.error("新增評論失敗:", error);
    }
});
deleteConfirmBtn.addEventListener('click', async (e) => {
    const taskId = e.target.dataset.id;
    if (taskId) {
        try {
            await deleteDoc(doc(db, "tasks", taskId));
            closeModal(deleteConfirmModal);
        } catch (error) {
            console.error("刪除任務失敗:", error);
        }
    }
});
viewToggleContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        currentView = e.target.dataset.view;
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        e.target.classList.add('bg-indigo-600', 'text-white');
        fetchTasks();
    }
});
filterContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        currentFilter = e.target.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('bg-indigo-500', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        e.target.classList.add('bg-indigo-500', 'text-white');
        renderTasks();
    }
});
function fetchTasks() {
    if (!currentUser) return;
    if (unsubscribeTasks) unsubscribeTasks();

    taskLoader.classList.remove('hidden');
    taskList.innerHTML = '';

    const tasksRef = collection(db, "tasks");
    const queryField = currentView === 'assigned' ? 'assigneeId' : 'creatorId';
    const q = query(tasksRef, where(queryField, "==", currentUser.uid), orderBy("createdAt", "desc"));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        taskLoader.classList.add('hidden');
        renderTasks();
    });
}
function renderTasks() {
    taskList.innerHTML = '';
    const filteredTasks = allTasks.filter(task => currentFilter === 'all' || task.status === currentFilter);

    if (filteredTasks.length === 0) {
        taskList.innerHTML = `<div class="text-center py-8"><i class="fas fa-folder-open text-3xl text-gray-400"></i><p class="mt-2 text-gray-500">這個分類中沒有任務。</p></div>`;
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredTasks.forEach(task => {
        const isOverdue = task.dueDate && task.dueDate.toDate() < today && task.status !== 'done';
        const taskElement = document.createElement('div');
        taskElement.className = `p-4 rounded-lg flex items-start justify-between transition border cursor-pointer hover:shadow-md hover:border-indigo-300 ${isOverdue ? 'border-red-400 bg-red-50' : 'bg-white border-gray-200'}`;
        taskElement.dataset.taskId = task.id;

        taskElement.innerHTML = `<div class="flex-grow"><p class="font-semibold">${task.title}</p><div class="text-xs mt-2 space-y-1 ${isOverdue ? 'text-red-600' : 'text-gray-500'}"><p><i class="fas fa-user-tag mr-1 w-4 text-center"></i> 指派給: ${task.assigneeName}</p><p><i class="fas fa-calendar-alt mr-1 w-4 text-center"></i> 截止: ${task.dueDate ? task.dueDate.toDate().toLocaleDateString() : '無'}</p></div></div><div class="flex items-center gap-2 ml-4 flex-shrink-0"><select data-id="${task.id}" class="task-status-select border-gray-300 rounded-md text-sm py-1"><option value="todo" ${task.status === 'todo' ? 'selected' : ''}>待處理</option><option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>進行中</option><option value="done" ${task.status === 'done' ? 'selected' : ''}>已完成</option></select><button data-id="${task.id}" class="edit-task-btn text-blue-500 hover:text-blue-700 w-8 h-8 rounded-full hover:bg-blue-100 flex items-center justify-center"><i class="fas fa-pencil-alt"></i></button><button data-id="${task.id}" class="delete-task-btn text-red-500 hover:text-red-700 w-8 h-8 rounded-full hover:bg-red-100 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button></div>`;
        taskList.appendChild(taskElement);
    });
}
taskList.addEventListener('click', (e) => {
    const target = e.target;
    const taskCard = target.closest('[data-task-id]');
    
    if (target.closest('.edit-task-btn')) {
        const taskId = target.closest('.edit-task-btn').dataset.id;
        const task = allTasks.find(t => t.id === taskId);
        if(task) openEditModal(task);
    } else if (target.closest('.delete-task-btn')) {
        const taskId = target.closest('.delete-task-btn').dataset.id;
        deleteConfirmBtn.dataset.id = taskId;
        openModal(deleteConfirmModal);
    } else if (taskCard) {
        const taskId = taskCard.dataset.taskId;
        const task = allTasks.find(t => t.id === taskId);
        if(task) openDetailModal(task);
    }
});
taskList.addEventListener('change', async (e) => {
    if (e.target.classList.contains('task-status-select')) {
        const taskId = e.target.dataset.id;
        const newStatus = e.target.value;
        const updateData = { status: newStatus };
        if (newStatus === 'done') {
            updateData.completedAt = serverTimestamp();
        } else {
            updateData.completedAt = null;
        }
        try {
            await updateDoc(doc(db, "tasks", taskId), updateData);
        } catch (error) {
            console.error("更新狀態失敗:", error);
        }
    }
});
document.getElementById('generate-report-btn').addEventListener('click', () => {
    if (!currentUser) return;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const q = query(
        collection(db, "tasks"), 
        where("assigneeId", "==", currentUser.uid),
        where("status", "==", "done"),
        where("completedAt", ">=", oneWeekAgo)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        let reportText = `本週 (${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}) 已完成任務：\n\n`;
        if (snapshot.empty) {
            reportText += "- 無";
        } else {
            snapshot.forEach((doc, index) => {
                reportText += `${index + 1}. ${doc.data().title}\n`;
            });
        }
        
        document.getElementById('report-content').value = reportText;
        document.getElementById('report-output').classList.remove('hidden');

        unsubscribe();
    });
});
document.getElementById('copy-report-btn').addEventListener('click', () => {
    const reportContent = document.getElementById('report-content');
    reportContent.select();
    document.execCommand('copy');
    const btn = document.getElementById('copy-report-btn');
    btn.textContent = '已複製！';
    setTimeout(() => { btn.textContent = '複製內容'; }, 2000);
});

