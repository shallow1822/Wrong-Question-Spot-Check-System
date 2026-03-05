const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getStats: () => ipcRenderer.invoke('get-stats'),
    getHistory: () => ipcRenderer.invoke('get-history'),
    saveQuestion: (question) => ipcRenderer.invoke('save-question', question),
    getPdfs: () => ipcRenderer.invoke('get-pdfs'),
    uploadPdf: (pdf) => ipcRenderer.invoke('upload-pdf', pdf),
    deletePdf: (id) => ipcRenderer.invoke('delete-pdf', id),
    getReviewQuestions: (filter) => ipcRenderer.invoke('get-review-questions', filter),
    getRandomQuestions: (filter) => ipcRenderer.invoke('get-random-questions', filter),
    recordReviewResult: (data) => ipcRenderer.invoke('record-review-result', data),
    deleteQuestion: (id) => ipcRenderer.invoke('delete-question', id),
    getAllQuestions: () => ipcRenderer.invoke('get-all-questions'),
    getActiveSession: () => ipcRenderer.invoke('get-active-session'),
    startSession: (data) => ipcRenderer.invoke('start-session', data),
    updateSessionProgress: (data) => ipcRenderer.invoke('update-session-progress', data),
    finishSession: (sessionId) => ipcRenderer.invoke('finish-session', sessionId)
});
