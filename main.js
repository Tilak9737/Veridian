const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./src/db');

const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'src/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.maximize();
    mainWindow.loadFile('src/index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // Auto-backup every 5 seconds
    setInterval(() => {
        try {
            const dbPath = db.getDatabasePath();
            const backupPath = path.join(BACKUP_DIR, 'auto_backup.db');
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, backupPath);
                // console.log('Auto-backup completed');
            }
        } catch (error) {
            console.error('Auto-backup failed:', error);
        }
    }, 5000);
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('db-query', async (event, { method, args }) => {
    try {
        return await db[method](...args);
    } catch (error) {
        console.error(`DB Error (${method}):`, error);
        throw error;
    }
});

// Manual backup handler removed (Auto-backup implemented)

ipcMain.handle('export-pdf', async (event, data) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Export Veridian Analytics Report',
        defaultPath: `Veridian_Report_${data.dateRange}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (filePath) {
        return filePath;
    }
    return null;
});

ipcMain.handle('save-pdf', async (event, { filePath, pdfBuffer }) => {
    try {
        fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
        return true;
    } catch (error) {
        console.error('Save PDF Error:', error);
        return false;
    }
});
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
        return true;
    } catch (error) {
        console.error('Open File Error:', error);
        return false;
    }
});
