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

// Lightweight migration for existing DB files created before preferred_currency existed.
const userCols = db.prepare("PRAGMA table_info(users)").all();
if (!userCols.some(col => col.name === 'preferred_currency')) {
    db.exec("ALTER TABLE users ADD COLUMN preferred_currency TEXT NOT NULL DEFAULT 'GBP'");
}
db.exec("UPDATE users SET preferred_currency = 'GBP' WHERE preferred_currency IS NULL OR preferred_currency NOT IN ('USD', 'GBP', 'EUR', 'INR', 'CAD', 'AUD', 'AED')");

// Run seed data if the file exists
const seedPath = path.join(__dirname, 'database', 'seed.sql');
if (fs.existsSync(seedPath)) {
    const seed = fs.readFileSync(seedPath, 'utf-8');
    db.exec(seed);
    console.log('Seed data applied.');
}

console.log('Database initialised — all tables ready.');

// Export the db instance so route files can use it
module.exports = db;