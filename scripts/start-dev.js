const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const backendPath = path.join(__dirname, '../backend');
const frontendPath = path.join(__dirname, '../frontend');
const BACKEND_URL = 'http://localhost:3001/api/health';

console.log('\n=========================================');
console.log('  企业项目申报管理系统 - 启动中');
console.log('=========================================\n');

function checkBackendReady(retries = 0) {
  return new Promise((resolve) => {
    if (retries > 60) {
      resolve(false);
      return;
    }

    const req = http.get(BACKEND_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.success === true);
        } catch {
          setTimeout(() => {
            checkBackendReady(retries + 1).then(resolve);
          }, 500);
        }
      });
    });

    req.on('error', () => {
      process.stdout.write('.');
      setTimeout(() => {
        checkBackendReady(retries + 1).then(resolve);
      }, 500);
    });

    req.setTimeout(2000, () => {
      req.destroy();
    });
  });
}

let frontendPort = 5173;
let backendReady = false;

console.log('正在启动后端服务...');
const backend = spawn('node', ['src/index.js'], {
  cwd: backendPath,
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, FORCE_COLOR: 'true' }
});

backend.stdout.on('data', (data) => {
  process.stdout.write(data);
});

let frontendStarted = false;

async function startFrontend() {
  if (frontendStarted) return;
  frontendStarted = true;
  
  console.log('\n正在启动前端服务...\n');
  
  const frontend = spawn('npx', ['vite', '--host'], {
    cwd: frontendPath,
    stdio: ['inherit', 'pipe', 'inherit'],
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  let portDetected = false;
  
  frontend.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    
    if (!portDetected) {
      const portMatch = output.match(/localhost:(\d+)/);
      if (portMatch) {
        frontendPort = parseInt(portMatch[1]);
        portDetected = true;
      }
    }
  });

  const cleanup = () => {
    console.log('\n正在关闭服务...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  backend.on('close', () => {
    console.log('\n后端服务已关闭，正在关闭前端...');
    frontend.kill();
    process.exit(0);
  });
}

checkBackendReady().then((ready) => {
  backendReady = ready;
  
  if (ready) {
    console.log('\n✅ 后端服务已就绪');
  } else {
    console.log('\n⚠️  后端服务启动超时，但会继续启动前端');
    console.log('   请稍后刷新页面查看效果\n');
  }
  
  setTimeout(startFrontend, 500);
});

setTimeout(() => {
  if (!backendReady && !frontendStarted) {
    console.log('\n⏱  等待后端超时，正在启动前端...');
    startFrontend();
  }
}, 15000);
