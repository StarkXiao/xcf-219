const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');

function saveOrUpdateEnterpriseProfile(companyName, applicant, phone, email) {
  if (!companyName || !companyName.trim()) return null;

  try {
    const existing = get('SELECT * FROM enterprise_profiles WHERE company_name = ?', [companyName.trim()]);
    
    if (existing) {
      run(`
        UPDATE enterprise_profiles 
        SET applicant = COALESCE(?, applicant),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [applicant || null, phone || null, email || null, existing.id]);
      return get('SELECT * FROM enterprise_profiles WHERE id = ?', [existing.id]);
    } else {
      const result = run(`
        INSERT INTO enterprise_profiles (company_name, applicant, phone, email)
        VALUES (?, ?, ?, ?)
      `, [companyName.trim(), applicant || '', phone || '', email || '']);
      return get('SELECT * FROM enterprise_profiles WHERE id = ?', [result.lastID]);
    }
  } catch (error) {
    console.error('保存企业信息失败:', error);
    return null;
  }
}

function updateEnterpriseProfileInfo(companyName, applicant, phone, email) {
  return saveOrUpdateEnterpriseProfile(companyName, applicant, phone, email);
}

router.get('/', (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 20 } = req.query;
    let countSql = 'SELECT COUNT(*) as total FROM enterprise_profiles WHERE 1=1';
    let sql = 'SELECT * FROM enterprise_profiles WHERE 1=1';
    const params = [];
    const countParams = [];

    if (keyword) {
      sql += ' AND (company_name LIKE ? OR applicant LIKE ?)';
      countSql += ' AND (company_name LIKE ? OR applicant LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const profiles = all(sql, params);
    const totalResult = get(countSql, countParams);

    res.json({
      success: true,
      data: {
        list: profiles,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  router,
  saveOrUpdateEnterpriseProfile,
  updateEnterpriseProfileInfo
};
