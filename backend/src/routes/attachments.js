const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `declaration-${req.params.declarationId}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

router.get('/material-types', (req, res) => {
  try {
    const { guidelineId } = req.query;
    let sql = 'SELECT * FROM material_types WHERE 1=1';
    const params = [];

    if (guidelineId) {
      sql += ' AND (guideline_id = ? OR guideline_id IS NULL)';
      params.push(guidelineId);
    }

    sql += ' ORDER BY sort_order ASC, id ASC';
    const materialTypes = all(sql, params);

    const result = materialTypes.map(mt => ({
      ...mt,
      allowed_extensions: mt.allowed_extensions ? mt.allowed_extensions.split(',') : [],
      required: mt.required === 1
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/material-types', (req, res) => {
  try {
    const { guideline_id, name, code, description, required, allowed_extensions, max_size, sort_order } = req.body;

    const existing = get('SELECT id FROM material_types WHERE code = ? AND (guideline_id = ? OR (guideline_id IS NULL AND ? IS NULL))',
      [code, guideline_id || null, guideline_id || null]);
    if (existing) {
      return res.status(400).json({ success: false, message: '材料类型编码已存在' });
    }

    const result = run(`
      INSERT INTO material_types (guideline_id, name, code, description, required, allowed_extensions, max_size, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      guideline_id || null,
      name,
      code,
      description || '',
      required ? 1 : 0,
      Array.isArray(allowed_extensions) ? allowed_extensions.join(',') : (allowed_extensions || ''),
      max_size || 10485760,
      sort_order || 0
    ]);

    logOperation(req, '创建', '材料类型', result.lastID, `创建材料类型: ${name}`);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/material-types/:id', (req, res) => {
  try {
    const { name, code, description, required, allowed_extensions, max_size, sort_order } = req.body;

    const existing = get('SELECT * FROM material_types WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '材料类型不存在' });
    }

    run(`
      UPDATE material_types 
      SET name = ?, code = ?, description = ?, required = ?, allowed_extensions = ?, max_size = ?, sort_order = ?
      WHERE id = ?
    `, [
      name || existing.name,
      code || existing.code,
      description !== undefined ? description : existing.description,
      required !== undefined ? (required ? 1 : 0) : existing.required,
      allowed_extensions !== undefined
        ? (Array.isArray(allowed_extensions) ? allowed_extensions.join(',') : allowed_extensions)
        : existing.allowed_extensions,
      max_size || existing.max_size,
      sort_order !== undefined ? sort_order : existing.sort_order,
      req.params.id
    ]);

    logOperation(req, '更新', '材料类型', req.params.id, `更新材料类型: ${name || existing.name}`);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/material-types/:id', (req, res) => {
  try {
    const existing = get('SELECT * FROM material_types WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '材料类型不存在' });
    }

    run('DELETE FROM material_types WHERE id = ?', [req.params.id]);

    logOperation(req, '删除', '材料类型', req.params.id, `删除材料类型: ${existing.name}`);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/declaration/:declarationId', (req, res) => {
  try {
    const attachments = all(`
      SELECT a.*, mt.name as material_type_name, mt.code as material_type_code, mt.required as material_type_required
      FROM attachments a
      LEFT JOIN material_types mt ON a.material_type_id = mt.id
      WHERE a.declaration_id = ? 
      ORDER BY mt.sort_order ASC, a.uploaded_at DESC
    `, [req.params.declarationId]);

    const result = attachments.map(a => ({
      ...a,
      material_type_required: a.material_type_required === 1
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/validate/:declarationId', (req, res) => {
  try {
    const { files } = req.body;
    const declarationId = req.params.declarationId;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.json({ success: true, data: { valid: true, results: [] } });
    }

    const declaration = get('SELECT guideline_id FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const materialTypes = all(`
      SELECT * FROM material_types 
      WHERE guideline_id = ? OR guideline_id IS NULL
      ORDER BY sort_order ASC
    `, [declaration.guideline_id || null]);

    const results = [];

    for (const file of files) {
      const fileResult = {
        name: file.name,
        size: file.size,
        valid: true,
        errors: [],
        warnings: [],
        material_type_id: null,
        material_type_name: null
      };

      const ext = path.extname(file.name).toLowerCase().slice(1);

      if (file.material_type_id) {
        const mt = materialTypes.find(m => m.id === file.material_type_id);
        if (mt) {
          fileResult.material_type_id = mt.id;
          fileResult.material_type_name = mt.name;

          if (mt.allowed_extensions) {
            const allowed = mt.allowed_extensions.split(',');
            if (!allowed.includes(ext)) {
              fileResult.valid = false;
              fileResult.errors.push(`文件类型不匹配"${mt.name}"，允许的类型：${allowed.join('、')}`);
            }
          }

          if (mt.max_size && file.size > mt.max_size) {
            fileResult.valid = false;
            const maxSizeMB = (mt.max_size / 1024 / 1024).toFixed(0);
            fileResult.errors.push(`文件大小超过"${mt.name}"限制，最大允许 ${maxSizeMB}MB`);
          }
        }
      }

      const globalAllowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'zip', 'rar'];
      if (!globalAllowed.includes(ext)) {
        fileResult.valid = false;
        fileResult.errors.push('不支持的文件类型');
      }

      if (file.size > 50 * 1024 * 1024) {
        fileResult.valid = false;
        fileResult.errors.push('文件大小不能超过50MB');
      }

      results.push(fileResult);
    }

    const allValid = results.every(r => r.valid);

    res.json({ success: true, data: { valid: allValid, results } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId', upload.array('files', 20), async (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const materialTypeIds = (req.body.materialTypeIds || '').split(',').filter(Boolean).map(Number);

    const declaration = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status !== 'draft') {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(400).json({ success: false, message: '只能上传草稿状态申报的附件' });
    }

    const attachments = [];
    const warnings = [];
    const duplicates = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const materialTypeId = materialTypeIds[i] || null;

      let fileHash = null;
      try {
        fileHash = await calculateFileHash(file.path);
      } catch (e) {
        console.warn('计算文件hash失败:', e);
      }

      if (fileHash) {
        const existing = get(`
          SELECT a.*, mt.name as material_type_name 
          FROM attachments a 
          LEFT JOIN material_types mt ON a.material_type_id = mt.id
          WHERE a.file_hash = ? AND a.declaration_id = ?
        `, [fileHash, declarationId]);

        if (existing) {
          duplicates.push({
            new_file: file.originalname,
            existing_file: existing.original_name,
            existing_id: existing.id,
            material_type_name: existing.material_type_name
          });
          fs.unlinkSync(file.path);
          continue;
        }
      }

      if (materialTypeId) {
        const mt = get('SELECT * FROM material_types WHERE id = ?', [materialTypeId]);
        if (mt) {
          const ext = path.extname(file.originalname).toLowerCase().slice(1);
          if (mt.allowed_extensions) {
            const allowed = mt.allowed_extensions.split(',');
            if (!allowed.includes(ext)) {
              warnings.push(`${file.originalname}：文件类型与"${mt.name}"要求不完全匹配`);
            }
          }
          if (mt.max_size && file.size > mt.max_size) {
            warnings.push(`${file.originalname}：文件大小超过"${mt.name}"的建议限制`);
          }
        }
      }

      const result = run(`
        INSERT INTO attachments (declaration_id, material_type_id, filename, original_name, file_path, file_size, file_type, file_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        declarationId,
        materialTypeId,
        file.filename,
        file.originalname,
        file.path,
        file.size,
        file.mimetype,
        fileHash
      ]);

      const mt = materialTypeId ? get('SELECT name, code, required FROM material_types WHERE id = ?', [materialTypeId]) : null;

      attachments.push({
        id: result.lastID,
        material_type_id: materialTypeId,
        material_type_name: mt?.name || null,
        material_type_code: mt?.code || null,
        material_type_required: mt?.required === 1,
        filename: file.filename,
        original_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
        file_hash: fileHash
      });
    }

    logOperation(req, '上传', '附件', null, `申报ID: ${declarationId}, 上传 ${attachments.length} 个附件, 跳过重复 ${duplicates.length} 个`);

    res.json({
      success: true,
      data: {
        attachments,
        warnings,
        duplicates,
        uploadedCount: attachments.length,
        duplicateCount: duplicates.length
      },
      message: `成功上传 ${attachments.length} 个文件${duplicates.length > 0 ? `，已跳过 ${duplicates.length} 个重复文件` : ''}`
    });
  } catch (error) {
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:declarationId/missing-check', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const numId = Number(declarationId);
    if (!Number.isInteger(numId) || numId <= 0) {
      return res.status(400).json({ success: false, message: '无效的申报ID' });
    }

    const declaration = get('SELECT guideline_id FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const materialTypes = all(`
      SELECT * FROM material_types 
      WHERE guideline_id = ? OR guideline_id IS NULL
      ORDER BY sort_order ASC
    `, [declaration.guideline_id || null]);

    const attachments = all(`
      SELECT * FROM attachments WHERE declaration_id = ?
    `, [declarationId]);

    const missing = [];
    const complete = [];
    const unnecessary = [];

    for (const mt of materialTypes) {
      const mtAttachments = attachments.filter(a => a.material_type_id === mt.id);
      const mtData = {
        id: mt.id,
        name: mt.name,
        code: mt.code,
        description: mt.description,
        required: mt.required === 1,
        allowed_extensions: mt.allowed_extensions ? mt.allowed_extensions.split(',') : [],
        max_size: mt.max_size,
        uploaded: mtAttachments.length,
        attachments: mtAttachments
      };

      if (mt.required === 1) {
        if (mtAttachments.length === 0) {
          missing.push(mtData);
        } else {
          complete.push(mtData);
        }
      } else {
        if (mtAttachments.length > 0) {
          complete.push(mtData);
        } else {
          unnecessary.push(mtData);
        }
      }
    }

    const uncategorized = attachments.filter(a => !a.material_type_id);

    const requiredTotal = materialTypes.filter(m => m.required === 1).length;
    const requiredComplete = requiredTotal - missing.length;

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
          required_missing: missing.length,
          optional_total: materialTypes.filter(m => m.required === 0).length,
          optional_complete: complete.filter(c => !c.required).length,
          attachments_total: attachments.length,
          uncategorized_count: uncategorized.length,
          completion_rate: requiredTotal > 0 ? Math.round((requiredComplete / requiredTotal) * 100) : 100,
          is_complete: missing.length === 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:declarationId/duplicates', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    const numId = Number(declarationId);
    if (!Number.isInteger(numId) || numId <= 0) {
      return res.status(400).json({ success: false, message: '无效的申报ID' });
    }

    const declaration = get('SELECT id FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    const attachments = all(`
      SELECT a.*, mt.name as material_type_name, mt.code as material_type_code
      FROM attachments a
      LEFT JOIN material_types mt ON a.material_type_id = mt.id
      WHERE a.declaration_id = ?
      ORDER BY a.uploaded_at DESC
    `, [declarationId]);

    const hashGroups = {};
    const nameSizeGroups = {};

    for (const att of attachments) {
      if (att.file_hash) {
        if (!hashGroups[att.file_hash]) {
          hashGroups[att.file_hash] = [];
        }
        hashGroups[att.file_hash].push(att);
      }

      const nameSizeKey = `${att.original_name.toLowerCase()}_${att.file_size}`;
      if (!nameSizeGroups[nameSizeKey]) {
        nameSizeGroups[nameSizeKey] = [];
      }
      nameSizeGroups[nameSizeKey].push(att);
    }

    const exactDuplicates = Object.values(hashGroups).filter(group => group.length > 1);
    const potentialDuplicates = Object.values(nameSizeGroups).filter(group => {
      if (group.length <= 1) return false;
      const hashes = new Set(group.map(g => g.file_hash).filter(Boolean));
      return hashes.size > 1 || hashes.size === 0;
    });

    res.json({
      success: true,
      data: {
        total_attachments: attachments.length,
        exact_duplicates: {
          groups: exactDuplicates,
          group_count: exactDuplicates.length,
          duplicate_count: exactDuplicates.reduce((sum, g) => sum + g.length - 1, 0)
        },
        potential_duplicates: {
          groups: potentialDuplicates,
          group_count: potentialDuplicates.length,
          duplicate_count: potentialDuplicates.reduce((sum, g) => sum + g.length - 1, 0)
        }
      }
    });
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

    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    logOperation(req, '下载', '附件', req.params.id, `下载附件: ${attachment.original_name}`);

    res.download(attachment.file_path, attachment.original_name);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function parseAttachmentIds(body) {
  let { attachmentIds } = body;

  if (typeof attachmentIds === 'string') {
    try {
      attachmentIds = JSON.parse(attachmentIds);
    } catch (e) {
      attachmentIds = null;
    }
  }

  if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    return null;
  }

  return attachmentIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
}

router.post('/:declarationId/batch-download', (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    let attachmentIds = parseAttachmentIds(req.body);

    const declaration = get('SELECT title FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (!attachmentIds) {
      const allAttachments = all('SELECT * FROM attachments WHERE declaration_id = ?', [declarationId]);
      attachmentIds = allAttachments.map(a => a.id);
    }

    if (attachmentIds.length === 0) {
      return res.status(400).json({ success: false, message: '没有可下载的附件' });
    }

    const placeholders = attachmentIds.map(() => '?').join(',');
    const attachments = all(`SELECT * FROM attachments WHERE id IN (${placeholders})`, attachmentIds);

    if (attachments.length === 0) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    if (attachments.length === 1) {
      const att = attachments[0];
      if (!fs.existsSync(att.file_path)) {
        return res.status(404).json({ success: false, message: `文件不存在: ${att.original_name}` });
      }
      logOperation(req, '批量下载', '附件', null, `申报ID: ${declarationId}, 下载 1 个附件`);
      return res.download(att.file_path, att.original_name);
    }

    const archiver = require('archiver');
    const safeTitle = (declaration.title || 'declaration').replace(/[<>:"/\\|?*]/g, '_');
    const zipFileName = `${safeTitle}_attachments_${Date.now()}.zip`;
    const zipFilePath = path.join(tempDir, zipFileName);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('打包错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: '打包失败' });
      }
    });

    archive.pipe(res);

    const nameCount = {};
    let fileCount = 0;
    for (const att of attachments) {
      if (!fs.existsSync(att.file_path)) {
        continue;
      }

      let entryName = att.original_name;
      if (nameCount[entryName]) {
        nameCount[entryName]++;
        const ext = path.extname(entryName);
        const baseName = path.basename(entryName, ext);
        entryName = `${baseName}_${nameCount[entryName]}${ext}`;
      } else {
        nameCount[entryName] = 1;
      }

      archive.file(att.file_path, { name: entryName });
      fileCount++;
    }

    if (fileCount === 0) {
      archive.abort();
      if (!res.headersSent) {
        return res.status(404).json({ success: false, message: '没有可下载的文件' });
      }
      return;
    }

    logOperation(req, '批量下载', '附件', null, `申报ID: ${declarationId}, 打包下载 ${fileCount} 个附件`);

    archive.finalize();
  } catch (error) {
    console.error('批量下载失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

router.put('/:id/material-type', (req, res) => {
  try {
    const { material_type_id } = req.body;

    const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    const declaration = get('SELECT status FROM declarations WHERE id = ?', [attachment.declaration_id]);
    if (declaration && declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能修改草稿状态申报的附件' });
    }

    if (material_type_id !== null && material_type_id !== undefined) {
      const mt = get('SELECT id FROM material_types WHERE id = ?', [material_type_id]);
      if (!mt) {
        return res.status(404).json({ success: false, message: '材料类型不存在' });
      }
    }

    run('UPDATE attachments SET material_type_id = ? WHERE id = ?', [
      material_type_id || null,
      req.params.id
    ]);

    logOperation(req, '修改材料类型', '附件', req.params.id,
      `设置材料类型: ${material_type_id || '未分类'}`);

    res.json({ success: true, message: '更新成功' });
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

    const declaration = get('SELECT status FROM declarations WHERE id = ?', [attachment.declaration_id]);
    if (declaration && declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能删除草稿状态申报的附件' });
    }

    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    run('DELETE FROM attachments WHERE id = ?', [req.params.id]);

    logOperation(req, '删除', '附件', req.params.id, `删除附件: ${attachment.original_name}`);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
