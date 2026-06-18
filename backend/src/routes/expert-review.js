const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

function getScoringCriteria(guidelineId) {
  let criteria;
  if (guidelineId) {
    criteria = all(`
      SELECT * FROM scoring_criteria 
      WHERE (guideline_id = ? OR guideline_id IS NULL) AND is_active = 1
      ORDER BY guideline_id DESC, sort_order ASC
    `, [guidelineId]);
  } else {
    criteria = all(`
      SELECT * FROM scoring_criteria 
      WHERE guideline_id IS NULL AND is_active = 1
      ORDER BY sort_order ASC
    `);
  }
  return criteria;
}

router.get('/experts', (req, res) => {
  try {
    const { field, status, keyword } = req.query;
    let sql = 'SELECT * FROM experts WHERE 1=1';
    const params = [];

    if (field && field !== 'all') {
      sql += ' AND field = ?';
      params.push(field);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND (name LIKE ? OR code LIKE ? OR organization LIKE ? OR specialties LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw, kw);
    }
    sql += ' ORDER BY field, name';

    const experts = all(sql, params);
    res.json({ success: true, data: experts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/experts/:id', (req, res) => {
  try {
    const expert = get('SELECT * FROM experts WHERE id = ?', [req.params.id]);
    if (!expert) {
      return res.status(404).json({ success: false, message: '专家不存在' });
    }
    const recentTasks = all(`
      SELECT rt.*, d.title as declaration_title, rg.name as group_name
      FROM review_tasks rt
      LEFT JOIN declarations d ON rt.declaration_id = d.id
      LEFT JOIN review_groups rg ON rt.group_id = rg.id
      WHERE rt.expert_id = ?
      ORDER BY rt.created_at DESC
      LIMIT 10
    `, [expert.id]);
    res.json({ success: true, data: { ...expert, recent_tasks: recentTasks } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/experts', (req, res) => {
  try {
    const { name, code, title, organization, field, specialties, phone, email, level } = req.body;
    const user = getCurrentUser(req);

    if (!name) {
      return res.status(400).json({ success: false, message: '专家姓名必填' });
    }

    const existingCode = code ? get('SELECT id FROM experts WHERE code = ?', [code]) : null;
    if (existingCode) {
      return res.status(400).json({ success: false, message: '专家编号已存在' });
    }

    const result = run(`
      INSERT INTO experts (name, code, title, organization, field, specialties, phone, email, level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, code || null, title || null, organization || null, field || null, specialties || null, phone || null, email || null, level || 'general']);

    logOperation(req, '新增专家', '专家评审', result.lastID, `新增专家: ${name}, 编号: ${code || '自动生成'}`);

    res.json({ success: true, data: { id: result.lastID }, message: '专家添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/experts/:id', (req, res) => {
  try {
    const expertId = req.params.id;
    const { name, code, title, organization, field, specialties, phone, email, level, status } = req.body;
    const user = getCurrentUser(req);

    const existing = get('SELECT * FROM experts WHERE id = ?', [expertId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '专家不存在' });
    }

    if (code && code !== existing.code) {
      const codeExists = get('SELECT id FROM experts WHERE code = ? AND id != ?', [code, expertId]);
      if (codeExists) {
        return res.status(400).json({ success: false, message: '专家编号已存在' });
      }
    }

    run(`
      UPDATE experts SET 
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        title = COALESCE(?, title),
        organization = COALESCE(?, organization),
        field = COALESCE(?, field),
        specialties = COALESCE(?, specialties),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        level = COALESCE(?, level),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, code, title, organization, field, specialties, phone, email, level, status, expertId]);

    const updated = get('SELECT * FROM experts WHERE id = ?', [expertId]);
    const changedFields = [];
    Object.keys(req.body).forEach(key => {
      if (existing[key] !== updated[key]) changedFields.push(key);
    });

    logOperationWithData(req, '更新专家', '专家评审', expertId,
      `更新专家信息: ${updated.name}`,
      existing, updated, changedFields);

    res.json({ success: true, message: '专家信息更新成功', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/experts/:id', (req, res) => {
  try {
    const expertId = req.params.id;
    const expert = get('SELECT * FROM experts WHERE id = ?', [expertId]);
    if (!expert) {
      return res.status(404).json({ success: false, message: '专家不存在' });
    }

    const taskCount = get('SELECT COUNT(*) as count FROM review_tasks WHERE expert_id = ?', [expertId]);
    if (taskCount.count > 0) {
      return res.status(400).json({ success: false, message: '该专家已有评审任务，无法删除' });
    }

    run('DELETE FROM experts WHERE id = ?', [expertId]);
    logOperation(req, '删除专家', '专家评审', expertId, `删除专家: ${expert.name}`);

    res.json({ success: true, message: '专家删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/fields', (req, res) => {
  try {
    const fields = all('SELECT DISTINCT field FROM experts WHERE field IS NOT NULL AND field != "" ORDER BY field');
    const fieldList = fields.map(f => f.field);
    res.json({ success: true, data: fieldList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/criteria', (req, res) => {
  try {
    const { guideline_id } = req.query;
    const criteria = getScoringCriteria(guideline_id ? parseInt(guideline_id) : null);
    res.json({ success: true, data: criteria });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/groups', (req, res) => {
  try {
    const { guideline_id, status } = req.query;
    let sql = `
      SELECT rg.*, g.title as guideline_title,
        (SELECT COUNT(*) FROM review_tasks rt WHERE rt.group_id = rg.id) as total_tasks,
        (SELECT COUNT(*) FROM review_tasks rt WHERE rt.group_id = rg.id AND rt.status = 'submitted') as submitted_tasks
      FROM review_groups rg
      LEFT JOIN guidelines g ON rg.guideline_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (guideline_id) {
      sql += ' AND rg.guideline_id = ?';
      params.push(guideline_id);
    }
    if (status && status !== 'all') {
      sql += ' AND rg.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY rg.created_at DESC';

    const groups = all(sql, params).map(g => ({
      ...g,
      declaration_ids: JSON.parse(g.declaration_ids || '[]'),
      expert_ids: JSON.parse(g.expert_ids || '[]')
    }));

    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/groups/:id', (req, res) => {
  try {
    const group = get('SELECT * FROM review_groups WHERE id = ?', [req.params.id]);
    if (!group) {
      return res.status(404).json({ success: false, message: '评审分组不存在' });
    }

    const declarationIds = JSON.parse(group.declaration_ids || '[]');
    const expertIds = JSON.parse(group.expert_ids || '[]');

    let declarations = [];
    let experts = [];
    let tasks = [];

    if (declarationIds.length > 0) {
      const placeholders = declarationIds.map(() => '?').join(',');
      declarations = all(`
        SELECT d.id, d.title, d.applicant, d.company, d.status, d.current_step, g.title as guideline_title
        FROM declarations d
        LEFT JOIN guidelines g ON d.guideline_id = g.id
        WHERE d.id IN (${placeholders})
      `, declarationIds);
    }

    if (expertIds.length > 0) {
      const placeholders = expertIds.map(() => '?').join(',');
      experts = all(`SELECT * FROM experts WHERE id IN (${placeholders}) ORDER BY name`, expertIds);
    }

    tasks = all(`
      SELECT rt.*, d.title as declaration_title, e.name as expert_name
      FROM review_tasks rt
      LEFT JOIN declarations d ON rt.declaration_id = d.id
      LEFT JOIN experts e ON rt.expert_id = e.id
      WHERE rt.group_id = ?
      ORDER BY rt.declaration_id, rt.expert_id
    `, [group.id]);

    res.json({
      success: true,
      data: {
        ...group,
        declaration_ids: declarationIds,
        expert_ids: expertIds,
        declarations,
        experts,
        tasks
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/groups', (req, res) => {
  try {
    const { name, guideline_id, description, declaration_ids, expert_ids, expert_count, deadline } = req.body;
    const user = getCurrentUser(req);

    if (!name) {
      return res.status(400).json({ success: false, message: '分组名称必填' });
    }

    const finalDeclarationIds = declaration_ids || [];
    let finalExpertIds = expert_ids || [];

    if (!finalExpertIds.length && expert_count) {
      const field = req.body.field || null;
      let expertSql = 'SELECT id FROM experts WHERE status = \'active\'';
      const params = [];
      if (field) {
        expertSql += ' AND field = ?';
        params.push(field);
      }
      expertSql += ' ORDER BY RANDOM() LIMIT ?';
      params.push(expert_count);
      finalExpertIds = all(expertSql, params).map(e => e.id);
    }

    const result = run(`
      INSERT INTO review_groups (name, guideline_id, description, declaration_ids, expert_ids, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, guideline_id || null, description || null, JSON.stringify(finalDeclarationIds), JSON.stringify(finalExpertIds), user]);

    const groupId = result.lastID;

    const taskInsert = runStmt => {};
    const insertTaskStmt = require('../models/database').db.prepare(`
      INSERT INTO review_tasks (group_id, declaration_id, expert_id, guideline_id, deadline, is_anonymous)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    let taskCount = 0;
    const txn = require('../models/database').db.transaction(() => {
      for (const declId of finalDeclarationIds) {
        for (const expId of finalExpertIds) {
          insertTaskStmt.run(groupId, declId, expId, guideline_id || null, deadline || null);
          taskCount++;
        }
      }
    });
    txn();

    logOperation(req, '创建评审分组', '专家评审', groupId,
      `创建分组: ${name}, 申报${finalDeclarationIds.length}个, 专家${finalExpertIds.length}人, 生成任务${taskCount}个`);

    res.json({
      success: true,
      data: { id: groupId, task_count: taskCount },
      message: `评审分组创建成功，生成 ${taskCount} 个评审任务`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/groups/:id/status', (req, res) => {
  try {
    const groupId = req.params.id;
    const { status } = req.body;
    const user = getCurrentUser(req);

    const group = get('SELECT * FROM review_groups WHERE id = ?', [groupId]);
    if (!group) {
      return res.status(404).json({ success: false, message: '评审分组不存在' });
    }

    run('UPDATE review_groups SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, groupId]);

    if (status === 'in_progress') {
      run('UPDATE review_tasks SET status = \'assigned\' WHERE group_id = ? AND status = \'pending\'', [groupId]);
    } else if (status === 'completed') {
      run('UPDATE review_tasks SET status = \'completed\' WHERE group_id = ? AND status = \'submitted\'', [groupId]);
    }

    logOperation(req, '更新分组状态', '专家评审', groupId, `分组: ${group.name}, 状态: ${group.status} -> ${status}`);

    res.json({ success: true, message: '状态更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/groups/:id/add-declarations', (req, res) => {
  try {
    const groupId = req.params.id;
    const { declaration_ids } = req.body;
    const user = getCurrentUser(req);

    const group = get('SELECT * FROM review_groups WHERE id = ?', [groupId]);
    if (!group) {
      return res.status(404).json({ success: false, message: '评审分组不存在' });
    }

    const existingIds = new Set(JSON.parse(group.declaration_ids || '[]'));
    const expertIds = JSON.parse(group.expert_ids || '[]');
    const newIds = declaration_ids.filter(id => !existingIds.has(id));
    const allIds = [...existingIds, ...newIds];

    run('UPDATE review_groups SET declaration_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(allIds), groupId]);

    if (newIds.length > 0 && expertIds.length > 0) {
      const insertTaskStmt = require('../models/database').db.prepare(`
        INSERT INTO review_tasks (group_id, declaration_id, expert_id, guideline_id, is_anonymous)
        VALUES (?, ?, ?, ?, 1)
      `);
      const txn = require('../models/database').db.transaction(() => {
        for (const declId of newIds) {
          for (const expId of expertIds) {
            insertTaskStmt.run(groupId, declId, expId, group.guideline_id || null);
          }
        }
      });
      txn();
    }

    logOperation(req, '分组添加申报', '专家评审', groupId, `分组: ${group.name}, 新增${newIds.length}个申报`);

    res.json({ success: true, message: `成功添加 ${newIds.length} 个申报项目`, data: { added: newIds.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/groups/:id/add-experts', (req, res) => {
  try {
    const groupId = req.params.id;
    const { expert_ids } = req.body;
    const user = getCurrentUser(req);

    const group = get('SELECT * FROM review_groups WHERE id = ?', [groupId]);
    if (!group) {
      return res.status(404).json({ success: false, message: '评审分组不存在' });
    }

    const existingIds = new Set(JSON.parse(group.expert_ids || '[]'));
    const declarationIds = JSON.parse(group.declaration_ids || '[]');
    const newIds = expert_ids.filter(id => !existingIds.has(id));
    const allIds = [...existingIds, ...newIds];

    run('UPDATE review_groups SET expert_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(allIds), groupId]);

    if (newIds.length > 0 && declarationIds.length > 0) {
      const insertTaskStmt = require('../models/database').db.prepare(`
        INSERT OR IGNORE INTO review_tasks (group_id, declaration_id, expert_id, guideline_id, is_anonymous)
        VALUES (?, ?, ?, ?, 1)
      `);
      const txn = require('../models/database').db.transaction(() => {
        for (const declId of declarationIds) {
          for (const expId of newIds) {
            insertTaskStmt.run(groupId, declId, expId, group.guideline_id || null);
          }
        }
      });
      txn();
    }

    logOperation(req, '分组添加专家', '专家评审', groupId, `分组: ${group.name}, 新增${newIds.length}位专家`);

    res.json({ success: true, message: `成功添加 ${newIds.length} 位专家`, data: { added: newIds.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const { expert_id, declaration_id, group_id, status } = req.query;
    let sql = `
      SELECT rt.*, d.title as declaration_title, d.applicant, d.company, 
        d.content as declaration_content, g.title as guideline_title,
        e.name as expert_name, e.code as expert_code, e.field as expert_field,
        rg.name as group_name
      FROM review_tasks rt
      LEFT JOIN declarations d ON rt.declaration_id = d.id
      LEFT JOIN guidelines g ON d.guideline_id = g.id
      LEFT JOIN experts e ON rt.expert_id = e.id
      LEFT JOIN review_groups rg ON rt.group_id = rg.id
      WHERE 1=1
    `;
    const params = [];

    if (expert_id) {
      sql += ' AND rt.expert_id = ?';
      params.push(expert_id);
    }
    if (declaration_id) {
      sql += ' AND rt.declaration_id = ?';
      params.push(declaration_id);
    }
    if (group_id) {
      sql += ' AND rt.group_id = ?';
      params.push(group_id);
    }
    if (status && status !== 'all') {
      sql += ' AND rt.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY rt.created_at DESC';

    const tasks = all(sql, params);
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/tasks/:id', (req, res) => {
  try {
    const task = get(`
      SELECT rt.*, d.title as declaration_title, d.applicant, d.company, d.phone, d.email,
        d.content as declaration_content, d.guideline_id, g.title as guideline_title,
        e.name as expert_name, rg.name as group_name
      FROM review_tasks rt
      LEFT JOIN declarations d ON rt.declaration_id = d.id
      LEFT JOIN guidelines g ON d.guideline_id = g.id
      LEFT JOIN experts e ON rt.expert_id = e.id
      LEFT JOIN review_groups rg ON rt.group_id = rg.id
      WHERE rt.id = ?
    `, [req.params.id]);

    if (!task) {
      return res.status(404).json({ success: false, message: '评审任务不存在' });
    }

    const scores = all(`
      SELECT rs.*, sc.name as criterion_name, sc.code as criterion_code, 
        sc.max_score, sc.weight, sc.description as criterion_description
      FROM review_scores rs
      LEFT JOIN scoring_criteria sc ON rs.criterion_id = sc.id
      WHERE rs.task_id = ?
      ORDER BY sc.sort_order
    `, [task.id]);

    const criteria = getScoringCriteria(task.guideline_id);
    const attachments = all(`
      SELECT * FROM attachments WHERE declaration_id = ?
    `, [task.declaration_id]);

    res.json({
      success: true,
      data: {
        ...task,
        scores,
        criteria,
        attachments,
        is_anonymous: !!task.is_anonymous
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tasks/:id/start', (req, res) => {
  try {
    const taskId = req.params.id;
    const user = getCurrentUser(req);

    const task = get('SELECT * FROM review_tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: '评审任务不存在' });
    }
    if (task.status !== 'pending' && task.status !== 'assigned') {
      return res.status(400).json({ success: false, message: `当前状态(${task.status})不允许开始评审` });
    }

    run('UPDATE review_tasks SET status = \'in_progress\', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [taskId]);

    logOperation(req, '开始评审', '专家评审', taskId, `任务ID: ${taskId}, 申报ID: ${task.declaration_id}`);

    res.json({ success: true, message: '已开始评审' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tasks/:id/submit', (req, res) => {
  try {
    const taskId = req.params.id;
    const { scores, review_comment } = req.body;
    const user = getCurrentUser(req);

    const task = get('SELECT * FROM review_tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: '评审任务不存在' });
    }
    if (task.status === 'submitted' || task.status === 'completed') {
      return res.status(400).json({ success: false, message: '评审已提交，不能重复提交' });
    }

    const criteria = getScoringCriteria(task.guideline_id);
    const scoresMap = {};
    let totalScore = 0;

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ success: false, message: '请填写所有评分项' });
    }

    for (const item of scores) {
      const criterion = criteria.find(c => c.id === item.criterion_id);
      if (!criterion) continue;
      if (item.score < 0 || item.score > criterion.max_score) {
        return res.status(400).json({ success: false, message: `[${criterion.name}]分数应在 0-${criterion.max_score} 之间` });
      }
      scoresMap[item.criterion_id] = item;
      totalScore += item.score * criterion.weight;
    }

    for (const criterion of criteria) {
      if (!scoresMap[criterion.id]) {
        return res.status(400).json({ success: false, message: `请填写评分项: ${criterion.name}` });
      }
    }

    const dbObj = require('../models/database');
    const txn = dbObj.db.transaction(() => {
      run('DELETE FROM review_scores WHERE task_id = ?', [taskId]);

      const insertScore = dbObj.db.prepare(`
        INSERT INTO review_scores (task_id, declaration_id, expert_id, criterion_id, score, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of scores) {
        insertScore.run(taskId, task.declaration_id, task.expert_id, item.criterion_id, item.score, item.comment || null);
      }

      run(`
        UPDATE review_tasks 
        SET status = 'submitted', total_score = ?, review_comment = ?, 
          submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [totalScore, review_comment || null, taskId]);

      run(`
        UPDATE experts 
        SET review_count = review_count + 1,
          avg_score = (avg_score * review_count + ?) / (review_count + 1),
          last_review_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [totalScore, task.expert_id]);
    });
    txn();

    updateSummaryForDeclaration(task.declaration_id);

    logOperation(req, '提交评审', '专家评审', taskId,
      `提交评审: 任务ID ${taskId}, 总分 ${totalScore.toFixed(2)}, 专家ID ${task.expert_id}`);

    res.json({ success: true, message: '评审提交成功', data: { total_score: totalScore } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function updateSummaryForDeclaration(declarationId) {
  const tasks = all(`
    SELECT rt.* FROM review_tasks rt
    WHERE rt.declaration_id = ? AND rt.status = 'submitted'
  `, [declarationId]);

  if (tasks.length === 0) return;

  const allTasks = all('SELECT * FROM review_tasks WHERE declaration_id = ?', [declarationId]);
  const expertCount = new Set(allTasks.map(t => t.expert_id)).size;
  const submittedCount = tasks.length;

  const scores = tasks.map(t => t.total_score).filter(s => s !== null);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const minScore = scores.length ? Math.min(...scores) : null;
  const maxScore = scores.length ? Math.max(...scores) : null;

  const distribution = {
    '90-100': scores.filter(s => s >= 90).length,
    '80-89': scores.filter(s => s >= 80 && s < 90).length,
    '70-79': scores.filter(s => s >= 70 && s < 80).length,
    '60-69': scores.filter(s => s >= 60 && s < 70).length,
    '0-59': scores.filter(s => s < 60).length
  };

  let recommendation = 'pending';
  if (avgScore >= 85) recommendation = 'strongly_recommend';
  else if (avgScore >= 75) recommendation = 'recommend';
  else if (avgScore >= 60) recommendation = 'conditionally_recommend';
  else if (avgScore !== null) recommendation = 'not_recommend';

  const existing = get('SELECT id FROM review_summaries WHERE declaration_id = ?', [declarationId]);
  if (existing) {
    run(`
      UPDATE review_summaries SET
        expert_count = ?, submitted_count = ?,
        avg_total_score = ?, min_total_score = ?, max_total_score = ?,
        score_distribution = ?, final_recommendation = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE declaration_id = ?
    `, [expertCount, submittedCount, avgScore, minScore, maxScore, JSON.stringify(distribution), recommendation, declarationId]);
  } else {
    const decl = get('SELECT guideline_id FROM declarations WHERE id = ?', [declarationId]);
    const groups = all('SELECT DISTINCT group_id FROM review_tasks WHERE declaration_id = ?', [declarationId]);
    run(`
      INSERT INTO review_summaries 
        (declaration_id, guideline_id, group_id, expert_count, submitted_count,
         avg_total_score, min_total_score, max_total_score, score_distribution, final_recommendation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [declarationId, decl?.guideline_id || null, groups[0]?.group_id || null,
        expertCount, submittedCount, avgScore, minScore, maxScore, JSON.stringify(distribution), recommendation]);
  }
}

router.get('/summaries', (req, res) => {
  try {
    const { declaration_id, guideline_id, group_id, recommendation } = req.query;
    let sql = `
      SELECT rs.*, d.title as declaration_title, d.applicant, d.company, d.status,
        g.title as guideline_title, rg.name as group_name
      FROM review_summaries rs
      LEFT JOIN declarations d ON rs.declaration_id = d.id
      LEFT JOIN guidelines g ON rs.guideline_id = g.id
      LEFT JOIN review_groups rg ON rs.group_id = rg.id
      WHERE 1=1
    `;
    const params = [];

    if (declaration_id) {
      sql += ' AND rs.declaration_id = ?';
      params.push(declaration_id);
    }
    if (guideline_id) {
      sql += ' AND rs.guideline_id = ?';
      params.push(guideline_id);
    }
    if (group_id) {
      sql += ' AND rs.group_id = ?';
      params.push(group_id);
    }
    if (recommendation && recommendation !== 'all') {
      sql += ' AND rs.final_recommendation = ?';
      params.push(recommendation);
    }
    sql += ' ORDER BY rs.updated_at DESC';

    const summaries = all(sql, params).map(s => ({
      ...s,
      score_distribution: s.score_distribution ? JSON.parse(s.score_distribution) : null
    }));

    res.json({ success: true, data: summaries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/summaries/:declarationId', (req, res) => {
  try {
    const declarationId = req.params.declarationId;

    const summary = get(`
      SELECT rs.*, d.title as declaration_title, d.applicant, d.company, d.status, d.current_step,
        g.title as guideline_title, rg.name as group_name
      FROM review_summaries rs
      LEFT JOIN declarations d ON rs.declaration_id = d.id
      LEFT JOIN guidelines g ON rs.guideline_id = g.id
      LEFT JOIN review_groups rg ON rs.group_id = rg.id
      WHERE rs.declaration_id = ?
    `, [declarationId]);

    if (!summary) {
      return res.status(404).json({ success: false, message: '评审汇总不存在' });
    }

    const expertReviews = all(`
      SELECT rt.id as task_id, rt.total_score, rt.review_comment, rt.submitted_at,
        rt.expert_id, rt.is_anonymous,
        e.name as expert_name, e.field as expert_field, e.level as expert_level
      FROM review_tasks rt
      LEFT JOIN experts e ON rt.expert_id = e.id
      WHERE rt.declaration_id = ? AND rt.status = 'submitted'
      ORDER BY rt.submitted_at
    `, [declarationId]).map(r => ({
      ...r,
      expert_display: r.is_anonymous ? `专家${r.expert_id}` : r.expert_name,
      expert_info: r.is_anonymous ? { field: r.expert_field, level: r.expert_level } : { name: r.expert_name, field: r.expert_field, level: r.expert_level }
    }));

    const criterionStats = all(`
      SELECT 
        sc.id as criterion_id, sc.name as criterion_name, sc.code as criterion_code, 
        sc.max_score, sc.weight,
        AVG(rs.score) as avg_score,
        MIN(rs.score) as min_score,
        MAX(rs.score) as max_score,
        COUNT(rs.id) as score_count
      FROM review_scores rs
      LEFT JOIN scoring_criteria sc ON rs.criterion_id = sc.id
      WHERE rs.declaration_id = ?
      GROUP BY sc.id
      ORDER BY sc.sort_order
    `, [declarationId]);

    const individualScores = all(`
      SELECT 
        rs.task_id, rs.criterion_id, sc.name as criterion_name,
        rs.score, rs.comment, rt.expert_id
      FROM review_scores rs
      LEFT JOIN scoring_criteria sc ON rs.criterion_id = sc.id
      LEFT JOIN review_tasks rt ON rs.task_id = rt.id
      WHERE rs.declaration_id = ?
      ORDER BY rs.task_id, sc.sort_order
    `, [declarationId]);

    res.json({
      success: true,
      data: {
        ...summary,
        score_distribution: summary.score_distribution ? JSON.parse(summary.score_distribution) : null,
        expert_reviews: expertReviews,
        criterion_stats: criterionStats,
        individual_scores: individualScores
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/summaries/:declarationId/update-comment', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const { final_comment, final_recommendation } = req.body;
    const user = getCurrentUser(req);

    const existing = get('SELECT * FROM review_summaries WHERE declaration_id = ?', [declarationId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '评审汇总不存在' });
    }

    const before = { ...existing };

    run(`
      UPDATE review_summaries SET
        final_comment = ?,
        final_recommendation = COALESCE(?, final_recommendation),
        updated_at = CURRENT_TIMESTAMP
      WHERE declaration_id = ?
    `, [final_comment || null, final_recommendation || null, declarationId]);

    const after = get('SELECT * FROM review_summaries WHERE declaration_id = ?', [declarationId]);
    const changedFields = Object.keys(req.body);

    logOperationWithData(req, '更新评审汇总', '专家评审', declarationId,
      `更新申报 ${declarationId} 的评审汇总意见`,
      before, after, changedFields);

    res.json({ success: true, message: '评审意见已更新' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/summaries/:declarationId/write-to-workflow', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const { approver, action, comment } = req.body;
    const user = getCurrentUser(req);

    const summary = get('SELECT * FROM review_summaries WHERE declaration_id = ?', [declarationId]);
    if (!summary) {
      return res.status(404).json({ success: false, message: '评审汇总不存在' });
    }
    if (summary.workflow_written) {
      return res.status(400).json({ success: false, message: '评审结果已回写审批流，不能重复回写' });
    }

    const declaration = get('SELECT * FROM declarations WHERE id = ? AND is_deleted = 0', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const beforeDecl = { ...declaration };
    let resultAction = action;
    let nextStatus = declaration.status;
    let stepName = '专家评审';
    let stepRole = '评审专家';

    const resultLabelMap = {
      strongly_recommend: '强烈推荐立项',
      recommend: '推荐立项',
      conditionally_recommend: '有条件推荐',
      not_recommend: '不予推荐',
      pending: '评审中'
    };

    const expertReviewSummary = `
【专家评审汇总】
推荐结论: ${resultLabelMap[summary.final_recommendation] || '待定'}
参评专家: ${summary.expert_count}人，已提交: ${summary.submitted_count}人
平均分: ${summary.avg_total_score ? summary.avg_total_score.toFixed(2) : '-'} 
最高分: ${summary.max_total_score ? summary.max_total_score.toFixed(2) : '-'}
最低分: ${summary.min_total_score ? summary.min_total_score.toFixed(2) : '-'}
评审意见: ${summary.final_comment || ''}
    `.trim();

    const finalComment = [expertReviewSummary, comment].filter(Boolean).join('\n\n---\n\n');

    if (!resultAction) {
      if (summary.final_recommendation === 'not_recommend') {
        resultAction = 'reject';
      } else {
        resultAction = 'approve';
      }
    }

    if (resultAction === 'approve') {
      const config = getWorkflowConfig(declaration);
      const steps = config ? all('SELECT * FROM workflow_config_steps WHERE config_id = ? ORDER BY step_order', [config.id]) : [];
      const currentStep = steps.find(s => s.pending_status === declaration.status);

      if (currentStep) {
        nextStatus = currentStep.approved_status;
        stepName = currentStep.name;
        stepRole = currentStep.role;
        run('UPDATE declarations SET status = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [nextStatus, currentStep.step_order + 1, declarationId]);
      }
    } else if (resultAction === 'reject') {
      nextStatus = 'rejected';
      run('UPDATE declarations SET status = ?, current_step = 5, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextStatus, declarationId]);
    }

    run(`
      INSERT INTO approval_records (declaration_id, step, step_name, step_role, approver, action, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [declarationId, declaration.current_step, stepName, stepRole, approver || '评审汇总',
        resultAction === 'approve' ? '通过' : '驳回', finalComment]);

    run(`
      UPDATE review_summaries SET
        workflow_written = 1, written_at = CURRENT_TIMESTAMP, written_by = ?
      WHERE declaration_id = ?
    `, [user, declarationId]);

    const afterDecl = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);

    logOperationWithData(req, '评审结果回写审批流', '专家评审', declarationId,
      `回写申报 ${declaration.title} 的评审结果: ${resultAction === 'approve' ? '通过' : '驳回'}, 状态 ${declaration.status} -> ${nextStatus}`,
      beforeDecl, afterDecl, ['status', 'current_step']);

    res.json({
      success: true,
      message: '评审结果已回写审批流',
      data: {
        action: resultAction,
        previous_status: declaration.status,
        new_status: nextStatus,
        step_name: stepName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function getWorkflowConfig(declaration) {
  if (declaration.workflow_config_id) {
    return get('SELECT * FROM workflow_configs WHERE id = ?', [declaration.workflow_config_id]);
  }
  if (declaration.guideline_id) {
    return get('SELECT * FROM workflow_configs WHERE guideline_id = ?', [declaration.guideline_id]);
  }
  return null;
}

router.get('/stats', (req, res) => {
  try {
    const stats = {
      expert_total: get('SELECT COUNT(*) as count FROM experts').count,
      expert_active: get('SELECT COUNT(*) as count FROM experts WHERE status = ?', ['active']).count,
      group_total: get('SELECT COUNT(*) as count FROM review_groups').count,
      task_total: get('SELECT COUNT(*) as count FROM review_tasks').count,
      task_pending: get('SELECT COUNT(*) as count FROM review_tasks WHERE status IN (?, ?)', ['pending', 'assigned']).count,
      task_in_progress: get('SELECT COUNT(*) as count FROM review_tasks WHERE status = ?', ['in_progress']).count,
      task_submitted: get('SELECT COUNT(*) as count FROM review_tasks WHERE status IN (?, ?)', ['submitted', 'completed']).count,
      summary_total: get('SELECT COUNT(*) as count FROM review_summaries').count,
      summary_written: get('SELECT COUNT(*) as count FROM review_summaries WHERE workflow_written = 1').count,
      recommendation_distribution: {
        strongly_recommend: get('SELECT COUNT(*) as count FROM review_summaries WHERE final_recommendation = ?', ['strongly_recommend']).count,
        recommend: get('SELECT COUNT(*) as count FROM review_summaries WHERE final_recommendation = ?', ['recommend']).count,
        conditionally_recommend: get('SELECT COUNT(*) as count FROM review_summaries WHERE final_recommendation = ?', ['conditionally_recommend']).count,
        not_recommend: get('SELECT COUNT(*) as count FROM review_summaries WHERE final_recommendation = ?', ['not_recommend']).count,
        pending: get('SELECT COUNT(*) as count FROM review_summaries WHERE final_recommendation = ? OR final_recommendation IS NULL', ['pending']).count
      },
      field_distribution: all(`
        SELECT field, COUNT(*) as count 
        FROM experts 
        WHERE field IS NOT NULL AND field != '' 
        GROUP BY field 
        ORDER BY count DESC
      `),
      recent_activities: all(`
        SELECT 
          id, user, action, module, target_id, detail, created_at
        FROM operation_logs 
        WHERE module = '专家评审' 
        ORDER BY created_at DESC 
        LIMIT 20
      `)
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
