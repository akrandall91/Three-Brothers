const express = require('express');
const db = require('../db');

const router = express.Router();

function getBusiness() {
  return db.prepare('SELECT name, phone, email, note, updated_at FROM business WHERE id = 1').get()
    || { name: '', phone: '', email: '', note: '' };
}

function getItems() {
  return db.prepare(`
    SELECT id, name, pack, price, unit, "case" AS "case", qty, category
    FROM items
    ORDER BY sort_order ASC, name ASC
  `).all();
}

router.get('/', (req, res) => {
  res.json({ business: getBusiness(), items: getItems() });
});

module.exports = router;
