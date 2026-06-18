const express = require('express');
const { get, all, run } = require('../models/database');
const { logOperationWithData } = require('../middleware/logger');

const router = express.Router();

const SAVE_TYPES = {
  AUTO: 'auto',
  MANUAL: 'manual',
  SUBMIT: 'submit',
  STATUS_CHANGE: 'status_change',
  ROLLBACK: 'rollback',
  RESTORE: 'restore'
};

function saveVersion(configId, declarationId, declaration, saveType, user, summary) {
  try {
    const versionCount = get(
      'SELECT COUNT(*) as count FROM declaration_versions WHERE declaration_id = ?',
      [declarationId]
    );
    const versionNumber = versionCount.count + 1;

    const result = run(`
      INSERT INTO declaration_versions 
      (declaration_id, version_number, title, guideline_id, applicant, company, phone, email, 
       content, status, current_step, save_type, change_summary, created_by, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      declarationId,
      versionNumber,
      declaration.title,
      declaration.guideline_id || null,
      declaration.applicant,
      declaration.company,
      declaration.phone || '',
      declaration.email || '',
      declaration.content || '',
      declaration.status,
      declaration.current_step || 0,
      saveType,
      summary || '',
      user || null,
      JSON.stringify(declaration)
    ]);

    run(`
      UPDATE declarations 
      SET version_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [versionNumber, declarationId]);

    return {
      id: result.lastID,
      version_number: versionNumber
    };
  } catch (error) {
    console.error('保存版本失败:', error);
    return { id: null, version_number: 0 };
  }
}

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

router.post('/:id/autosave', (req, res) => {
  try {
    const declarationId = parseInt(req.params.id);
    const user = getCurrentUser(req);
    const data = req.body;

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const beforeData = { ...declaration };
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        declaration[key] = data[key];
      }
    });

    run(`
      UPDATE declarations SET title = ?, guideline_id = ?, applicant = ?, company = ?,
      phone = ?, email = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [declaration.title, declaration.guideline_id, declaration.applicant, declaration.company,
        declaration.phone, declaration.email, declaration.content, declarationId]);

    const versionResult = saveVersion(null, declarationId, declaration, SAVE_TYPES.AUTO, user, '自动保存');

    logOperationWithData(req, '自动保存', '版本', declarationId,
      `自动保存 v${versionResult.version_number}`, beforeData, declaration, Object.keys(data), versionResult.version_number);

    res.json({
      success: true,
      data: {
        version_number: versionResult.version_number,
        saved_at: new Date().toISOString(),
        skipped: false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/save', (req, res) => {
  try {
    const declarationId = parseInt(req.params.id);
    const user = getCurrentUser(req);
    const { change_note } = req.body;

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const versionResult = saveVersion(null, declarationId, declaration, SAVE_TYPES.MANUAL, user, change_note || '手动保存');

    logOperationWithData(req, '手动保存', '版本', declarationId,
      `手动保存 v${versionResult.version_number}`, null, null, null, versionResult.version_number);

    res.json({
      success: true,
      data: { version_number: versionResult.version_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const declarationId = parseInt(req.params.id);
    const { page = 1, pageSize = 20 } = req.query;

    const declaration = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const countResult = get('SELECT COUNT(*) as total FROM declaration_versions WHERE declaration_id = ?', [declarationId]);
    const versions = all(`
      SELECT * FROM declaration_versions 
      WHERE declaration_id = ? 
      ORDER BY version_number DESC 
      LIMIT ? OFFSET ?
    `, [declarationId, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]);

    const parsedVersions = versions.map(v => ({
      ...v,
      snapshot_json: undefined,
      snapshot: v.snapshot_json ? JSON.parse(v.snapshot_json) : null
    }));

    res.json({
      success: true,
      data: {
        declaration_id: declarationId,
        declaration_title: declaration.title,
        latest_version: countResult.total,
        list: parsedVersions,
        total: countResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/compare', (req, res) => {
  try {
    const declarationId = parseInt(req.params.id);
    const { v1, v2, type = 'current_vs_version' } = req.body;

    let beforeData, afterData;

    if (type === 'current_vs_version' && v2) {
      const current = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
      const version = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?', [declarationId, v2]);
      if (!current || !version) {
        return res.status(404).json({ success: false, message: '版本不存在' });
      }
      beforeData = version.snapshot_json ? JSON.parse(version.snapshot_json) : version;
      afterData = current;
    } else if (v1 && v2) {
      const ver1 = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?', [declarationId, v1]);
      const ver2 = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?', [declarationId, v2]);
      if (!ver1 || !ver2) {
        return res.status(404).json({ success: false, message: '版本不存在' });
      }
      beforeData = ver1.snapshot_json ? JSON.parse(ver1.snapshot_json) : ver1;
      afterData = ver2.snapshot_json ? JSON.parse(ver2.snapshot_json) : ver2;
    } else {
      return res.status(400).json({ success: false, message: '请提供要对比的版本号' });
    }

    const fieldLabels = {
      title: '项目名称', guideline_id: '申报指南', applicant: '申请人',
      company: '企业名称', phone: '联系电话', email: '电子邮箱',
      content: '项目内容', status: '状态', current_step: '当前步骤'
    };

    const changes = [];
    const changedFields = [];

    for (const field of Object.keys(fieldLabels)) {
      const before = beforeData[field] || '';
      const after = afterData[field] || '';
      if (before !== after) {
        changedFields.push(field);
        changes.push({
          field,
          field_label: fieldLabels[field],
          before,
          after,
          line_diff: {
            added: (after || '').split('\n').length - (before || '').split('\n').length,
            removed: 0,
            lines: []
          },
          char_change_count: Math.abs((after || '').length - (before || '').length)
        });
      }
    }

    res.json({
      success: true,
      data: {
        declaration_id: declarationId,
        before: { label: `v${v1 || '当前'}`, version_number: v1 || null, saved_at: '', saved_by: null, save_type: '' },
        after: { label: `v${v2 || '当前'}`, version_number: v2 || null, saved_at: '', saved_by: null, save_type: '' },
        diff: {
          has_changes: changes.length > 0,
          changed_fields: changedFields,
          changes,
          summary: changes.length > 0 ? `${changes.length} 个字段变更` : '无变更'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/restore/:versionId', (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const user = getCurrentUser(req);

    const version = get('SELECT * FROM declaration_versions WHERE id = ?', [versionId]);
    if (!version) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }

    const snapshot = version.snapshot_json ? JSON.parse(version.snapshot_json) : null;
    if (!snapshot) {
      return res.status(400).json({ success: false, message: '版本快照数据不完整' });
    }

    const declaration = get('SELECT * FROM declarations WHERE id = ?', [version.declaration_id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    run(`
      UPDATE declarations SET title = ?, guideline_id = ?, applicant = ?, company = ?,
      phone = ?, email = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [snapshot.title, snapshot.guideline_id, snapshot.applicant, snapshot.company,
        snapshot.phone, snapshot.email, snapshot.content, version.declaration_id]);

    const versionResult = saveVersion(null, version.declaration_id, {
      ...declaration,
      ...snapshot
    }, SAVE_TYPES.RESTORE, user, `恢复到版本 v${version.version_number}`);

    logOperationWithData(req, '恢复版本', '版本', version.declaration_id,
      `恢复到版本 v${version.version_number}，生成新版本 v${versionResult.version_number}`,
      null, null, null, versionResult.version_number);

    res.json({
      success: true,
      data: { version_number: versionResult.version_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/save-types', (req, res) => {
  const types = [
    { value: 'auto', label: '自动保存', color: '#8c8c8c', icon: 'clock' },
    { value: 'manual', label: '手动保存', color: '#1890ff', icon: 'save' },
    { value: 'submit', label: '提交保存', color: '#52c41a', icon: 'check' },
    { value: 'status_change', label: '状态变更', color: '#722ed1', icon: 'swap' },
    { value: 'rollback', label: '退回保存', color: '#fa8c16', icon: 'undo' },
    { value: 'restore', label: '版本恢复', color: '#eb2f96', icon: 'rollback' }
  ];
  res.json({ success: true, data: types });
});

router.get('/:id/preview-restore/:versionNumber', (req, res) => {
  try {
    const declarationId = parseInt(req.params.id);
    const versionNumber = parseInt(req.params.versionNumber);

    const current = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const version = get('SELECT * FROM declaration_versions WHERE declaration_id = ? AND version_number = ?', [declarationId, versionNumber]);

    if (!current || !version) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }

    const snapshot = version.snapshot_json ? JSON.parse(version.snapshot_json) : {};

    const fieldLabels = {
      title: '项目名称', guideline_id: '申报指南', applicant: '申请人',
      company: '企业名称', phone: '联系电话', email: '电子邮箱',
      content: '项目内容', status: '状态', current_step: '当前步骤'
    };

    const changes = [];
    const changedFields = [];

    for (const field of Object.keys(fieldLabels)) {
      const before = current[field] || '';
      const after = snapshot[field] || '';
      if (before !== after) {
        changedFields.push(field);
        changes.push({
          field,
          field_label: fieldLabels[field],
          before,
          after,
          line_diff: { added: 0, removed: 0, lines: [] },
          char_change_count: Math.abs((after || '').length - (before || '').length)
        });
      }
    }

    res.json({
      success: true,
      data: {
        current_version: current.version_count || 0,
        target_version: versionNumber,
        target_created_at: version.created_at,
        target_created_by: version.created_by,
        diff: {
          has_changes: changes.length > 0,
          changed_fields: changedFields,
          changes,
          summary: changes.length > 0 ? `${changes.length} 个字段将变更` : '无变更'
        }
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
