const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

router.get('/', (req, res) => {
  try {
    const { category, keyword } = req.query;
    let sql = 'SELECT * FROM guidelines WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (keyword) {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const guidelines = all(sql, params);
    
    logOperation(req, '查询', '申报指南', null, `查询条件: category=${category || '全部'}, keyword=${keyword || '无'}`);
    
    res.json({ success: true, data: guidelines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [req.params.id]);
    
    if (!guideline) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    logOperation(req, '查看详情', '申报指南', req.params.id, `查看指南: ${guideline.title}`);
    
    res.json({ success: true, data: guideline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/related', (req, res) => {
  try {
    const guidelineId = req.params.id;
    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [guidelineId]);
    
    if (!guideline) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    const templates = all(
      'SELECT * FROM declaration_templates WHERE guideline_id = ? ORDER BY sort_order ASC, created_at DESC',
      [guidelineId]
    );

    const materials = all(
      `SELECT mt.*, 
        (SELECT COUNT(*) FROM attachments a WHERE a.material_type_id = mt.id AND a.declaration_id IN 
          (SELECT id FROM declarations WHERE guideline_id = ? AND is_deleted = 0)) as usage_count
       FROM material_types mt 
       WHERE mt.guideline_id = ? OR mt.guideline_id IS NULL 
       ORDER BY mt.sort_order ASC, mt.created_at ASC`,
      [guidelineId, guidelineId]
    ).map(mt => ({
      ...mt,
      allowed_extensions: mt.allowed_extensions ? mt.allowed_extensions.split(',') : [],
      required: mt.required === 1
    }));

    const historyCases = all(
      `SELECT d.id, d.title, d.applicant, d.company, d.content, d.status, d.created_at,
        (SELECT COUNT(*) FROM approval_records ar WHERE ar.declaration_id = d.id) as approval_count
       FROM declarations d 
       WHERE d.guideline_id = ? AND d.status = 'approved' AND d.is_deleted = 0
       ORDER BY d.created_at DESC
       LIMIT 10`,
      [guidelineId]
    );

    const faqs = all(
      'SELECT * FROM faqs WHERE guideline_id = ? ORDER BY sort_order ASC, created_at ASC',
      [guidelineId]
    );

    const stats = get(
      `SELECT 
        (SELECT COUNT(*) FROM declarations WHERE guideline_id = ? AND is_deleted = 0) as total_declarations,
        (SELECT COUNT(*) FROM declarations WHERE guideline_id = ? AND status = 'approved' AND is_deleted = 0) as approved_count,
        (SELECT COUNT(*) FROM declarations WHERE guideline_id = ? AND status = 'submitted' AND is_deleted = 0) as pending_count,
        (SELECT COUNT(*) FROM declaration_templates WHERE guideline_id = ?) as template_count,
        (SELECT COUNT(*) FROM faqs WHERE guideline_id = ?) as faq_count
      `,
      [guidelineId, guidelineId, guidelineId, guidelineId, guidelineId]
    );

    const approvalRate = stats.total_declarations > 0 
      ? Math.round((stats.approved_count / stats.total_declarations) * 100) 
      : 0;

    logOperation(req, '查看关联推荐', '申报指南', guidelineId, `查看指南关联推荐: ${guideline.title}`);
    
    res.json({
      success: true,
      data: {
        guideline,
        templates,
        materials,
        history_cases: historyCases,
        faqs,
        stats: {
          ...stats,
          approval_rate: approvalRate
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/templates', (req, res) => {
  try {
    const templates = all(
      'SELECT * FROM declaration_templates WHERE guideline_id = ? ORDER BY sort_order ASC, created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/templates', (req, res) => {
  try {
    const { title, content, description, sort_order = 0, is_default = 0 } = req.body;
    const result = run(`
      INSERT INTO declaration_templates (guideline_id, title, content, description, sort_order, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, title, content, description || '', sort_order, is_default]);

    logOperation(req, '创建', '申报模板', result.lastID, `创建模板: ${title}`);
    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/templates/:templateId', (req, res) => {
  try {
    const { title, content, description, sort_order, is_default } = req.body;
    const template = get('SELECT * FROM declaration_templates WHERE id = ?', [req.params.templateId]);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    run(`
      UPDATE declaration_templates 
      SET title = COALESCE(?, title), 
          content = COALESCE(?, content), 
          description = COALESCE(?, description), 
          sort_order = COALESCE(?, sort_order),
          is_default = COALESCE(?, is_default),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, content, description, sort_order, is_default, req.params.templateId]);

    logOperation(req, '更新', '申报模板', req.params.templateId, `更新模板: ${title || template.title}`);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/templates/:templateId', (req, res) => {
  try {
    const template = get('SELECT * FROM declaration_templates WHERE id = ?', [req.params.templateId]);
    const result = run('DELETE FROM declaration_templates WHERE id = ?', [req.params.templateId]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    logOperation(req, '删除', '申报模板', req.params.templateId, `删除模板: ${template?.title || ''}`);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/faqs', (req, res) => {
  try {
    const faqs = all(
      'SELECT * FROM faqs WHERE guideline_id = ? ORDER BY sort_order ASC, created_at ASC',
      [req.params.id]
    );
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/faqs', (req, res) => {
  try {
    const { question, answer, sort_order = 0 } = req.body;
    const result = run(`
      INSERT INTO faqs (guideline_id, question, answer, sort_order)
      VALUES (?, ?, ?, ?)
    `, [req.params.id, question, answer, sort_order]);

    logOperation(req, '创建', '常见问题', result.lastID, `创建FAQ: ${question}`);
    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/faqs/:faqId', (req, res) => {
  try {
    const { question, answer, sort_order } = req.body;
    const faq = get('SELECT * FROM faqs WHERE id = ?', [req.params.faqId]);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ不存在' });
    }

    run(`
      UPDATE faqs 
      SET question = COALESCE(?, question), 
          answer = COALESCE(?, answer), 
          sort_order = COALESCE(?, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [question, answer, sort_order, req.params.faqId]);

    logOperation(req, '更新', '常见问题', req.params.faqId, `更新FAQ: ${question || faq.question}`);
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/faqs/:faqId', (req, res) => {
  try {
    const faq = get('SELECT * FROM faqs WHERE id = ?', [req.params.faqId]);
    const result = run('DELETE FROM faqs WHERE id = ?', [req.params.faqId]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'FAQ不存在' });
    }
    logOperation(req, '删除', '常见问题', req.params.faqId, `删除FAQ: ${faq?.question || ''}`);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/materials', (req, res) => {
  try {
    const materials = all(`
      SELECT mt.*, 
        (SELECT COUNT(*) FROM attachments a WHERE a.material_type_id = mt.id) as upload_count
      FROM material_types mt 
      WHERE mt.guideline_id = ? OR mt.guideline_id IS NULL 
      ORDER BY mt.sort_order ASC, mt.created_at ASC
    `, [req.params.id]).map(mt => ({
      ...mt,
      allowed_extensions: mt.allowed_extensions ? mt.allowed_extensions.split(',') : [],
      required: mt.required === 1
    }));
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/cases', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const cases = all(`
      SELECT d.id, d.title, d.applicant, d.company, d.content, d.status, d.created_at, d.updated_at,
        (SELECT COUNT(*) FROM attachments a WHERE a.declaration_id = d.id) as attachment_count,
        (SELECT COUNT(*) FROM approval_records ar WHERE ar.declaration_id = d.id) as approval_count
      FROM declarations d 
      WHERE d.guideline_id = ? AND d.status = 'approved' AND d.is_deleted = 0
      ORDER BY d.created_at DESC
      LIMIT ?
    `, [req.params.id, parseInt(limit)]);
    res.json({ success: true, data: cases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { title, content, category, deadline } = req.body;
    
    const result = run(`
      INSERT INTO guidelines (title, content, category, deadline)
      VALUES (?, ?, ?, ?)
    `, [title, content, category || '其他', deadline || null]);

    logOperation(req, '创建', '申报指南', result.lastID, `创建指南: ${title}`);
    
    res.json({ 
      success: true, 
      data: { id: result.lastID } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { title, content, category, deadline } = req.body;
    
    const result = run(`
      UPDATE guidelines 
      SET title = ?, content = ?, category = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, content, category, deadline, req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    logOperation(req, '更新', '申报指南', req.params.id, `更新指南: ${title}`);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const guideline = get('SELECT title FROM guidelines WHERE id = ?', [req.params.id]);
    const result = run('DELETE FROM guidelines WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    logOperation(req, '删除', '申报指南', req.params.id, `删除指南: ${guideline?.title || ''}`);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
