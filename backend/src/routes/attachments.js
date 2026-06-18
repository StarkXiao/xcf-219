const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|zip|rar/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

router.get('/declaration/:declarationId', (req, res) => {
  try {
    const attachments = all(`
      SELECT * FROM attachments 
      WHERE declaration_id = ? 
      ORDER BY uploaded_at DESC
    `, [req.params.declarationId]);

    res.json({ success: true, data: attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/declaration/:declarationId', upload.array('files', 10), (req, res) => {
  try {
    const declarationId = req.params.declarationId;
    
    const declaration = get('SELECT * FROM declarations WHERE id = ?', [declarationId]);
    if (!declaration) {
      return res.status(404).json({ success: false, message: '申报不存在' });
    }

    if (declaration.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能上传草稿状态申报的附件' });
    }

    const attachments = [];
    
    for (const file of req.files) {
      const result = run(`
        INSERT INTO attachments (declaration_id, filename, original_name, file_path, file_size, file_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        declarationId,
        file.filename,
        file.originalname,
        file.path,
        file.size,
        file.mimetype
      ]);
      attachments.push({
        id: result.lastID,
        filename: file.filename,
        original_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype
      });
    }

    logOperation(req, '上传', '附件', null, `申报ID: ${declarationId}, 上传 ${req.files.length} 个附件`);

    res.json({ 
      success: true, 
      data: attachments,
      message: `成功上传 ${req.files.length} 个文件` 
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
