const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const {
  checkPassword,
  issueToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
  isAuthed,
} = require('../auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  setSessionCookie(res, issueToken());
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ authed: isAuthed(req) });
});

// Everything below requires a valid admin session.
router.use(requireAdmin);

function nextSortOrder() {
  const row = db.prepare('SELECT MAX(sort_order) AS m FROM items').get();
  return (row.m == null ? -1 : row.m) + 1;
}

function genId() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function toNumOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

router.get('/items', (req, res) => {
  const items = db.prepare(`
    SELECT id, name, pack, price, unit, "case" AS "case", qty, category, sort_order
    FROM items ORDER BY sort_order ASC, name ASC
  `).all();
  res.json({ items });
});

router.post('/items', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const item = {
    id: genId(),
    name: String(b.name).trim(),
    pack: b.pack ? String(b.pack).trim() : '',
    price: toNumOrNull(b.price),
    unit: b.unit ? String(b.unit).trim() : '',
    case: b.case ? String(b.case).trim() : '',
    qty: toNumOrNull(b.qty),
    category: b.category ? String(b.category).trim() : 'Other Seafood',
    sort_order: nextSortOrder(),
  };
  db.prepare(`
    INSERT INTO items (id, name, pack, price, unit, "case", qty, category, sort_order)
    VALUES (@id, @name, @pack, @price, @unit, @case, @qty, @category, @sort_order)
  `).run(item);
  res.status(201).json({ item });
});

router.put('/items/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const item = {
    id: req.params.id,
    name: String(b.name).trim(),
    pack: b.pack ? String(b.pack).trim() : '',
    price: toNumOrNull(b.price),
    unit: b.unit ? String(b.unit).trim() : '',
    case: b.case ? String(b.case).trim() : '',
    qty: toNumOrNull(b.qty),
    category: b.category ? String(b.category).trim() : 'Other Seafood',
  };
  db.prepare(`
    UPDATE items SET name=@name, pack=@pack, price=@price, unit=@unit,
      "case"=@case, qty=@qty, category=@category, updated_at=datetime('now')
    WHERE id=@id
  `).run(item);
  res.json({ item });
});

router.delete('/items/:id', (req, res) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true });
});

router.post('/items/reorder', (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  const update = db.prepare('UPDATE items SET sort_order = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    order.forEach((id, idx) => update.run(idx, id));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

router.put('/business', (req, res) => {
  const b = req.body || {};
  const business = {
    name: b.name ? String(b.name).trim() : '',
    phone: b.phone ? String(b.phone).trim() : '',
    email: b.email ? String(b.email).trim() : '',
    note: b.note ? String(b.note) : '',
  };
  db.prepare(`
    INSERT INTO business (id, name, phone, email, note, updated_at)
    VALUES (1, @name, @phone, @email, @note, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=@name, phone=@phone, email=@email, note=@note, updated_at=datetime('now')
  `).run(business);
  res.json({ business });
});

module.exports = router;
