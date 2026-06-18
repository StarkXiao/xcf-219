const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

const STATUS_MAP = {
  draft: '草稿',
  submitted: '待初审',
  reviewing: '初审中',
  first_reviewed: '待复审',
  second_reviewed: '待终审',
  approved: '已立项',
  rejected: '已驳回'
};

router.get('/', (req, res) => {
  try {
    const { status, keyword, applicant } = req.query;
    let sql = 'SELECT d.*, g.title as guideline_title FROM declarations d LEFT JOIN guidelines g ON d.guideline_id = g.id WHERE 1=1';
    const params = [];

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
    const declarations = all(sql, params);
    
    logOperation(req, '查询', '申报表单', null, `查询条件: status=${status || '全部'}`);
    
    res.json({ success: true, data: declarations });
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
      WHERE d.id = ?
    `, [req.params.id]);
    
    if (!declaration) {
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
    
    const result = run(`
      INSERT INTO declarations (title, guideline_id, applicant, company, phone, email, content, status, current_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0)
    `, [title, guideline_id || null, applicant, company, phone || '', email || '', content || '']);

    logOperation(req, '创建', '申报表单', result.lastID, `创建申报: ${title}, 申请人: ${applicant}`);
    
    res.json({ 
      success: true, 
      data: { id: result.lastID, status: 'draft' } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { title, guideline_id, applicant, company, phone, email, content } = req.body;
    
    const declaration = get('SELECT status FROM declarations WHERE id = ?', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }
    
    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能编辑草稿状态的申报' });
    }

    run(`
      UPDATE declarations 
      SET title = ?, guideline_id = ?, applicant = ?, company = ?, 
          phone = ?, email = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, guideline_id || null, applicant, company, phone, email, content, req.params.id]);

    logOperation(req, '更新', '申报表单', req.params.id, `更新申报: ${title}`);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/submit', (req, res) => {
  try {
    const declaration = get('SELECT * FROM declarations WHERE id = ?', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }
    
    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能提交草稿状态的申报' });
    }

    run(`
      UPDATE declarations 
      SET status = 'submitted', current_step = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    run(`
      INSERT INTO approval_records (declaration_id, step, approver, action, comment)
      VALUES (?, ?, ?, ?, ?)
    `, [req.params.id, 1, '系统', '提交', '申报人提交申报材料']);

    logOperation(req, '提交', '申报表单', req.params.id, `提交申报: ${declaration.title}`);
    
    res.json({ success: true, message: '提交成功', status: 'submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const declaration = get('SELECT title, status FROM declarations WHERE id = ?', [req.params.id]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }
    
    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能删除草稿状态的申报' });
    }

    run('DELETE FROM declarations WHERE id = ?', [req.params.id]);
    logOperation(req, '删除', '申报表单', req.params.id, `删除申报: ${declaration.title}`);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
