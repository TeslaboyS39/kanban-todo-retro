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
const TOPICS_DIR = path.join(DATA_DIR, 'topics');
const CATEGORIES_DIR = path.join(DATA_DIR, 'categories');

// Ensure directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(TASKS_DIR, { recursive: true });
        await fs.mkdir(USERS_DIR, { recursive: true });
        await fs.mkdir(TOPICS_DIR, { recursive: true });
        await fs.mkdir(CATEGORIES_DIR, { recursive: true });
    } catch (err) {
        console.error('Error creating directories:', err);
    }
}

// Call this when the server starts
ensureDirectories();

// Read a JSON file, returning `fallback` if it doesn't exist or is invalid
async function readJsonFile(filePath, fallback) {
    try {
        return JSON.parse(await fs.readFile(filePath));
    } catch (err) {
        return fallback;
    }
}

// Load a user's topics, creating a default "General" topic on first access
// (also covers users created before topics existed).
async function ensureTopics(username) {
    const filePath = path.join(TOPICS_DIR, `${username}_topics.json`);
    let topics = await readJsonFile(filePath, null);
    if (!topics) {
        topics = [{ id: Date.now(), name: 'General', createdAt: new Date().toISOString() }];
        await fs.writeFile(filePath, JSON.stringify(topics, null, 2));
    }
    return topics;
}

router.get('/storage-info', (req, res) => {
    res.json({ dataDir: DATA_DIR });
});

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
            await fs.writeFile(path.join(TOPICS_DIR, `${username}_topics.json`), JSON.stringify(
                [{ id: Date.now(), name: 'General', createdAt: new Date().toISOString() }], null, 2
            ));
            await fs.writeFile(path.join(CATEGORIES_DIR, `${username}_categories.json`), JSON.stringify([], null, 2));
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
        // Backfill topicId on tasks created before topics existed, so they
        // stay visible under the default "General" topic instead of vanishing.
        const topics = await ensureTopics(username);
        const defaultTopicId = topics[0].id;
        let changed = false;
        tasks.forEach(t => {
            if (!t.topicId) {
                t.topicId = defaultTopicId;
                changed = true;
            }
        });
        if (changed) {
            await fs.writeFile(filePath, JSON.stringify(tasks, null, 2));
        }
        res.json(tasks);
    } catch (err) {
        res.json([]);
    }
});

router.get('/load-topics', async (req, res) => {
    const { username } = req.query;
    try {
        res.json(await ensureTopics(username));
    } catch (err) {
        res.json([]);
    }
});

router.post('/add-topic', async (req, res) => {
    const { username, name } = req.body;
    if (!name || !name.trim()) {
        return res.json({ success: false, error: "Topic name is required" });
    }
    const filePath = path.join(TOPICS_DIR, `${username}_topics.json`);
    try {
        const topics = await ensureTopics(username);
        if (topics.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
            return res.json({ success: false, error: "Topic already exists" });
        }
        const topic = { id: Date.now(), name: name.trim(), createdAt: new Date().toISOString() };
        topics.push(topic);
        await fs.writeFile(filePath, JSON.stringify(topics, null, 2));
        res.json({ success: true, topic });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post('/rename-topic', async (req, res) => {
    const { username, id, name } = req.body;
    if (!name || !name.trim()) {
        return res.json({ success: false, error: "Topic name is required" });
    }
    const filePath = path.join(TOPICS_DIR, `${username}_topics.json`);
    try {
        const topics = await ensureTopics(username);
        const topic = topics.find(t => t.id == id);
        if (!topic) {
            return res.json({ success: false, error: "Topic not found" });
        }
        if (topics.some(t => t.id != id && t.name.toLowerCase() === name.trim().toLowerCase())) {
            return res.json({ success: false, error: "Topic name already exists" });
        }
        topic.name = name.trim();
        await fs.writeFile(filePath, JSON.stringify(topics, null, 2));
        res.json({ success: true, topic });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post('/delete-topic', async (req, res) => {
    const { username, id } = req.body;
    const topicsFilePath = path.join(TOPICS_DIR, `${username}_topics.json`);
    const tasksFilePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const topics = await ensureTopics(username);
        if (topics.length <= 1) {
            return res.json({ success: false, error: "Cannot delete the only remaining topic" });
        }
        const index = topics.findIndex(t => t.id == id);
        if (index === -1) {
            return res.json({ success: false, error: "Topic not found" });
        }
        const [removed] = topics.splice(index, 1);
        const fallbackTopicId = topics[0].id;
        await fs.writeFile(topicsFilePath, JSON.stringify(topics, null, 2));

        // Clean up the deleted topic's own category list (orphaned otherwise)
        try {
            await fs.unlink(path.join(CATEGORIES_DIR, `${username}_${removed.id}_categories.json`));
        } catch (e) {
            // Nothing to remove — fine
        }

        // Reassign any tasks that belonged to the deleted topic so they aren't orphaned
        try {
            const tasks = JSON.parse(await fs.readFile(tasksFilePath));
            let changed = false;
            tasks.forEach(t => {
                if (t.topicId == removed.id) {
                    t.topicId = fallbackTopicId;
                    changed = true;
                }
            });
            if (changed) {
                await fs.writeFile(tasksFilePath, JSON.stringify(tasks, null, 2));
            }
        } catch (e) {
            // No tasks file yet for this user — nothing to reassign
        }

        res.json({ success: true, fallbackTopicId });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Categories are scoped per topic. The very first time a topic's categories
// are requested, seed them from the old global per-user category list (if one
// exists from before categories became per-topic), so nothing disappears.
async function ensureCategories(username, topicId) {
    const filePath = path.join(CATEGORIES_DIR, `${username}_${topicId}_categories.json`);
    let categories = await readJsonFile(filePath, null);
    if (!categories) {
        const legacyFilePath = path.join(CATEGORIES_DIR, `${username}_categories.json`);
        categories = await readJsonFile(legacyFilePath, []);
        await fs.writeFile(filePath, JSON.stringify(categories, null, 2));
    }
    return categories;
}

router.get('/load-categories', async (req, res) => {
    const { username, topicId } = req.query;
    try {
        res.json(await ensureCategories(username, topicId));
    } catch (err) {
        res.json([]);
    }
});

router.post('/add-category', async (req, res) => {
    const { username, topicId, name } = req.body;
    if (!name || !name.trim()) {
        return res.json({ success: false, error: "Category name is required" });
    }
    if (!topicId) {
        return res.json({ success: false, error: "Missing topic" });
    }
    const filePath = path.join(CATEGORIES_DIR, `${username}_${topicId}_categories.json`);
    try {
        const categories = await ensureCategories(username, topicId);
        if (categories.some(c => c.toLowerCase() === name.trim().toLowerCase())) {
            return res.json({ success: false, error: "Category already exists" });
        }
        categories.push(name.trim());
        await fs.writeFile(filePath, JSON.stringify(categories, null, 2));
        res.json({ success: true, categories });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post('/rename-category', async (req, res) => {
    const { username, topicId, oldName, newName } = req.body;
    if (!newName || !newName.trim()) {
        return res.json({ success: false, error: "Category name is required" });
    }
    const filePath = path.join(CATEGORIES_DIR, `${username}_${topicId}_categories.json`);
    try {
        const categories = await ensureCategories(username, topicId);
        const index = categories.findIndex(c => c === oldName);
        if (index === -1) {
            return res.json({ success: false, error: "Category not found" });
        }
        if (categories.some((c, i) => i !== index && c.toLowerCase() === newName.trim().toLowerCase())) {
            return res.json({ success: false, error: "Category name already exists" });
        }
        categories[index] = newName.trim();
        await fs.writeFile(filePath, JSON.stringify(categories, null, 2));

        // Keep existing tasks' category text in sync with the rename
        const tasksFilePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
        try {
            const tasks = JSON.parse(await fs.readFile(tasksFilePath));
            let changed = false;
            tasks.forEach(t => {
                if (t.topicId == topicId && t.category === oldName) {
                    t.category = newName.trim();
                    changed = true;
                }
            });
            if (changed) {
                await fs.writeFile(tasksFilePath, JSON.stringify(tasks, null, 2));
            }
        } catch (e) {
            // No tasks file yet — nothing to sync
        }

        res.json({ success: true, categories });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post('/delete-category', async (req, res) => {
    const { username, topicId, name } = req.body;
    const filePath = path.join(CATEGORIES_DIR, `${username}_${topicId}_categories.json`);
    try {
        const categories = await ensureCategories(username, topicId);
        const updated = categories.filter(c => c !== name);
        await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
        // Tasks already tagged with the deleted category keep it as a free-text
        // value — the UI already renders master-list-less category values fine.
        res.json({ success: true, categories: updated });
    } catch (err) {
        res.json({ success: false, error: err.message });
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

// Repositions a task within the stored tasks array. Render order within a
// column is simply "array order filtered to that status", so reordering is
// just moving the task's array element — no separate `order` field needed.
router.post('/reorder-task', async (req, res) => {
    const { username, draggedId, status, targetId, position } = req.body;
    const filePath = path.join(TASKS_DIR, `${username}_tasks.txt`);
    try {
        const tasks = JSON.parse(await fs.readFile(filePath));
        const draggedIndex = tasks.findIndex(t => t.id == draggedId);
        if (draggedIndex === -1) {
            return res.json({ success: false, error: "Task not found" });
        }
        const [dragged] = tasks.splice(draggedIndex, 1);

        const statusChanged = dragged.status !== status;
        dragged.status = status;
        if (statusChanged) {
            dragged.statusChangedAt = new Date().toISOString();
            if (status === "completed" && !dragged.completedAt) {
                dragged.completedAt = dragged.statusChangedAt;
            }
        }

        let insertIndex;
        if (targetId != null) {
            const targetIndex = tasks.findIndex(t => t.id == targetId);
            insertIndex = targetIndex === -1 ? tasks.length : (position === 'after' ? targetIndex + 1 : targetIndex);
        } else {
            // No specific target — drop happened on empty column space, so
            // append after the last task already in that status group.
            let lastIndex = -1;
            tasks.forEach((t, i) => { if (t.status === status) lastIndex = i; });
            insertIndex = lastIndex === -1 ? tasks.length : lastIndex + 1;
        }

        tasks.splice(insertIndex, 0, dragged);
        await fs.writeFile(filePath, JSON.stringify(tasks, null, 2));
        res.json({ success: true });
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