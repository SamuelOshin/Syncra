import Database from 'better-sqlite3';

const db = new Database('database.db');

console.log("=== USERS ===");
const users = db.prepare("SELECT id, name, email, preferred_language, onboarded FROM users").all();
console.log(JSON.stringify(users, null, 2));

console.log("\n=== CHATS ===");
const chats = db.prepare("SELECT id, name, is_group FROM chats").all();
console.log(JSON.stringify(chats, null, 2));

console.log("\n=== PARTICIPANTS ===");
const participants = db.prepare("SELECT * FROM chat_participants").all();
console.log(JSON.stringify(participants, null, 2));

console.log("\n=== MESSAGES ===");
const messages = db.prepare("SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5").all();
console.log(JSON.stringify(messages, null, 2));

console.log("\n=== TRANSLATIONS ===");
const translations = db.prepare("SELECT * FROM message_translations ORDER BY created_at DESC LIMIT 5").all();
console.log(JSON.stringify(translations, null, 2));
