let currentUser = null;
let statusChart, categoryChart, completedChart;
let editingTaskId = null;

function signIn() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
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
        } else {
            alert("Invalid credentials");
        }
    });
}

function signUp() {
    const username = document.getElementById("signup-username").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    fetch('http://localhost:3000/signup', {
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
        loadTasks();
        loadStats();
    } else {
        window.location.replace("index.html"); // Redirect to login if not logged in
    }
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
    const updatedTask = {
        id: editingTaskId,
        title: document.getElementById("edit-title").value,
        description: document.getElementById("edit-description").value,
        urgency: document.getElementById("edit-urgency").value,
        category: document.getElementById("edit-category").value,
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

function loadTasks() {
    fetch(`http://localhost:3000/load-tasks?username=${currentUser}`)
    .then(response => response.json())
    .then(tasks => {
        document.querySelectorAll(".column").forEach(col => {
            const taskList = col.querySelector(".task-list");
            taskList.innerHTML = "";
        });
        tasks.forEach(task => renderTask(task));
    });
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
    taskList.appendChild(card);
}

function deleteTask(id) {
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
    fetch('http://localhost:3000/update-task', {
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
    .then(tasks => {
        console.log('All tasks:', tasks); // Debug: Log all tasks
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
    })
    .catch(error => console.error('Error in loadStats:', error));
}