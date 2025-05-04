const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron'); // Import Electron's app module to get userData path

const router = express.Router();
router.use(express.json());

// Use Electron's userData directory for storing user and task data
const DATA_DIR = app ? path.join(app.getPath('userData'), 'kanban-tracker') : path.join(__dirname, 'data');
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const USERS_DIR = path.join(DATA_DIR, 'users');

// Ensure directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(TASKS_DIR, { recursive: true });
        await fs.mkdir(USERS_DIR, { recursive: true });
    } catch (err) {
        console.error('Error creating directories:', err);
    }
}

// Call this when the server starts
ensureDirectories();

router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    console.log('Signup request:', { username, email, password });
    if (!username || !email || !password) {
        return res.json({ success: false, error: "All fields are required" });
    }
    const userFile = path.join(USERS_DIR, `${username}.json`);
    try {
        try {
            await fs.access(userFile);
            console.log(`Username ${username} already exists`);
            return res.json({ success: false, error: "Username already exists" });
        } catch (err) {
            console.log(`Creating new user: ${username}`);
            await fs.writeFile(userFile, JSON.stringify({ username, email, password }));
            await fs.writeFile(path.join(TASKS_DIR, `${username}_tasks.txt`), JSON.stringify([]));
            return res.json({ success: true });
        }
    } catch (err) {
        console.error('Error during signup:', err);
        res.json({ success: false, error: err.message });
    }
});

router.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    const userFile = path.join(USERS_DIR, `${username}.json`);
    try {
        const userData = JSON.parse(await fs.readFile(userFile));
        if (userData.password === password) {
            res.json({ success: true, username });
        } else {
            res.json({ success: false, error: "Invalid password" });
        }
    } catch (err) {
        res.json({ success: false, error: "User not found" });
    }
});

router.post('/save-task', async (req, res) => {
    const { username, task } = req.body;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = JSON.parse(await fs.readFile(filePath));
        task.statusChangedAt = task.createdAt;
        tasks.push(task);
        await fs.writeFile(filePath, JSON.stringify(tasks, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.get('/load-tasks', async (req, res) => {
    const { username } = req.query;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = JSON.parse(await fs.readFile(filePath));
        res.json(tasks);
    } catch (err) {
        res.json([]);
    }
});

router.post('/update-task', async (req, res) => {
    const { username, id, status } = req.body;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = JSON.parse(await fs.readFile(filePath));
        const task = tasks.find(t => t.id == id);
        if (task) {
            task.status = status;
            task.statusChangedAt = new Date().toISOString();
            if (status === "completed" && !task.completedAt) {
                task.completedAt = task.statusChangedAt;
            }
            await fs.writeFile(filePath, JSON.stringify(tasks, null, 2));
            res.json({ success: true });
        } else {
            res.json({ success: false, error: "Task not found" });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post('/update-task-full', async (req, res) => {
    const { username, task } = req.body;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = JSON.parse(await fs.readFile(filePath));
        const index = tasks.findIndex(t => t.id == task.id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...task };
            await fs.writeFile(filePath, JSON.stringify(tasks, null, 2));
            res.json({ success: true });
        } else {
            res.json({ success: false, error: "Task not found" });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post('/delete-task', async (req, res) => {
    const { username, id } = req.body;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = JSON.parse(await fs.readFile(filePath));
        const updatedTasks = tasks.filter(t => t.id != id);
        await fs.writeFile(filePath, JSON.stringify(updatedTasks, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.get('/export-tasks', async (req, res) => {
    const { username } = req.query;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = await fs.readFile(filePath, 'utf8');
        res.send(tasks);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;