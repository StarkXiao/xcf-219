const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');
const { computeDiff } = require('../utils/diff');

const SAVE_TYPES = {
  AUTO: 'auto',
  MANUAL: 'manual',
  SUBMIT: 'submit',
  STATUS_CHANGE: 'status_change',
  ROLLBACK: 'rollback',
  RESTORE: 'restore'
};

const MAX_VERSIONS_PER_DECLARATION = 100;

function saveVersion(db, declarationId, data, saveType, createdBy = null, changeSummary = null) {
  const existing = get('SELECT version_count FROM declarations WHERE id = ?', [declarationId]);
  const versionNumber = (existing?.version_count || 0) + 1;
  const snapshotJson = JSON.stringify({
    title: data.title,
    guideline_id: data.guideline_id,
    applicant: data.applicant,
    company: data.company,
    phone: data.phone,
    email: data.email,
    content: data.content,
    status: data.status,
    current_step: data.current_step
  });

  run(`
    INSERT INTO declaration_versions 
    (declaration_id, version_number, title, guideline_id, applicant, company, phone, email, content, status, current_step, save_type, change_summary, created_by, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    declarationId, versionNumber,
    data.title, data.guideline_id || null, data.applicant, data.company,
    data.phone || '', data.email || '', data.content || '',
    data.status || 'draft', data.current_step || 0,
    saveType, changeSummary, createdBy, snapshotJson
  ]);

  run('UPDATE declarations SET version_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [versionNumber, declarationId]);

  if (saveType === SAVE_TYPES.AUTO) {
    run('UPDATE declarations SET last_auto_save_at = CURRENT_TIMESTAMP WHERE id = ?', [declarationId]);
  }

  cleanupOldVersions(declarationId);

  return { version_number: versionNumber };
}

function cleanupOldVersions(declarationId) {
  const countResult = get('SELECT COUNT(*) as count FROM declaration_versions WHERE declaration_id = ?', [declarationId]);
  if (countResult.count > MAX_VERSIONS_PER_DECLARATION) {
    const toDelete = countResult.count - MAX_VERSIONS_PER_DECLARATION;
    run(`
      DELETE FROM declaration_versions 
      WHERE declaration_id = ? 
      AND id IN (
        SELECT id FROM declaration_versions 
        WHERE declaration_id = ? 
        ORDER BY version_number ASC 
        LIMIT ?
      )
    `, [declarationId, declarationId, toDelete]);
  }
}

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

router.get('/save-types', (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'auto', label: '自动保存', color: '#8c8c8c', icon: '⚡' },
      { value: 'manual', label: '手动保存', color: '#1890ff', icon: '💾' },
      { value: 'submit', label: '提交申报', color: '#52c41a', icon: '📤' },
      { value: 'status_change', label: '状态变更', color: '#722ed1', icon: '🔄' },
      { value: 'rollback', label: '版本回滚', color: '#fa8c16', icon: '↩️' },
      { value: 'restore', label: '恢复删除', color: '#eb2f96', icon: '♻️' }
    ]
  });
});

router.get('/declaration/:declarationId', (req, res) => {
  try {
    const { page = 1, pageSize = 20, save_type } = req.query;
    const declarationId = req.params.declarationId;

    const declaration = get('SELECT id, title FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    let sql = `
      SELECT v.*, 
        (SELECT COUNT(*) + 1 FROM declaration_versions v2 
         WHERE v2.declaration_id = v.declaration_id AND v2.version_number > v.version_number) as reverse_number
      FROM declaration_versions v
      WHERE v.declaration_id = ?
    `;
    let countSql = 'SELECT COUNT(*) as total FROM declaration_versions WHERE declaration_id = ?';
    const params = [declarationId];
    const countParams = [declarationId];

    if (save_type) {
      sql += ' AND v.save_type = ?';
      countSql += ' AND save_type = ?';
      params.push(save_type);
      countParams.push(save_type);
    }

    sql += ' ORDER BY v.version_number DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const versions = all(sql, params);
    const totalResult = get(countSql, countParams);
    const latestVersion = get(
      'SELECT MAX(version_number) as latest FROM declaration_versions WHERE declaration_id = ?',
      [declarationId]
    );

    res.json({
      success: true,
      data: {
        declaration_id: declarationId,
        declaration_title: declaration.title,
        latest_version: latestVersion?.latest || 0,
        list: versions,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:versionId', (req, res) => {
  try {
    const version = get(`
      SELECT v.*, d.title as current_title, d.status as current_status
      FROM declaration_versions v
      LEFT JOIN declarations d ON v.declaration_id = d.id
      WHERE v.id = ?
    `, [req.params.versionId]);

    if (!version) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }

    try {
      if (version.snapshot_json) {
        version.snapshot = JSON.parse(version.snapshot_json);
      }
    } catch (e) {
      version.snapshot = null;
    }

    res.json({ success: true, data: version });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/declaration/:declarationId/latest', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const version = get(`
      SELECT * FROM declaration_versions
      WHERE declaration_id = ?
      ORDER BY version_number DESC
      LIMIT 1
    `, [declarationId]);

    if (!version) {
      return res.status(404).json({ success: false, message: '暂无版本记录' });
    }

    res.json({ success: true, data: version });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/autosave', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const data = req.body;
    const user = getCurrentUser(req);

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '仅草稿状态可自动保存' });
    }

    const beforeData = { ...declaration };
    const diffResult = computeDiff(beforeData, data);

    if (!diffResult.has_changes) {
      return res.json({
        success: true,
        skipped: true,
        message: '内容无变化，跳过自动保存',
        data: { version_number: declaration.version_count || 0 }
      });
    }

    run(`
      UPDATE declarations
      SET title = ?, guideline_id = ?, applicant = ?, company = ?,
          phone = ?, email = ?, content = ?, last_auto_save_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.title || declaration.title,
      data.guideline_id !== undefined ? data.guideline_id : declaration.guideline_id,
      data.applicant || declaration.applicant,
      data.company || declaration.company,
      data.phone !== undefined ? data.phone : declaration.phone,
      data.email !== undefined ? data.email : declaration.email,
      data.content !== undefined ? data.content : declaration.content,
      declarationId
    ]);

    const updatedDeclaration = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const result = saveVersion(null, declarationId, updatedDeclaration, SAVE_TYPES.AUTO, user, diffResult.summary);

    logOperation(req, '自动保存', '版本管理', declarationId, `版本v${result.version_number}: ${diffResult.summary}`);

    res.json({
      success: true,
      message: '自动保存成功',
      data: {
        version_number: result.version_number,
        saved_at: new Date().toISOString(),
        changes: diffResult.changed_fields
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/save-version', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const { change_note, ...formData } = req.body;
    const user = getCurrentUser(req);

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const beforeData = { ...declaration };
    const diffResult = computeDiff(beforeData, formData);
    const summary = change_note || diffResult.summary;

    if (diffResult.has_changes) {
      run(`
        UPDATE declarations
        SET title = ?, guideline_id = ?, applicant = ?, company = ?,
            phone = ?, email = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        formData.title || declaration.title,
        formData.guideline_id !== undefined ? formData.guideline_id : declaration.guideline_id,
        formData.applicant || declaration.applicant,
        formData.company || declaration.company,
        formData.phone !== undefined ? formData.phone : declaration.phone,
        formData.email !== undefined ? formData.email : declaration.email,
        formData.content !== undefined ? formData.content : declaration.content,
        declarationId
      ]);
    }

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const result = saveVersion(null, declarationId, updated, SAVE_TYPES.MANUAL, user, summary);

    logOperation(req, '保存版本', '版本管理', declarationId, `版本v${result.version_number}: ${summary}`);

    res.json({
      success: true,
      message: '版本保存成功',
      data: {
        version_number: result.version_number,
        saved_at: new Date().toISOString(),
        change_summary: summary,
        changes: diffResult.changed_fields
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/diff/compare', (req, res) => {
  try {
    const { declaration_id, version1, version2, type = 'versions' } = req.query;

    if (!declaration_id) {
      return res.status(400).json({ success: false, message: '缺少 declaration_id 参数' });
    }

    let beforeData, afterData;
    let beforeLabel, afterLabel;

    if (type === 'current_vs_version') {
      const declaration = get('SELECT * FROM declarations WHERE id = ?', [declaration_id]);
      if (!declaration) {
        return res.status(404).json({ success: false, message: '申报不存在' });
      }
      afterData = declaration;
      afterLabel = '当前版本';

      const v = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?',
        [declaration_id, parseInt(version1)]);
      if (!v) {
        return res.status(404).json({ success: false, message: '指定版本不存在' });
      }
      beforeData = v;
      beforeLabel = `版本 v${v.version_number}`;
    } else {
      if (!version1 || !version2) {
        return res.status(400).json({ success: false, message: '请提供两个版本号进行对比' });
      }
      const v1 = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?',
        [declaration_id, parseInt(version1)]);
      const v2 = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?',
        [declaration_id, parseInt(version2)]);

      if (!v1 || !v2) {
        return res.status(404).json({ success: false, message: '版本不存在' });
      }

      beforeData = v1;
      afterData = v2;
      beforeLabel = `版本 v${v1.version_number}`;
      afterLabel = `版本 v${v2.version_number}`;
    }

    const diff = computeDiff(beforeData, afterData);

    res.json({
      success: true,
      data: {
        declaration_id: parseInt(declaration_id),
        before: {
          label: beforeLabel,
          version_number: beforeData.version_number || null,
          saved_at: beforeData.created_at || beforeData.updated_at,
          saved_by: beforeData.created_by || null,
          save_type: beforeData.save_type || 'current'
        },
        after: {
          label: afterLabel,
          version_number: afterData.version_number || null,
          saved_at: afterData.created_at || afterData.updated_at,
          saved_by: afterData.created_by || null,
          save_type: afterData.save_type || 'current'
        },
        diff
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:versionId/restore', (req, res) => {
  try {
    const versionId = req.params.versionId;
    const { restore_note } = req.body;
    const user = getCurrentUser(req);

    const version = get('SELECT * FROM declaration_versions WHERE id = ?', [versionId]);
    if (!version) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [version.declaration_id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在或已删除' });
    }

    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '仅草稿状态可恢复版本' });
    }

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations
      SET title = ?, guideline_id = ?, applicant = ?, company = ?,
          phone = ?, email = ?, content = ?, status = ?, current_step = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      version.title, version.guideline_id, version.applicant, version.company,
      version.phone, version.email, version.content, version.status, version.current_step,
      version.declaration_id
    ]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [version.declaration_id]);
    const summary = restore_note || `回滚至版本 v${version.version_number} (${version.created_at})`;
    const diffResult = computeDiff(beforeData, updated);
    const result = saveVersion(null, version.declaration_id, updated, SAVE_TYPES.ROLLBACK, user, summary);

    logOperation(req, '恢复版本', '版本管理', version.declaration_id,
      `从版本v${version.version_number}恢复，生成v${result.version_number}: ${summary}`);

    res.json({
      success: true,
      message: '版本恢复成功',
      data: {
        declaration_id: version.declaration_id,
        restored_from_version: version.version_number,
        new_version_number: result.version_number,
        changes: diffResult.changed_fields
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/preview-restore', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const { version_number } = req.body;

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const version = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?',
      [declarationId, parseInt(version_number)]);
    if (!version) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }

    const diff = computeDiff(declaration, version);

    res.json({
      success: true,
      data: {
        current_version: declaration.version_count,
        target_version: version.version_number,
        target_created_at: version.created_at,
        target_created_by: version.created_by,
        diff
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  router,
  saveVersion,
  SAVE_TYPES
};
