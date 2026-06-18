const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, get, all, run } = require('../models/database');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/deliverables');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `deliverable-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

const getCurrentUser = (req) => {
  return req.headers['x-user'] || 'system';
};

const initializeProjectPhases = (declarationId, guidelineId) => {
  const existingCount = get(
    'SELECT COUNT(*) as count FROM project_phase_instances WHERE declaration_id = ?',
    [declarationId]
  );

  if (existingCount.count > 0) {
    return;
  }

  let phases;
  if (guidelineId) {
    phases = all(
      'SELECT * FROM project_phases WHERE guideline_id = ? OR guideline_id IS NULL ORDER BY sort_order ASC',
      [guidelineId]
    );
  } else {
    phases = all(
      'SELECT * FROM project_phases WHERE guideline_id IS NULL ORDER BY sort_order ASC'
    );
  }

  if (!phases || phases.length === 0) {
    return;
  }

  const insertPhase = db.prepare(`
    INSERT INTO project_phase_instances 
    (declaration_id, phase_id, phase_name, phase_code, phase_description, sort_order, expected_duration, status, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)
  `);

  phases.forEach(phase => {
    insertPhase.run(
      declarationId,
      phase.id,
      phase.name,
      phase.code,
      phase.description,
      phase.sort_order,
      phase.expected_duration
    );
  });
};

const calculateOverallProgress = (phases) => {
  if (!phases || phases.length === 0) {
    return 0;
  }

  let totalDuration = 0;
  let weightedProgress = 0;

  phases.forEach(phase => {
    const duration = phase.expected_duration || 1;
    totalDuration += duration;
    weightedProgress += (phase.progress || 0) * duration;
  });

  return totalDuration > 0 ? Math.round(weightedProgress / totalDuration) : 0;
};

router.get('/:declarationId/overview', (req, res) => {
  try {
    const { declarationId } = req.params;

    const declaration = get(
      'SELECT id, title, status, guideline_id FROM declarations WHERE id = ? AND is_deleted = 0',
      [declarationId]
    );

    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    initializeProjectPhases(declarationId, declaration.guideline_id);

    const phases = all(`
      SELECT p.*,
        (SELECT COUNT(*) FROM phase_deliverables d WHERE d.phase_instance_id = p.id) as deliverable_count,
        (SELECT COUNT(*) FROM phase_deliverables d WHERE d.phase_instance_id = p.id AND d.submitted = 1) as submitted_deliverable_count,
        (SELECT COUNT(*) FROM acceptance_nodes a WHERE a.phase_instance_id = p.id) as acceptance_count,
        (SELECT COUNT(*) FROM acceptance_nodes a WHERE a.phase_instance_id = p.id AND a.status = 'passed') as passed_acceptance_count
      FROM project_phase_instances p
      WHERE p.declaration_id = ?
      ORDER BY p.sort_order ASC
    `, [declarationId]);

    const overallProgress = calculateOverallProgress(phases);

    const latestLog = get(`
      SELECT * FROM project_progress_logs
      WHERE declaration_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [declarationId]);

    const totalDeliverables = phases.reduce((sum, p) => sum + (p.deliverable_count || 0), 0);
    const submittedDeliverables = phases.reduce((sum, p) => sum + (p.submitted_deliverable_count || 0), 0);
    const totalAcceptances = phases.reduce((sum, p) => sum + (p.acceptance_count || 0), 0);
    const passedAcceptances = phases.reduce((sum, p) => sum + (p.passed_acceptance_count || 0), 0);

    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const inProgressPhases = phases.filter(p => p.status === 'in_progress').length;
    const pendingPhases = phases.filter(p => p.status === 'pending').length;
    const delayedPhases = phases.filter(p => p.status === 'delayed').length;

    res.json({
      success: true,
      data: {
        declaration: {
          id: declaration.id,
          title: declaration.title || '',
          status: declaration.status || ''
        },
        overall_progress: overallProgress || 0,
        phase_stats: {
          total: phases.length || 0,
          completed: completedPhases || 0,
          in_progress: inProgressPhases || 0,
          pending: pendingPhases || 0,
          delayed: delayedPhases || 0
        },
        deliverable_stats: {
          total: totalDeliverables || 0,
          submitted: submittedDeliverables || 0,
          completion_rate: totalDeliverables > 0 ? Math.round((submittedDeliverables / totalDeliverables) * 100) : 0
        },
        acceptance_stats: {
          total: totalAcceptances || 0,
          passed: passedAcceptances || 0,
          pass_rate: totalAcceptances > 0 ? Math.round((passedAcceptances / totalAcceptances) * 100) : 0
        },
        latest_progress_log: latestLog || null,
        phases: phases || []
      }
    });
  } catch (error) {
    console.error('获取项目概览失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

router.get('/:declarationId/phases', (req, res) => {
  try {
    const { declarationId } = req.params;

    const declaration = get(
      'SELECT id, guideline_id FROM declarations WHERE id = ? AND is_deleted = 0',
      [declarationId]
    );

    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    initializeProjectPhases(declarationId, declaration.guideline_id);

    const phases = all(`
      SELECT p.*,
        (SELECT COUNT(*) FROM phase_deliverables d WHERE d.phase_instance_id = p.id) as deliverable_count,
        (SELECT COUNT(*) FROM phase_deliverables d WHERE d.phase_instance_id = p.id AND d.submitted = 1) as submitted_deliverable_count,
        (SELECT COUNT(*) FROM acceptance_nodes a WHERE a.phase_instance_id = p.id) as acceptance_count,
        (SELECT COUNT(*) FROM acceptance_nodes a WHERE a.phase_instance_id = p.id AND a.status = 'passed') as passed_acceptance_count
      FROM project_phase_instances p
      WHERE p.declaration_id = ?
      ORDER BY p.sort_order ASC
    `, [declarationId]);

    res.json({
      success: true,
      data: phases || []
    });
  } catch (error) {
    console.error('获取阶段列表失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

router.put('/phases/:phaseId', (req, res) => {
  try {
    const { phaseId } = req.params;
    const { status, progress, start_date, planned_end_date, actual_end_date, responsible_person, remarks, update_note } = req.body;

    const phase = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);
    if (!phase) {
      return res.status(404).json({ success: false, message: '阶段不存在' });
    }

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (progress !== undefined) {
      updates.push('progress = ?');
      params.push(Math.min(100, Math.max(0, progress)));
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(start_date || null);
    }
    if (planned_end_date !== undefined) {
      updates.push('planned_end_date = ?');
      params.push(planned_end_date || null);
    }
    if (actual_end_date !== undefined) {
      updates.push('actual_end_date = ?');
      params.push(actual_end_date || null);
    }
    if (responsible_person !== undefined) {
      updates.push('responsible_person = ?');
      params.push(responsible_person || null);
    }
    if (remarks !== undefined) {
      updates.push('remarks = ?');
      params.push(remarks || null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, data: phase });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(phaseId);

    run(
      `UPDATE project_phase_instances SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (status !== undefined || progress !== undefined) {
      run(
        `INSERT INTO project_progress_logs 
        (declaration_id, phase_instance_id, progress_before, progress_after, status_before, status_after, update_note, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          phase.declaration_id,
          phase.id,
          phase.progress || 0,
          progress !== undefined ? Math.min(100, Math.max(0, progress)) : phase.progress || 0,
          phase.status || null,
          status || phase.status || null,
          update_note || null,
          getCurrentUser(req)
        ]
      );
    }

    const updatedPhase = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);
    res.json({ success: true, data: updatedPhase });
  } catch (error) {
    console.error('更新阶段失败:', error);
    res.status(500).json({ success: false, message: error.message || '更新失败' });
  }
});

router.get('/phases/:phaseId/deliverables', (req, res) => {
  try {
    const { phaseId } = req.params;

    const deliverables = all(`
      SELECT d.*,
        (SELECT COUNT(*) FROM deliverable_attachments a WHERE a.deliverable_id = d.id) as attachment_count
      FROM phase_deliverables d
      WHERE d.phase_instance_id = ?
      ORDER BY d.sort_order ASC, d.id ASC
    `, [phaseId]);

    const result = (deliverables || []).map(d => ({
      ...d,
      attachment_count: d.attachment_count || 0
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取阶段成果失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

router.post('/phases/:phaseId/deliverables', (req, res) => {
  try {
    const { phaseId } = req.params;
    const { name, description, required, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '成果名称不能为空' });
    }

    const phase = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);
    if (!phase) {
      return res.status(404).json({ success: false, message: '阶段不存在' });
    }

    const result = run(
      `INSERT INTO phase_deliverables (phase_instance_id, name, description, required, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        phaseId,
        name.trim(),
        description || null,
        required ? 1 : 0,
        sort_order || 0
      ]
    );

    const deliverable = get('SELECT * FROM phase_deliverables WHERE id = ?', [result.lastID]);
    res.json({ success: true, data: deliverable });
  } catch (error) {
    console.error('添加阶段成果失败:', error);
    res.status(500).json({ success: false, message: error.message || '添加失败' });
  }
});

router.put('/deliverables/:deliverableId', (req, res) => {
  try {
    const { deliverableId } = req.params;
    const { name, description, required, sort_order, status, remark } = req.body;

    const deliverable = get('SELECT * FROM phase_deliverables WHERE id = ?', [deliverableId]);
    if (!deliverable) {
      return res.status(404).json({ success: false, message: '成果不存在' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (required !== undefined) {
      updates.push('required = ?');
      params.push(required ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order || 0);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status || 'pending');
      if (status === 'submitted') {
        updates.push('submitted = 1');
        updates.push('submitted_at = CURRENT_TIMESTAMP');
      }
    }
    if (remark !== undefined) {
      updates.push('remark = ?');
      params.push(remark || null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, data: deliverable });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(deliverableId);

    run(
      `UPDATE phase_deliverables SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const updated = get('SELECT * FROM phase_deliverables WHERE id = ?', [deliverableId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新阶段成果失败:', error);
    res.status(500).json({ success: false, message: error.message || '更新失败' });
  }
});

router.delete('/deliverables/:deliverableId', (req, res) => {
  try {
    const { deliverableId } = req.params;

    const deliverable = get('SELECT * FROM phase_deliverables WHERE id = ?', [deliverableId]);
    if (!deliverable) {
      return res.status(404).json({ success: false, message: '成果不存在' });
    }

    const attachments = all('SELECT * FROM deliverable_attachments WHERE deliverable_id = ?', [deliverableId]);
    (attachments || []).forEach(att => {
      if (att.file_path && fs.existsSync(att.file_path)) {
        fs.unlinkSync(att.file_path);
      }
    });

    run('DELETE FROM deliverable_attachments WHERE deliverable_id = ?', [deliverableId]);
    run('DELETE FROM phase_deliverables WHERE id = ?', [deliverableId]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除阶段成果失败:', error);
    res.status(500).json({ success: false, message: error.message || '删除失败' });
  }
});

router.post('/deliverables/:deliverableId/upload', upload.array('files', 10), (req, res) => {
  try {
    const { deliverableId } = req.params;
    const { remark } = req.body;

    const deliverable = get('SELECT * FROM phase_deliverables WHERE id = ?', [deliverableId]);
    if (!deliverable) {
      return res.status(404).json({ success: false, message: '成果不存在' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }

    const uploadedFiles = [];
    const insertAttachment = db.prepare(`
      INSERT INTO deliverable_attachments (deliverable_id, filename, original_name, file_path, file_size, file_type, uploaded_by, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    files.forEach(file => {
      const result = insertAttachment.run(
        deliverableId,
        file.filename,
        file.originalname,
        file.path,
        file.size,
        file.mimetype,
        getCurrentUser(req),
        remark || null
      );
      uploadedFiles.push({
        id: result.lastID,
        original_name: file.originalname,
        filename: file.filename,
        file_size: file.size
      });
    });

    const attachmentCount = get(
      'SELECT COUNT(*) as count FROM deliverable_attachments WHERE deliverable_id = ?',
      [deliverableId]
    );

    if (attachmentCount.count > 0 && deliverable.submitted !== 1) {
      run('UPDATE phase_deliverables SET submitted = 1, status = ? WHERE id = ?', ['submitted', deliverableId]);
    }

    res.json({ success: true, data: uploadedFiles });
  } catch (error) {
    console.error('上传成果附件失败:', error);
    res.status(500).json({ success: false, message: error.message || '上传失败' });
  }
});

router.get('/deliverables/:deliverableId/attachments', (req, res) => {
  try {
    const { deliverableId } = req.params;

    const attachments = all(
      'SELECT * FROM deliverable_attachments WHERE deliverable_id = ? ORDER BY created_at DESC',
      [deliverableId]
    );

    res.json({ success: true, data: attachments || [] });
  } catch (error) {
    console.error('获取成果附件失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

router.get('/attachments/:attachmentId/download', (req, res) => {
  try {
    const { attachmentId } = req.params;

    const attachment = get('SELECT * FROM deliverable_attachments WHERE id = ?', [attachmentId]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    if (!attachment.file_path || !fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ success: false, message: '附件文件不存在' });
    }

    res.download(attachment.file_path, attachment.original_name || 'attachment');
  } catch (error) {
    console.error('下载附件失败:', error);
    res.status(500).json({ success: false, message: error.message || '下载失败' });
  }
});

router.delete('/attachments/:attachmentId', (req, res) => {
  try {
    const { attachmentId } = req.params;

    const attachment = get('SELECT * FROM deliverable_attachments WHERE id = ?', [attachmentId]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    if (attachment.file_path && fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    run('DELETE FROM deliverable_attachments WHERE id = ?', [attachmentId]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除附件失败:', error);
    res.status(500).json({ success: false, message: error.message || '删除失败' });
  }
});

router.get('/phases/:phaseId/acceptance-nodes', (req, res) => {
  try {
    const { phaseId } = req.params;

    const nodes = all(`
      SELECT n.*,
        (SELECT COUNT(*) FROM acceptance_records r WHERE r.acceptance_node_id = n.id) as record_count
      FROM acceptance_nodes n
      WHERE n.phase_instance_id = ?
      ORDER BY n.sort_order ASC, n.id ASC
    `, [phaseId]);

    const result = (nodes || []).map(n => ({
      ...n,
      record_count: n.record_count || 0
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取验收节点失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

router.post('/phases/:phaseId/acceptance-nodes', (req, res) => {
  try {
    const { phaseId } = req.params;
    const { name, description, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '节点名称不能为空' });
    }

    const phase = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);
    if (!phase) {
      return res.status(404).json({ success: false, message: '阶段不存在' });
    }

    const result = run(
      `INSERT INTO acceptance_nodes (phase_instance_id, name, description, sort_order)
       VALUES (?, ?, ?, ?)`,
      [phaseId, name.trim(), description || null, sort_order || 0]
    );

    const node = get('SELECT * FROM acceptance_nodes WHERE id = ?', [result.lastID]);
    res.json({ success: true, data: node });
  } catch (error) {
    console.error('添加验收节点失败:', error);
    res.status(500).json({ success: false, message: error.message || '添加失败' });
  }
});

router.put('/acceptance-nodes/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const { name, description, sort_order, status, comment } = req.body;

    const node = get('SELECT * FROM acceptance_nodes WHERE id = ?', [nodeId]);
    if (!node) {
      return res.status(404).json({ success: false, message: '验收节点不存在' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order || 0);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status || 'pending');
      if (status === 'passed') {
        updates.push('acceptance_date = CURRENT_DATE');
        updates.push('accepted_by = ?');
        params.push(getCurrentUser(req));
      }
    }
    if (comment !== undefined) {
      updates.push('comment = ?');
      params.push(comment || null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, data: node });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(nodeId);

    run(
      `UPDATE acceptance_nodes SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (status !== undefined) {
      run(
        `INSERT INTO acceptance_records (acceptance_node_id, action, comment, operator)
         VALUES (?, ?, ?, ?)`,
        [nodeId, status || 'update', comment || null, getCurrentUser(req)]
      );
    }

    const updated = get('SELECT * FROM acceptance_nodes WHERE id = ?', [nodeId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新验收节点失败:', error);
    res.status(500).json({ success: false, message: error.message || '更新失败' });
  }
});

router.delete('/acceptance-nodes/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;

    const node = get('SELECT * FROM acceptance_nodes WHERE id = ?', [nodeId]);
    if (!node) {
      return res.status(404).json({ success: false, message: '验收节点不存在' });
    }

    run('DELETE FROM acceptance_records WHERE acceptance_node_id = ?', [nodeId]);
    run('DELETE FROM acceptance_nodes WHERE id = ?', [nodeId]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除验收节点失败:', error);
    res.status(500).json({ success: false, message: error.message || '删除失败' });
  }
});

router.get('/acceptance-nodes/:nodeId/records', (req, res) => {
  try {
    const { nodeId } = req.params;

    const records = all(
      'SELECT * FROM acceptance_records WHERE acceptance_node_id = ? ORDER BY created_at DESC',
      [nodeId]
    );

    res.json({ success: true, data: records || [] });
  } catch (error) {
    console.error('获取验收记录失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

router.get('/:declarationId/progress-logs', (req, res) => {
  try {
    const { declarationId } = req.params;

    const logs = all(
      'SELECT * FROM project_progress_logs WHERE declaration_id = ? ORDER BY created_at DESC',
      [declarationId]
    );

    res.json({ success: true, data: logs || [] });
  } catch (error) {
    console.error('获取进度日志失败:', error);
    res.status(500).json({ success: false, message: error.message || '获取失败' });
  }
});

module.exports = {
  router,
  initializeProjectPhases
};
