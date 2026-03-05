const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Ensure db is stored in user data directory
const dbPath = path.join(app.getPath('userData'), 'study-system.db');
const db = new Database(dbPath);

// Initialize Tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pdf_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      content TEXT,
      image_path TEXT,
      pdf_id INTEGER,
      page_number INTEGER,
      interval_level INTEGER DEFAULT 0, -- 0-6 stages of Ebbinghaus
      next_review_date DATE,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      last_reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(pdf_id) REFERENCES pdf_files(id)
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER,
      result TEXT, -- 'correct' or 'wrong'
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS active_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL, -- 'planned' or 'instant'
      subject TEXT NOT NULL,
      current_index INTEGER DEFAULT 0,
      total_count INTEGER,
      is_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_questions (
      session_id INTEGER,
      question_id INTEGER,
      order_index INTEGER,
      is_done INTEGER DEFAULT 0,
      FOREIGN KEY(session_id) REFERENCES active_sessions(id),
      FOREIGN KEY(question_id) REFERENCES questions(id)
    );
  `);
}

// Ebbinghaus intervals in days: 1, 2, 4, 7, 15, 30
const INTERVALS = [1, 2, 4, 7, 15, 30];

function getNextReviewDate(level) {
  const days = INTERVALS[Math.min(level, INTERVALS.length - 1)];
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

module.exports = {
  initDb,
  db,
  getNextReviewDate
};
