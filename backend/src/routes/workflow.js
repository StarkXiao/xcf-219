const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');
const { saveVersion, SAVE_TYPES } = require('./versions');

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

router.get('/steps', (req, res) => {
  try {
    const steps = all('SELECT * FROM workflow_steps ORDER BY step_order');
    res.json({ success: true, data: steps });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/status-options', (req, res) => {
  const statuses = [
    { value: 'draft', label: '草稿' },
    { value: 'submitted', label: '待初审' },
    { value: 'reviewing', label: '初审中' },
    { value: 'first_reviewed', label: '待复审' },
    { value: 'second_reviewed', label: '待终审' },
    { value: 'approved', label: '已立项' },
    { value: 'rejected', label: '已驳回' }
  ];
  res.json({ success: true, data: statuses });
});

router.get('/declaration/:declarationId/history', (req, res) => {
  try {
    const records = all(`
      SELECT ar.*, ws.name as step_name
      FROM approval_records ar
      LEFT JOIN workflow_steps ws ON ar.step = ws.step_order
      WHERE ar.declaration_id = ?
      ORDER BY ar.created_at ASC
    `, [req.params.declarationId]);

    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/approve', (req, res) => {
  try {
    const { approver, comment, step } = req.body;
    const declarationId = req.params.declarationId;
    const user = getCurrentUser(req);

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    let nextStatus;
    let nextStep;
    
    switch (declaration.status) {
      case 'submitted':
        nextStatus = 'first_reviewed';
        nextStep = 2;
        break;
      case 'first_reviewed':
        nextStatus = 'second_reviewed';
        nextStep = 3;
        break;
      case 'second_reviewed':
        nextStatus = 'approved';
        nextStep = 4;
        break;
      default:
        return res.status(400).json({ success: false, message: '当前状态不允许审批通过' });
    }

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations 
      SET status = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nextStatus, nextStep, declarationId]);

    run(`
      INSERT INTO approval_records (declaration_id, step, approver, action, comment)
      VALUES (?, ?, ?, ?, ?)
    `, [declarationId, step || declaration.current_step, approver || '审批人', '通过', comment || '']);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.STATUS_CHANGE, user,
      `审批通过: ${declaration.status} -> ${nextStatus}`);

    logOperationWithData(req, '审批通过', '状态流转', declarationId,
      `申报: ${declaration.title}, 审批人: ${approver || '审批人'}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);

    res.json({ 
      success: true, 
      message: '审批通过',
      status: nextStatus,
      data: { version_number: versionResult.version_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/reject', (req, res) => {
  try {
    const { approver, comment, step } = req.body;
    const declarationId = req.params.declarationId;
    const user = getCurrentUser(req);

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status === 'draft' || declaration.status === 'approved' || declaration.status === 'rejected') {
      return res.status(400).json({ success: false, message: '当前状态不允许驳回' });
    }

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations 
      SET status = 'rejected', current_step = 5, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [declarationId]);

    run(`
      INSERT INTO approval_records (declaration_id, step, approver, action, comment)
      VALUES (?, ?, ?, ?, ?)
    `, [declarationId, step || declaration.current_step, approver || '审批人', '驳回', comment || '']);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.STATUS_CHANGE, user,
      `审批驳回: ${declaration.status} -> rejected`);

    logOperationWithData(req, '审批驳回', '状态流转', declarationId,
      `申报: ${declaration.title}, 驳回原因: ${comment || '无'}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);

    res.json({ 
      success: true, 
      message: '已驳回',
      status: 'rejected',
      data: { version_number: versionResult.version_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/rollback', (req, res) => {
  try {
    const { approver, comment, target_step } = req.body;
    const declarationId = req.params.declarationId;
    const user = getCurrentUser(req);

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status === 'draft' || declaration.status === 'approved' || declaration.status === 'rejected') {
      return res.status(400).json({ success: false, message: '当前状态不允许退回' });
    }

    let rollbackStatus;
    let rollbackStep;
    
    if (target_step === 0 || target_step === 'draft') {
      rollbackStatus = 'draft';
      rollbackStep = 0;
    } else if (target_step === 1 || target_step === 'submitted') {
      rollbackStatus = 'submitted';
      rollbackStep = 1;
    } else {
      rollbackStatus = 'first_reviewed';
      rollbackStep = 2;
    }

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations 
      SET status = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [rollbackStatus, rollbackStep, declarationId]);

    run(`
      INSERT INTO approval_records (declaration_id, step, approver, action, comment)
      VALUES (?, ?, ?, ?, ?)
    `, [declarationId, declaration.current_step, approver || '审批人', '退回', comment || '']);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.STATUS_CHANGE, user,
      `审批退回: ${declaration.status} -> ${rollbackStatus}`);

    logOperationWithData(req, '审批退回', '状态流转', declarationId,
      `申报: ${declaration.title}, 退回至步骤: ${rollbackStep}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);

    res.json({ 
      success: true, 
      message: '已退回',
      status: rollbackStatus,
      data: { version_number: versionResult.version_number }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
