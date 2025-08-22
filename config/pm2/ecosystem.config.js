// PM2 生产环境配置文件
module.exports = {
  apps: [
    {
      name: 'veomuse',
      script: 'server.js',
      instances: 'max', // 使用所有CPU核心
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // 日志配置
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      
      // 监控配置
      monitoring: false,
      
      // 重启配置
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        'generated'
      ],
      
      // 内存限制
      max_memory_restart: '1G',
      
      // 重启策略
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // 进程配置
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // 环境变量
      env_file: '.env'
    }
  ]
};