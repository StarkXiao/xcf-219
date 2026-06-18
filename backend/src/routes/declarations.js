const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');
const { saveVersion, SAVE_TYPES } = require('./versions');
const { computeDiff, getChangedFields } = require('../utils/diff');

const STATUS_MAP = {
  draft: '草稿',
  submitted: '待初审',
  reviewing: '初审中',
  first_reviewed: '待复审',
  second_reviewed: '待终审',
  approved: '已立项',
  rejected: '已驳回'
};

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

router.get('/', (req, res) => {
  try {
    const { status, keyword, applicant, include_deleted = 'false' } = req.query;
    let sql = 'SELECT d.*, g.title as guideline_title FROM declarations d LEFT JOIN guidelines g ON d.guideline_id = g.id WHERE 1=1';
    const params = [];

    if (include_deleted !== 'true') {
      sql += ' AND d.is_deleted = 0';
    }

    if (status) {
      sql += ' AND d.status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (d.title LIKE ? OR d.content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (applicant) {
      sql += ' AND d.applicant = ?';
      params.push(applicant);
    }

    sql += ' ORDER BY d.created_at DESC';
    const declarations = all(sql, params);
    
    logOperation(req, '查询', '申报表单', null, `查询条件: status=${status || '全部'}`);
    
    res.json({ success: true, data: declarations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recycle-bin', (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 20 } = req.query;
    let sql = `
      SELECT d.*, g.title as guideline_title
      FROM declarations d 
      LEFT JOIN guidelines g ON d.guideline_id = g.id 
      WHERE d.is_deleted = 1
    `;
    let countSql = 'SELECT COUNT(*) as total FROM declarations WHERE is_deleted = 1';
    const params = [];
    const countParams = [];

    if (keyword) {
      sql += ' AND (d.title LIKE ? OR d.content LIKE ?)';
      countSql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY d.deleted_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const items = all(sql, params);
    const totalResult = get(countSql, countParams);

    logOperation(req, '查看回收站', '申报表单', null, `共${totalResult.total}条记录`);

    res.json({
      success: true,
      data: {
        list: items,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = {
      total: get('SELECT COUNT(*) as count FROM declarations WHERE is_deleted = 0').count,
      draft: get("SELECT COUNT(*) as count FROM declarations WHERE is_deleted = 0 AND status = 'draft'").count,
      in_progress: get(`
        SELECT COUNT(*) as count FROM declarations 
        WHERE is_deleted = 0 AND status IN ('submitted','reviewing','first_reviewed','second_reviewed')
      `).count,
      approved: get("SELECT COUNT(*) as count FROM declarations WHERE is_deleted = 0 AND status = 'approved'").count,
      rejected: get("SELECT COUNT(*) as count FROM declarations WHERE is_deleted = 0 AND status = 'rejected'").count,
      deleted: get('SELECT COUNT(*) as count FROM declarations WHERE is_deleted = 1').count,
      total_versions: get('SELECT COUNT(*) as count FROM declaration_versions').count
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const declaration = get(`
      SELECT d.*, g.title as guideline_title, g.content as guideline_content
      FROM declarations d 
      LEFT JOIN guidelines g ON d.guideline_id = g.id 
      WHERE d.id = ? AND d.is_deleted = 0
    `, [req.params.id]);
    
    if (!declaration) {
      const deleted = get(`
        SELECT d.*, g.title as guideline_title, g.content as guideline_content
        FROM declarations d 
        LEFT JOIN guidelines g ON d.guideline_id = g.id 
        WHERE d.id = ? AND d.is_deleted = 1
      `, [req.params.id]);
      if (deleted) {
        return res.status(410).json({ 
          success: false, 
          message: '申报已被删除，可在回收站中恢复',
          data: { ...deleted, is_in_recycle_bin: true }
        });
      }
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const attachments = all('SELECT * FROM attachments WHERE declaration_id = ?', [req.params.id]);
    declaration.attachments = attachments;

    logOperation(req, '查看详情', '申报表单', req.params.id, `查看申报: ${declaration.title}`);
    
    res.json({ success: true, data: declaration });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { title, guideline_id, applicant, company, phone, email, content } = req.body;
    const user = getCurrentUser(req);
    
    const result = run(`
      INSERT INTO declarations (title, guideline_id, applicant, company, phone, email, content, status, current_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0)
    `, [title, guideline_id || null, applicant, company, phone || '', email || '', content || '']);

    const newDeclaration = get('SELECT * FROM declarations WHERE id = ?', [result.lastID]);
    saveVersion(null, result.lastID, newDeclaration, SAVE_TYPES.MANUAL, user, '创建初始版本');

    logOperationWithData(req, '创建', '申报表单', result.lastID, 
      `创建申报: ${title}, 申请人: ${applicant}`,
      null, newDeclaration, ['title', 'applicant', 'company', 'content']);
    
    res.json({ 
      success: true, 
      data: { id: result.lastID, status: 'draft', version_number: 1 } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { title, guideline_id, applicant, company, phone, email, content, change_note } = req.body;
    const user = getCurrentUser(req);
    
    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }
    
    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能编辑草稿状态的申报' });
    }

    const beforeData = { ...declaration };
    const updateData = {
      title: title !== undefined ? title : declaration.title,
      guideline_id: guideline_id !== undefined ? guideline_id : declaration.guideline_id,
      applicant: applicant !== undefined ? applicant : declaration.applicant,
      company: company !== undefined ? company : declaration.company,
      phone: phone !== undefined ? phone : declaration.phone,
      email: email !== undefined ? email : declaration.email,
      content: content !== undefined ? content : declaration.content
    };

    const changedFields = getChangedFields(beforeData, updateData);
    if (changedFields.length === 0) {
      return res.json({ success: true, message: '内容无变化', skipped: true });
    }

    run(`
      UPDATE declarations 
      SET title = ?, guideline_id = ?, applicant = ?, company = ?, 
          phone = ?, email = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updateData.title, updateData.guideline_id, updateData.applicant, updateData.company, 
        updateData.phone, updateData.email, updateData.content, req.params.id]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    const diff = computeDiff(beforeData, updated);
    const summary = change_note || diff.summary;
    const versionResult = saveVersion(null, req.params.id, updated, SAVE_TYPES.MANUAL, user, summary);

    logOperationWithData(req, '更新', '申报表单', req.params.id,
      `更新申报: ${title || declaration.title}, ${diff.summary}`,
      beforeData, updated, changedFields, versionResult.version_number);
    
    res.json({ 
      success: true, 
      message: '更新成功',
      data: {
        version_number: versionResult.version_number,
        changed_fields: changedFields
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/submit', (req, res) => {
  try {
    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }
    
    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能提交草稿状态的申报' });
    }

    const user = getCurrentUser(req);
    const beforeData = { ...declaration };

    run(`
      UPDATE declarations 
      SET status = 'submitted', current_step = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    run(`
      INSERT INTO approval_records (declaration_id, step, approver, action, comment)
      VALUES (?, ?, ?, ?, ?)
    `, [req.params.id, 1, '系统', '提交', '申报人提交申报材料']);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    const versionResult = saveVersion(null, req.params.id, updated, SAVE_TYPES.SUBMIT, user, '提交申报，进入审批流程');

    logOperationWithData(req, '提交', '申报表单', req.params.id,
      `提交申报: ${declaration.title}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);
    
    res.json({ success: true, message: '提交成功', status: 'submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { permanent = 'false' } = req.query;
    const user = getCurrentUser(req);
    const declaration = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (permanent === 'true') {
      if (!declaration.is_deleted) {
        return res.status(400).json({ success: false, message: '请先将申报移至回收站，再进行永久删除' });
      }
      run('DELETE FROM declaration_versions WHERE declaration_id = ?', [req.params.id]);
      run('DELETE FROM approval_records WHERE declaration_id = ?', [req.params.id]);
      run('DELETE FROM attachments WHERE declaration_id = ?', [req.params.id]);
      run('DELETE FROM declarations WHERE id = ?', [req.params.id]);
      logOperation(req, '永久删除', '申报表单', req.params.id, `永久删除申报: ${declaration.title}`);
      return res.json({ success: true, message: '永久删除成功' });
    }
    
    if (declaration.is_deleted) {
      return res.status(400).json({ success: false, message: '申报已在回收站中' });
    }

    run(`
      UPDATE declarations 
      SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [user, req.params.id]);

    const afterData = { ...declaration, is_deleted: 1, deleted_by: user, deleted_at: new Date().toISOString() };
    logOperationWithData(req, '删除(软删除)', '申报表单', req.params.id,
      `删除申报移至回收站: ${declaration.title}`,
      declaration, afterData, ['is_deleted', 'deleted_at', 'deleted_by']);
    
    res.json({ success: true, message: '已移至回收站' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/restore', (req, res) => {
  try {
    const { restore_note } = req.body;
    const user = getCurrentUser(req);
    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 1', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不在回收站中' });
    }

    const beforeData = { ...declaration };
    run(`
      UPDATE declarations 
      SET is_deleted = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    if (updated.status === 'draft') {
      saveVersion(null, req.params.id, updated, SAVE_TYPES.RESTORE, user,
        restore_note || `从回收站恢复: ${declaration.title}`);
    }

    logOperationWithData(req, '恢复删除', '申报表单', req.params.id,
      `从回收站恢复申报: ${declaration.title}`,
      beforeData, updated, ['is_deleted', 'deleted_at']);
    
    res.json({ success: true, message: '恢复成功', data: { status: updated.status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/recycle-bin/clear', (req, res) => {
  try {
    const { older_than_days } = req.body;
    let sql = 'SELECT id, title FROM declarations WHERE is_deleted = 1';
    const params = [];
    if (older_than_days) {
      sql += ` AND deleted_at < datetime('now', ?)`;
      params.push(`-${older_than_days} days`);
    }
    const toDelete = all(sql, params);
    const ids = toDelete.map(d => d.id);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      run(`DELETE FROM declaration_versions WHERE declaration_id IN (${placeholders})`, ids);
      run(`DELETE FROM approval_records WHERE declaration_id IN (${placeholders})`, ids);
      run(`DELETE FROM attachments WHERE declaration_id IN (${placeholders})`, ids);
      run(`DELETE FROM declarations WHERE id IN (${placeholders})`, ids);
    }

    logOperation(req, '清空回收站', '申报表单', null,
      `永久删除 ${ids.length} 条回收站记录${older_than_days ? `(${older_than_days}天前)` : ''}`);

    res.json({
      success: true,
      message: `清空成功，共删除 ${ids.length} 条记录`,
      data: { deleted_count: ids.length, deleted_ids: ids }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
