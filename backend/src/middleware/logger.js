const { run } = require('../models/database');

function logOperation(req, action, module, targetId, detail) {
  const ip = req.ip || req.connection.remoteAddress;
  const user = req.headers['x-user'] || 'anonymous';
  
  try {
    run(`
      INSERT INTO operation_logs (user, action, module, target_id, detail, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user, action, module, targetId, detail, ip]);
  } catch (err) {
    console.error('记录操作日志失败:', err);
  }
}

module.exports = { logOperation };
