const { edenTreaty } = require('@elysiajs/eden');
const { spawn } = require('child_process');
const path = require('path');

describe('全栈连通性 E2E 验证', () => {
  let serverProcess;
  const backendDir = path.resolve(__dirname, '../apps/backend');

  // 在所有测试开始前启动后端服务
  beforeAll((done) => {
    serverProcess = spawn('bun', ['run', 'src/index.ts'], {
      cwd: backendDir,
      env: { ...process.env, PORT: 3002 } // 使用不同端口避免冲突
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('后端已在')) {
        done();
      }
    });

    serverProcess.on('error', (err) => {
      done(err);
    });
  });

  // 测试结束后关闭服务
  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('前端 Eden Client 应能成功访问后端 /health 接口并获取正确类型', async () => {
    // 模拟前端环境中的 Eden Client (指向测试端口 3002)
    const api = edenTreaty('http://localhost:3002');
    
    const { data, status, error } = await api.health.get();
    
    expect(status).toBe(200);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.status).toBe('ok');
    expect(typeof data.timestamp).toBe('string');
  });
});
