const { run } = require('../models/database');

function getCurrentUser(req) {
  return req.headers['x-user'] || 'anonymous';
}

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
}

function logOperation(req, action, module, targetId, detail) {
  try {
    const user = getCurrentUser(req);
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    run(`
      INSERT INTO operation_logs (user, action, module, target_id, detail, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [user, action, module || null, targetId || null, detail || null, ip, userAgent]);
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

function logOperationWithData(req, action, module, targetId, detail, beforeData, afterData, changedFields, versionNumber) {
  try {
    const user = getCurrentUser(req);
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    run(`
      INSERT INTO operation_logs 
      (user, action, module, target_id, detail, ip, user_agent, before_data, after_data, changed_fields, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user, 
      action, 
      module || null, 
      targetId || null, 
      detail || null, 
      ip, 
      userAgent,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      changedFields ? JSON.stringify(changedFields) : null,
      versionNumber || null
    ]);
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

module.exports = {
  logOperation,
  logOperationWithData
};
