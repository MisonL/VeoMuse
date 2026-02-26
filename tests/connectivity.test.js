const { edenTreaty } = require('@elysiajs/eden');
const { spawn } = require('child_process');
const path = require('path');

describe('全栈连通性 E2E 验证 (加固版)', () => {
  let serverProcess;
  const backendDir = path.resolve(__dirname, '../apps/backend');

  beforeAll((done) => {
    serverProcess = spawn('bun', ['run', 'src/index.ts'], {
      cwd: backendDir,
      env: { ...process.env, PORT: 3005 } // 使用独立端口
    });

    let isDone = false;
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('已启动') || output.includes('启动')) {
        if (!isDone) {
          isDone = true;
          done();
        }
      }
    });

    serverProcess.on('error', (err) => {
      if (!isDone) done(err);
    });

    // 增加保险超时
    setTimeout(() => {
      if (!isDone) {
        isDone = true;
        done();
      }
    }, 4000);
  });

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
  });

  test('前端 Eden Client 应能访问后端 /health', async () => {
    const api = edenTreaty('http://localhost:3005');
    const { data, status } = await api.health.get();
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
  });
});
