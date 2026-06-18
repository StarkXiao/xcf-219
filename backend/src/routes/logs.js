const express = require('express');
const router = express.Router();
const { get, all } = require('../models/database');

router.get('/', (req, res) => {
  try {
    const { page = 1, pageSize = 20, module, user, keyword } = req.query;
    let countSql = 'SELECT COUNT(*) as total FROM operation_logs WHERE 1=1';
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    const countParams = [];

    if (module) {
      sql += ' AND module = ?';
      countSql += ' AND module = ?';
      params.push(module);
      countParams.push(module);
    }

    if (user) {
      sql += ' AND user = ?';
      countSql += ' AND user = ?';
      params.push(user);
      countParams.push(user);
    }

    if (keyword) {
      sql += ' AND (detail LIKE ? OR action LIKE ?)';
      countSql += ' AND (detail LIKE ? OR action LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const logs = all(sql, params);
    const totalResult = get(countSql, countParams);

    res.json({
      success: true,
      data: {
        list: logs,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
