const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDb, db } = require('./database');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 禁用跨域限制，允许前端 fetch 加载本地 PDF 文件
      webviewTag: true  // 启用 <webview> 标签，支持 PDF 缩放和跳页
    }
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  initDb();
  createWindow();

  // IPC Handlers
  ipcMain.handle('read-file', async (event, filePath) => {
    return fs.promises.readFile(filePath);
  });

  // 终极杀招：直接传递 base64 字符串，规避了 Buffer 序列化丢失问题和跨域阻拦
  ipcMain.handle('read-pdf-base64', async (event, filePath) => {
    return fs.promises.readFile(filePath, { encoding: 'base64' });
  });

  ipcMain.handle('get-stats', async () => {
    const stats = db.prepare(`
        SELECT 
            subject, 
            COUNT(*) as total,
            SUM(CASE WHEN next_review_date IS NOT NULL AND next_review_date <= date('now') THEN 1 ELSE 0 END) as pending
        FROM questions 
        GROUP BY subject
    `).all();
    return stats;
  });

  ipcMain.handle('get-history', async () => {
    const history = db.prepare(`
        SELECT 
            date(l.reviewed_at) as date, 
            q.subject, 
            COUNT(*) as count 
        FROM review_logs l
        JOIN questions q ON l.question_id = q.id
        WHERE l.reviewed_at > date('now', '-7 days')
        GROUP BY date(l.reviewed_at), q.subject
        ORDER BY date ASC
    `).all();
    return history;
  });

  ipcMain.handle('save-question', async (event, question) => {
    const { subject, content, imagePath, pdfId, pageNumber } = question;
    // 入库时不设复习日期，首次测验后才写入
    const stmt = db.prepare(`
        INSERT INTO questions (subject, content, image_path, pdf_id, page_number, next_review_date)
        VALUES (?, ?, ?, ?, ?, NULL)
    `);
    const result = stmt.run(subject, content, imagePath, pdfId, pageNumber);
    return result.lastInsertRowid;
  });

  ipcMain.handle('get-pdfs', async () => {
    return db.prepare(`SELECT * FROM pdf_files`).all();
  });

  ipcMain.handle('upload-pdf', async (event, data) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const fileName = (data && data.name) || path.basename(sourcePath);

    // 将 PDF 实体文件拷贝至系统专用的 userData/pdfs 目录中，防止原文件被删后无法打开（即变相“存入数据库/软件后台”）
    const userDataPath = app.getPath('userData');
    const pdfsDir = path.join(userDataPath, 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const internalFileName = Date.now() + '_' + path.basename(sourcePath);
    const destPath = path.join(pdfsDir, internalFileName);
    fs.copyFileSync(sourcePath, destPath);

    const stmt = db.prepare(`INSERT INTO pdf_files (name, path) VALUES (?, ?)`);
    const dbResult = stmt.run(fileName, destPath);
    return dbResult.lastInsertRowid;
  });

  ipcMain.handle('delete-pdf', async (event, id) => {
    const updateQs = db.prepare(`UPDATE questions SET pdf_id = NULL WHERE pdf_id = ?`);
    const deletePdf = db.prepare(`DELETE FROM pdf_files WHERE id = ?`);

    db.transaction(() => {
      updateQs.run(id);
      deletePdf.run(id);
    })();

    return true;
  });

  ipcMain.handle('delete-question', async (event, id) => {
    const deleteSessionQs = db.prepare(`DELETE FROM session_questions WHERE question_id = ?`);
    const deleteLogs = db.prepare(`DELETE FROM review_logs WHERE question_id = ?`);
    const deleteQ = db.prepare(`DELETE FROM questions WHERE id = ?`);

    db.transaction(() => {
      deleteSessionQs.run(id);
      deleteLogs.run(id);
      deleteQ.run(id);
    })();

    return true;
  });

  ipcMain.handle('get-all-questions', async () => {
    return db.prepare(`
        SELECT q.*, p.name as pdf_name, p.path as pdf_path
        FROM questions q 
        LEFT JOIN pdf_files p ON q.pdf_id = p.id
        ORDER BY q.created_at DESC
    `).all();
  });

  ipcMain.handle('get-review-questions', async (event, { subject, limit }) => {
    let query = `
        SELECT q.*, p.name as pdf_name, p.path as pdf_path
        FROM questions q
        LEFT JOIN pdf_files p ON q.pdf_id = p.id
        WHERE next_review_date IS NOT NULL AND next_review_date <= date('now')
    `;
    const params = [];
    if (subject && subject !== 'all') {
      query += ` AND q.subject = ?`;
      params.push(subject);
    }
    query += ` ORDER BY next_review_date ASC, created_at ASC LIMIT ?`;
    params.push(limit);

    return db.prepare(query).all(params);
  });

  ipcMain.handle('get-random-questions', async (event, { subject, limit }) => {
    let query = `
        SELECT q.*, p.name as pdf_name, p.path as pdf_path
        FROM questions q
        LEFT JOIN pdf_files p ON q.pdf_id = p.id
    `;
    const params = [];
    if (subject && subject !== 'all') {
      query += ` WHERE q.subject = ?`;
      params.push(subject);
    }
    query += ` ORDER BY RANDOM() LIMIT ?`;
    params.push(limit);

    return db.prepare(query).all(params);
  });

  ipcMain.handle('record-review-result', async (event, { questionId, result }) => {
    const { getNextReviewDate } = require('./database');
    const question = db.prepare(`SELECT interval_level FROM questions WHERE id = ?`).get(questionId);

    let newLevel = 0;
    if (result === 'correct') {
      newLevel = question.interval_level + 1;
    } else {
      newLevel = 0; // Reset for wrong answers
    }

    const nextDate = getNextReviewDate(newLevel);

    const updateStmt = db.prepare(`
        UPDATE questions 
        SET 
            interval_level = ?, 
            next_review_date = ?, 
            ${result === 'correct' ? 'correct_count = correct_count + 1' : 'wrong_count = wrong_count + 1'},
            last_reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const logStmt = db.prepare(`
        INSERT INTO review_logs (question_id, result) VALUES (?, ?)
    `);

    db.transaction(() => {
      updateStmt.run(newLevel, nextDate, questionId);
      logStmt.run(questionId, result);
    })();

    return { newLevel, nextDate };
  });

  ipcMain.handle('get-active-session', async () => {
    const session = db.prepare(`SELECT * FROM active_sessions WHERE is_completed = 0 ORDER BY created_at DESC LIMIT 1`).get();
    if (!session) return null;

    const questions = db.prepare(`
        SELECT q.*, p.name as pdf_name, p.path as pdf_path, sq.is_done, sq.order_index
        FROM session_questions sq
        JOIN questions q ON sq.question_id = q.id
        LEFT JOIN pdf_files p ON q.pdf_id = p.id
        WHERE sq.session_id = ?
        ORDER BY sq.order_index ASC
    `).all(session.id);

    return { ...session, questions };
  });

  ipcMain.handle('start-session', async (event, { mode, subject, questions }) => {
    // Close any previous active sessions
    db.prepare(`UPDATE active_sessions SET is_completed = 1 WHERE is_completed = 0`).run();

    const stmt = db.prepare(`INSERT INTO active_sessions (mode, subject, total_count) VALUES (?, ?, ?)`);
    const result = stmt.run(mode, subject, questions.length);
    const sessionId = result.lastInsertRowid;

    const itemStmt = db.prepare(`INSERT INTO session_questions (session_id, question_id, order_index) VALUES (?, ?, ?)`);
    const insertMany = db.transaction((qs) => {
      qs.forEach((q, idx) => itemStmt.run(sessionId, q.id, idx));
    });
    insertMany(questions);

    return sessionId;
  });

  ipcMain.handle('update-session-progress', async (event, { sessionId, questionId, currentIndex }) => {
    db.transaction(() => {
      db.prepare(`UPDATE session_questions SET is_done = 1 WHERE session_id = ? AND question_id = ?`).run(sessionId, questionId);
      db.prepare(`UPDATE active_sessions SET current_index = ? WHERE id = ?`).run(currentIndex, sessionId);
    })();
    return true;
  });

  ipcMain.handle('finish-session', async (event, sessionId) => {
    db.prepare(`UPDATE active_sessions SET is_completed = 1 WHERE id = ?`).run(sessionId);
    return true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
