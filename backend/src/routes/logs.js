const express = require('express');
const router = express.Router();
const { get, all } = require('../models/database');

router.get('/', (req, res) => {
  try {
    const { module, action, user, page = 1, pageSize = 20 } = req.query;
    
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM operation_logs WHERE 1=1';
    const params = [];
    const countParams = [];

    if (module) {
      sql += ' AND module = ?';
      countSql += ' AND module = ?';
      params.push(module);
      countParams.push(module);
    }

    if (action) {
      sql += ' AND action = ?';
      countSql += ' AND action = ?';
      params.push(action);
      countParams.push(action);
    }

    if (user) {
      sql += ' AND user LIKE ?';
      countSql += ' AND user LIKE ?';
      params.push(`%${user}%`);
      countParams.push(`%${user}%`);
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

router.get('/statistics', (req, res) => {
  try {
    const moduleStats = all(`
      SELECT module, COUNT(*) as count 
      FROM operation_logs 
      WHERE module IS NOT NULL 
      GROUP BY module 
      ORDER BY count DESC
    `);

    const actionStats = all(`
      SELECT action, COUNT(*) as count 
      FROM operation_logs 
      GROUP BY action 
      ORDER BY count DESC
    `);

    const totalResult = get('SELECT COUNT(*) as total FROM operation_logs');

    res.json({
      success: true,
      data: {
        total: totalResult.total,
        by_module: moduleStats,
        by_action: actionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
