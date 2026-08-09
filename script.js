let currentUser = null;
let statusChart, categoryChart, completedChart;
let editingTaskId = null;
let topics = [];
let currentTopicId = null;
let categories = [];

function signIn() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    if (errorEl) errorEl.textContent = "";
    fetch('http://localhost:3000/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentUser = data.username;
            localStorage.setItem("username", data.username); // Store username in localStorage
            window.location.replace("main.html"); // Use replace for Electron
        } else if (errorEl) {
            errorEl.textContent = "Invalid credentials";
        } else {
            alert("Invalid credentials");
        }
    })
    .catch(() => {
        if (errorEl) errorEl.textContent = "Connection error. Is the server running?";
    });
}

function signUp() {
    const username = document.getElementById("signup-username").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const errorEl = document.getElementById("signup-error");
    if (errorEl) errorEl.textContent = "";
    fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Account created! Please sign in.");
        } else if (errorEl) {
            errorEl.textContent = data.error || "Username or email already exists";
        } else {
            alert("Username or email already exists");
        }
    })
    .catch(() => {
        if (errorEl) errorEl.textContent = "Connection error. Is the server running?";
    });
}

function signOut() {
    currentUser = null;
    localStorage.removeItem("username"); // Clear username from localStorage
    window.location.replace("index.html"); // Use replace for Electron
}

if (window.location.pathname.includes("index.html")) {
    // Simulate a boot sequence on the login page
    const bootText = document.getElementById("boot-text");
    const loginSection = document.getElementById("login-section");
    const bootSequence = [
        "Initializing System...\n",
        "BIOS Version 1.0.0\n",
        "Memory Check: 640KB OK\n",
        "Loading OS...\n",
        "Checking Hardware...\n",
        "CPU: 486DX 33MHz\n",
        "Floppy Drive: A: OK\n",
        "Hard Drive: C: OK\n",
        "Starting Kanban OS...\n",
        "System Ready.\n"
    ];

    let currentLine = 0;
    function displayBootSequence() {
        if (currentLine < bootSequence.length) {
            bootText.textContent += bootSequence[currentLine];
            currentLine++;
            setTimeout(displayBootSequence, 300); // Display each line with a 300ms delay
        } else {
            setTimeout(() => {
                document.getElementById("boot-sequence").style.display = "none";
                loginSection.style.display = "block";
            }, 500); // Wait 500ms before showing the login form
        }
    }
    displayBootSequence();
}

if (window.location.pathname.includes("main.html")) {
    // Check if user is logged in using localStorage
    currentUser = localStorage.getItem("username");
    if (currentUser) {
        document.getElementById("username-display").textContent = currentUser;
        initSidebarState();
        loadStorageInfo();
        loadTopics(); // loads topics, then triggers loadCategories()/loadTasks()/loadStats() once currentTopicId is known
    } else {
        window.location.replace("index.html"); // Redirect to login if not logged in
    }
}

// ---- Sidebar / Topics ----

function initSidebarState() {
    const collapsed = localStorage.getItem("sidebarCollapsed") === "1";
    if (collapsed) {
        document.getElementById("sidebar").classList.add("collapsed");
        document.getElementById("sidebar-toggle-btn").innerHTML = "&raquo;";
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const collapsed = sidebar.classList.toggle("collapsed");
    document.getElementById("sidebar-toggle-btn").innerHTML = collapsed ? "&raquo;" : "&laquo;";
    localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
}

function loadTopics() {
    fetch(`http://localhost:3000/load-topics?username=${currentUser}`)
    .then(response => response.json())
    .then(data => {
        topics = data;
        const savedTopicId = localStorage.getItem(`activeTopic_${currentUser}`);
        const found = topics.find(t => String(t.id) === String(savedTopicId));
        currentTopicId = found ? found.id : (topics[0] ? topics[0].id : null);
        renderTopics();
        loadCategories();
        loadTasks();
        loadStats();
    });
}

function renderTopics() {
    const list = document.getElementById("topic-list");
    list.innerHTML = "";
    topics.forEach(topic => {
        const item = document.createElement("div");
        item.className = "topic-item" + (topic.id === currentTopicId ? " active" : "");

        const nameSpan = document.createElement("span");
        nameSpan.className = "topic-name";
        nameSpan.textContent = topic.name;
        nameSpan.title = topic.name;
        nameSpan.onclick = () => selectTopic(topic.id);

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "topic-action-btn";
        renameBtn.textContent = "✎"; // pencil
        renameBtn.title = "Rename topic";
        renameBtn.onclick = (e) => { e.stopPropagation(); startInlineTopicRename(item, topic); };

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "topic-action-btn";
        deleteBtn.textContent = "✕"; // x
        deleteBtn.title = "Delete topic";
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteTopicPrompt(topic.id, topic.name); };

        const actions = document.createElement("span");
        actions.className = "topic-actions";
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(nameSpan);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

// Electron doesn't implement window.prompt() (it returns null immediately with
// no dialog shown), so renaming is done as an inline, in-place text edit instead.
function startInlineTopicRename(item, topic) {
    const nameSpan = item.querySelector(".topic-name");
    if (!nameSpan) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "topic-name-edit";
    input.value = topic.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    const commit = () => {
        if (settled) return;
        settled = true;
        const newName = input.value.trim();
        if (newName && newName !== topic.name) {
            submitTopicRename(topic.id, newName);
        } else {
            renderTopics();
        }
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            settled = true;
            renderTopics();
        }
    });
}

function submitTopicRename(id, newName) {
    fetch('http://localhost:3000/rename-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, id, name: newName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const topic = topics.find(t => t.id === id);
            if (topic) topic.name = data.topic.name;
        } else {
            alert(data.error || "Failed to rename topic");
        }
        renderTopics();
    })
    .catch(() => {
        alert("Connection error while renaming topic.");
        renderTopics();
    });
}

function deleteTopicPrompt(id, name) {
    if (!confirm(`Delete topic "${name}"? Its tasks will move to your other topic.`)) return;
    fetch('http://localhost:3000/delete-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            topics = topics.filter(t => t.id !== id);
            if (currentTopicId === id) {
                currentTopicId = data.fallbackTopicId;
                localStorage.setItem(`activeTopic_${currentUser}`, currentTopicId);
            }
            renderTopics();
            loadCategories();
            loadTasks();
            loadStats();
        } else {
            alert(data.error || "Failed to delete topic");
        }
    });
}

function selectTopic(id) {
    currentTopicId = id;
    localStorage.setItem(`activeTopic_${currentUser}`, id);
    renderTopics();
    loadCategories();
    loadTasks();
    loadStats();
}

function addTopic() {
    const input = document.getElementById("new-topic-name");
    const name = input.value.trim();
    if (!name) return;
    fetch('http://localhost:3000/add-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            input.value = "";
            topics.push(data.topic);
            selectTopic(data.topic.id);
        } else {
            alert(data.error || "Failed to add topic");
        }
    });
}

// ---- Categories (master list) ----

function loadCategories() {
    if (!currentTopicId) return;
    fetch(`http://localhost:3000/load-categories?username=${currentUser}&topicId=${currentTopicId}`)
    .then(response => response.json())
    .then(data => {
        categories = data;
        populateCategorySelect("category", "");
        renderCategoriesPage();
    });
}

function populateCategorySelect(selectId, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    let optionsHtml = `<option value="">Select category...</option><option value="__add_new__">+ Add new category...</option>`;
    categories.forEach(cat => {
        optionsHtml += `<option value="${cat}">${cat}</option>`;
    });
    // Preserve legacy/free-text category values that predate the master list
    if (selectedValue && !categories.includes(selectedValue)) {
        optionsHtml += `<option value="${selectedValue}">${selectedValue} (legacy)</option>`;
    }
    select.innerHTML = optionsHtml;
    select.value = selectedValue || "";
}

function handleCategorySelect(selectId) {
    const select = document.getElementById(selectId);
    const boxId = selectId === "category" ? "category-new-box" : "edit-category-new-box";
    const box = document.getElementById(boxId);
    if (select.value === "__add_new__") {
        box.style.display = "flex";
        document.getElementById(selectId === "category" ? "category-new-input" : "edit-category-new-input").focus();
    } else {
        box.style.display = "none";
    }
}

function confirmNewCategory(selectId) {
    const inputId = selectId === "category" ? "category-new-input" : "edit-category-new-input";
    const boxId = selectId === "category" ? "category-new-box" : "edit-category-new-box";
    const input = document.getElementById(inputId);
    const name = input.value.trim();
    if (!name) return;
    fetch('http://localhost:3000/add-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, topicId: currentTopicId, name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            categories = data.categories;
            populateCategorySelect(selectId, name);
            input.value = "";
            document.getElementById(boxId).style.display = "none";
        } else {
            alert(data.error || "Failed to add category");
        }
    });
}

// ---- Categories page (its own tab, scoped to the active topic) ----

function renderCategoriesPage() {
    const list = document.getElementById("categories-page-list");
    if (!list) return; // page not in the DOM yet (or on a page without it)

    const topic = topics.find(t => t.id === currentTopicId);
    const label = document.getElementById("categories-topic-label");
    if (label) label.textContent = topic ? `Categories — ${topic.name}` : "Categories";

    list.innerHTML = "";
    if (!categories.length) {
        const empty = document.createElement("div");
        empty.className = "topic-name";
        empty.textContent = "No categories yet for this topic.";
        list.appendChild(empty);
        return;
    }
    categories.forEach(cat => {
        const item = document.createElement("div");
        item.className = "topic-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "topic-name";
        nameSpan.textContent = cat;
        nameSpan.title = cat;

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "topic-action-btn";
        renameBtn.textContent = "✎";
        renameBtn.title = "Rename category";
        renameBtn.onclick = () => startInlineCategoryRename(item, cat);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "topic-action-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Delete category";
        deleteBtn.onclick = () => deleteCategoryPrompt(cat);

        const actions = document.createElement("span");
        actions.className = "topic-actions";
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(nameSpan);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

function addCategoryToPage() {
    const input = document.getElementById("new-category-name");
    const name = input.value.trim();
    if (!name) return;
    fetch('http://localhost:3000/add-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, topicId: currentTopicId, name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            categories = data.categories;
            input.value = "";
            renderCategoriesPage();
            populateCategorySelect("category", "");
        } else {
            alert(data.error || "Failed to add category");
        }
    });
}

// Same window.prompt() caveat as topics — see startInlineTopicRename.
function startInlineCategoryRename(item, oldName) {
    const nameSpan = item.querySelector(".topic-name");
    if (!nameSpan) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "topic-name-edit";
    input.value = oldName;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    const commit = () => {
        if (settled) return;
        settled = true;
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            submitCategoryRename(oldName, newName);
        } else {
            renderCategoriesPage();
        }
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            settled = true;
            renderCategoriesPage();
        }
    });
}

function submitCategoryRename(oldName, newName) {
    fetch('http://localhost:3000/rename-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, topicId: currentTopicId, oldName, newName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            categories = data.categories;
            populateCategorySelect("category", "");
            loadTasks(); // task cards may display the renamed category text
            loadStats();
        } else {
            alert(data.error || "Failed to rename category");
        }
        renderCategoriesPage();
    })
    .catch(() => {
        alert("Connection error while renaming category.");
        renderCategoriesPage();
    });
}

function deleteCategoryPrompt(name) {
    if (!confirm(`Delete category "${name}"? Tasks already using it will keep it as a plain label.`)) return;
    fetch('http://localhost:3000/delete-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, topicId: currentTopicId, name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            categories = data.categories;
            renderCategoriesPage();
            populateCategorySelect("category", "");
        } else {
            alert(data.error || "Failed to delete category");
        }
    });
}

// ---- Storage location (view-only) ----

let storageDataDir = null;

function loadStorageInfo() {
    fetch(`http://localhost:3000/storage-info`)
    .then(response => response.json())
    .then(data => {
        storageDataDir = data.dataDir;
        const el = document.getElementById("storage-path-display");
        if (el) {
            el.textContent = storageDataDir;
            el.title = storageDataDir;
        }
    })
    .catch(() => {
        const el = document.getElementById("storage-path-display");
        if (el) el.textContent = "Unable to load";
    });
}

function openStorageFolder() {
    if (!storageDataDir) return;
    try {
        const { shell } = require('electron');
        shell.openPath(storageDataDir);
    } catch (e) {
        alert("Couldn't open the folder automatically. Path:\n" + storageDataDir);
    }
}

function copyStoragePath() {
    if (!storageDataDir) return;
    try {
        const { clipboard } = require('electron');
        clipboard.writeText(storageDataDir);
        alert("Path copied to clipboard.");
    } catch (e) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(storageDataDir);
            alert("Path copied to clipboard.");
        } else {
            alert("Couldn't copy automatically. Path:\n" + storageDataDir);
        }
    }
}

function showSection(section) {
    document.getElementById("kanban-section").style.display = section === "kanban" ? "block" : "none";
    document.getElementById("stats-section").style.display = section === "stats" ? "block" : "none";
    document.getElementById("categories-section").style.display = section === "categories" ? "block" : "none";
    if (section === "stats") loadStats();
    if (section === "categories") renderCategoriesPage();
}

function openTaskModal() {
    populateCategorySelect("category", "");
    document.getElementById("task-modal").style.display = "block";
}

function closeTaskModal() {
    document.getElementById("task-modal").style.display = "none";
    document.getElementById("title").value = "";
    document.getElementById("description").value = "";
    document.getElementById("urgency").value = "low";
    document.getElementById("category").value = "";
    document.getElementById("deadline").value = "";
    document.getElementById("category-new-box").style.display = "none";
}

function openEditTaskModal(task) {
    editingTaskId = task.id;
    document.getElementById("edit-title").value = task.title;
    document.getElementById("edit-description").value = task.description;
    document.getElementById("edit-urgency").value = task.urgency;
    populateCategorySelect("edit-category", task.category);
    document.getElementById("edit-deadline").value = task.deadline;
    document.getElementById("edit-category-new-box").style.display = "none";
    document.getElementById("edit-task-modal").style.display = "block";
}

function closeEditTaskModal() {
    document.getElementById("edit-task-modal").style.display = "none";
    editingTaskId = null;
}

function addTask() {
    const category = document.getElementById("category").value;
    if (category === "__add_new__") {
        alert("Confirm the new category first (click OK), or pick an existing one.");
        return;
    }
    const task = {
        id: Date.now(),
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
        urgency: document.getElementById("urgency").value,
        category,
        deadline: document.getElementById("deadline").value,
        status: "todo",
        topicId: currentTopicId,
        createdAt: new Date().toISOString()
    };
    saveTask(task);
    closeTaskModal();
}

function saveTask(task) {
    fetch('http://localhost:3000/save-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, task })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadTasks();
            loadStats();
        }
    });
}

function saveEditedTask() {
    const category = document.getElementById("edit-category").value;
    if (category === "__add_new__") {
        alert("Confirm the new category first (click OK), or pick an existing one.");
        return;
    }
    const updatedTask = {
        id: editingTaskId,
        title: document.getElementById("edit-title").value,
        description: document.getElementById("edit-description").value,
        urgency: document.getElementById("edit-urgency").value,
        category,
        deadline: document.getElementById("edit-deadline").value
    };
    fetch('http://localhost:3000/update-task-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, task: updatedTask })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadTasks();
            loadStats();
        }
        closeEditTaskModal();
    });
}

let topicTasks = []; // all tasks in the current topic, as loaded from the server

function loadTasks() {
    fetch(`http://localhost:3000/load-tasks?username=${currentUser}`)
    .then(response => response.json())
    .then(tasks => {
        topicTasks = tasks.filter(t => t.topicId === currentTopicId);
        populateCategoryFilterOptions();
        renderTaskBoard();
    });
}

// Populates the "All categories" filter dropdown from categories actually in
// use in this topic's tasks (keeps it short — not the full master list).
function populateCategoryFilterOptions() {
    const select = document.getElementById("task-filter-category");
    if (!select) return;
    const currentValue = select.value;
    const used = [...new Set(topicTasks.map(t => t.category).filter(Boolean))].sort();
    select.innerHTML = `<option value="">All categories</option>` +
        used.map(c => `<option value="${c}">${c}</option>`).join("");
    select.value = used.includes(currentValue) ? currentValue : "";
}

function filterTasks() {
    renderTaskBoard();
}

// Renders topicTasks into the board, applying the search/category/priority
// filters on top. Purely client-side — no server round-trip per keystroke.
function renderTaskBoard() {
    const searchTerm = (document.getElementById("task-search")?.value || "").trim().toLowerCase();
    const categoryFilter = document.getElementById("task-filter-category")?.value || "";
    const urgencyFilter = document.getElementById("task-filter-urgency")?.value || "";

    document.querySelectorAll(".column").forEach(col => {
        col.querySelector(".task-list").innerHTML = "";
    });

    topicTasks
        .filter(t => !searchTerm ||
            t.title.toLowerCase().includes(searchTerm) ||
            (t.description || "").toLowerCase().includes(searchTerm))
        .filter(t => !categoryFilter || t.category === categoryFilter)
        .filter(t => !urgencyFilter || t.urgency === urgencyFilter)
        .forEach(task => renderTask(task));
}

function renderTask(task) {
    const column = document.getElementById(task.status);
    const taskList = column.querySelector(".task-list");
    const card = document.createElement("div");
    card.className = `card ${task.urgency}`;
    card.draggable = true;
    card.id = task.id;
    card.innerHTML = `
        <strong>${task.title}</strong><br>
        ${task.description}<br>
        Urgency: ${task.urgency}<br>
        Category: ${task.category}<br>
        Deadline: ${task.deadline}
        <button onclick="deleteTask(${task.id})">Delete</button>
        <button onclick='openEditTaskModal(${JSON.stringify(task)})'>Edit</button>
    `;
    card.ondragstart = (e) => e.dataTransfer.setData("text", task.id);

    // Drag a task onto this card to drop it right before/after it (reorder
    // within a column, or move into this column at that exact position).
    card.ondragover = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = card.getBoundingClientRect();
        const isAfter = (e.clientY - rect.top) > rect.height / 2;
        card.classList.toggle("drag-over-before", !isAfter);
        card.classList.toggle("drag-over-after", isAfter);
    };
    card.ondragleave = () => {
        card.classList.remove("drag-over-before", "drag-over-after");
    };
    card.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove("drag-over-before", "drag-over-after");
        const draggedId = e.dataTransfer.getData("text");
        if (draggedId == task.id) return; // dropped on itself
        const rect = card.getBoundingClientRect();
        const isAfter = (e.clientY - rect.top) > rect.height / 2;
        reorderTask(draggedId, task.status, task.id, isAfter ? "after" : "before");
    };

    taskList.appendChild(card);
}

function deleteTask(id) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    fetch('http://localhost:3000/delete-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadTasks();
            loadStats();
        }
    });
}

function allowDrop(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text");
    const newStatus = e.target.closest(".column").id;
    // Dropped on empty column space (not on a specific card) — append to the
    // end of that column. Card-level ondrop handles precise before/after drops.
    reorderTask(taskId, newStatus, null, null);
}

function reorderTask(draggedId, status, targetId, position) {
    fetch('http://localhost:3000/reorder-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, draggedId, status, targetId, position })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadTasks();
            loadStats();
        }
    });
}

function exportTasks() {
    const floppy = document.getElementById("floppy-disk");
    floppy.style.display = "block";
    fetch(`http://localhost:3000/export-tasks?username=${currentUser}`)
    .then(response => response.text())
    .then(data => {
        setTimeout(() => {
            floppy.style.display = "none";
            const blob = new Blob([data], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentUser}_tasks_backup.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 2000); // Simulate a 2-second save animation
    })
    .catch(() => {
        floppy.style.display = "none";
        alert("Error exporting tasks");
    });
}

function changeTheme() {
    const theme = document.getElementById("theme-selector").value;
    document.body.className = theme;
}

function loadStats() {
    fetch(`http://localhost:3000/load-tasks?username=${currentUser}`)
    .then(response => response.json())
    .then(allTasks => {
        const tasks = allTasks.filter(t => t.topicId === currentTopicId);
        console.log('Tasks in current topic:', tasks); // Debug: Log tasks for the active topic
        const statusData = {
            "In Progress": tasks.filter(t => t.status === "inprogress").length,
            "Completed": tasks.filter(t => t.status === "completed").length,
            "Halted/Failed": tasks.filter(t => t.status === "halt").length
        };

        const categoryData = tasks.reduce((acc, task) => {
            acc[task.category] = (acc[task.category] || 0) + 1;
            return acc;
        }, {});

        // Use the current date instead of a hardcoded March 28, 2025
        const currentDate = new Date(); // e.g. Today: May 3, 2025
        const threeMonthsAgo = new Date(currentDate); // Copy current date
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3); // 3 months ago: Feb 3, 2025
        console.log('threeMonthsAgo:', threeMonthsAgo); // Debug: Log the filter date
        const selectedStatus = document.getElementById("status-filter").value;
        const filteredTasks = tasks.filter(t => 
            t.status === selectedStatus && 
            t.statusChangedAt && 
            new Date(t.statusChangedAt).getTime() >= threeMonthsAgo.getTime()
        );
        console.log('Filtered tasks:', filteredTasks); // Debug: Log filtered tasks

        // Dynamically calculate the last 3 months
        const monthlyData = {};
        for (let i = 0; i < 3; i++) {
            const monthDate = new Date(currentDate);
            monthDate.setMonth(currentDate.getMonth() - i);
            const monthKey = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
            monthlyData[monthKey] = 0;
        }
        console.log('Monthly data before count:', monthlyData); // Debug: Log initial monthly data

        filteredTasks.forEach(task => {
            const date = new Date(task.statusChangedAt);
            const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (monthlyData[monthKey] !== undefined) monthlyData[monthKey]++;
        });
        console.log('Monthly data after count:', monthlyData); // Debug: Log final monthly data

        if (statusChart) statusChart.destroy();
        if (categoryChart) categoryChart.destroy();
        if (completedChart) completedChart.destroy();

        statusChart = new Chart(document.getElementById("statusChart"), {
            type: 'pie',
            data: {
                labels: Object.keys(statusData),
                datasets: [{ data: Object.values(statusData), backgroundColor: ["#4a8787", "#2a4066", "#a83232"] }]
            },
            options: { responsive: true, maintainAspectRatio: false, title: { display: true, text: "Task Status", fontFamily: "Courier New" } }
        });

        categoryChart = new Chart(document.getElementById("categoryChart"), {
            type: 'pie',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{ data: Object.values(categoryData), backgroundColor: ["#4a8787", "#2a4066", "#a83232", "#c9c94f", "#4fa84f"] }]
            },
            options: { responsive: true, maintainAspectRatio: false, title: { display: true, text: "Task Categories", fontFamily: "Courier New" } }
        });

        const statusLabelMap = {
            "completed": "Completed",
            "inprogress": "In Progress",
            "halt": "Halted/Failed"
        };
        const displayStatus = statusLabelMap[selectedStatus];

        completedChart = new Chart(document.getElementById("completedChart"), {
            type: 'bar',
            data: {
                labels: Object.keys(monthlyData),
                datasets: [{ label: `${displayStatus} Tasks`, data: Object.values(monthlyData), backgroundColor: "#4a8787" }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                title: { display: true, text: "Tasks by Status (Last 3 Months)", fontFamily: "Courier New" }
            }
        });

        renderStatsTable(tasks);
    })
    .catch(error => console.error('Error in loadStats:', error));
}

const STATUS_LABELS = {
    todo: "To Do",
    inprogress: "In Progress",
    completed: "Completed",
    halt: "Halted/Failed"
};

function formatDate(isoString) {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleDateString();
}

// Compares a task's deadline (estimated finish date) against when it was
// actually completed, and returns a label + CSS class for the stats table.
function computeTimeliness(task) {
    if (!task.deadline) return { label: "-", cls: "" };
    const deadline = task.deadline; // "YYYY-MM-DD"
    if (task.completedAt) {
        const completedDate = task.completedAt.split("T")[0];
        if (completedDate > deadline) return { label: "Ngaret (Late)", cls: "timeliness-late" };
        if (completedDate < deadline) return { label: "Lebih Cepat (Early)", cls: "timeliness-early" };
        return { label: "Tepat Waktu (On Time)", cls: "timeliness-ontime" };
    }
    const today = new Date().toISOString().split("T")[0];
    if (task.status !== "completed" && today > deadline) {
        return { label: "Overdue", cls: "timeliness-late" };
    }
    return { label: "In Progress", cls: "" };
}

const STATS_PAGE_SIZE = 10;
let statsTablePage = 1;
let statsTableTasks = [];

function renderStatsTable(tasks) {
    statsTableTasks = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    statsTablePage = 1; // reset to first page whenever the underlying task list is reloaded
    renderStatsTablePage();
}

function renderStatsTablePage() {
    const tbody = document.getElementById("stats-table-body");
    if (!tbody) return;

    const totalPages = Math.max(1, Math.ceil(statsTableTasks.length / STATS_PAGE_SIZE));
    if (statsTablePage > totalPages) statsTablePage = totalPages;
    if (statsTablePage < 1) statsTablePage = 1;

    const start = (statsTablePage - 1) * STATS_PAGE_SIZE;
    const pageTasks = statsTableTasks.slice(start, start + STATS_PAGE_SIZE);

    tbody.innerHTML = "";
    pageTasks.forEach(task => {
        const { label, cls } = computeTimeliness(task);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${task.title}</td>
            <td>${task.category || "-"}</td>
            <td>${task.urgency}</td>
            <td>${STATUS_LABELS[task.status] || task.status}</td>
            <td>${formatDate(task.createdAt)}</td>
            <td>${task.deadline || "-"}</td>
            <td>${task.completedAt ? formatDate(task.completedAt) : "-"}</td>
            <td class="${cls}">${label}</td>
        `;
        tbody.appendChild(row);
    });

    const pageInfo = document.getElementById("stats-table-page-info");
    if (pageInfo) {
        pageInfo.textContent = statsTableTasks.length
            ? `Page ${statsTablePage} / ${totalPages} (${statsTableTasks.length} tasks)`
            : "No tasks";
    }
    const prevBtn = document.getElementById("stats-table-prev");
    const nextBtn = document.getElementById("stats-table-next");
    if (prevBtn) prevBtn.disabled = statsTablePage <= 1;
    if (nextBtn) nextBtn.disabled = statsTablePage >= totalPages;
}

function statsTablePrevPage() {
    statsTablePage--;
    renderStatsTablePage();
}

function statsTableNextPage() {
    statsTablePage++;
    renderStatsTablePage();
}