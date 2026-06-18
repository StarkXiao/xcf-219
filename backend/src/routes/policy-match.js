const express = require('express');
const router = express.Router();
const { get, all, run } = require('../models/database');
const { logOperation, logOperationWithData } = require('../middleware/logger');

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

function calculateMatchScore(guideline, params) {
  let score = 0;
  const details = [];

  if (params.project_title || params.project_content) {
    const text = (params.project_title || '') + ' ' + (params.project_content || '');
    const keywordMatchScore = calculateKeywordMatch(guideline, text);
    score += keywordMatchScore.score;
    details.push(...keywordMatchScore.details);
  }

  if (params.employee_count !== undefined && params.employee_count !== null) {
    const empScore = calculateEmployeeMatch(guideline, params.employee_count);
    score += empScore.score;
    details.push(empScore.detail);
  }

  if (params.tech_person_ratio !== undefined && params.tech_person_ratio !== null) {
    const techScore = calculateTechRatioMatch(guideline, params.tech_person_ratio);
    score += techScore.score;
    details.push(techScore.detail);
  }

  if (params.rd_ratio !== undefined && params.rd_ratio !== null) {
    const rdScore = calculateRdRatioMatch(guideline, params.rd_ratio);
    score += rdScore.score;
    details.push(rdScore.detail);
  }

  if (params.ip_count !== undefined && params.ip_count !== null) {
    const ipScore = calculateIpMatch(guideline, params.ip_count);
    score += ipScore.score;
    details.push(ipScore.detail);
  }

  if (params.registered_years !== undefined && params.registered_years !== null) {
    const regScore = calculateRegisteredYearsMatch(guideline, params.registered_years);
    score += regScore.score;
    details.push(regScore.detail);
  }

  if (params.company_name) {
    const historyScore = calculateHistoryMatch(guideline, params.company_name);
    score += historyScore.score;
    details.push(historyScore.detail);
  }

  const normalizedScore = Math.min(100, Math.max(0, score));

  return {
    score: Math.round(normalizedScore * 10) / 10,
    details: details.filter(d => d),
    level: getMatchLevel(normalizedScore)
  };
}

function calculateKeywordMatch(guideline, text) {
  let score = 0;
  const details = [];
  const lowerText = text.toLowerCase();

  const keywords = guideline.keywords ? guideline.keywords.split(/[,，、]/).map(k => k.trim().toLowerCase()).filter(k => k) : [];
  
  let matchedKeywords = [];
  keywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  });

  if (keywords.length > 0) {
    const matchRatio = matchedKeywords.length / keywords.length;
    score = matchRatio * 30;
    if (matchedKeywords.length > 0) {
      details.push({
        type: 'keyword',
        label: '关键词匹配',
        score: Math.round(score * 10) / 10,
        max_score: 30,
        description: `匹配关键词 ${matchedKeywords.length}/${keywords.length} 个：${matchedKeywords.join('、')}`
      });
    }
  }

  if (guideline.category && lowerText.includes(guideline.category.toLowerCase())) {
    score += 5;
    details.push({
      type: 'category',
      label: '分类匹配',
      score: 5,
      max_score: 5,
      description: `项目类型与"${guideline.category}"分类匹配`
    });
  }

  if (guideline.industry && lowerText.includes(guideline.industry.toLowerCase())) {
    score += 5;
    details.push({
      type: 'industry',
      label: '行业匹配',
      score: 5,
      max_score: 5,
      description: `所属行业与"${guideline.industry}"匹配`
    });
  }

  return { score, details };
}

function calculateEmployeeMatch(guideline, employeeCount) {
  let score = 0;
  let detail = null;

  const min = guideline.min_employee_count || 0;
  const max = guideline.max_employee_count || 100000;

  if (employeeCount >= min && employeeCount <= max) {
    score = 15;
    detail = {
      type: 'employee',
      label: '人员规模匹配',
      score: 15,
      max_score: 15,
      description: `企业人员 ${employeeCount} 人，符合要求范围 (${min}-${max}人)`
    };
  } else if (employeeCount < min) {
    const diff = min - employeeCount;
    score = Math.max(0, 15 - diff * 0.5);
    detail = {
      type: 'employee',
      label: '人员规模匹配',
      score: Math.round(score * 10) / 10,
      max_score: 15,
      description: `企业人员 ${employeeCount} 人，略低于最低要求 ${min} 人`
    };
  } else {
    const diff = employeeCount - max;
    const penalty = Math.min(15, diff / max * 15);
    score = Math.max(0, 15 - penalty);
    detail = {
      type: 'employee',
      label: '人员规模匹配',
      score: Math.round(score * 10) / 10,
      max_score: 15,
      description: `企业人员 ${employeeCount} 人，超出上限 ${max} 人`
    };
  }

  return { score, detail };
}

function calculateTechRatioMatch(guideline, techRatio) {
  let score = 0;
  let detail = null;

  const minRatio = guideline.min_tech_ratio || 0;

  if (minRatio === 0) {
    score = techRatio > 0 ? 10 : 0;
    if (techRatio > 0) {
      detail = {
        type: 'tech_ratio',
        label: '科技人员占比',
        score: 10,
        max_score: 10,
        description: `科技人员占比 ${techRatio}%`
      };
    }
  } else if (techRatio >= minRatio) {
    score = 15;
    detail = {
      type: 'tech_ratio',
      label: '科技人员占比',
      score: 15,
      max_score: 15,
      description: `科技人员占比 ${techRatio}%，满足要求 (≥${minRatio}%)`
    };
  } else {
    const ratio = techRatio / minRatio;
    score = Math.round(ratio * 15 * 10) / 10;
    detail = {
      type: 'tech_ratio',
      label: '科技人员占比',
      score,
      max_score: 15,
      description: `科技人员占比 ${techRatio}%，低于要求 ${minRatio}%`
    };
  }

  return { score, detail };
}

function calculateRdRatioMatch(guideline, rdRatio) {
  let score = 0;
  let detail = null;

  const minRatio = guideline.min_rd_ratio || 0;

  if (minRatio === 0) {
    score = rdRatio > 0 ? 10 : 0;
    if (rdRatio > 0) {
      detail = {
        type: 'rd_ratio',
        label: '研发投入占比',
        score: 10,
        max_score: 10,
        description: `研发投入占比 ${rdRatio}%`
      };
    }
  } else if (rdRatio >= minRatio) {
    score = 15;
    detail = {
      type: 'rd_ratio',
      label: '研发投入占比',
      score: 15,
      max_score: 15,
      description: `研发投入占比 ${rdRatio}%，满足要求 (≥${minRatio}%)`
    };
  } else {
    const ratio = rdRatio / minRatio;
    score = Math.round(ratio * 15 * 10) / 10;
    detail = {
      type: 'rd_ratio',
      label: '研发投入占比',
      score,
      max_score: 15,
      description: `研发投入占比 ${rdRatio}%，低于要求 ${minRatio}%`
    };
  }

  return { score, detail };
}

function calculateIpMatch(guideline, ipCount) {
  let score = 0;
  let detail = null;

  if (guideline.requires_ip) {
    if (ipCount > 0) {
      score = 10;
      detail = {
        type: 'ip',
        label: '知识产权',
        score: 10,
        max_score: 10,
        description: `拥有 ${ipCount} 项知识产权，满足要求`
      };
    } else {
      score = 0;
      detail = {
        type: 'ip',
        label: '知识产权',
        score: 0,
        max_score: 10,
        description: '暂无知识产权，建议补充后申报'
      };
    }
  } else if (ipCount > 0) {
    score = 5;
    detail = {
      type: 'ip',
      label: '知识产权',
      score: 5,
      max_score: 5,
      description: `拥有 ${ipCount} 项知识产权，可作为加分项`
    };
  }

  return { score, detail };
}

function calculateRegisteredYearsMatch(guideline, registeredYears) {
  let score = 0;
  let detail = null;

  const minYears = guideline.min_registered_years || 0;

  if (minYears === 0) {
    score = 5;
    detail = {
      type: 'registered_years',
      label: '注册年限',
      score: 5,
      max_score: 5,
      description: '无注册年限要求'
    };
  } else if (registeredYears >= minYears) {
    score = 10;
    detail = {
      type: 'registered_years',
      label: '注册年限',
      score: 10,
      max_score: 10,
      description: `注册 ${registeredYears} 年，满足要求 (≥${minYears}年)`
    };
  } else {
    const ratio = registeredYears / minYears;
    score = Math.round(ratio * 10 * 10) / 10;
    detail = {
      type: 'registered_years',
      label: '注册年限',
      score,
      max_score: 10,
      description: `注册 ${registeredYears} 年，低于要求 ${minYears} 年`
    };
  }

  return { score, detail };
}

function calculateHistoryMatch(guideline, companyName) {
  let score = 0;
  let detail = null;

  const history = all(`
    SELECT status FROM declarations 
    WHERE company = ? AND guideline_id = ? AND is_deleted = 0
  `, [companyName, guideline.id]);

  if (history.length > 0) {
    const approvedCount = history.filter(h => h.status === 'approved').length;
    const approvalRate = history.length > 0 ? (approvedCount / history.length) * 100 : 0;

    if (approvalRate >= 50) {
      score = 10;
    } else if (approvalRate > 0) {
      score = 5;
    } else {
      score = 2;
    }

    detail = {
      type: 'history',
      label: '历史申报记录',
      score,
      max_score: 10,
      description: `该企业在此指南下共申报 ${history.length} 次，立项 ${approvedCount} 次，通过率 ${Math.round(approvalRate)}%`
    };
  }

  return { score, detail };
}

function getMatchLevel(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'low';
}

router.post('/recommend', (req, res) => {
  try {
    const { 
      company_name, 
      applicant, 
      project_title, 
      project_content, 
      employee_count, 
      tech_person_ratio,
      rd_ratio,
      ip_count,
      registered_years,
      industry,
      top_n = 5,
      match_source = 'manual',
      match_context
    } = req.body;

    const guidelines = all('SELECT * FROM guidelines WHERE 1=1');

    const results = guidelines.map(guideline => {
      const matchResult = calculateMatchScore(guideline, {
        project_title,
        project_content,
        employee_count,
        tech_person_ratio,
        rd_ratio,
        ip_count,
        registered_years,
        company_name
      });

      const tags = all('SELECT * FROM guideline_tags WHERE guideline_id = ? ORDER BY sort_order', [guideline.id]);

      const materialCount = get('SELECT COUNT(*) as count FROM material_types WHERE guideline_id = ? OR guideline_id IS NULL', [guideline.id]).count;

      const historyStats = get(`
        SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
          SUM(CASE WHEN status NOT IN ('draft', 'rejected') AND status != 'approved' THEN 1 ELSE 0 END) as pending_count
        FROM declarations 
        WHERE guideline_id = ? AND is_deleted = 0
      `, [guideline.id]);

      const approvalRate = historyStats.total_count > 0 
        ? Math.round((historyStats.approved_count / historyStats.total_count) * 100) 
        : 0;

      return {
        guideline_id: guideline.id,
        title: guideline.title,
        category: guideline.category,
        deadline: guideline.deadline,
        industry: guideline.industry,
        score: matchResult.score,
        match_level: matchResult.level,
        match_details: matchResult.details,
        tags,
        material_count: materialCount,
        history_stats: {
          total_count: historyStats.total_count,
          approved_count: historyStats.approved_count,
          pending_count: historyStats.pending_count,
          approval_rate: approvalRate
        },
        days_remaining: guideline.deadline ? calculateDaysRemaining(guideline.deadline) : null
      };
    });

    results.sort((a, b) => b.score - a.score);

    const topResults = results.slice(0, top_n);

    const matchRecordId = saveMatchRecord({
      company_name,
      applicant,
      project_title,
      project_content,
      industry,
      employee_count,
      tech_person_ratio,
      rd_ratio,
      ip_count,
      match_results: topResults,
      top_match_guideline_id: topResults.length > 0 ? topResults[0].guideline_id : null,
      top_match_score: topResults.length > 0 ? topResults[0].score : 0,
      match_source,
      match_context,
      user: getCurrentUser(req)
    });

    updateMatchStats(topResults);

    logOperation(req, '政策匹配推荐', '政策匹配', matchRecordId, 
      `匹配 ${results.length} 条政策指南，最高匹配度 ${topResults.length > 0 ? topResults[0].score : 0}分`);

    res.json({
      success: true,
      data: {
        match_id: matchRecordId,
        total: results.length,
        results: topResults,
        best_match: topResults.length > 0 ? topResults[0] : null
      }
    });
  } catch (error) {
    console.error('推荐计算错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

function calculateDaysRemaining(deadline) {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffTime = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function saveMatchRecord(params) {
  const result = run(`
    INSERT INTO policy_match_records 
    (company_name, applicant, project_title, project_content, industry, employee_count, 
     tech_person_ratio, rd_ratio, ip_count, match_results, top_match_guideline_id, 
     top_match_score, match_source, match_context, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    params.company_name || null,
    params.applicant || null,
    params.project_title || null,
    params.project_content || null,
    params.industry || null,
    params.employee_count !== undefined ? params.employee_count : null,
    params.tech_person_ratio !== undefined ? params.tech_person_ratio : null,
    params.rd_ratio !== undefined ? params.rd_ratio : null,
    params.ip_count !== undefined ? params.ip_count : null,
    JSON.stringify(params.match_results || []),
    params.top_match_guideline_id || null,
    params.top_match_score || 0,
    params.match_source || 'manual',
    params.match_context || null,
    params.user || 'anonymous'
  ]);
  return result.lastID;
}

function updateMatchStats(results) {
  results.forEach(result => {
    const existing = get('SELECT * FROM policy_match_stats WHERE guideline_id = ?', [result.guideline_id]);
    
    if (existing) {
      const newMatchCount = existing.match_count + 1;
      const newTotalScore = existing.total_score + result.score;
      const newAvgScore = newTotalScore / newMatchCount;
      
      run(`
        UPDATE policy_match_stats 
        SET match_count = ?, total_score = ?, avg_score = ?, last_match_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newMatchCount, newTotalScore, newAvgScore, existing.id]);
    } else {
      run(`
        INSERT INTO policy_match_stats (guideline_id, match_count, total_score, avg_score, last_match_at)
        VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
      `, [result.guideline_id, result.score, result.score]);
    }
  });
}

router.post('/select', (req, res) => {
  try {
    const { match_id, guideline_id } = req.body;
    const user = getCurrentUser(req);

    if (!match_id || !guideline_id) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const matchRecord = get('SELECT * FROM policy_match_records WHERE id = ?', [match_id]);
    if (!matchRecord) {
      return res.status(404).json({ success: false, message: '匹配记录不存在' });
    }

    run(`
      UPDATE policy_match_records 
      SET user_selected_guideline_id = ?
      WHERE id = ?
    `, [guideline_id, match_id]);

    const statRecord = get('SELECT * FROM policy_match_stats WHERE guideline_id = ?', [guideline_id]);
    if (statRecord) {
      run(`
        UPDATE policy_match_stats 
        SET selected_count = selected_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [statRecord.id]);
    } else {
      run(`
        INSERT INTO policy_match_stats (guideline_id, selected_count, match_count, avg_score)
        VALUES (?, 1, 0, 0)
      `, [guideline_id]);
    }

    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [guideline_id]);
    logOperation(req, '选择推荐政策', '政策匹配', match_id, 
      `从推荐结果中选择: ${guideline?.title || guideline_id}`);

    res.json({ success: true, message: '记录选择成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/match-records', (req, res) => {
  try {
    const { page = 1, pageSize = 20, company_name, guideline_id } = req.query;
    let countSql = 'SELECT COUNT(*) as total FROM policy_match_records WHERE 1=1';
    let sql = 'SELECT * FROM policy_match_records WHERE 1=1';
    const params = [];
    const countParams = [];

    if (company_name) {
      sql += ' AND company_name LIKE ?';
      countSql += ' AND company_name LIKE ?';
      params.push(`%${company_name}%`);
      countParams.push(`%${company_name}%`);
    }

    if (guideline_id) {
      sql += ' AND top_match_guideline_id = ?';
      countSql += ' AND top_match_guideline_id = ?';
      params.push(guideline_id);
      countParams.push(guideline_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), parseInt(offset));

    const records = all(sql, params);
    const totalResult = get(countSql, countParams);

    const parsedRecords = records.map(r => ({
      ...r,
      match_results: r.match_results ? JSON.parse(r.match_results) : []
    }));

    res.json({
      success: true,
      data: {
        list: parsedRecords,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/match-records/:id', (req, res) => {
  try {
    const record = get('SELECT * FROM policy_match_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ success: false, message: '匹配记录不存在' });
    }

    record.match_results = record.match_results ? JSON.parse(record.match_results) : [];

    if (record.top_match_guideline_id) {
      const guideline = get('SELECT * FROM guidelines WHERE id = ?', [record.top_match_guideline_id]);
      record.top_match_guideline = guideline;
    }

    if (record.user_selected_guideline_id) {
      const selected = get('SELECT * FROM guidelines WHERE id = ?', [record.user_selected_guideline_id]);
      record.selected_guideline = selected;
    }

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = {};

    stats.total_matches = get('SELECT COUNT(*) as count FROM policy_match_records').count;
    stats.total_selections = get('SELECT COUNT(*) as count FROM policy_match_records WHERE user_selected_guideline_id IS NOT NULL').count;
    
    const todayMatches = get(`
      SELECT COUNT(*) as count FROM policy_match_records 
      WHERE DATE(created_at) = DATE('now')
    `).count;
    stats.today_matches = todayMatches;

    const topGuidelines = all(`
      SELECT 
        pms.*,
        g.title,
        g.category,
        g.deadline
      FROM policy_match_stats pms
      LEFT JOIN guidelines g ON pms.guideline_id = g.id
      ORDER BY pms.match_count DESC
      LIMIT 10
    `);
    stats.top_guidelines = topGuidelines;

    const categoryStats = all(`
      SELECT 
        g.category,
        COUNT(*) as match_count,
        SUM(CASE WHEN pmr.user_selected_guideline_id IS NOT NULL THEN 1 ELSE 0 END) as select_count
      FROM policy_match_records pmr
      LEFT JOIN guidelines g ON pmr.top_match_guideline_id = g.id
      WHERE g.category IS NOT NULL
      GROUP BY g.category
      ORDER BY match_count DESC
    `);
    stats.category_stats = categoryStats;

    const avgScore = get('SELECT AVG(top_match_score) as avg FROM policy_match_records').avg;
    stats.avg_top_score = avgScore ? Math.round(avgScore * 10) / 10 : 0;

    const scoreDistribution = all(`
      SELECT 
        CASE 
          WHEN top_match_score >= 80 THEN '优秀(80-100)'
          WHEN top_match_score >= 60 THEN '良好(60-79)'
          WHEN top_match_score >= 40 THEN '一般(40-59)'
          ELSE '较低(0-39)'
        END as score_range,
        COUNT(*) as count
      FROM policy_match_records
      GROUP BY score_range
      ORDER BY MIN(top_match_score) DESC
    `);
    stats.score_distribution = scoreDistribution;

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recommend-materials/:guideline_id', (req, res) => {
  try {
    const { guideline_id } = req.params;

    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [guideline_id]);
    if (!guideline) {
      return res.status(404).json({ success: false, message: '指南不存在' });
    }

    const materialTypes = all(`
      SELECT * FROM material_types 
      WHERE guideline_id = ? OR guideline_id IS NULL
      ORDER BY 
        CASE WHEN guideline_id IS NULL THEN 1 ELSE 0 END,
        sort_order ASC
    `, [guideline_id]);

    const categoryReq = getCategoryRequirements(guideline.category);
    
    const recommendedMaterials = materialTypes.map(mt => ({
      ...mt,
      is_category_required: categoryReq.requiredMaterials.includes(mt.code),
      recommendation_reason: getMaterialRecommendation(mt, guideline.category)
    }));

    const requiredCount = recommendedMaterials.filter(m => m.required || m.is_category_required).length;

    logOperation(req, '获取推荐材料清单', '政策匹配', guideline_id, 
      `获取指南: ${guideline.title} 的推荐材料清单，共 ${recommendedMaterials.length} 项，必需 ${requiredCount} 项`);

    res.json({
      success: true,
      data: {
        guideline: {
          id: guideline.id,
          title: guideline.title,
          category: guideline.category
        },
        materials: recommendedMaterials,
        stats: {
          total: recommendedMaterials.length,
          required: requiredCount,
          optional: recommendedMaterials.length - requiredCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function getCategoryRequirements(category) {
  const requirements = {
    '科技项目': {
      requiredMaterials: ['business_license', 'project_application', 'ip_cert'],
      description: '科技项目类申报需提供详细的技术方案和知识产权证明'
    },
    '企业发展': {
      requiredMaterials: ['business_license', 'financial_statement'],
      description: '企业发展类申报需提供财务报表证明企业经营状况'
    },
    '资质认定': {
      requiredMaterials: ['business_license', 'legal_id_card', 'ip_cert', 'honor_qualification'],
      description: '资质认定类申报需提供完整的企业资质和荣誉证明'
    },
    '其他': {
      requiredMaterials: ['business_license'],
      description: '其他类申报需提供基础的企业证明材料'
    }
  };
  return requirements[category] || requirements['其他'];
}

function getMaterialRecommendation(material, category) {
  const reasons = {
    business_license: '企业基本身份证明材料，所有申报均需提供',
    legal_id_card: '法定代表人身份证明',
    project_application: '项目申报核心材料，需详细描述项目内容',
    financial_statement: '证明企业经营状况和财务能力',
    ip_cert: '知识产权证明，体现企业技术实力',
    honor_qualification: '企业荣誉和资质证明，提升申报竞争力',
    org_code_cert: '组织机构代码证（如已三证合一可不提供）',
    tax_reg_cert: '税务登记证（如已三证合一可不提供）',
    other_materials: '其他补充证明材料'
  };
  return reasons[material.code] || '根据申报指南要求准备';
}

router.post('/quick-create-declaration', (req, res) => {
  try {
    const { 
      match_id, 
      guideline_id, 
      title, 
      applicant, 
      company, 
      phone, 
      email, 
      content 
    } = req.body;

    const user = getCurrentUser(req);

    if (!guideline_id) {
      return res.status(400).json({ success: false, message: '请选择申报指南' });
    }

    const guideline = get('SELECT * FROM guidelines WHERE id = ?', [guideline_id]);
    if (!guideline) {
      return res.status(404).json({ success: false, message: '申报指南不存在' });
    }

    const declarationTitle = title || `${guideline.title} - ${company || '新申报'}`;

    const result = run(`
      INSERT INTO declarations (title, guideline_id, applicant, company, phone, email, content, status, current_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0)
    `, [
      declarationTitle,
      guideline_id,
      applicant || '',
      company || '',
      phone || '',
      email || '',
      content || ''
    ]);

    const newDeclaration = get('SELECT * FROM declarations WHERE id = ?', [result.lastID]);

    if (match_id) {
      run(`
        UPDATE policy_match_records 
        SET user_selected_guideline_id = ?
        WHERE id = ?
      `, [guideline_id, match_id]);

      const statRecord = get('SELECT * FROM policy_match_stats WHERE guideline_id = ?', [guideline_id]);
      if (statRecord) {
        run(`
          UPDATE policy_match_stats 
          SET selected_count = selected_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [statRecord.id]);
      }
    }

    logOperation(req, '快速创建申报', '政策匹配', result.lastID,
      `基于政策匹配推荐创建申报: ${declarationTitle}`);

    res.json({
      success: true,
      message: '创建成功',
      data: {
        id: result.lastID,
        title: declarationTitle,
        status: 'draft',
        guideline_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
