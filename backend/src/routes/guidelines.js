const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

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
    
    logOperation(req, '查询', '申报指南', null, `查询条件: category=${category || '全部'}, keyword=${keyword || '无'}`);
    
    res.json({ success: true, data: guidelines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [req.params.id]);
    
    if (!guideline) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    logOperation(req, '查看详情', '申报指南', req.params.id, `查看指南: ${guideline.title}`);
    
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
    `, [title, content, category || '其他', deadline || null]);

    logOperation(req, '创建', '申报指南', result.lastID, `创建指南: ${title}`);
    
    res.json({ 
      success: true, 
      data: { id: result.lastID } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { title, content, category, deadline } = req.body;
    
    const result = run(`
      UPDATE guidelines 
      SET title = ?, content = ?, category = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, content, category, deadline, req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    logOperation(req, '更新', '申报指南', req.params.id, `更新指南: ${title}`);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const guideline = get('SELECT title FROM guidelines WHERE id = ?', [req.params.id]);
    const result = run('DELETE FROM guidelines WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    logOperation(req, '删除', '申报指南', req.params.id, `删除指南: ${guideline?.title || ''}`);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
