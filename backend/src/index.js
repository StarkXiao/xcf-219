const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./models/database');

const guidelinesRouter = require('./routes/guidelines');
const declarationsRouter = require('./routes/declarations');
const attachmentsRouter = require('./routes/attachments');
const workflowRouter = require('./routes/workflow');
const workflowConfigsRouter = require('./routes/workflow-configs');
const logsRouter = require('./routes/logs');
const versionsModule = require('./routes/versions');
const enterpriseProfilesModule = require('./routes/enterprise-profiles');
const projectExecutionModule = require('./routes/project-execution');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '申报管理系统 API 服务正常运行' });
});

app.use('/api/guidelines', guidelinesRouter);
app.use('/api/declarations', declarationsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/workflow-configs', workflowConfigsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/versions', versionsModule.router);
app.use('/api/enterprise-profiles', enterpriseProfilesModule.router);
app.use('/api/project-execution', projectExecutionModule.router);
app.use('/api/search', searchRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});

try {
  initDatabase();
  
  app.listen(PORT, () => {
    console.log(`
=========================================
  企业项目申报管理系统 - 后端服务
  运行地址: http://localhost:${PORT}
  API前缀:  /api
=========================================
    `);
  });
} catch (error) {
  console.error('启动服务器失败:', error);
  process.exit(1);
}
