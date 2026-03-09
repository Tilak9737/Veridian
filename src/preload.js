const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    dbQuery: (method, ...args) => ipcRenderer.invoke('db-query', { method, args }),
    backupDB: () => ipcRenderer.invoke('backup-db'),
    exportPDF: (data) => ipcRenderer.invoke('export-pdf', data),
    savePDF: (filePath, pdfBuffer) => ipcRenderer.invoke('save-pdf', { filePath, pdfBuffer }),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath)
});
