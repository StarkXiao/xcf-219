const express = require('express');
const router = express.Router();
const { get, all } = require('../models/database');
const { parseLogData } = require('../middleware/logger');

router.get('/', (req, res) => {
  try {
    const { module, action, user, target_id, page = 1, pageSize = 20, include_data = 'false' } = req.query;
    
    const selectFields = include_data === 'true'
      ? '*'
      : 'id, user, action, module, target_id, detail, ip, version_number, created_at';
    
    let sql = `SELECT ${selectFields} FROM operation_logs WHERE 1=1`;
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

    if (target_id) {
      sql += ' AND target_id = ?';
      countSql += ' AND target_id = ?';
      params.push(parseInt(target_id));
      countParams.push(parseInt(target_id));
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const logs = all(sql, params);
    const parsedLogs = include_data === 'true' ? logs.map(parseLogData) : logs;
    const totalResult = get(countSql, countParams);

    res.json({ 
      success: true, 
      data: {
        list: parsedLogs,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const log = get('SELECT * FROM operation_logs WHERE id = ?', [req.params.id]);
    if (!log) {
      return res.status(404).json({ success: false, message: '日志不存在' });
    }
    const parsed = parseLogData(log);
    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/target/:module/:targetId', (req, res) => {
  try {
    const { module, targetId } = req.params;
    const { page = 1, pageSize = 50, include_data = 'true' } = req.query;
    
    const selectFields = include_data === 'true' ? '*' : 'id, user, action, module, target_id, detail, ip, version_number, created_at';
    
    let sql = `SELECT ${selectFields} FROM operation_logs WHERE module = ? AND target_id = ?`;
    let countSql = 'SELECT COUNT(*) as total FROM operation_logs WHERE module = ? AND target_id = ?';
    const params = [module, targetId];
    const countParams = [module, targetId];

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const logs = all(sql, params);
    const parsedLogs = include_data === 'true' ? logs.map(parseLogData) : logs;
    const totalResult = get(countSql, countParams);

    res.json({
      success: true,
      data: {
        module,
        target_id: targetId,
        list: parsedLogs,
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
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND created_at <= ?';
      params.push(end_date);
    }

    const moduleStats = all(`
      SELECT module, COUNT(*) as count 
      FROM operation_logs 
      WHERE module IS NOT NULL ${dateFilter}
      GROUP BY module 
      ORDER BY count DESC
    `, params);

    const actionStats = all(`
      SELECT action, COUNT(*) as count 
      FROM operation_logs 
      WHERE 1=1 ${dateFilter}
      GROUP BY action 
      ORDER BY count DESC
    `, params);

    const userStats = all(`
      SELECT user, COUNT(*) as count 
      FROM operation_logs 
      WHERE user IS NOT NULL ${dateFilter}
      GROUP BY user 
      ORDER BY count DESC
      LIMIT 20
    `, params);

    const dailyStats = all(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM operation_logs
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, params);

    const totalResult = get(`SELECT COUNT(*) as total FROM operation_logs WHERE 1=1 ${dateFilter}`, params);

    res.json({
      success: true,
      data: {
        total: totalResult.total,
        by_module: moduleStats,
        by_action: actionStats,
        by_user: userStats,
        by_day: dailyStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/module/declaration/:declarationId', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const logs = all(`
      SELECT id, user, action, module, target_id, detail, version_number, created_at
      FROM operation_logs
      WHERE (module = '申报表单' OR module = '版本管理' OR module = '状态流转')
        AND target_id = ?
      ORDER BY created_at ASC
    `, [declarationId]);

    const timeline = logs.map(log => ({
      ...log,
      timestamp: log.created_at,
      event_type: log.module === '版本管理' ? 'version' : 
                  log.module === '状态流转' ? 'workflow' : 'declaration'
    }));

    res.json({
      success: true,
      data: {
        declaration_id: declarationId,
        timeline,
        total: logs.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
