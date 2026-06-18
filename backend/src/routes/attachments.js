const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

router.get('/', (req, res) => {
  try {
    const { declaration_id } = req.query;
    let sql = `SELECT a.*, mt.name as material_type_name, mt.code as material_type_code, mt.required as material_type_required
               FROM attachments a
               LEFT JOIN material_types mt ON a.material_type_id = mt.id
               WHERE 1=1`;
    const params = [];

    if (declaration_id) {
      sql += ' AND a.declaration_id = ?';
      params.push(declaration_id);
    }

    sql += ' ORDER BY a.uploaded_at DESC';
    const attachments = all(sql, params);
    res.json({ success: true, data: attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }
    res.json({ success: true, data: attachment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/upload', upload.array('files', 20), (req, res) => {
  try {
    const declarationId = req.body.declaration_id;
    if (!declarationId) {
      return res.status(400).json({ success: false, message: '缺少申报ID' });
    }

    const files = req.files || [];
    const attachments = [];
    const warnings = [];
    const duplicates = [];
    let uploadedCount = 0;
    let duplicateCount = 0;

    for (const file of files) {
      const existing = get(
        'SELECT * FROM attachments WHERE declaration_id = ? AND original_name = ? AND file_size = ?',
        [declarationId, file.originalname, file.size]
      );

      if (existing) {
        duplicates.push({
          new_file: file.originalname,
          existing_file: existing.original_name,
          existing_id: existing.id,
          material_type_name: null
        });
        duplicateCount++;
        const filePath = path.join(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        continue;
      }

      const result = run(`
        INSERT INTO attachments (declaration_id, material_type_id, filename, original_name, file_path, file_size, file_type)
        VALUES (?, NULL, ?, ?, ?, ?, ?)
      `, [declarationId, file.filename, file.originalname, file.path, file.size, file.mimetype]);

      attachments.push({
        id: result.lastID,
        declaration_id: parseInt(declarationId),
        material_type_id: null,
        filename: file.filename,
        original_name: file.originalname,
        file_path: file.path,
        file_size: file.size,
        file_type: file.mimetype,
        uploaded_at: new Date().toISOString()
      });
      uploadedCount++;
    }

    logOperation(req, '上传附件', '附件', parseInt(declarationId),
      `上传 ${uploadedCount} 个附件${duplicateCount > 0 ? `，${duplicateCount} 个重复跳过` : ''}`);

    res.json({
      success: true,
      data: { attachments, warnings, duplicates, uploadedCount, duplicateCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/validate', upload.array('files', 20), (req, res) => {
  try {
    const files = req.files || [];
    const results = files.map(file => ({
      name: file.originalname,
      size: file.size,
      valid: true,
      errors: [],
      warnings: [],
      material_type_id: null,
      material_type_name: null
    }));

    const filePath = path.join(uploadsDir);
    for (const file of (req.files || [])) {
      const fp = path.join(filePath, file.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    res.json({ success: true, data: { valid: true, results } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/download', (req, res) => {
  try {
    const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }
    const filePath = attachment.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    res.download(filePath, attachment.original_name);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/missing-check/:declarationId', (req, res) => {
  try {
    const { declarationId } = req.params;
    const materialTypes = all('SELECT * FROM material_types WHERE guideline_id IN (SELECT guideline_id FROM declarations WHERE id = ?) OR guideline_id IS NULL ORDER BY sort_order', [declarationId]);
    const attachments = all('SELECT * FROM attachments WHERE declaration_id = ?', [declarationId]);

    const complete = [];
    const missing = [];
    const unnecessary = [];
    const uncategorized = attachments.filter(a => !a.material_type_id);

    for (const mt of materialTypes) {
      const mtAttachments = attachments.filter(a => a.material_type_id === mt.id);
      if (mtAttachments.length > 0) {
        complete.push({ ...mt, uploaded: mtAttachments.length, attachments: mtAttachments });
      } else if (mt.required) {
        missing.push(mt);
      } else {
        unnecessary.push(mt);
      }
    }

    const requiredTotal = materialTypes.filter(m => m.required).length;
    const requiredComplete = complete.filter(c => c.required).length;

    res.json({
      success: true,
      data: {
        missing,
        complete,
        unnecessary,
        uncategorized,
        stats: {
          total_types: materialTypes.length,
          required_total: requiredTotal,
          required_complete: requiredComplete,
          required_missing: requiredTotal - requiredComplete,
          optional_total: materialTypes.filter(m => !m.required).length,
          optional_complete: complete.filter(c => !c.required).length,
          attachments_total: attachments.length,
          uncategorized_count: uncategorized.length,
          completion_rate: requiredTotal > 0 ? Math.round((requiredComplete / requiredTotal) * 100) : 100,
          is_complete: requiredTotal <= requiredComplete
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/duplicates/:declarationId', (req, res) => {
  try {
    const { declarationId } = req.params;
    const attachments = all('SELECT * FROM attachments WHERE declaration_id = ?', [declarationId]);

    const exactGroups = [];
    const potentialGroups = [];
    const seen = new Map();

    for (const a of attachments) {
      const key = `${a.file_size}-${a.original_name}`;
      if (seen.has(key)) {
        const existing = seen.get(key);
        const group = exactGroups.find(g => g[0].file_size === a.file_size && g[0].original_name === a.original_name);
        if (group) {
          group.push(a);
        } else {
          exactGroups.push([existing, a]);
        }
      } else {
        seen.set(key, a);
      }
    }

    res.json({
      success: true,
      data: {
        total_attachments: attachments.length,
        exact_duplicates: { groups: exactGroups, group_count: exactGroups.length, duplicate_count: exactGroups.reduce((s, g) => s + g.length - 1, 0) },
        potential_duplicates: { groups: potentialGroups, group_count: 0, duplicate_count: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/batch-download/:declarationId', (req, res) => {
  try {
    const { declarationId } = req.params;
    const attachments = all('SELECT * FROM attachments WHERE declaration_id = ?', [declarationId]);
    if (attachments.length === 0) {
      return res.status(404).json({ success: false, message: '无附件可下载' });
    }
    res.json({ success: true, message: '请使用单个附件下载', data: { count: attachments.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }
    if (attachment.file_path && fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }
    run('DELETE FROM attachments WHERE id = ?', [req.params.id]);
    logOperation(req, '删除附件', '附件', parseInt(req.params.id), `删除附件: ${attachment.original_name}`);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
