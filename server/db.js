const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.sqlite');
const SEED_PATH = path.join(__dirname, '..', 'data', 'seed.json');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pack TEXT DEFAULT '',
    price REAL,
    unit TEXT DEFAULT '',
    "case" TEXT DEFAULT '',
    qty REAL,
    category TEXT DEFAULT 'Other Seafood',
    sort_order INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS business (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    note TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM items').get();
  return row.n === 0;
}

function seedIfEmpty() {
  if (!isEmpty()) return;
  if (!fs.existsSync(SEED_PATH)) return;

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

  const insertItem = db.prepare(`
    INSERT INTO items (id, name, pack, price, unit, "case", qty, category, sort_order)
    VALUES (@id, @name, @pack, @price, @unit, @case, @qty, @category, @sort_order)
  `);
  const insertBusiness = db.prepare(`
    INSERT INTO business (id, name, phone, email, note)
    VALUES (1, @name, @phone, @email, @note)
    ON CONFLICT(id) DO UPDATE SET name=@name, phone=@phone, email=@email, note=@note
  `);

  db.exec('BEGIN');
  try {
    (seed.items || []).forEach((it, idx) => {
      insertItem.run({
        id: it.id,
        name: it.name,
        pack: it.pack || '',
        price: it.price == null ? null : Number(it.price),
        unit: it.unit || '',
        case: it.case || '',
        qty: it.qty == null ? null : Number(it.qty),
        category: it.category || 'Other Seafood',
        sort_order: idx,
      });
    });

    const b = seed.business || {};
    insertBusiness.run({
      name: b.name || '',
      phone: b.phone || '',
      email: b.email || '',
      note: b.note || '',
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

seedIfEmpty();

module.exports = db;
