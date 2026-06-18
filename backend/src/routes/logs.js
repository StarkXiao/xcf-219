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

router.get('/timeline/:declarationId', (req, res) => {
  try {
    const { declarationId } = req.params;
    const logs = all(
      'SELECT * FROM operation_logs WHERE target_id = ? ORDER BY created_at DESC',
      [declarationId]
    );

    const timeline = logs.map(log => {
      let eventType = 'declaration';
      if (log.module === '版本' || (log.action && log.action.includes('保存')) || (log.action && log.action.includes('版本'))) {
        eventType = 'version';
      } else if (log.module === '状态流转' || log.module === '审批' || (log.action && (log.action.includes('审批') || log.action.includes('提交') || log.action.includes('驳回') || log.action.includes('退回')))) {
        eventType = 'workflow';
      }

      return {
        id: log.id,
        user: log.user,
        action: log.action,
        module: log.module,
        target_id: log.target_id,
        detail: log.detail,
        version_number: log.version_number || null,
        created_at: log.created_at,
        timestamp: log.created_at,
        event_type: eventType
      };
    });

    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
