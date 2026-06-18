const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

router.get('/', (req, res) => {
  try {
    const configs = all(`
      SELECT wc.*, g.title as guideline_title
      FROM workflow_configs wc
      LEFT JOIN guidelines g ON wc.guideline_id = g.id
      ORDER BY wc.created_at DESC
    `);

    const result = configs.map(config => {
      const steps = all(
        'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
        [config.id]
      );
      return {
        ...config,
        steps: steps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]')
        }))
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/guideline/:guidelineId', (req, res) => {
  try {
    const config = get(
      'SELECT * FROM workflow_configs WHERE guideline_id = ?',
      [req.params.guidelineId]
    );

    if (!config) {
      return res.json({ success: true, data: null });
    }

    const steps = all(
      'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
      [config.id]
    );

    res.json({
      success: true,
      data: {
        ...config,
        steps: steps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]')
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [req.params.id]);
    if (!config) {
      return res.status(404).json({ success: false, message: '工作流配置不存在' });
    }

    const steps = all(
      'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
      [config.id]
    );

    res.json({
      success: true,
      data: {
        ...config,
        steps: steps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]')
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { guideline_id, name, description, steps } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: '配置名称不能为空' });
    }

    if (!steps || steps.length === 0) {
      return res.status(400).json({ success: false, message: '至少需要一个审批步骤' });
    }

    if (guideline_id) {
      const existing = get(
        'SELECT id FROM workflow_configs WHERE guideline_id = ?',
        [guideline_id]
      );
      if (existing) {
        return res.status(400).json({ success: false, message: '该指南已有工作流配置，请使用更新接口' });
      }
    }

    const configResult = run(`
      INSERT INTO workflow_configs (guideline_id, name, description)
      VALUES (?, ?, ?)
    `, [guideline_id || null, name, description || '']);

    const configId = configResult.lastID;
    const insertStep = db.prepare(`
      INSERT INTO workflow_config_steps (config_id, name, step_key, role, step_order, pending_status, approved_status, allow_rollback, rollback_targets)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const step of steps) {
      insertStep.run(
        configId,
        step.name,
        step.step_key,
        step.role,
        step.step_order,
        step.pending_status,
        step.approved_status,
        step.allow_rollback !== false ? 1 : 0,
        JSON.stringify(step.rollback_targets || [])
      );
    }

    logOperation(req, '创建', '工作流配置', configId, `创建配置: ${name}`);

    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [configId]);
    const configSteps = all(
      'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
      [configId]
    );

    res.json({
      success: true,
      data: {
        ...config,
        steps: configSteps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]')
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, description, steps } = req.body;
    const configId = req.params.id;

    const existing = get('SELECT * FROM workflow_configs WHERE id = ?', [configId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '工作流配置不存在' });
    }

    run(`
      UPDATE workflow_configs
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name || existing.name, description !== undefined ? description : existing.description, configId]);

    if (steps && steps.length > 0) {
      run('DELETE FROM workflow_config_steps WHERE config_id = ?', [configId]);

      const insertStep = db.prepare(`
        INSERT INTO workflow_config_steps (config_id, name, step_key, role, step_order, pending_status, approved_status, allow_rollback, rollback_targets)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const step of steps) {
        insertStep.run(
          configId,
          step.name,
          step.step_key,
          step.role,
          step.step_order,
          step.pending_status,
          step.approved_status,
          step.allow_rollback !== false ? 1 : 0,
          JSON.stringify(step.rollback_targets || [])
        );
      }
    }

    logOperation(req, '更新', '工作流配置', configId, `更新配置: ${name || existing.name}`);

    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [configId]);
    const configSteps = all(
      'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
      [configId]
    );

    res.json({
      success: true,
      data: {
        ...config,
        steps: configSteps.map(s => ({
          ...s,
          allow_rollback: !!s.allow_rollback,
          rollback_targets: JSON.parse(s.rollback_targets || '[]')
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [req.params.id]);
    if (!config) {
      return res.status(404).json({ success: false, message: '工作流配置不存在' });
    }

    const inUse = get(
      'SELECT COUNT(*) as count FROM declarations WHERE workflow_config_id = ? AND is_deleted = 0 AND status NOT IN (\'draft\', \'approved\', \'rejected\')',
      [req.params.id]
    );
    if (inUse.count > 0) {
      return res.status(400).json({ success: false, message: '该配置正有申报使用中，无法删除' });
    }

    run('DELETE FROM workflow_config_steps WHERE config_id = ?', [req.params.id]);
    run('DELETE FROM workflow_configs WHERE id = ?', [req.params.id]);

    logOperation(req, '删除', '工作流配置', req.params.id, `删除配置: ${config.name}`);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/roles/list', (req, res) => {
  try {
    const roles = all('SELECT DISTINCT role FROM workflow_config_steps WHERE role IS NOT NULL AND role != \'\'');
    const defaultRoles = [
      { value: '初审员', label: '初审员' },
      { value: '复审员', label: '复审员' },
      { value: '终审员', label: '终审员' },
      { value: '评审专家', label: '评审专家' },
      { value: '审查员', label: '审查员' },
      { value: '公示专员', label: '公示专员' },
      { value: '领导', label: '领导' },
      { value: '认定委员会', label: '认定委员会' }
    ];
    const customRoles = roles.map(r => ({ value: r.role, label: r.role }));
    const allRoles = [...defaultRoles];
    customRoles.forEach(cr => {
      if (!allRoles.find(dr => dr.value === cr.value)) {
        allRoles.push(cr);
      }
    });
    res.json({ success: true, data: allRoles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const db = require('../models/database').db;

module.exports = router;
