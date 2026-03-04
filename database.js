const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Open (or create) the database file in data/
const dbPath = path.join(__dirname, 'data', 'finance.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute the schema file to create all tables
const schemaPath = path.join(__dirname, 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

console.log('Database initialised — all tables ready.');

// Export the db instance so route files can use it
module.exports = db;