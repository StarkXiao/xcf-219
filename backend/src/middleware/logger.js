const { run } = require('../models/database');

function logOperation(req, action, module, targetId, detail) {
  return logOperationWithData(req, action, module, targetId, detail, null, null, null, null);
}

function logOperationWithData(req, action, module, targetId, detail, beforeData, afterData, changedFields, versionNumber) {
  const ip = req?.ip || req?.connection?.remoteAddress || '';
  const user = req?.headers?.['x-user'] || 'anonymous';
  const userAgent = req?.headers?.['user-agent'] || '';
  
  try {
    let beforeJson = null;
    let afterJson = null;
    let changedFieldsJson = null;

    if (beforeData && typeof beforeData === 'object') {
      try {
        const sanitized = sanitizeData(beforeData);
        beforeJson = JSON.stringify(sanitized);
      } catch (e) {
        beforeJson = null;
      }
    }

    if (afterData && typeof afterData === 'object') {
      try {
        const sanitized = sanitizeData(afterData);
        afterJson = JSON.stringify(sanitized);
      } catch (e) {
        afterJson = null;
      }
    }

    if (changedFields && Array.isArray(changedFields)) {
      try {
        changedFieldsJson = JSON.stringify(changedFields);
      } catch (e) {
        changedFieldsJson = null;
      }
    }

    run(`
      INSERT INTO operation_logs 
      (user, action, module, target_id, detail, ip, user_agent, before_data, after_data, changed_fields, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [user, action, module, targetId, detail, ip, userAgent, beforeJson, afterJson, changedFieldsJson, versionNumber || null]);
    return true;
  } catch (err) {
    console.error('记录操作日志失败:', err);
    return false;
  }
}

function sanitizeData(data) {
  const copy = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization'];
  
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      copy[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      if (Buffer.isBuffer(value)) {
        copy[key] = `[Buffer: ${value.length} bytes]`;
      } else {
        copy[key] = sanitizeData(value);
      }
    } else {
      copy[key] = value;
    }
  }
  return copy;
}

function parseLogData(log) {
  if (!log) return log;
  const result = { ...log };
  
  try {
    if (result.before_data) result.before_data_parsed = JSON.parse(result.before_data);
  } catch (e) {
    result.before_data_parsed = null;
  }
  
  try {
    if (result.after_data) result.after_data_parsed = JSON.parse(result.after_data);
  } catch (e) {
    result.after_data_parsed = null;
  }
  
  try {
    if (result.changed_fields) result.changed_fields_parsed = JSON.parse(result.changed_fields);
  } catch (e) {
    result.changed_fields_parsed = null;
  }
  
  return result;
}

module.exports = { logOperation, logOperationWithData, parseLogData };
