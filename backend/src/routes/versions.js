const express = require('express');
const { get, run } = require('../models/database');

const router = express.Router();

const SAVE_TYPES = {
  AUTO: 'auto',
  MANUAL: 'manual',
  SUBMIT: 'submit',
  STATUS_CHANGE: 'status_change',
  ROLLBACK: 'rollback',
  RESTORE: 'restore'
};

function saveVersion(configId, declarationId, declaration, saveType, user, summary) {
  try {
    const versionCount = get(
      'SELECT COUNT(*) as count FROM declaration_versions WHERE declaration_id = ?',
      [declarationId]
    );
    const versionNumber = versionCount.count + 1;

    const result = run(`
      INSERT INTO declaration_versions 
      (declaration_id, version_number, title, guideline_id, applicant, company, phone, email, 
       content, status, current_step, save_type, change_summary, created_by, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      declarationId,
      versionNumber,
      declaration.title,
      declaration.guideline_id || null,
      declaration.applicant,
      declaration.company,
      declaration.phone || '',
      declaration.email || '',
      declaration.content || '',
      declaration.status,
      declaration.current_step || 0,
      saveType,
      summary || '',
      user || null,
      JSON.stringify(declaration)
    ]);

    run(`
      UPDATE declarations 
      SET version_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [versionNumber, declarationId]);

    return {
      id: result.lastID,
      version_number: versionNumber
    };
  } catch (error) {
    console.error('保存版本失败:', error);
    return { id: null, version_number: 0 };
  }
}

module.exports = {
  router,
  saveVersion,
  SAVE_TYPES
};
