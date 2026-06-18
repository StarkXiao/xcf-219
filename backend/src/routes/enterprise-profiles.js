const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation } = require('../middleware/logger');

function saveOrUpdateEnterpriseProfile(company, applicant, phone, email) {
  if (!company || !company.trim()) return null;

  const companyName = company.trim();
  const existing = get('SELECT * FROM enterprise_profiles WHERE company_name = ?', [companyName]);

  if (existing) {
    const updatedApplicant = applicant || existing.applicant;
    const updatedPhone = phone || existing.phone;
    const updatedEmail = email || existing.email;

    run(`
      UPDATE enterprise_profiles 
      SET applicant = ?, phone = ?, email = ?, 
          declaration_count = declaration_count + 1,
          last_declaration_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updatedApplicant, updatedPhone, updatedEmail, existing.id]);

    return get('SELECT * FROM enterprise_profiles WHERE id = ?', [existing.id]);
  } else {
    const result = run(`
      INSERT INTO enterprise_profiles (company_name, applicant, phone, email, declaration_count, last_declaration_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `, [companyName, applicant || '', phone || '', email || '']);

    return get('SELECT * FROM enterprise_profiles WHERE id = ?', [result.lastID]);
  }
}

function updateEnterpriseProfileInfo(company, applicant, phone, email) {
  if (!company || !company.trim()) return null;

  const companyName = company.trim();
  const existing = get('SELECT * FROM enterprise_profiles WHERE company_name = ?', [companyName]);

  if (existing) {
    const hasChanges = 
      (applicant && applicant !== existing.applicant) ||
      (phone && phone !== existing.phone) ||
      (email && email !== existing.email);

    if (!hasChanges) return existing;

    const updatedApplicant = applicant !== undefined ? applicant : existing.applicant;
    const updatedPhone = phone !== undefined ? phone : existing.phone;
    const updatedEmail = email !== undefined ? email : existing.email;

    run(`
      UPDATE enterprise_profiles 
      SET applicant = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updatedApplicant, updatedPhone, updatedEmail, existing.id]);

    return get('SELECT * FROM enterprise_profiles WHERE id = ?', [existing.id]);
  }
  return null;
}

router.get('/search', (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;
    
    if (!keyword || !keyword.trim()) {
      return res.json({ success: true, data: [] });
    }

    const searchKeyword = `%${keyword.trim()}%`;
    const enterprises = all(`
      SELECT id, company_name, applicant, phone, email, declaration_count, last_declaration_at
      FROM enterprise_profiles 
      WHERE company_name LIKE ? OR applicant LIKE ?
      ORDER BY declaration_count DESC, last_declaration_at DESC
      LIMIT ?
    `, [searchKeyword, searchKeyword, parseInt(limit)]);

    logOperation(req, '搜索企业信息', '企业信息', null, `关键词: ${keyword}`);

    res.json({ success: true, data: enterprises });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const enterprise = get('SELECT * FROM enterprise_profiles WHERE id = ?', [req.params.id]);
    
    if (!enterprise) {
      return res.status(404).json({ success: false, message: '企业信息不存在' });
    }

    const recentDeclarations = all(`
      SELECT id, title, status, created_at
      FROM declarations 
      WHERE company = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT 5
    `, [enterprise.company_name]);

    enterprise.recent_declarations = recentDeclarations;

    logOperation(req, '查看企业详情', '企业信息', req.params.id, `企业: ${enterprise.company_name}`);

    res.json({ success: true, data: enterprise });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/by-name/:name', (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.name);
    const enterprise = get('SELECT * FROM enterprise_profiles WHERE company_name = ?', [companyName]);
    
    if (!enterprise) {
      return res.json({ success: true, data: null });
    }

    logOperation(req, '查询企业信息', '企业信息', null, `企业: ${companyName}`);

    res.json({ success: true, data: enterprise });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { company_name, applicant, phone, email, address, business_scope, contact_person } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: '企业名称不能为空' });
    }

    const existing = get('SELECT * FROM enterprise_profiles WHERE company_name = ?', [company_name.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: '该企业信息已存在' });
    }

    const result = run(`
      INSERT INTO enterprise_profiles (company_name, applicant, phone, email, address, business_scope, contact_person)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      company_name.trim(),
      applicant || '',
      phone || '',
      email || '',
      address || '',
      business_scope || '',
      contact_person || ''
    ]);

    const newEnterprise = get('SELECT * FROM enterprise_profiles WHERE id = ?', [result.lastID]);

    logOperation(req, '创建企业信息', '企业信息', result.lastID, `企业: ${company_name}`);

    res.json({ success: true, data: newEnterprise });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { company_name, applicant, phone, email, address, business_scope, contact_person } = req.body;
    const existing = get('SELECT * FROM enterprise_profiles WHERE id = ?', [req.params.id]);

    if (!existing) {
      return res.status(404).json({ success: false, message: '企业信息不存在' });
    }

    const updateData = {
      company_name: company_name !== undefined ? company_name.trim() : existing.company_name,
      applicant: applicant !== undefined ? applicant : existing.applicant,
      phone: phone !== undefined ? phone : existing.phone,
      email: email !== undefined ? email : existing.email,
      address: address !== undefined ? address : existing.address,
      business_scope: business_scope !== undefined ? business_scope : existing.business_scope,
      contact_person: contact_person !== undefined ? contact_person : existing.contact_person
    };

    run(`
      UPDATE enterprise_profiles 
      SET company_name = ?, applicant = ?, phone = ?, email = ?, 
          address = ?, business_scope = ?, contact_person = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updateData.company_name,
      updateData.applicant,
      updateData.phone,
      updateData.email,
      updateData.address,
      updateData.business_scope,
      updateData.contact_person,
      req.params.id
    ]);

    const updated = get('SELECT * FROM enterprise_profiles WHERE id = ?', [req.params.id]);

    logOperation(req, '更新企业信息', '企业信息', req.params.id, `企业: ${updateData.company_name}`);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, saveOrUpdateEnterpriseProfile, updateEnterpriseProfileInfo };
