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
    signInWithRedirect,
    getRedirectResult
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
// Firebase 設定 (修正 storageBucket)
// ----------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCit5N1bBjQcCYal-WvvXJ26RIS0MUOTZc",
    authDomain: "smart-weekly-report.firebaseapp.com",
    projectId: "smart-weekly-report",
    // *** 修正：還原為您最初提供的正確值 ***
    storageBucket: "smart-weekly-report.firebasestorage.app", 
    messagingSenderId: "696359926670",
    appId: "1:696359926670:web:3faca23cefa6d76f3e42df",
    measurementId: "G-H97W9ESTWL"
};

// ----------------------------------------------------------------
// 全局變數 & DOM 元素
// ----------------------------------------------------------------
let auth, db, googleProvider;
let currentUser = null, allUsers = [], allTasks = [];
let currentView = 'assigned', currentFilter = 'all';
let unsubscribeTasks = null, unsubscribeComments = null;

const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const statusPanel = document.getElementById('status-panel');
const authError = document.getElementById('auth-error');
const authButtons = document.querySelectorAll('.auth-btn');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const googleSigninBtn = document.getElementById('google-signin-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
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
// 輔助函式
// ----------------------------------------------------------------
function updateStatus(message, isError = false) {
    console.log(`[STATUS] ${isError ? 'ERROR: ' : ''}${message}`);
    authError.textContent = message;
    statusPanel.className = `mb-4 p-3 rounded-lg text-center text-sm ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
}

function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    if (isLoading) {
        button.disabled = true;
        if(btnText && spinner) {
            btnText.style.visibility = 'hidden';
            spinner.style.display = 'inline-block';
        }
    } else {
        button.disabled = false;
        if(btnText && spinner) {
            btnText.style.visibility = 'visible';
            spinner.style.display = 'none';
        }
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
// 主要初始化函式
// ----------------------------------------------------------------
function main() {
    try {
        updateStatus("正在連接後端服務...", false);
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();

        authButtons.forEach(btn => btn.disabled = false);
        updateStatus("Firebase 已就緒，請登入或註冊。", false);

        setupEventListeners();
        handleRedirectResult();
        onAuthStateChanged(auth, handleAuthStateChange);

    } catch (error) {
        console.error("Firebase 初始化失敗:", error);
        updateStatus("錯誤：無法連接至後端服務。", true);
    }
}

// ----------------------------------------------------------------
// 事件監聽器設定
// ----------------------------------------------------------------
function setupEventListeners() {
    loginForm.addEventListener('submit', handleEmailLogin);
    registerForm.addEventListener('submit', handleEmailRegister);
    googleSigninBtn.addEventListener('click', handleGoogleLogin);
    logoutBtn.addEventListener('click', () => signOut(auth));
    showLoginBtn.addEventListener('click', toggleAuthForm);
    showRegisterBtn.addEventListener('click', toggleAuthForm);
    addNewTaskBtn.addEventListener('click', openNewTaskModal);
    modalTaskForm.addEventListener('submit', handleTaskFormSubmit);
    taskList.addEventListener('click', handleTaskListClick);
    taskList.addEventListener('change', handleTaskStatusChange);
    viewToggleContainer.addEventListener('click', handleViewToggle);
    filterContainer.addEventListener('click', handleFilterToggle);
    deleteConfirmBtn.addEventListener('click', handleDeleteTask);
    addCommentForm.addEventListener('submit', handleAddComment);
    modalCancelBtn.addEventListener('click', () => closeModal(taskModal));
    detailModalCloseBtn.addEventListener('click', () => {
        closeModal(taskDetailModal);
        if(unsubscribeComments) unsubscribeComments();
    });
    deleteCancelBtn.addEventListener('click', () => closeModal(deleteConfirmModal));
    document.getElementById('generate-report-btn').addEventListener('click', generateReport);
    document.getElementById('copy-report-btn').addEventListener('click', copyReport);
}

function toggleAuthForm(e) {
    const isLogin = e.target.id === 'show-login-btn';
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    showLoginBtn.classList.toggle('text-indigo-600', isLogin);
    showLoginBtn.classList.toggle('border-indigo-600', isLogin);
    showLoginBtn.classList.toggle('text-gray-500', !isLogin);
    showRegisterBtn.classList.toggle('text-indigo-600', !isLogin);
    showRegisterBtn.classList.toggle('border-indigo-600', !isLogin);
    showRegisterBtn.classList.toggle('text-gray-500', isLogin);
    updateStatus("請登入或註冊", false);
}

// ----------------------------------------------------------------
// 驗證處理函式
// ----------------------------------------------------------------
async function handleRedirectResult() {
    showGlobalLoader("正在檢查登入狀態...");
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log("Google 重新導向成功", result);
            updateStatus(`歡迎 ${result.user.displayName}！`, false);
        }
    } catch (error) {
        console.error("Google 登入錯誤:", error);
        updateStatus(`Google 登入失敗: ${error.code}`, true);
    } finally {
        setTimeout(hideGlobalLoader, 500);
    }
}

async function handleAuthStateChange(user) {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { displayName: user.displayName, email: user.email }, { merge: true });

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
    }
    hideGlobalLoader();
}

async function handleEmailRegister(e) {
    e.preventDefault();
    setButtonLoading(registerSubmitBtn, true);
    
    const displayName = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        updateStatus("註冊成功！將自動登入。", false);
    } catch (error) {
        console.error("註冊錯誤:", error);
        updateStatus(`註冊失敗：${error.code}`, true);
    } finally {
        setButtonLoading(registerSubmitBtn, false);
    }
}

async function handleEmailLogin(e) {
    e.preventDefault();
    setButtonLoading(loginSubmitBtn, true);

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        updateStatus("登入成功！", false);
    } catch (error) {
        console.error("登入錯誤:", error);
        updateStatus(`登入失敗：${error.code}`, true);
    } finally {
        setButtonLoading(loginSubmitBtn, false);
    }
}

async function handleGoogleLogin() {
    updateStatus("正在重新導向至 Google...", false);
    try {
        await signInWithRedirect(auth, googleProvider);
    } catch (error) {
        console.error("Google Redirect 啟動失敗:", error);
        updateStatus("無法啟動 Google 登入流程。", true);
    }
}

// ----------------------------------------------------------------
// 應用程式主要邏輯
// ----------------------------------------------------------------
function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }
function openNewTaskModal() { modalTaskForm.reset(); modalTaskId.value = ""; modalTitle.textContent = "新增任務"; populateAssigneeDropdown(); openModal(taskModal); }
async function handleTaskFormSubmit(e) { e.preventDefault(); if (!currentUser) return; const t = allUsers.find(e => e.id === modalTaskAssignee.value); if (!t) return void alert("請選擇指派對象"); const o = modalTaskId.value, n = { title: modalTaskTitle.value.trim(), description: modalTaskDesc.value.trim(), assigneeId: t.id, assigneeName: t.displayName, dueDate: modalTaskDueDate.value ? Timestamp.fromDate(new Date(modalTaskDueDate.value)) : null, updatedAt: serverTimestamp() }; try { o ? await updateDoc(doc(db, "tasks", o), n) : await addDoc(collection(db, "tasks"), { ...n, status: "todo", creatorId: currentUser.uid, creatorName: currentUser.displayName, createdAt: serverTimestamp() }), closeModal(taskModal) } catch (e) { console.error("儲存任務失敗:", e) } }
function handleTaskListClick(e) { const t = e.target, o = t.closest("[data-task-id]"); if (t.closest(".edit-task-btn")) { const o = t.closest(".edit-task-btn").dataset.id, n = allTasks.find(e => e.id === o); n && openEditModal(n) } else if (t.closest(".delete-task-btn")) { const o = t.closest(".delete-task-btn").dataset.id; deleteConfirmBtn.dataset.id = o, openModal(deleteConfirmModal) } else if (o) { const e = o.dataset.taskId, t = allTasks.find(t => t.id === e); t && openDetailModal(t) } }
async function handleTaskStatusChange(e) { if (e.target.classList.contains("task-status-select")) { const t = e.target.dataset.id, o = e.target.value, n = { status: o }; "done" === o ? n.completedAt = serverTimestamp() : n.completedAt = null; try { await updateDoc(doc(db, "tasks", t), n) } catch (e) { console.error("更新狀態失敗:", e) } } }
function handleViewToggle(e) { if ("BUTTON" === e.target.tagName) { currentView = e.target.dataset.view; document.querySelectorAll(".view-toggle-btn").forEach(e => { e.classList.remove("bg-indigo-600", "text-white"), e.classList.add("bg-gray-200", "text-gray-700") }); e.target.classList.add("bg-indigo-600", "text-white"); fetchTasks() } }
function handleFilterToggle(e) { if ("BUTTON" === e.target.tagName) { currentFilter = e.target.dataset.filter; document.querySelectorAll(".filter-btn").forEach(e => { e.classList.remove("bg-indigo-500", "text-white"), e.classList.add("bg-gray-200", "text-gray-700") }); e.target.classList.add("bg-indigo-500", "text-white"); renderTasks() } }
async function handleDeleteTask(e) { const t = e.target.closest("#delete-confirm-modal").querySelector("#delete-confirm-btn").dataset.id; t && deleteDoc(doc(db, "tasks", t)).then(() => closeModal(deleteConfirmModal)).catch(e => console.error("刪除任務失敗:", e)) }
async function handleAddComment(e) { e.preventDefault(); const t = addCommentForm.dataset.taskId, o = commentInput.value.trim(); if (!o || !t) return; try { const e = collection(db, `tasks/${t}/comments`); await addDoc(e, { text: o, authorId: currentUser.uid, authorName: currentUser.displayName, createdAt: serverTimestamp() }); commentInput.value = "" } catch (e) { console.error("新增評論失敗:", e) } }
async function fetchUsers() { const e = collection(db, "users"), t = query(e, orderBy("displayName")); onSnapshot(t, e => { allUsers = e.docs.map(e => ({ id: e.id, ...e.data() })); populateAssigneeDropdown() }) }
function fetchTasks() { if (!currentUser) return; unsubscribeTasks && unsubscribeTasks(); taskLoader.classList.remove("hidden"); taskList.innerHTML = ""; const e = collection(db, "tasks"), t = "assigned" === currentView ? "assigneeId" : "creatorId", o = query(e, where(t, "==", currentUser.uid), orderBy("createdAt", "desc")); unsubscribeTasks = onSnapshot(o, e => { allTasks = e.docs.map(e => ({ id: e.id, ...e.data() })); taskLoader.classList.add("hidden"); renderTasks() }) }
function renderTasks() { taskList.innerHTML = ""; const e = allTasks.filter(e => "all" === currentFilter || e.status === currentFilter); if (0 === e.length) return void (taskList.innerHTML = '<div class="text-center py-8"><i class="fas fa-folder-open text-3xl text-gray-400"></i><p class="mt-2 text-gray-500">這個分類中沒有任務。</p></div>'); const t = new Date; t.setHours(0, 0, 0, 0); e.forEach(e => { const o = e.dueDate && e.dueDate.toDate() < t && "done" !== e.status, n = document.createElement("div"); n.className = `p-4 rounded-lg flex items-start justify-between transition border cursor-pointer hover:shadow-md hover:border-indigo-300 ${o ? "border-red-400 bg-red-50" : "bg-white border-gray-200"}`; n.dataset.taskId = e.id; n.innerHTML = `<div class="flex-grow"><p class="font-semibold">${e.title}</p><div class="text-xs mt-2 space-y-1 ${o ? "text-red-600" : "text-gray-500"}"><p><i class="fas fa-user-tag mr-1 w-4 text-center"></i> 指派給: ${e.assigneeName}</p><p><i class="fas fa-calendar-alt mr-1 w-4 text-center"></i> 截止: ${e.dueDate ? e.dueDate.toDate().toLocaleDateString() : "無"}</p></div></div><div class="flex items-center gap-2 ml-4 flex-shrink-0"><select data-id="${e.id}" class="task-status-select border-gray-300 rounded-md text-sm py-1"><option value="todo" ${"todo" === e.status ? "selected" : ""}>待處理</option><option value="in_progress" ${"in_progress" === e.status ? "selected" : ""}>進行中</option><option value="done" ${"done" === e.status ? "selected" : ""}>已完成</option></select><button data-id="${e.id}" class="edit-task-btn text-blue-500 hover:text-blue-700 w-8 h-8 rounded-full hover:bg-blue-100 flex items-center justify-center"><i class="fas fa-pencil-alt"></i></button><button data-id="${e.id}" class="delete-task-btn text-red-500 hover:text-red-700 w-8 h-8 rounded-full hover:bg-red-100 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button></div>`; taskList.appendChild(n) }) }
function openEditModal(e) { modalTaskForm.reset(); modalTitle.textContent = "編輯任務"; modalTaskId.value = e.id; modalTaskTitle.value = e.title; modalTaskDesc.value = e.description || ""; e.dueDate && e.dueDate.toDate && (modalTaskDueDate.value = e.dueDate.toDate().toISOString().split("T")[0]); populateAssigneeDropdown(e.assigneeId); openModal(taskModal) }
async function openDetailModal(e) { unsubscribeComments && unsubscribeComments(); detailModalTitle.textContent = e.title; detailModalBody.innerHTML = `<div class="mb-4"><p class="text-sm text-gray-500">詳細描述</p><p class="p-2 bg-gray-100 rounded">${e.description || "無"}</p></div><div class="grid grid-cols-2 gap-4 mb-4 text-sm"><div><p class="text-gray-500">建立者</p><p>${e.creatorName || "N/A"}</p></div><div><p class="text-gray-500">指派給</p><p>${e.assigneeName || "N/A"}</p></div><div><p class="text-gray-500">截止日期</p><p>${e.dueDate ? e.dueDate.toDate().toLocaleDateString() : "無"}</p></div><div><p class="text-gray-500">狀態</p><p>${e.status}</p></div></div><hr><h3 class="font-semibold mt-4 mb-2">溝通與回報</h3><div id="comments-container" class="space-y-3 max-h-60 overflow-y-auto comment-box"><p class="text-gray-400 text-center">載入中...</p></div>`; addCommentForm.dataset.taskId = e.id; openModal(taskDetailModal); const t = collection(db, `tasks/${e.id}/comments`), o = query(t, orderBy("createdAt", "asc")); unsubscribeComments = onSnapshot(o, e => { const t = document.getElementById("comments-container"); if (t.innerHTML = "", e.empty) t.innerHTML = '<p class="text-gray-400 text-center">尚無回報</p>'; else { e.forEach(e => { const o = e.data(), n = document.createElement("div"), s = o.authorId === currentUser.uid; n.className = `flex gap-2 ${s ? "justify-end" : "justify-start"}`; n.innerHTML = `<div class="max-w-xs md:max-w-md"><p class="text-xs text-gray-500 ${s ? "text-right" : ""}">${o.authorName} - ${o.createdAt.toDate().toLocaleString()}</p><p class="p-2 rounded-lg ${s ? "bg-indigo-100" : "bg-gray-100"}">${o.text}</p></div>`; t.appendChild(n) }); t.scrollTop = t.scrollHeight } }) }
function populateAssigneeDropdown(e = null) { modalTaskAssignee.innerHTML = '<option value="">選擇指派對象</option>'; allUsers.forEach(t => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.displayName; t.id === e && (o.selected = !0); modalTaskAssignee.appendChild(o) }) }
function generateReport() { if (!currentUser) return; const e = new Date; e.setDate(e.getDate() - 7); const t = query(collection(db, "tasks"), where("assigneeId", "==", currentUser.uid), where("status", "==", "done"), where("completedAt", ">=", e)), o = onSnapshot(t, t => { let n = `本週 (${e.toLocaleDateString()} - ${new Date().toLocaleDateString()}) 已完成任務：\n\n`; t.empty ? n += "- 無" : t.forEach((e, t) => { n += `${t + 1}. ${e.data().title}\n` }); document.getElementById("report-content").value = n; document.getElementById("report-output").classList.remove("hidden"); o() }) }
function copyReport() { const e = document.getElementById("report-content"); e.select(); document.execCommand("copy"); const t = document.getElementById("copy-report-btn"); t.textContent = "已複製！"; setTimeout(() => { t.textContent = "複製內容" }, 2e3) }

// ----------------------------------------------------------------
// 啟動應用程式
// ----------------------------------------------------------------
main();

