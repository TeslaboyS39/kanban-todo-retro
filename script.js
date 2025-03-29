let currentUser = null;
let statusChart, categoryChart, completedChart;
let editingTaskId = null;

// Sign In / Sign Up (unchanged)
function signIn() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    fetch('/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentUser = data.username;
            window.location.href = "main.html";
        } else {
            alert("Invalid credentials");
        }
    });
}

function signUp() {
    const username = document.getElementById("signup-username").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Account created! Please sign in.");
        } else {
            alert("Username or email already exists");
        }
    });
}

function signOut() {
    currentUser = null;
    window.location.href = "index.html";
}

// Main Page Logic
if (window.location.pathname.includes("main.html")) {
    fetch('/get-current-user')
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            currentUser = data.username;
            document.getElementById("username-display").textContent = currentUser;
            loadTasks();
            loadStats();
        } else {
            window.location.href = "index.html";
        }
    });
}

function showSection(section) {
    document.getElementById("kanban-section").style.display = section === "kanban" ? "block" : "none";
    document.getElementById("stats-section").style.display = section === "stats" ? "block" : "none";
    if (section === "stats") loadStats();
}

function openTaskModal() {
    document.getElementById("task-modal").style.display = "block";
}

function closeTaskModal() {
    document.getElementById("task-modal").style.display = "none";
    document.getElementById("title").value = "";
    document.getElementById("description").value = "";
    document.getElementById("urgency").value = "low";
    document.getElementById("category").value = "";
    document.getElementById("deadline").value = "";
}

function openEditTaskModal(task) {
    editingTaskId = task.id;
    document.getElementById("edit-title").value = task.title;
    document.getElementById("edit-description").value = task.description;
    document.getElementById("edit-urgency").value = task.urgency;
    document.getElementById("edit-category").value = task.category;
    document.getElementById("edit-deadline").value = task.deadline;
    document.getElementById("edit-task-modal").style.display = "block";
}

function closeEditTaskModal() {
    document.getElementById("edit-task-modal").style.display = "none";
    editingTaskId = null;
}

function addTask() {
    const task = {
        id: Date.now(),
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
        urgency: document.getElementById("urgency").value,
        category: document.getElementById("category").value,
        deadline: document.getElementById("deadline").value,
        status: "todo",
        createdAt: new Date().toISOString()
    };
    saveTask(task);
    closeTaskModal();
}

function saveTask(task) {
    fetch('/save-task', {
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
    const updatedTask = {
        id: editingTaskId,
        title: document.getElementById("edit-title").value,
        description: document.getElementById("edit-description").value,
        urgency: document.getElementById("edit-urgency").value,
        category: document.getElementById("edit-category").value,
        deadline: document.getElementById("edit-deadline").value
    };
    fetch('/update-task-full', {
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

function loadTasks() {
    fetch(`/load-tasks?username=${currentUser}`)
    .then(response => response.json())
    .then(tasks => {
        document.querySelectorAll(".column").forEach(col => {
            const taskList = col.querySelector(".task-list");
            taskList.innerHTML = ""; // Clear only the task list
        });
        tasks.forEach(task => renderTask(task));
    });
}

function renderTask(task) {
    const column = document.getElementById(task.status);
    const taskList = column.querySelector(".task-list"); // Append to task-list, not column
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
    taskList.appendChild(card);
}

function deleteTask(id) {
    fetch('/delete-task', {
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
    fetch('/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, id: taskId, status: newStatus })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadTasks();
            loadStats();
        }
    });
}

function loadStats() {
    fetch(`/load-tasks?username=${currentUser}`)
    .then(response => response.json())
    .then(tasks => {
        // Task Status Pie Chart
        const statusData = {
            "In Progress": tasks.filter(t => t.status === "inprogress").length,
            "Completed": tasks.filter(t => t.status === "completed").length,
            "Halted/Failed": tasks.filter(t => t.status === "halt").length
        };

        // Task Categories Pie Chart
        const categoryData = tasks.reduce((acc, task) => {
            acc[task.category] = (acc[task.category] || 0) + 1;
            return acc;
        }, {});

        // Tasks by Status Bar Chart (Last 3 Months)
        const threeMonthsAgo = new Date(2025, 2, 28); // March 28, 2025
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3); // Back to December 28, 2024
        const selectedStatus = document.getElementById("status-filter").value;
        const filteredTasks = tasks.filter(t => 
            t.status === selectedStatus && 
            t.statusChangedAt && 
            new Date(t.statusChangedAt) >= threeMonthsAgo
        );

        const monthlyData = {
            "Jan 2025": 0,
            "Feb 2025": 0,
            "Mar 2025": 0
        };
        filteredTasks.forEach(task => {
            const date = new Date(task.statusChangedAt);
            const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (monthlyData[monthKey] !== undefined) monthlyData[monthKey]++;
        });

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
    });
}