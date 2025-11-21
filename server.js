// server.js - 服务器入口文件（重构后的MVC架构）
console.log('Loading server.js...');
const App = require('./src/app');

// 创建并启动应用
const app = new App();
app.start();