const { spawn } = require('child_process');
const path = require('path');

const backendPath = path.join(__dirname, '../backend');
const frontendPath = path.join(__dirname, '../frontend');

console.log('正在启动企业项目申报管理系统...\n');

const backend = spawn('node', ['src/index.js'], {
  cwd: backendPath,
  stdio: 'inherit'
});

const frontend = spawn('npx', ['vite'], {
  cwd: frontendPath,
  stdio: 'inherit'
});

let backendReady = false;
let frontendReady = false;

setTimeout(() => {
  console.log('\n=========================================');
  console.log('  企业项目申报管理系统');
  console.log('  后端地址: http://localhost:3001');
  console.log('  前端地址: http://localhost:5173 (或下一个可用端口)');
  console.log('=========================================\n');
}, 3000);

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  backend.kill();
  frontend.kill();
  process.exit(0);
});
