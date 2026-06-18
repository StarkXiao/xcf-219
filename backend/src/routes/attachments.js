const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');

router.get('/', (req, res) => {
  try {
    const { declaration_id } = req.query;
    let sql = 'SELECT * FROM attachments WHERE 1=1';
    const params = [];

    if (declaration_id) {
      sql += ' AND declaration_id = ?';
      params.push(declaration_id);
    }

    sql += ' ORDER BY uploaded_at DESC';
    const attachments = all(sql, params);
    res.json({ success: true, data: attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }
    res.json({ success: true, data: attachment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }
    run('DELETE FROM attachments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
