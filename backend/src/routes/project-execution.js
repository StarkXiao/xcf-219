const express = require('express');
const router = express.Router();
const { db, get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '../uploads/project-execution');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}_${random}${ext}`);
  }
});

const upload = multer({ storage });

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

function initializeProjectPhases(declarationId, guidelineId) {
  try {
    const existing = get('SELECT COUNT(*) as count FROM project_phase_instances WHERE declaration_id = ?', [declarationId]);
    if (existing.count > 0) return;

    let phases = all(`
      SELECT * FROM project_phases 
      WHERE guideline_id = ? OR guideline_id IS NULL 
      ORDER BY guideline_id DESC, sort_order ASC
    `, [guidelineId || null]);

    if (phases.length === 0) {
      phases = all('SELECT * FROM project_phases WHERE guideline_id IS NULL ORDER BY sort_order ASC');
    }

    const seenCodes = new Set();
    const uniquePhases = [];
    for (const p of phases) {
      if (!seenCodes.has(p.code)) {
        seenCodes.add(p.code);
        uniquePhases.push(p);
      }
    }

    const insertPhase = db.prepare(`
      INSERT INTO project_phase_instances 
      (declaration_id, phase_id, phase_name, phase_code, phase_description, sort_order, 
       status, progress, expected_duration, responsible_person)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
    `);

    const insertDeliverable = db.prepare(`
      INSERT INTO phase_deliverables (phase_instance_id, declaration_id, name, description, required, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    const insertAcceptanceNode = db.prepare(`
      INSERT INTO acceptance_nodes (declaration_id, phase_instance_id, node_name, node_type, description, status, acceptance_criteria)
      VALUES (?, ?, ?, 'phase', ?, 'pending', ?)
    `);

    uniquePhases.forEach((phase, idx) => {
      const result = insertPhase.run(
        declarationId,
        phase.id,
        phase.name,
        phase.code,
        phase.description,
        idx + 1,
        phase.expected_duration,
        ''
      );
      const phaseInstanceId = result.lastInsertRowid;

      const defaultDeliverables = getDefaultDeliverables(phase.code);
      defaultDeliverables.forEach((d, dIdx) => {
        insertDeliverable.run(phaseInstanceId, declarationId, d.name, d.description, dIdx + 1);
      });

      if (phase.requires_acceptance) {
        insertAcceptanceNode.run(
          declarationId,
          phaseInstanceId,
          `${phase.name}验收`,
          phase.description,
          `完成${phase.name}阶段所有任务并提交成果物`
        );
      }
    });

    const finalNode = get('SELECT * FROM acceptance_nodes WHERE declaration_id = ? AND node_type = ?', [declarationId, 'final']);
    if (!finalNode) {
      run(`
        INSERT INTO acceptance_nodes (declaration_id, phase_instance_id, node_name, node_type, description, status, acceptance_criteria)
        VALUES (?, NULL, '项目最终验收', 'final', '项目整体验收和成果交付', 'pending', '所有阶段验收通过，成果物完整，达到预期目标')
      `, [declarationId]);
    }

    console.log(`为申报 ${declarationId} 初始化 ${uniquePhases.length} 个项目阶段`);
  } catch (e) {
    console.error('初始化项目阶段失败:', e);
  }
}

function getDefaultDeliverables(phaseCode) {
  const mapping = {
    startup: [
      { name: '项目计划书', description: '包含项目目标、范围、进度计划、资源配置、风险评估等' },
      { name: '团队组织架构', description: '项目团队成员名单及职责分工' }
    ],
    requirement_design: [
      { name: '需求规格说明书', description: '详细的功能需求和非功能需求描述' },
      { name: '系统设计文档', description: '架构设计、数据库设计、接口设计等' },
      { name: 'UI/UX设计稿', description: '界面设计原型和交互说明' }
    ],
    development: [
      { name: '源代码', description: '项目源代码及版本管理说明' },
      { name: '技术文档', description: '开发文档、接口文档、部署文档' }
    ],
    midterm_check: [
      { name: '中期进展报告', description: '项目执行情况总结、进度偏差分析、下阶段计划' },
      { name: '阶段性成果', description: '已完成模块的演示或测试报告' }
    ],
    testing: [
      { name: '测试报告', description: '功能测试、性能测试、安全测试报告' },
      { name: 'Bug修复记录', description: '问题清单及修复情况' }
    ],
    pilot_training: [
      { name: '用户培训材料', description: '培训PPT、操作手册、视频教程等' },
      { name: '试运行报告', description: '试运行期间的运行数据和问题记录' }
    ],
    final_acceptance: [
      { name: '项目总结报告', description: '项目整体完成情况、经验教训、成果说明' },
      { name: '验收测试报告', description: '最终验收测试结果' },
      { name: '交付物清单', description: '所有交付物的完整清单和说明' }
    ],
    proposal: [
      { name: '可行性研究报告', description: '技术可行性、经济可行性、市场可行性分析' },
      { name: '技术方案', description: '详细的技术实现方案和路线图' }
    ],
    key_tech: [
      { name: '技术攻关报告', description: '关键技术难点及解决方案' },
      { name: '原型验证报告', description: '核心功能原型测试和验证结果' }
    ],
    integration: [
      { name: '集成测试报告', description: '模块集成和系统联调测试结果' }
    ],
    prototype: [
      { name: '样机测试报告', description: '原型样机性能测试和验证结果' },
      { name: '设计图纸', description: '产品设计图纸和技术规范' }
    ],
    pilot_production: [
      { name: '试产报告', description: '小批量试产情况总结' },
      { name: '工艺文件', description: '生产工艺文件和质量控制标准' }
    ],
    acceptance: [
      { name: '项目验收报告', description: '项目整体验收总结和交付清单' }
    ]
  };
  return mapping[phaseCode] || [];
}

router.get('/phases/templates', (req, res) => {
  try {
    const { guideline_id } = req.query;
    let sql = 'SELECT * FROM project_phases WHERE guideline_id IS NULL';
    const params = [];

    if (guideline_id) {
      sql = `
        SELECT * FROM project_phases 
        WHERE guideline_id = ? OR guideline_id IS NULL 
        ORDER BY guideline_id DESC, sort_order ASC
      `;
      params.push(guideline_id);
    } else {
      sql += ' ORDER BY sort_order ASC';
    }

    const templates = all(sql, params);
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:declarationId/phases', (req, res) => {
  try {
    const { declarationId } = req.params;

    const declaration = get('SELECT id, guideline_id, status FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    initializeProjectPhases(declarationId, declaration.guideline_id);

    const phases = all(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM phase_deliverables d WHERE d.phase_instance_id = p.id) as deliverable_count,
        (SELECT COUNT(*) FROM phase_deliverables d WHERE d.phase_instance_id = p.id AND d.id IN (
          SELECT deliverable_id FROM deliverable_attachments
        )) as submitted_deliverable_count,
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
      ORDER BY created_at DESC LIMIT 1
    `, [declarationId]);

    res.json({
      success: true,
      data: {
        phases,
        overall_progress: overallProgress,
        latest_progress_log: latestLog
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function calculateOverallProgress(phases) {
  if (phases.length === 0) return 0;
  const totalWeight = phases.reduce((sum, p) => sum + (p.expected_duration || 1), 0);
  const weightedProgress = phases.reduce((sum, p) => {
    const weight = (p.expected_duration || 1) / totalWeight;
    return sum + (p.progress || 0) * weight;
  }, 0);
  return Math.round(weightedProgress);
}

router.post('/:declarationId/phases/initialize', (req, res) => {
  try {
    const { declarationId } = req.params;
    const declaration = get('SELECT id, guideline_id, status FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    initializeProjectPhases(declarationId, declaration.guideline_id);

    logOperation(req, '初始化项目阶段', '项目执行', declarationId, `初始化申报 ${declarationId} 的项目执行阶段`);

    res.json({ success: true, message: '项目阶段初始化成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/phases/:phaseId', (req, res) => {
  try {
    const { phaseId } = req.params;
    const { status, progress, start_date, planned_end_date, actual_end_date, responsible_person, remarks } = req.body;
    const user = getCurrentUser(req);

    const phase = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);
    if (!phase) {
      return res.status(404).json({ success: false, message: '阶段不存在' });
    }

    const beforeData = { ...phase };
    let previousProgress = phase.progress;

    run(`
      UPDATE project_phase_instances 
      SET status = COALESCE(?, status),
          progress = COALESCE(?, progress),
          start_date = COALESCE(?, start_date),
          planned_end_date = COALESCE(?, planned_end_date),
          actual_end_date = COALESCE(?, actual_end_date),
          responsible_person = COALESCE(?, responsible_person),
          remarks = COALESCE(?, remarks),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, progress, start_date, planned_end_date, actual_end_date, responsible_person, remarks, phaseId]);

    if (progress !== undefined && progress !== previousProgress) {
      run(`
        INSERT INTO project_progress_logs 
        (declaration_id, phase_instance_id, progress_value, previous_progress, update_note, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [phase.declaration_id, phaseId, progress, previousProgress, 
          req.body.update_note || `阶段进度从 ${previousProgress}% 更新到 ${progress}%`, user]);
    }

    const updated = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);

    logOperationWithData(req, '更新项目阶段', '项目执行', phase.declaration_id,
      `更新阶段: ${phase.phase_name}`,
      beforeData, updated, Object.keys(req.body).filter(k => req.body[k] !== undefined));

    res.json({ success: true, data: updated, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:declarationId/progress', (req, res) => {
  try {
    const { declarationId } = req.params;
    const { phase_instance_id, progress_value, update_note } = req.body;
    const user = getCurrentUser(req);

    if (progress_value === undefined) {
      return res.status(400).json({ success: false, message: '进度值不能为空' });
    }

    let previousProgress = 0;
    if (phase_instance_id) {
      const phase = get('SELECT progress FROM project_phase_instances WHERE id = ? AND declaration_id = ?', 
        [phase_instance_id, declarationId]);
      if (!phase) {
        return res.status(404).json({ success: false, message: '阶段不存在' });
      }
      previousProgress = phase.progress;
      run('UPDATE project_phase_instances SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [progress_value, phase_instance_id]);
    }

    run(`
      INSERT INTO project_progress_logs 
      (declaration_id, phase_instance_id, progress_value, previous_progress, update_note, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [declarationId, phase_instance_id || null, progress_value, previousProgress, 
        update_note || `进度更新到 ${progress_value}%`, user]);

    logOperation(req, '更新项目进度', '项目执行', declarationId,
      `${phase_instance_id ? '阶段' : '项目'}进度更新为 ${progress_value}%`);

    res.json({ success: true, message: '进度更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:declarationId/progress/logs', (req, res) => {
  try {
    const { declarationId } = req.params;
    const { phase_instance_id, page = 1, pageSize = 50 } = req.query;

    let sql = 'SELECT * FROM project_progress_logs WHERE declaration_id = ?';
    const params = [declarationId];

    if (phase_instance_id) {
      sql += ' AND phase_instance_id = ?';
      params.push(phase_instance_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (page - 1) * parseInt(pageSize));

    const logs = all(sql, params);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/phases/:phaseId/deliverables', (req, res) => {
  try {
    const { phaseId } = req.params;

    const deliverables = all(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM deliverable_attachments a WHERE a.deliverable_id = d.id) as attachment_count,
        (SELECT MAX(uploaded_at) FROM deliverable_attachments a WHERE a.deliverable_id = d.id) as last_uploaded_at
      FROM phase_deliverables d 
      WHERE d.phase_instance_id = ? 
      ORDER BY d.sort_order ASC, d.created_at ASC
    `, [phaseId]);

    for (const d of deliverables) {
      d.attachments = all('SELECT * FROM deliverable_attachments WHERE deliverable_id = ? ORDER BY uploaded_at DESC', [d.id]);
    }

    res.json({ success: true, data: deliverables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/phases/:phaseId/deliverables', (req, res) => {
  try {
    const { phaseId } = req.params;
    const { name, description, required, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '成果物名称不能为空' });
    }

    const phase = get('SELECT * FROM project_phase_instances WHERE id = ?', [phaseId]);
    if (!phase) {
      return res.status(404).json({ success: false, message: '阶段不存在' });
    }

    const result = run(`
      INSERT INTO phase_deliverables (phase_instance_id, declaration_id, name, description, required, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [phaseId, phase.declaration_id, name.trim(), description || '', required !== undefined ? required : 1, sort_order || 0]);

    logOperation(req, '添加阶段成果物', '项目执行', phase.declaration_id,
      `在阶段 ${phase.phase_name} 添加成果物: ${name}`);

    res.json({ success: true, data: { id: result.lastID }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/deliverables/:deliverableId', (req, res) => {
  try {
    const { deliverableId } = req.params;

    const deliverable = get('SELECT * FROM phase_deliverables WHERE id = ?', [deliverableId]);
    if (!deliverable) {
      return res.status(404).json({ success: false, message: '成果物不存在' });
    }

    run('DELETE FROM deliverable_attachments WHERE deliverable_id = ?', [deliverableId]);
    run('DELETE FROM phase_deliverables WHERE id = ?', [deliverableId]);

    logOperation(req, '删除阶段成果物', '项目执行', deliverable.declaration_id,
      `删除成果物: ${deliverable.name}`);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/deliverables/:deliverableId/upload', upload.array('files', 10), (req, res) => {
  try {
    const { deliverableId } = req.params;
    const { remark } = req.body;
    const user = getCurrentUser(req);

    const deliverable = get('SELECT d.*, p.phase_name FROM phase_deliverables d LEFT JOIN project_phase_instances p ON d.phase_instance_id = p.id WHERE d.id = ?', [deliverableId]);
    if (!deliverable) {
      return res.status(404).json({ success: false, message: '成果物不存在' });
    }

    const attachments = [];
    for (const file of req.files) {
      const maxVersion = get('SELECT COALESCE(MAX(version), 0) as max_ver FROM deliverable_attachments WHERE deliverable_id = ?', [deliverableId]);
      const result = run(`
        INSERT INTO deliverable_attachments 
        (deliverable_id, phase_instance_id, declaration_id, filename, original_name, file_path, file_size, file_type, uploaded_by, version, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [deliverableId, deliverable.phase_instance_id, deliverable.declaration_id,
          file.filename, file.originalname, file.path, file.size, file.mimetype,
          user, (maxVersion.max_ver || 0) + 1, remark || '']);
      attachments.push({ id: result.lastID, original_name: file.originalname });
    }

    logOperation(req, '上传成果物附件', '项目执行', deliverable.declaration_id,
      `在阶段 ${deliverable.phase_name} 上传成果物 ${deliverable.name} 的 ${attachments.length} 个附件`);

    res.json({ success: true, data: attachments, message: `成功上传 ${attachments.length} 个文件` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attachments/:attachmentId/download', (req, res) => {
  try {
    const { attachmentId } = req.params;
    const attachment = get('SELECT * FROM deliverable_attachments WHERE id = ?', [attachmentId]);

    if (!attachment || !fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    res.download(attachment.file_path, attachment.original_name);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/attachments/:attachmentId', (req, res) => {
  try {
    const { attachmentId } = req.params;

    const attachment = get('SELECT * FROM deliverable_attachments WHERE id = ?', [attachmentId]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    run('DELETE FROM deliverable_attachments WHERE id = ?', [attachmentId]);

    logOperation(req, '删除成果物附件', '项目执行', attachment.declaration_id,
      `删除附件: ${attachment.original_name}`);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:declarationId/acceptance-nodes', (req, res) => {
  try {
    const { declarationId } = req.params;

    const nodes = all(`
      SELECT n.*, 
        p.phase_name,
        (SELECT COUNT(*) FROM acceptance_records r WHERE r.node_id = n.id) as record_count,
        (SELECT result FROM acceptance_records r WHERE r.node_id = n.id ORDER BY accepted_at DESC LIMIT 1) as last_result,
        (SELECT accepted_at FROM acceptance_records r WHERE r.node_id = n.id ORDER BY accepted_at DESC LIMIT 1) as last_accepted_at
      FROM acceptance_nodes n 
      LEFT JOIN project_phase_instances p ON n.phase_instance_id = p.id
      WHERE n.declaration_id = ? 
      ORDER BY 
        CASE n.node_type WHEN 'final' THEN 999 ELSE COALESCE(p.sort_order, 0) END ASC,
        n.created_at ASC
    `, [declarationId]);

    for (const node of nodes) {
      node.records = all('SELECT * FROM acceptance_records WHERE node_id = ? ORDER BY accepted_at DESC', [node.id]);
    }

    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:declarationId/acceptance-nodes', (req, res) => {
  try {
    const { declarationId } = req.params;
    const { phase_instance_id, node_name, node_type = 'custom', description, planned_date, acceptance_criteria } = req.body;

    if (!node_name || !node_name.trim()) {
      return res.status(400).json({ success: false, message: '验收节点名称不能为空' });
    }

    const result = run(`
      INSERT INTO acceptance_nodes 
      (declaration_id, phase_instance_id, node_name, node_type, description, planned_date, status, acceptance_criteria)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [declarationId, phase_instance_id || null, node_name.trim(), node_type, 
        description || '', planned_date || null, acceptance_criteria || '']);

    logOperation(req, '添加验收节点', '项目执行', declarationId, `添加验收节点: ${node_name}`);

    res.json({ success: true, data: { id: result.lastID }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/acceptance-nodes/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const { node_name, description, planned_date, actual_date, status, acceptance_criteria } = req.body;

    const node = get('SELECT * FROM acceptance_nodes WHERE id = ?', [nodeId]);
    if (!node) {
      return res.status(404).json({ success: false, message: '验收节点不存在' });
    }

    run(`
      UPDATE acceptance_nodes 
      SET node_name = COALESCE(?, node_name),
          description = COALESCE(?, description),
          planned_date = COALESCE(?, planned_date),
          actual_date = COALESCE(?, actual_date),
          status = COALESCE(?, status),
          acceptance_criteria = COALESCE(?, acceptance_criteria),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [node_name, description, planned_date, actual_date, status, acceptance_criteria, nodeId]);

    const updated = get('SELECT * FROM acceptance_nodes WHERE id = ?', [nodeId]);
    logOperation(req, '更新验收节点', '项目执行', node.declaration_id, `更新验收节点: ${node_name || node.node_name}`);

    res.json({ success: true, data: updated, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/acceptance-nodes/:nodeId/records', (req, res) => {
  try {
    const { nodeId } = req.params;
    const { result, score, comment, issues_found, suggestions } = req.body;
    const user = getCurrentUser(req);

    if (!result) {
      return res.status(400).json({ success: false, message: '验收结果不能为空' });
    }

    const node = get('SELECT * FROM acceptance_nodes WHERE id = ?', [nodeId]);
    if (!node) {
      return res.status(404).json({ success: false, message: '验收节点不存在' });
    }

    const insertResult = run(`
      INSERT INTO acceptance_records 
      (node_id, declaration_id, phase_instance_id, result, score, comment, issues_found, suggestions, accepted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [nodeId, node.declaration_id, node.phase_instance_id, result, 
        score || null, comment || '', issues_found || '', suggestions || '', user]);

    let newStatus = node.status;
    let actualDate = node.actual_date;
    if (result === 'passed') {
      newStatus = 'passed';
      actualDate = new Date().toISOString().split('T')[0];
    } else if (result === 'failed') {
      newStatus = 'failed';
    } else if (result === 'conditional') {
      newStatus = 'conditional';
    }

    run('UPDATE acceptance_nodes SET status = ?, actual_date = COALESCE(?, actual_date), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, actualDate, nodeId]);

    if (result === 'passed' && node.phase_instance_id) {
      run('UPDATE project_phase_instances SET status = ?, actual_end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', actualDate, node.phase_instance_id]);
    }

    if (result === 'passed' && node.node_type === 'final') {
      run('UPDATE declarations SET status = ? WHERE id = ?', ['completed', node.declaration_id]);
    }

    logOperation(req, '提交验收记录', '项目执行', node.declaration_id,
      `验收节点 ${node.node_name} 结果: ${result}${score ? `, 评分: ${score}` : ''}`);

    res.json({ success: true, data: { id: insertResult.lastID }, message: '验收记录提交成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:declarationId/summary', (req, res) => {
  try {
    const { declarationId } = req.params;

    const declaration = get(`
      SELECT d.*, g.title as guideline_title 
      FROM declarations d LEFT JOIN guidelines g ON d.guideline_id = g.id 
      WHERE d.id = ? AND d.is_deleted = 0
    `, [declarationId]);

    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    initializeProjectPhases(declarationId, declaration.guideline_id);

    const phaseStats = get(`
      SELECT 
        COUNT(*) as total_phases,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_phases,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_phases,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_phases,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_phases
      FROM project_phase_instances WHERE declaration_id = ?
    `, [declarationId]);

    const deliverableStats = get(`
      SELECT 
        COUNT(*) as total_deliverables,
        SUM(CASE WHEN id IN (SELECT deliverable_id FROM deliverable_attachments) THEN 1 ELSE 0 END) as submitted_deliverables,
        SUM(CASE WHEN id NOT IN (SELECT deliverable_id FROM deliverable_attachments) AND required = 1 THEN 1 ELSE 0 END) as missing_required
      FROM phase_deliverables WHERE declaration_id = ?
    `, [declarationId]);

    const acceptanceStats = get(`
      SELECT 
        COUNT(*) as total_nodes,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_nodes,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_nodes,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_nodes,
        SUM(CASE WHEN status = 'conditional' THEN 1 ELSE 0 END) as conditional_nodes
      FROM acceptance_nodes WHERE declaration_id = ?
    `, [declarationId]);

    const phases = all('SELECT * FROM project_phase_instances WHERE declaration_id = ? ORDER BY sort_order ASC', [declarationId]);
    const overallProgress = calculateOverallProgress(phases);

    res.json({
      success: true,
      data: {
        declaration,
        overall_progress: overallProgress,
        phase_stats: phaseStats,
        deliverable_stats: deliverableStats,
        acceptance_stats: acceptanceStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, initializeProjectPhases };
