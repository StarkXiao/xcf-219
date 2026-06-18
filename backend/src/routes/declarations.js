const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');
const { saveVersion, SAVE_TYPES } = require('./versions');
const { computeDiff, getChangedFields } = require('../utils/diff');
const { saveOrUpdateEnterpriseProfile, updateEnterpriseProfileInfo } = require('./enterprise-profiles');

const STATUS_MAP = {
  draft: '草稿',
  submitted: '待初审',
  reviewing: '初审中',
  first_reviewed: '待复审',
  second_reviewed: '待终审',
  approved: '已立项',
  rejected: '已驳回',
  completed: '已完成'
};

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

function enrichDeclarationWorkflow(declaration) {
  const result = { ...declaration };
  let configId = declaration.workflow_config_id;

  if (!configId && declaration.guideline_id) {
    const cfg = get('SELECT id FROM workflow_configs WHERE guideline_id = ?', [declaration.guideline_id]);
    if (cfg) configId = cfg.id;
  }

  if (!configId) {
    result.current_step_name = null;
    result.current_step_role = null;
    result.status_label = STATUS_MAP[declaration.status] || declaration.status;
    return result;
  }

  const step = get(
    'SELECT name, role FROM workflow_config_steps WHERE config_id = ? AND pending_status = ?',
    [configId, declaration.status]
  );

  if (step) {
    result.current_step_name = step.name;
    result.current_step_role = step.role;
    result.status_label = `待${step.name}`;
  } else if (declaration.status === 'approved') {
    result.current_step_name = '已立项';
    result.current_step_role = '系统';
    result.status_label = '已立项';
  } else if (declaration.status === 'completed') {
    result.current_step_name = '已完成';
    result.current_step_role = '系统';
    result.status_label = '项目完成';
  } else if (declaration.status === 'rejected') {
    result.current_step_name = '已驳回';
    result.current_step_role = '系统';
    result.status_label = '已驳回';
  } else if (declaration.status === 'draft') {
    result.current_step_name = '草稿';
    result.current_step_role = '申请人';
    result.status_label = '草稿';
  } else {
    result.current_step_name = null;
    result.current_step_role = null;
    result.status_label = STATUS_MAP[declaration.status] || declaration.status;
  }

  return result;
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
    const declarations = all(sql, params).map(enrichDeclarationWorkflow);
    
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
      completed: get("SELECT COUNT(*) as count FROM declarations WHERE is_deleted = 0 AND status = 'completed'").count,
      in_execution: get(`
        SELECT COUNT(*) as count FROM declarations d
        INNER JOIN project_phase_instances p ON d.id = p.declaration_id
        WHERE d.is_deleted = 0 AND d.status IN ('approved','completed')
        AND p.status = 'in_progress'
      `).count,
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

    saveOrUpdateEnterpriseProfile(company, applicant, phone, email);

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
    
    if (declaration.status !== 'draft' && declaration.status !== 'rejected') {
      return res.status(400).json({ success: false, message: '只能编辑草稿或已驳回状态的申报' });
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

    if (changedFields.some(f => ['applicant', 'company', 'phone', 'email'].includes(f))) {
      updateEnterpriseProfileInfo(
        updateData.company,
        updateData.applicant,
        updateData.phone,
        updateData.email
      );
    }

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

    let workflowConfigId = declaration.workflow_config_id;
    let firstStepName = '初审';
    let firstStepRole = '初审员';

    if (!workflowConfigId && declaration.guideline_id) {
      const config = get('SELECT id FROM workflow_configs WHERE guideline_id = ?', [declaration.guideline_id]);
      if (config) {
        workflowConfigId = config.id;
        const firstStep = get(
          'SELECT name, role FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order LIMIT 1',
          [config.id]
        );
        if (firstStep) {
          firstStepName = firstStep.name;
          firstStepRole = firstStep.role;
        }
      }
    } else if (workflowConfigId) {
      const firstStep = get(
        'SELECT name, role FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order LIMIT 1',
        [workflowConfigId]
      );
      if (firstStep) {
        firstStepName = firstStep.name;
        firstStepRole = firstStep.role;
      }
    }

    run(`
      UPDATE declarations 
      SET status = 'submitted', current_step = 1, workflow_config_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [workflowConfigId, req.params.id]);

    run(`
      INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, 1, firstStepName, firstStepRole, '系统', '提交', '申报人提交申报材料']);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    const versionResult = saveVersion(null, req.params.id, updated, SAVE_TYPES.SUBMIT, user, '提交申报，进入审批流程');

    logOperationWithData(req, '提交', '申报表单', req.params.id,
      `提交申报: ${declaration.title}`,
      beforeData, updated, ['status', 'current_step', 'workflow_config_id'], versionResult.version_number);
    
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

const CATEGORY_REQUIREMENTS = {
  '科技项目': {
    minContentLength: 500,
    requiredMaterials: ['business_license', 'project_application', 'ip_cert'],
    description: '科技项目类申报需提供详细的技术方案和知识产权证明'
  },
  '企业发展': {
    minContentLength: 300,
    requiredMaterials: ['business_license', 'financial_statement'],
    description: '企业发展类申报需提供财务报表证明企业经营状况'
  },
  '资质认定': {
    minContentLength: 800,
    requiredMaterials: ['business_license', 'legal_id_card', 'ip_cert', 'honor_qualification'],
    description: '资质认定类申报需提供完整的企业资质和荣誉证明'
  },
  '其他': {
    minContentLength: 200,
    requiredMaterials: ['business_license'],
    description: '其他类申报需提供基础的企业证明材料'
  }
};

router.post('/qualification-check', (req, res) => {
  try {
    const { guideline_id, company, applicant, phone, email, content, declaration_id } = req.body;
    const risks = [];
    let totalChecks = 0;
    let passedChecks = 0;

    let guidelineInfo = null;
    if (guideline_id) {
      const guideline = get('SELECT * FROM guidelines WHERE id = ?', [guideline_id]);
      if (guideline) {
        let daysRemaining = null;
        if (guideline.deadline) {
          const deadline = new Date(guideline.deadline);
          const now = new Date();
          daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        }
        guidelineInfo = {
          id: guideline.id,
          title: guideline.title,
          category: guideline.category || '其他',
          deadline: guideline.deadline,
          days_remaining: daysRemaining
        };
      }
    }

    totalChecks++;
    if (guideline_id) {
      passedChecks++;
    } else {
      risks.push({
        id: 'no-guideline',
        level: 'medium',
        category: 'guideline',
        title: '未选择申报指南',
        description: '建议选择对应的申报指南以提高申报成功率',
        suggestion: '请从下拉列表中选择符合项目类型的申报指南'
      });
    }

    if (guidelineInfo) {
      totalChecks++;
      if (guidelineInfo.days_remaining !== null) {
        if (guidelineInfo.days_remaining < 0) {
          risks.push({
            id: 'deadline-passed',
            level: 'high',
            category: 'guideline',
            title: '申报截止日期已过',
            description: `该指南的申报截止日期为 ${guidelineInfo.deadline}，已超过 ${Math.abs(guidelineInfo.days_remaining)} 天`,
            suggestion: '请选择其他尚未截止的申报指南'
          });
        } else if (guidelineInfo.days_remaining <= 3) {
          risks.push({
            id: 'deadline-urgent',
            level: 'medium',
            category: 'guideline',
            title: '申报即将截止',
            description: `距离截止日期仅剩 ${guidelineInfo.days_remaining} 天，请尽快完成申报材料`,
            suggestion: '建议优先准备必需材料，避免错过申报时间'
          });
          passedChecks++;
        } else {
          passedChecks++;
        }
      } else {
        passedChecks++;
      }

      const categoryReq = CATEGORY_REQUIREMENTS[guidelineInfo.category] || CATEGORY_REQUIREMENTS['其他'];
      totalChecks++;
      const contentLen = (content || '').length;
      if (contentLen >= categoryReq.minContentLength) {
        passedChecks++;
      } else {
        risks.push({
          id: 'content-too-short',
          level: 'medium',
          category: 'guideline',
          title: '项目内容描述不够详细',
          description: `${guidelineInfo.category}类申报建议内容不少于 ${categoryReq.minContentLength} 字，当前仅 ${contentLen} 字`,
          suggestion: categoryReq.description
        });
      }

      totalChecks++;
      const mtCodes = categoryReq.requiredMaterials;
      const uploadedMaterialCodes = new Set();
      if (declaration_id) {
        const uploaded = all(`
          SELECT DISTINCT mt.code 
          FROM attachments a 
          LEFT JOIN material_types mt ON a.material_type_id = mt.id 
          WHERE a.declaration_id = ?
        `, [declaration_id]);
        uploaded.forEach(m => m.code && uploadedMaterialCodes.add(m.code));
      }
      const missingMaterials = mtCodes.filter(c => !uploadedMaterialCodes.has(c));
      if (missingMaterials.length === 0) {
        passedChecks++;
      } else {
        const materialNames = {
          business_license: '企业营业执照',
          legal_id_card: '法人身份证',
          org_code_cert: '组织机构代码证',
          tax_reg_cert: '税务登记证',
          project_application: '项目申请书',
          financial_statement: '财务报表',
          ip_cert: '知识产权证明',
          honor_qualification: '荣誉资质',
          other_materials: '其他材料'
        };
        const missingNames = missingMaterials.map(c => materialNames[c] || c).join('、');
        risks.push({
          id: 'missing-materials',
          level: 'high',
          category: 'material',
          title: '缺少必需的申报材料',
          description: `根据${guidelineInfo.category}类申报要求，还需上传：${missingNames}`,
          suggestion: '请在附件材料区域上传上述必需文件'
        });
      }
    }

    totalChecks++;
    if (company && company.trim().length >= 2) {
      passedChecks++;
    } else {
      risks.push({
        id: 'company-name-invalid',
        level: 'high',
        category: 'company',
        title: '企业名称不完整',
        description: '企业名称至少需要2个字符',
        suggestion: '请填写完整的企业全称（与营业执照一致）'
      });
    }

    totalChecks++;
    if (applicant && applicant.trim().length >= 2) {
      passedChecks++;
    } else {
      risks.push({
        id: 'applicant-invalid',
        level: 'medium',
        category: 'company',
        title: '申请人信息不完整',
        description: '请填写有效的申请人姓名',
        suggestion: '请填写申请人真实姓名'
      });
    }

    totalChecks++;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (phone && phoneRegex.test(phone.trim())) {
      passedChecks++;
    } else if (!phone) {
      risks.push({
        id: 'phone-missing',
        level: 'low',
        category: 'company',
        title: '未填写联系电话',
        description: '建议填写联系电话以便后续沟通',
        suggestion: '请填写有效的手机号码'
      });
    } else {
      risks.push({
        id: 'phone-invalid',
        level: 'medium',
        category: 'company',
        title: '联系电话格式不正确',
        description: '请检查手机号码格式',
        suggestion: '请输入正确的11位手机号码'
      });
    }

    totalChecks++;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && emailRegex.test(email.trim())) {
      passedChecks++;
    } else if (!email) {
      risks.push({
        id: 'email-missing',
        level: 'low',
        category: 'company',
        title: '未填写电子邮箱',
        description: '建议填写邮箱用于接收申报通知',
        suggestion: '请填写常用的电子邮箱地址'
      });
    } else {
      risks.push({
        id: 'email-invalid',
        level: 'medium',
        category: 'company',
        title: '电子邮箱格式不正确',
        description: '请检查邮箱格式',
        suggestion: '请输入正确的邮箱格式，如 example@company.com'
      });
    }

    let companyHistory = null;
    if (company && company.trim()) {
      const excludeId = declaration_id ? declaration_id : null;
      const sql = excludeId 
        ? 'SELECT * FROM declarations WHERE company = ? AND id != ? AND is_deleted = 0'
        : 'SELECT * FROM declarations WHERE company = ? AND is_deleted = 0';
      const params = excludeId ? [company.trim(), excludeId] : [company.trim()];
      const history = all(sql, params);
      
      const totalDeclarations = history.length;
      const approvedCount = history.filter(d => d.status === 'approved').length;
      const rejectedCount = history.filter(d => d.status === 'rejected').length;
      const pendingCount = history.filter(d => ['submitted', 'reviewing', 'first_reviewed', 'second_reviewed'].includes(d.status)).length;
      const approvalRate = totalDeclarations > 0 ? Math.round((approvedCount / totalDeclarations) * 100) : 0;
      const lastDeclaration = history.length > 0 
        ? history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] 
        : null;

      companyHistory = {
        total_declarations: totalDeclarations,
        approved_count: approvedCount,
        rejected_count: rejectedCount,
        pending_count: pendingCount,
        approval_rate: approvalRate,
        last_declaration_at: lastDeclaration?.created_at
      };

      totalChecks++;
      if (rejectedCount >= 3) {
        risks.push({
          id: 'high-rejection-rate',
          level: 'high',
          category: 'history',
          title: '历史驳回次数较多',
          description: `该企业历史共有 ${rejectedCount} 次申报被驳回，需重点关注申报材料质量`,
          suggestion: '建议仔细审查本次申报材料，参考以往驳回原因进行改进'
        });
      } else {
        passedChecks++;
      }

      totalChecks++;
      if (approvalRate < 30 && totalDeclarations >= 2) {
        risks.push({
          id: 'low-approval-rate',
          level: 'medium',
          category: 'history',
          title: '历史立项通过率偏低',
          description: `该企业历史申报立项通过率为 ${approvalRate}%，低于平均水平`,
          suggestion: '建议加强项目创新性和可行性论证，提高申报材料质量'
        });
      } else {
        passedChecks++;
      }

      if (guideline_id) {
        totalChecks++;
        const sameGuidelineHistory = history.filter(d => d.guideline_id === guideline_id);
        const sameGuidelinePending = sameGuidelineHistory.filter(d => 
          ['submitted', 'reviewing', 'first_reviewed', 'second_reviewed'].includes(d.status)
        );
        if (sameGuidelinePending.length > 0) {
          risks.push({
            id: 'duplicate-guideline-submission',
            level: 'medium',
            category: 'history',
            title: '同一指南存在待审核申报',
            description: `该企业在当前指南下已有 ${sameGuidelinePending.length} 个正在进行中的申报`,
            suggestion: '同一指南下的重复申报可能影响评审结果，建议确认是否继续'
          });
        } else {
          passedChecks++;
        }
      }

      totalChecks++;
      if (totalDeclarations === 0) {
        risks.push({
          id: 'first-time-declaration',
          level: 'info',
          category: 'history',
          title: '首次申报提醒',
          description: '该企业暂无历史申报记录，属于首次申报',
          suggestion: '建议仔细阅读申报指南要求，确保材料完整准确'
        });
      } else {
        passedChecks++;
      }
    }

    const highRisks = risks.filter(r => r.level === 'high');
    const mediumRisks = risks.filter(r => r.level === 'medium');
    const lowRisks = risks.filter(r => r.level === 'low');

    let overallRisk = 'low';
    if (highRisks.length > 0) {
      overallRisk = 'high';
    } else if (mediumRisks.length >= 3) {
      overallRisk = 'high';
    } else if (mediumRisks.length > 0) {
      overallRisk = 'medium';
    } else if (lowRisks.length > 0) {
      overallRisk = 'low';
    }

    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    const canSubmit = highRisks.length === 0;

    let summary = '';
    if (risks.length === 0) {
      summary = '所有检查项均已通过，申报材料完整，可以提交！';
    } else {
      const parts = [];
      if (highRisks.length > 0) parts.push(`${highRisks.length} 项高风险`);
      if (mediumRisks.length > 0) parts.push(`${mediumRisks.length} 项中风险`);
      if (lowRisks.length > 0) parts.push(`${lowRisks.length} 项低风险`);
      if (risks.filter(r => r.level === 'info').length > 0) parts.push(`${risks.filter(r => r.level === 'info').length} 项提示`);
      summary = `资格预审完成：发现 ${parts.join('，')}。预审评分：${score} 分。`;
      if (!canSubmit) {
        summary += ' 建议先处理高风险问题后再提交。';
      }
    }

    logOperation(req, '资格预审', '申报表单', declaration_id || null, summary);

    res.json({
      success: true,
      data: {
        overall_risk: overallRisk,
        score,
        total_checks: totalChecks,
        passed_checks: passedChecks,
        risks,
        summary,
        can_submit: canSubmit,
        company_history: companyHistory,
        guideline_info: guidelineInfo
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/todo-kanban/summary', (req, res) => {
  try {
    const { role = 'all' } = req.query;

    const allPending = all(`
      SELECT d.*, g.title as guideline_title, g.deadline as guideline_deadline, wcs.name as step_name, wcs.role as step_role
      FROM declarations d
      LEFT JOIN guidelines g ON d.guideline_id = g.id
      LEFT JOIN workflow_config_steps wcs 
        ON d.workflow_config_id = wcs.config_id 
        AND d.status = wcs.pending_status
      WHERE d.is_deleted = 0
        AND d.status NOT IN ('draft', 'approved', 'rejected')
      ORDER BY d.created_at DESC
    `);

    const now = new Date();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const TIMEOUT_DAYS = 7;

    const isTimeout = (decl) => {
      if (!decl.created_at) return false;
      const created = new Date(decl.created_at);
      const diffMs = now.getTime() - created.getTime();
      return diffMs > TIMEOUT_DAYS * 24 * 60 * 60 * 1000;
    };

    const isRoleMatch = (declRole, queryRole) => {
      if (!queryRole || queryRole === 'all') return true;
      if (!declRole) return false;
      const roleMap = {
        'chushen': ['初审员', '审查员'],
        'fushen': ['复审员', '评审专家'],
        'zhong': ['领导', '终审员', '公示专员', '认定委员会']
      };
      const allowedRoles = roleMap[queryRole] || [queryRole];
      return allowedRoles.some(r => declRole.includes(r));
    };

    const pendingInitialReview = [];
    const pendingReReview = [];
    const timeoutDeclarations = [];

    allPending.forEach(decl => {
      const enriched = enrichDeclarationWorkflow(decl);
      const stepRole = enriched.current_step_role || decl.step_role || '';
      const stepName = enriched.current_step_name || decl.step_name || '';

      const statusInitial = ['submitted'].includes(decl.status) || stepName === '初审' || stepName === '形式审查';
      const statusRe = ['first_reviewed', 'formal_reviewed', 'expert_reviewed', 'public_reviewed', 'second_reviewed'].includes(decl.status)
        || stepName === '复审' || stepName === '专家评审' || stepName === '公示审核' || stepName === '认定审批';

      if (statusInitial && isRoleMatch(stepRole || '初审员', role)) {
        pendingInitialReview.push({
          ...enriched,
          step_role: stepRole || '初审员',
          step_name: stepName || '初审'
        });
      }

      if (statusRe && isRoleMatch(stepRole || '复审员', role)) {
        pendingReReview.push({
          ...enriched,
          step_role: stepRole || '复审员',
          step_name: stepName || '复审'
        });
      }

      if (isTimeout(decl) && isRoleMatch(stepRole, role)) {
        const created = new Date(decl.created_at);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
        timeoutDeclarations.push({
          ...enriched,
          step_role: stepRole,
          step_name: stepName,
          timeout_days: diffDays
        });
      }
    });

    const upcomingDeadlines = [];
    const guidelines = all('SELECT * FROM guidelines WHERE deadline IS NOT NULL ORDER BY deadline ASC');
    guidelines.forEach(g => {
      if (!g.deadline) return;
      const deadline = new Date(g.deadline);
      const diffMs = deadline.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      if (daysRemaining >= -30 && daysRemaining <= 30) {
        const relatedCount = get(
          'SELECT COUNT(*) as count FROM declarations WHERE guideline_id = ? AND is_deleted = 0 AND status != ?',
          [g.id, 'approved']
        ).count;

        const draftCount = get(
          'SELECT COUNT(*) as count FROM declarations WHERE guideline_id = ? AND is_deleted = 0 AND status = ?',
          [g.id, 'draft']
        ).count;

        upcomingDeadlines.push({
          id: g.id,
          title: g.title,
          category: g.category,
          deadline: g.deadline,
          days_remaining: daysRemaining,
          related_count: relatedCount,
          draft_count: draftCount,
          is_overdue: daysRemaining < 0,
          is_urgent: daysRemaining >= 0 && daysRemaining <= 3
        });
      }
    });

    const roleOptions = [
      { value: 'all', label: '全部角色' },
      { value: 'chushen', label: '初审角色' },
      { value: 'fushen', label: '复审角色' },
      { value: 'zhong', label: '终审/领导角色' }
    ];

    const countsByRole = {};
    roleOptions.forEach(opt => {
      if (opt.value === 'all') {
        countsByRole[opt.value] = {
          pending_initial: pendingInitialReview.length,
          pending_re: pendingReReview.length,
          timeout: timeoutDeclarations.length,
          upcoming: upcomingDeadlines.filter(g => !g.is_overdue && g.days_remaining <= 7).length
        };
      } else {
        const initialCount = allPending.filter(d => {
          const stepRole = enrichDeclarationWorkflow(d).current_step_role || d.step_role || '';
          const stepName = enrichDeclarationWorkflow(d).current_step_name || d.step_name || '';
          const statusInitial = ['submitted'].includes(d.status) || stepName === '初审' || stepName === '形式审查';
          return statusInitial && isRoleMatch(stepRole || '初审员', opt.value);
        }).length;
        const reCount = allPending.filter(d => {
          const stepRole = enrichDeclarationWorkflow(d).current_step_role || d.step_role || '';
          const stepName = enrichDeclarationWorkflow(d).current_step_name || d.step_name || '';
          const statusRe = ['first_reviewed', 'formal_reviewed', 'expert_reviewed', 'public_reviewed', 'second_reviewed'].includes(d.status)
            || stepName === '复审' || stepName === '专家评审' || stepName === '公示审核' || stepName === '认定审批';
          return statusRe && isRoleMatch(stepRole || '复审员', opt.value);
        }).length;
        const timeoutCount = allPending.filter(d => isTimeout(d) && isRoleMatch(
          enrichDeclarationWorkflow(d).current_step_role || d.step_role || '', opt.value
        )).length;
        countsByRole[opt.value] = {
          pending_initial: initialCount,
          pending_re: reCount,
          timeout: timeoutCount,
          upcoming: upcomingDeadlines.filter(g => !g.is_overdue && g.days_remaining <= 7).length
        };
      }
    });

    const filtered = (list, queryRole) => {
      if (queryRole === 'all') return list;
      return list.filter(item => isRoleMatch(item.step_role, queryRole));
    };

    const filteredDeadlines = upcomingDeadlines;

    res.json({
      success: true,
      data: {
        current_role: role,
        role_options: roleOptions,
        counts_by_role: countsByRole,
        pending_initial_review: filtered(pendingInitialReview, role).slice(0, 10),
        pending_initial_review_count: filtered(pendingInitialReview, role).length,
        pending_re_review: filtered(pendingReReview, role).slice(0, 10),
        pending_re_review_count: filtered(pendingReReview, role).length,
        timeout_declarations: filtered(timeoutDeclarations, role).slice(0, 10),
        timeout_declarations_count: filtered(timeoutDeclarations, role).length,
        upcoming_deadlines: filteredDeadlines.slice(0, 10),
        upcoming_deadlines_count: filteredDeadlines.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/batch/export', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要导出的申报' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const declarations = all(`
      SELECT d.*, g.title as guideline_title 
      FROM declarations d 
      LEFT JOIN guidelines g ON d.guideline_id = g.id 
      WHERE d.id IN (${placeholders}) AND d.is_deleted = 0
      ORDER BY d.created_at DESC
    `, ids);

    const STATUS_LABEL = {
      draft: '草稿',
      submitted: '待初审',
      reviewing: '初审中',
      first_reviewed: '待复审',
      second_reviewed: '待终审',
      approved: '已立项',
      rejected: '已驳回',
      completed: '已完成'
    };

    const csvHeader = ['ID', '项目名称', '申请人', '企业名称', '关联指南', '状态', '联系电话', '电子邮箱', '创建时间', '更新时间'];
    const csvRows = declarations.map(d => [
      d.id,
      `"${(d.title || '').replace(/"/g, '""')}"`,
      `"${(d.applicant || '').replace(/"/g, '""')}"`,
      `"${(d.company || '').replace(/"/g, '""')}"`,
      `"${(d.guideline_title || '').replace(/"/g, '""')}"`,
      STATUS_LABEL[d.status] || d.status,
      d.phone || '',
      d.email || '',
      d.created_at || '',
      d.updated_at || ''
    ]);

    const csvContent = '\ufeff' + [csvHeader.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    logOperation(req, '批量导出', '申报表单', null, `导出 ${declarations.length} 条申报记录`);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="declarations_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/batch/submit', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要提交的申报' });
    }

    const user = getCurrentUser(req);
    const results = { success: [], failed: [] };
    const placeholders = ids.map(() => '?').join(',');
    const declarations = all(`SELECT * FROM declarations WHERE id IN (${placeholders}) AND is_deleted = 0`, ids);

    declarations.forEach(declaration => {
      if (declaration.status !== 'draft') {
        results.failed.push({ id: declaration.id, title: declaration.title, reason: '只能提交草稿状态的申报' });
        return;
      }

      let workflowConfigId = declaration.workflow_config_id;
      let firstStepName = '初审';
      let firstStepRole = '初审员';

      if (!workflowConfigId && declaration.guideline_id) {
        const config = get('SELECT id FROM workflow_configs WHERE guideline_id = ?', [declaration.guideline_id]);
        if (config) {
          workflowConfigId = config.id;
          const firstStep = get(
            'SELECT name, role FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order LIMIT 1',
            [config.id]
          );
          if (firstStep) {
            firstStepName = firstStep.name;
            firstStepRole = firstStep.role;
          }
        }
      } else if (workflowConfigId) {
        const firstStep = get(
          'SELECT name, role FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order LIMIT 1',
          [workflowConfigId]
        );
        if (firstStep) {
          firstStepName = firstStep.name;
          firstStepRole = firstStep.role;
        }
      }

      run(`
        UPDATE declarations 
        SET status = 'submitted', current_step = 1, workflow_config_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [workflowConfigId, declaration.id]);

      run(`
        INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [declaration.id, 1, firstStepName, firstStepRole, '系统', '提交', '批量提交申报材料']);

      const updated = get('SELECT * FROM declarations WHERE id = ?', [declaration.id]);
      saveVersion(null, declaration.id, updated, SAVE_TYPES.SUBMIT, user, '批量提交申报，进入审批流程');
      results.success.push({ id: declaration.id, title: declaration.title });
    });

    const failedIds = declarations.filter(d => d.status !== 'draft').map(d => d.id);
    ids.forEach(id => {
      if (!declarations.find(d => d.id === id)) {
        results.failed.push({ id, title: '未知', reason: '申报不存在或已删除' });
      }
    });

    logOperation(req, '批量提交', '申报表单', null, 
      `提交成功 ${results.success.length} 条，失败 ${results.failed.length} 条`);

    res.json({
      success: true,
      message: `批量提交完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/batch/qualification-check', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要校验的申报' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const declarations = all(`
      SELECT d.*, g.title as guideline_title, g.category as guideline_category, g.deadline as guideline_deadline
      FROM declarations d 
      LEFT JOIN guidelines g ON d.guideline_id = g.id 
      WHERE d.id IN (${placeholders}) AND d.is_deleted = 0
    `, ids);

    const results = [];
    declarations.forEach(d => {
      const risks = [];
      let totalChecks = 0;
      let passedChecks = 0;

      totalChecks++;
      if (d.guideline_id) {
        passedChecks++;
      } else {
        risks.push({ id: 'no-guideline', level: 'medium', title: '未选择申报指南' });
      }

      totalChecks++;
      if (d.company && d.company.trim().length >= 2) {
        passedChecks++;
      } else {
        risks.push({ id: 'company-name-invalid', level: 'high', title: '企业名称不完整' });
      }

      totalChecks++;
      if (d.applicant && d.applicant.trim().length >= 2) {
        passedChecks++;
      } else {
        risks.push({ id: 'applicant-invalid', level: 'medium', title: '申请人信息不完整' });
      }

      totalChecks++;
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (d.phone && phoneRegex.test(d.phone.trim())) {
        passedChecks++;
      } else {
        risks.push({ id: 'phone-invalid', level: 'medium', title: '联系电话格式不正确' });
      }

      totalChecks++;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (d.email && emailRegex.test(d.email.trim())) {
        passedChecks++;
      } else {
        risks.push({ id: 'email-invalid', level: 'medium', title: '电子邮箱格式不正确' });
      }

      totalChecks++;
      const contentLen = (d.content || '').length;
      if (contentLen >= 200) {
        passedChecks++;
      } else {
        risks.push({ id: 'content-too-short', level: 'medium', title: `项目内容描述不够详细(${contentLen}字)` });
      }

      const highRisks = risks.filter(r => r.level === 'high');
      const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
      const canSubmit = highRisks.length === 0;

      results.push({
        id: d.id,
        title: d.title,
        score,
        total_checks: totalChecks,
        passed_checks: passedChecks,
        can_submit: canSubmit,
        high_risk_count: highRisks.length,
        medium_risk_count: risks.filter(r => r.level === 'medium').length,
        risks
      });
    });

    logOperation(req, '批量校验', '申报表单', null, `校验 ${results.length} 条申报记录`);

    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.can_submit).length,
        failed: results.filter(r => !r.can_submit).length,
        avg_score: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/batch/follow', (req, res) => {
  try {
    const { ids, followed = true } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的申报' });
    }

    const user = getCurrentUser(req);
    const placeholders = ids.map(() => '?').join(',');
    const followValue = followed ? 1 : 0;

    run(`
      UPDATE declarations 
      SET is_followed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders}) AND is_deleted = 0
    `, [followValue, ...ids]);

    const updated = all(`SELECT id, title, is_followed FROM declarations WHERE id IN (${placeholders})`, ids);

    logOperation(req, followed ? '批量标记关注' : '批量取消关注', '申报表单', null,
      `${followed ? '标记关注' : '取消关注'} ${updated.length} 条申报记录`);

    res.json({
      success: true,
      message: `${followed ? '标记关注' : '取消关注'}成功，共 ${updated.length} 条`,
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/follow', (req, res) => {
  try {
    const { followed = true } = req.body;
    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const user = getCurrentUser(req);
    const followValue = followed ? 1 : 0;
    const beforeData = { ...declaration };

    run(`
      UPDATE declarations 
      SET is_followed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [followValue, req.params.id]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);

    logOperationWithData(req, followed ? '标记关注' : '取消关注', '申报表单', req.params.id,
      `${followed ? '标记关注' : '取消关注'}: ${declaration.title}`,
      beforeData, updated, ['is_followed']);

    res.json({ success: true, message: followed ? '已标记关注' : '已取消关注', data: { is_followed: followValue } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/filters', (req, res) => {
  try {
    const { module = 'declarations' } = req.query;
    const user = getCurrentUser(req);

    const filters = all(`
      SELECT * FROM saved_filters 
      WHERE module = ? AND (user = ? OR user IS NULL)
      ORDER BY is_default DESC, sort_order ASC, created_at DESC
    `, [module, user]);

    const parsed = filters.map(f => ({
      ...f,
      filter_data: JSON.parse(f.filter_data)
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/filters', (req, res) => {
  try {
    const { name, module = 'declarations', filter_data, is_default = 0 } = req.body;
    const user = getCurrentUser(req);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '请输入筛选方案名称' });
    }

    if (!filter_data) {
      return res.status(400).json({ success: false, message: '筛选条件不能为空' });
    }

    if (is_default) {
      run(`UPDATE saved_filters SET is_default = 0 WHERE module = ? AND (user = ? OR user IS NULL)`, [module, user]);
    }

    const result = run(`
      INSERT INTO saved_filters (name, module, filter_data, user, is_default, sort_order)
      VALUES (?, ?, ?, ?, ?, 0)
    `, [name.trim(), module, JSON.stringify(filter_data), user, is_default ? 1 : 0]);

    const saved = get('SELECT * FROM saved_filters WHERE id = ?', [result.lastID]);

    logOperation(req, '保存筛选方案', '筛选方案', result.lastID, `保存筛选方案: ${name}`);

    res.json({
      success: true,
      message: '筛选方案已保存',
      data: { ...saved, filter_data: JSON.parse(saved.filter_data) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/filters/:id', (req, res) => {
  try {
    const { name, filter_data, is_default } = req.body;
    const user = getCurrentUser(req);
    const existing = get('SELECT * FROM saved_filters WHERE id = ?', [req.params.id]);

    if (!existing) {
      return res.status(404).json({ success: false, message: '筛选方案不存在' });
    }

    if (is_default) {
      run(`UPDATE saved_filters SET is_default = 0 WHERE module = ? AND (user = ? OR user IS NULL) AND id != ?`, 
        [existing.module, user, req.params.id]);
    }

    run(`
      UPDATE saved_filters 
      SET name = ?, filter_data = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name !== undefined ? name.trim() : existing.name,
      filter_data !== undefined ? JSON.stringify(filter_data) : existing.filter_data,
      is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
      req.params.id
    ]);

    const updated = get('SELECT * FROM saved_filters WHERE id = ?', [req.params.id]);
    logOperation(req, '更新筛选方案', '筛选方案', req.params.id, `更新筛选方案: ${name || existing.name}`);

    res.json({
      success: true,
      message: '筛选方案已更新',
      data: { ...updated, filter_data: JSON.parse(updated.filter_data) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/filters/:id', (req, res) => {
  try {
    const existing = get('SELECT * FROM saved_filters WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '筛选方案不存在' });
    }

    run('DELETE FROM saved_filters WHERE id = ?', [req.params.id]);
    logOperation(req, '删除筛选方案', '筛选方案', req.params.id, `删除筛选方案: ${existing.name}`);

    res.json({ success: true, message: '筛选方案已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/resubmit', (req, res) => {
  try {
    const { supplement_note, title, content, applicant, company, phone, email } = req.body;
    const user = getCurrentUser(req);
    const declarationId = req.params.id;

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status !== 'rejected') {
      return res.status(400).json({ success: false, message: '只有已驳回状态的申报才能进行二次申报' });
    }

    if (!supplement_note || !supplement_note.trim()) {
      return res.status(400).json({ success: false, message: '请填写补充说明' });
    }

    const beforeData = { ...declaration };
    const newResubmitCount = (declaration.resubmit_count || 0) + 1;

    const updateData = {
      title: title !== undefined ? title : declaration.title,
      applicant: applicant !== undefined ? applicant : declaration.applicant,
      company: company !== undefined ? company : declaration.company,
      phone: phone !== undefined ? phone : declaration.phone,
      email: email !== undefined ? email : declaration.email,
      content: content !== undefined ? content : declaration.content
    };

    let workflowConfigId = declaration.workflow_config_id;
    let reReviewStepName = '复审';
    let reReviewStepRole = '复审员';
    let reReviewStatus = 'first_reviewed';
    let reReviewStepOrder = 2;

    if (workflowConfigId || declaration.guideline_id) {
      const config = getWorkflowConfigForResubmit(declaration);
      if (config && config.steps.length > 0) {
        if (config.steps.length >= 2) {
          const secondStep = config.steps[1];
          reReviewStepName = secondStep.name;
          reReviewStepRole = secondStep.role;
          reReviewStatus = secondStep.pending_status;
          reReviewStepOrder = secondStep.step_order;
        } else {
          const firstStep = config.steps[0];
          reReviewStepName = firstStep.name;
          reReviewStepRole = firstStep.role;
          reReviewStatus = firstStep.pending_status;
          reReviewStepOrder = firstStep.step_order;
        }
      }
    }

    run(`
      UPDATE declarations 
      SET title = ?, applicant = ?, company = ?, phone = ?, email = ?, content = ?,
          status = ?, current_step = ?, resubmit_count = ?, 
          last_reject_reason = NULL, last_rejected_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updateData.title, updateData.applicant, updateData.company,
      updateData.phone, updateData.email, updateData.content,
      reReviewStatus, reReviewStepOrder, newResubmitCount,
      declarationId
    ]);

    run(`
      INSERT INTO declaration_resubmissions (declaration_id, resubmit_count, supplement_note, created_by)
      VALUES (?, ?, ?, ?)
    `, [declarationId, newResubmitCount, supplement_note.trim(), user]);

    run(`
      INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [declarationId, reReviewStepOrder, reReviewStepName, reReviewStepRole, user, '二次申报', `补充说明: ${supplement_note.trim()}`]);

    const updated = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    const versionResult = saveVersion(null, declarationId, updated, SAVE_TYPES.SUBMIT, user,
      `二次申报(第${newResubmitCount}次), 补充说明: ${supplement_note.trim()}`);

    logOperationWithData(req, '二次申报', '申报表单', declarationId,
      `第${newResubmitCount}次二次申报: ${declaration.title}, 进入${reReviewStepName}环节`,
      beforeData, updated, ['status', 'current_step', 'resubmit_count', 'last_reject_reason', 'last_rejected_at'],
      versionResult.version_number);

    res.json({
      success: true,
      message: '二次申报成功，已进入复核流程',
      data: {
        id: declarationId,
        status: reReviewStatus,
        resubmit_count: newResubmitCount,
        step_name: reReviewStepName,
        version_number: versionResult.version_number
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function getWorkflowConfigForResubmit(declaration) {
  if (declaration.workflow_config_id) {
    const config = get('SELECT * FROM workflow_configs WHERE id = ?', [declaration.workflow_config_id]);
    if (config) {
      const steps = all(
        'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
        [config.id]
      );
      return { ...config, steps };
    }
  }

  if (declaration.guideline_id) {
    const config = get('SELECT * FROM workflow_configs WHERE guideline_id = ?', [declaration.guideline_id]);
    if (config) {
      const steps = all(
        'SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order',
        [config.id]
      );
      return { ...config, steps };
    }
  }

  return null;
}

router.get('/:id/resubmissions', (req, res) => {
  try {
    const declaration = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const resubmissions = all(`
      SELECT * FROM declaration_resubmissions 
      WHERE declaration_id = ? 
      ORDER BY resubmit_count DESC, created_at DESC
    `, [req.params.id]);

    logOperation(req, '查看二次申报历史', '申报表单', req.params.id,
      `查看申报: ${declaration.title} 的二次申报历史，共${resubmissions.length}条`);

    res.json({ success: true, data: resubmissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
