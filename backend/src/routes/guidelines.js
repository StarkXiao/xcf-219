const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');

router.get('/', (req, res) => {
  try {
    const { category, keyword } = req.query;
    let sql = 'SELECT * FROM guidelines WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (keyword) {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const guidelines = all(sql, params);
    res.json({ success: true, data: guidelines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [req.params.id]);
    if (!guideline) {
      return res.status(404).json({ success: false, message: '指南不存在' });
    }
    res.json({ success: true, data: guideline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { title, content, category, deadline } = req.body;
    const result = run(`
      INSERT INTO guidelines (title, content, category, deadline)
      VALUES (?, ?, ?, ?)
    `, [title, content, category || null, deadline || null]);
    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { title, content, category, deadline } = req.body;
    run(`
      UPDATE guidelines 
      SET title = ?, content = ?, category = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, content, category || null, deadline || null, req.params.id]);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM guidelines WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
