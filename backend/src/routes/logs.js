const express = require('express');
const router = express.Router();
const { get, all } = require('../models/database');
const { parseLogData } = require('../middleware/logger');

router.get('/', (req, res) => {
  try {
    const { module, action, user, target_id, start_date, end_date, detail_keyword, page = 1, pageSize = 20, include_data = 'false' } = req.query;
    
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

    if (start_date) {
      sql += ' AND created_at >= ?';
      countSql += ' AND created_at >= ?';
      params.push(start_date);
      countParams.push(start_date);
    }

    if (end_date) {
      sql += ' AND created_at <= ?';
      countSql += ' AND created_at <= ?';
      const endDateStr = String(end_date).includes(' ') ? end_date : `${end_date} 23:59:59`;
      params.push(endDateStr);
      countParams.push(endDateStr);
    }

    if (detail_keyword) {
      sql += ' AND detail LIKE ?';
      countSql += ' AND detail LIKE ?';
      params.push(`%${detail_keyword}%`);
      countParams.push(`%${detail_keyword}%`);
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

router.get('/options/filters', (req, res) => {
  try {
    const modules = all('SELECT DISTINCT module FROM operation_logs WHERE module IS NOT NULL ORDER BY module');
    const actions = all('SELECT DISTINCT action FROM operation_logs WHERE action IS NOT NULL ORDER BY action');
    const users = all('SELECT DISTINCT user FROM operation_logs WHERE user IS NOT NULL ORDER BY user LIMIT 100');

    res.json({
      success: true,
      data: {
        modules: modules.map(m => m.module),
        actions: actions.map(a => a.action),
        users: users.map(u => u.user)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/target/detail/:module/:targetId', (req, res) => {
  try {
    const { module, targetId } = req.params;
    let targetInfo = null;

    if (module === '申报表单' || module === '版本管理' || module === '状态流转' || module === '审批' || module === '附件') {
      const decl = get(`
        SELECT id, title, applicant, company, status, current_step, created_at, updated_at, is_deleted
        FROM declarations WHERE id = ?
      `, [targetId]);
      if (decl) {
        targetInfo = {
          type: 'declaration',
          ...decl,
          display_title: decl.title,
          display_subtitle: `${decl.applicant} / ${decl.company}`,
          status_text: decl.status
        };
      }
    } else if (module === '申报指南') {
      const guide = get(`
        SELECT id, title, category, deadline, created_at, updated_at
        FROM guidelines WHERE id = ?
      `, [targetId]);
      if (guide) {
        targetInfo = {
          type: 'guideline',
          ...guide,
          display_title: guide.title,
          display_subtitle: `分类: ${guide.category || '未分类'}`,
          status_text: guide.deadline ? `截止: ${guide.deadline}` : '无截止日期'
        };
      }
    }

    const relatedLogs = all(`
      SELECT id, user, action, module, target_id, detail, version_number, created_at
      FROM operation_logs
      WHERE module = ? AND target_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [module, targetId]);

    res.json({
      success: true,
      data: {
        module,
        target_id: targetId,
        target_info: targetInfo,
        related_logs: relatedLogs,
        related_count: relatedLogs.length
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

    let target_info = null;
    if (parsed.module && parsed.target_id) {
      try {
        if (['申报表单', '版本管理', '状态流转', '审批', '附件'].includes(parsed.module)) {
          const decl = get(`SELECT id, title, applicant, company, status, current_step, is_deleted FROM declarations WHERE id = ?`, [parsed.target_id]);
          if (decl) {
            target_info = { type: 'declaration', ...decl, display_title: decl.title };
          }
        } else if (parsed.module === '申报指南') {
          const guide = get(`SELECT id, title, category FROM guidelines WHERE id = ?`, [parsed.target_id]);
          if (guide) {
            target_info = { type: 'guideline', ...guide, display_title: guide.title };
          }
        }
      } catch (e) {
        target_info = null;
      }
    }

    let previous_log = null;
    let next_log = null;
    try {
      previous_log = get(`
        SELECT id, user, action, module, target_id, detail, version_number, created_at
        FROM operation_logs
        WHERE created_at < ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [parsed.created_at]);
      next_log = get(`
        SELECT id, user, action, module, target_id, detail, version_number, created_at
        FROM operation_logs
        WHERE created_at > ?
        ORDER BY created_at ASC
        LIMIT 1
      `, [parsed.created_at]);
    } catch (e) {}

    res.json({ 
      success: true, 
      data: {
        ...parsed,
        target_info,
        previous_log,
        next_log
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
