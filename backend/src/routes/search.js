const express = require('express');
const router = express.Router();
const { get, all } = require('../models/database');

const SEARCH_MODULES = {
  guidelines: {
    name: '申报指南',
    table: 'guidelines',
    searchFields: ['title', 'content', 'category'],
    titleField: 'title',
    contentField: 'content',
    extraFields: ['id', 'category', 'deadline', 'created_at'],
    routePath: '/guidelines'
  },
  declarations: {
    name: '申报单',
    table: 'declarations',
    searchFields: ['title', 'content', 'applicant', 'company'],
    titleField: 'title',
    contentField: 'content',
    extraFields: ['id', 'applicant', 'company', 'status', 'created_at'],
    routePath: '/declarations',
    filter: 'is_deleted = 0'
  },
  attachments: {
    name: '附件',
    table: 'attachments',
    searchFields: ['original_name', 'file_type'],
    titleField: 'original_name',
    contentField: 'file_type',
    extraFields: ['id', 'declaration_id', 'file_size', 'uploaded_at'],
    routePath: '/declarations'
  },
  approval_records: {
    name: '审批意见',
    table: 'approval_records',
    searchFields: ['comment', 'approver', 'step_name'],
    titleField: 'step_name',
    contentField: 'comment',
    extraFields: ['id', 'declaration_id', 'approver', 'action', 'created_at'],
    routePath: '/declarations'
  },
  operation_logs: {
    name: '操作日志',
    table: 'operation_logs',
    searchFields: ['detail', 'action', 'module', 'user'],
    titleField: 'action',
    contentField: 'detail',
    extraFields: ['id', 'module', 'user', 'target_id', 'created_at'],
    routePath: '/logs'
  }
};

function highlightText(text, keyword, maxLength = 200) {
  if (!text) return '';
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  
  let snippet = text;
  if (text.length > maxLength) {
    if (index >= 0) {
      const start = Math.max(0, index - Math.floor(maxLength / 3));
      const end = Math.min(text.length, start + maxLength);
      snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
    } else {
      snippet = text.slice(0, maxLength) + '...';
    }
  }
  
  return snippet;
}

function searchModule(moduleKey, keyword, limit = 20) {
  const module = SEARCH_MODULES[moduleKey];
  if (!module) return [];

  const params = [];
  const conditions = module.searchFields.map(field => {
    params.push(`%${keyword}%`);
    return `${field} LIKE ?`;
  });

  let whereClause = conditions.join(' OR ');
  if (module.filter) {
    whereClause = `(${module.filter}) AND (${whereClause})`;
  }

  const fields = [...module.extraFields, module.titleField, module.contentField].join(', ');
  const sql = `SELECT ${fields} FROM ${module.table} WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  try {
    const results = all(sql, params);
    return results.map(item => {
      const title = item[module.titleField] || '';
      const content = item[module.contentField] || '';
      
      return {
        id: item.id,
        module: moduleKey,
        module_name: module.name,
        title: title,
        snippet: highlightText(content, keyword),
        route_path: module.routePath,
        target_id: moduleKey === 'declarations' || moduleKey === 'guidelines' 
          ? item.id 
          : (item.declaration_id || item.target_id),
        created_at: item.created_at || null,
        extra: {
          ...item,
          id: undefined,
          [module.titleField]: undefined,
          [module.contentField]: undefined
        }
      };
    });
  } catch (error) {
    console.error(`搜索 ${moduleKey} 失败:`, error);
    return [];
  }
}

router.get('/', (req, res) => {
  try {
    const { keyword, modules, limit = 20 } = req.query;

    if (!keyword || !keyword.trim()) {
      return res.json({
        success: true,
        data: {
          results: [],
          total: 0,
          by_module: {}
        }
      });
    }

    const trimmedKeyword = keyword.trim();
    const moduleList = modules 
      ? modules.split(',').filter(m => SEARCH_MODULES[m])
      : Object.keys(SEARCH_MODULES);

    const allResults = [];
    const byModule = {};

    moduleList.forEach(moduleKey => {
      const moduleResults = searchModule(moduleKey, trimmedKeyword, parseInt(limit));
      if (moduleResults.length > 0) {
        byModule[moduleKey] = {
          name: SEARCH_MODULES[moduleKey].name,
          count: moduleResults.length,
          items: moduleResults
        };
        allResults.push(...moduleResults);
      }
    });

    allResults.sort((a, b) => {
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({
      success: true,
      data: {
        results: allResults.slice(0, parseInt(limit) * moduleList.length),
        total: allResults.length,
        by_module: byModule
      }
    });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/modules', (req, res) => {
  try {
    const modules = Object.entries(SEARCH_MODULES).map(([key, value]) => ({
      key,
      name: value.name
    }));
    res.json({ success: true, data: modules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
