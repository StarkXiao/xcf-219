const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');

router.get('/', (req, res) => {
  try {
    const configs = all('SELECT * FROM workflow_configs ORDER BY created_at DESC');
    const result = configs.map(config => {
      const steps = all('SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order', [config.id]);
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

router.get('/:id', (req, res) => {
  try {
    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [req.params.id]);
    if (!config) {
      return res.status(404).json({ success: false, message: '工作流配置不存在' });
    }
    const steps = all('SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order', [config.id]);
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

module.exports = router;
