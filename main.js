const { app, Menu, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const serverApp = express();
const server = require('./server'); // Import your updated server.js

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true, // Allow Node.js integration in renderer process
            contextIsolation: false, // Disable context isolation for simplicity
            enableRemoteModule: true, // Enable remote module (optional, for older Electron versions)
            zoomFactor: 0.9
        }
    });

    // Load index.html as the entry point
    mainWindow.loadFile('index.html');

    // Open DevTools for debugging (optional, removed coz in production)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Start the Express server within Electron
function startServer() {
    serverApp.use(express.static(path.join(__dirname))); // Serve static files
    serverApp.use('/', server); // Use the routes from server.js
    serverApp.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}

app.on('ready', () => {
    startServer(); // Start the server
    createWindow(); // Create the main window
    Menu.setApplicationMenu(null);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});