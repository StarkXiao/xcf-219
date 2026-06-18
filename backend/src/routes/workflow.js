const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');
const { saveVersion, SAVE_TYPES } = require('./versions');

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

function validateApprovalAction(actionType, comment, reasonCategory) {
  const actionLabels = {
    approve: '审批意见',
    reject: '驳回原因',
    rollback: '退回原因'
  };
  const label = actionLabels[actionType] || '原因';
  if (!comment || !comment.trim()) {
    return `${label}为必填项`;
  }
  if (!reasonCategory) {
    return '请选择原因分类';
  }
  return null;
}

function getWorkflowConfig(declaration) {
  if (declaration.workflow_config_id) {
    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [declaration.workflow_config_id]);
    if (config) {
      const steps = all(
        'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
        [config.id]
      );
      return {
        ...config,
        steps: steps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]'),
          description: s.description || '',
          expected_duration: s.expected_duration || 0,
          responsible_person: s.responsible_person || ''
        }))
      };
    }
  }

  if (declaration.guideline_id) {
    const config = get('SELECT * FROM workflow_configs WHERE guideline_id = ?', [declaration.guideline_id]);
    if (config) {
      const steps = all(
        'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
        [config.id]
      );
      return {
        ...config,
        steps: steps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]'),
          description: s.description || '',
          expected_duration: s.expected_duration || 0,
          responsible_person: s.responsible_person || ''
        }))
      };
    }
  }

  return null;
}

function getFallbackConfig() {
  return {
    id: null,
    name: '默认审批流',
    steps: [
      { step_order: 1, name: '初审', step_key: 'initial_review', role: '初审员', pending_status: 'submitted', approved_status: 'first_reviewed', allow_rollback: true, rollback_targets: [0], description: '对申报材料进行形式审查，检查材料完整性和规范性', expected_duration: 3, responsible_person: '初审员' },
      { step_order: 2, name: '复审', step_key: 'second_review', role: '复审员', pending_status: 'first_reviewed', approved_status: 'second_reviewed', allow_rollback: true, rollback_targets: [1, 0], description: '业务部门对项目内容进行实质性审核', expected_duration: 5, responsible_person: '复审员' },
      { step_order: 3, name: '终审', step_key: 'final_review', role: '终审员', pending_status: 'second_reviewed', approved_status: 'approved', allow_rollback: true, rollback_targets: [2, 1, 0], description: '领导最终审批决策', expected_duration: 3, responsible_person: '终审员' }
    ]
  };
}

function resolveConfig(declaration) {
  return getWorkflowConfig(declaration) || getFallbackConfig();
}

function findCurrentStep(config, declaration) {
  if (declaration.current_step === 0 && declaration.status === 'draft') {
    return null;
  }

  return config.steps.find(s => s.pending_status === declaration.status) || null;
}

function findStepByOrder(config, stepOrder) {
  if (stepOrder === 0) {
    return { step_order: 0, name: '草稿', step_key: 'draft', role: '申请人', pending_status: 'draft', approved_status: 'submitted', allow_rollback: false, rollback_targets: [] };
  }
  return config.steps.find(s => s.step_order === stepOrder) || null;
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

router.get('/reason-categories', (req, res) => {
  try {
    const { action_type } = req.query;
    let sql = 'SELECT * FROM approval_reason_categories WHERE is_active = 1';
    const params = [];
    if (action_type) {
      sql += ' AND action_type = ?';
      params.push(action_type);
    }
    sql += ' ORDER BY action_type, sort_order, id';
    const categories = all(sql, params);
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/declaration/:declarationId/workflow-info', (req, res) => {
  try {
    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [req.params.declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const config = resolveConfig(declaration);
    const currentStep = findCurrentStep(config, declaration);
    const rollbackOptions = [];

    if (currentStep && currentStep.allow_rollback) {
      for (const targetOrder of currentStep.rollback_targets) {
        const targetStep = findStepByOrder(config, targetOrder);
        if (targetStep) {
          rollbackOptions.push({
            step_order: targetOrder,
            name: targetStep.name,
            status: targetStep.pending_status
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        config: { id: config.id, name: config.name },
        current_step: currentStep,
        steps: config.steps,
        rollback_options: rollbackOptions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/declaration/:declarationId/history', (req, res) => {
  try {
    const declaration = get('SELECT * FROM declarations WHERE id = ?', [req.params.declarationId]);
    const configSteps = {};

    if (declaration) {
      const config = resolveConfig(declaration);
      config.steps.forEach(s => {
        configSteps[s.step_order] = { name: s.name, role: s.role };
      });
      configSteps[0] = { name: '草稿', role: '申请人' };
    }

    const records = all(`
      SELECT ar.*, ws.name as legacy_step_name
      FROM approval_records ar
      LEFT JOIN workflow_steps ws ON ar.step = ws.step_order
      WHERE ar.declaration_id = ?
      ORDER BY ar.created_at ASC
    `, [req.params.declarationId]);

    const result = records.map(r => {
      const stepName = r.step_name || configSteps[r.step]?.name || r.legacy_step_name || `步骤${r.step}`;
      return { ...r, step_name: stepName, step_role: r.step_role || configSteps[r.step]?.role || '' };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/approve', (req, res) => {
  try {
    const { approver, comment, reason_category, step } = req.body;
    const declarationId = req.params.declarationId;
    const user = getCurrentUser(req);

    const validationError = validateApprovalAction('approve', comment, reason_category);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const config = resolveConfig(declaration);
    const currentStep = findCurrentStep(config, declaration);

    if (!currentStep) {
      return res.status(400).json({ success: false, message: '当前状态不在审批流程中，无法审批通过' });
    }

    const nextStatus = currentStep.approved_status;
    const currentStepIndex = config.steps.findIndex(s => s.step_order === currentStep.step_order);
    const nextStep = currentStepIndex < config.steps.length - 1 ? config.steps[currentStepIndex + 1] : null;
    const nextStepOrder = nextStep ? nextStep.step_order : currentStep.step_order + 1;

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations
      SET status = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nextStatus, nextStepOrder, declarationId]);

    run(`
      INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment, reason_category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [declarationId, currentStep.step_order, currentStep.name, currentStep.role, approver || currentStep.role, '通过', comment.trim(), reason_category]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.STATUS_CHANGE, user,
      `审批通过[${currentStep.name}]: ${declaration.status} -> ${nextStatus}`);

    logOperationWithData(req, '审批通过', '状态流转', declarationId,
      `申报: ${declaration.title}, 步骤: ${currentStep.name}, 审批人: ${approver || currentStep.role}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);

    res.json({
      success: true,
      message: '审批通过',
      status: nextStatus,
      data: {
        version_number: versionResult.version_number,
        step_name: currentStep.name,
        next_step: nextStep ? { name: nextStep.name, role: nextStep.role } : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/reject', (req, res) => {
  try {
    const { approver, comment, reason_category, step } = req.body;
    const declarationId = req.params.declarationId;
    const user = getCurrentUser(req);

    const validationError = validateApprovalAction('reject', comment, reason_category);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status === 'draft' || declaration.status === 'approved' || declaration.status === 'rejected') {
      return res.status(400).json({ success: false, message: '当前状态不允许驳回' });
    }

    const config = resolveConfig(declaration);
    const currentStep = findCurrentStep(config, declaration);
    const stepName = currentStep ? currentStep.name : '未知步骤';
    const stepRole = currentStep ? currentStep.role : (approver || '审批人');

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations
      SET status = 'rejected', current_step = 5, last_rejected_at = CURRENT_TIMESTAMP, last_reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [comment.trim(), declarationId]);

    run(`
      INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment, reason_category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [declarationId, step || declaration.current_step, stepName, stepRole, approver || stepRole, '驳回', comment.trim(), reason_category]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.STATUS_CHANGE, user,
      `审批驳回[${stepName}]: ${declaration.status} -> rejected`);

    logOperationWithData(req, '审批驳回', '状态流转', declarationId,
      `申报: ${declaration.title}, 步骤: ${stepName}, 驳回原因: ${comment || '无'}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);

    res.json({
      success: true,
      message: '已驳回',
      status: 'rejected',
      data: { version_number: versionResult.version_number, step_name: stepName }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId/rollback', (req, res) => {
  try {
    const { approver, comment, reason_category, target_step } = req.body;
    const declarationId = req.params.declarationId;
    const user = getCurrentUser(req);

    const validationError = validateApprovalAction('rollback', comment, reason_category);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status === 'draft' || declaration.status === 'approved' || declaration.status === 'rejected') {
      return res.status(400).json({ success: false, message: '当前状态不允许退回' });
    }

    const config = resolveConfig(declaration);
    const currentStep = findCurrentStep(config, declaration);

    if (!currentStep) {
      return res.status(400).json({ success: false, message: '当前状态不在审批流程中' });
    }

    if (!currentStep.allow_rollback) {
      return res.status(400).json({ success: false, message: '当前步骤不允许退回' });
    }

    let rollbackStepOrder = target_step;
    if (rollbackStepOrder === undefined || rollbackStepOrder === null) {
      if (currentStep.rollback_targets && currentStep.rollback_targets.length > 0) {
        rollbackStepOrder = currentStep.rollback_targets[0];
      } else {
        rollbackStepOrder = 0;
      }
    }

    if (currentStep.rollback_targets && currentStep.rollback_targets.length > 0 && !currentStep.rollback_targets.includes(rollbackStepOrder)) {
      return res.status(400).json({ success: false, message: `当前步骤只能退回到: ${currentStep.rollback_targets.map(t => findStepByOrder(config, t)?.name || `步骤${t}`).join('、')}` });
    }

    let rollbackStatus;
    let rollbackStepName;

    if (rollbackStepOrder === 0) {
      rollbackStatus = 'draft';
      rollbackStepName = '草稿';
    } else {
      const targetStepInfo = findStepByOrder(config, rollbackStepOrder);
      if (targetStepInfo) {
        rollbackStatus = targetStepInfo.pending_status;
        rollbackStepName = targetStepInfo.name;
      } else {
        return res.status(400).json({ success: false, message: '退回目标步骤不存在' });
      }
    }

    const beforeData = { ...declaration };

    run(`
      UPDATE declarations
      SET status = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [rollbackStatus, rollbackStepOrder, declarationId]);

    run(`
      INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment, reason_category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [declarationId, declaration.current_step, currentStep.name, currentStep.role, approver || currentStep.role, '退回', comment.trim(), reason_category]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.STATUS_CHANGE, user,
      `审批退回[${currentStep.name}→${rollbackStepName}]: ${declaration.status} -> ${rollbackStatus}`);

    logOperationWithData(req, '审批退回', '状态流转', declarationId,
      `申报: ${declaration.title}, 从${currentStep.name}退回至${rollbackStepName}`,
      beforeData, updated, ['status', 'current_step'], versionResult.version_number);

    res.json({
      success: true,
      message: `已退回至${rollbackStepName}`,
      status: rollbackStatus,
      data: {
        version_number: versionResult.version_number,
        from_step: currentStep.name,
        to_step: rollbackStepName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
