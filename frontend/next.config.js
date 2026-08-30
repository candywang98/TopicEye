/** @type {import('next').NextConfig} */
const path = require('path');

const backendApiUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:8102';

const nextConfig = {
  agentRules: false,
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ['localhost', '127.0.0.1', 'frontend.topiceye.orb.local'],
  // 2GiB 本地 Docker VM 下避免连续切页时保留过多开发页面编译结果。
  onDemandEntries: {
    maxInactiveAge: 10 * 1000,
    pagesBufferLength: 1,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // LLM 翻译等长请求需要超过 Next.js rewrite proxy 默认 30s 超时
  experimental: {
    proxyTimeout: 120000,
  },
  // 只在 Docker bind mount 模式启用轮询；原生开发依赖文件系统事件，避免额外 CPU/延迟。
  webpack: (config) => {
    if (process.env.DOCKER_FRONTEND === 'true') {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  // 旧 admin 路径 301 重定向到 /admin/* 新址
  // 迁移历史：v0.7.0 路由收口，admin 页面统一到 /admin/* 前缀
  async redirects() {
    return [
      { source: '/sources', destination: '/admin/sources', permanent: true },
      { source: '/model-eval', destination: '/admin/model-eval', permanent: true },
      { source: '/feedback', destination: '/admin/feedback', permanent: true },
      { source: '/contents', destination: '/admin/contents', permanent: true },
      { source: '/mother-topics/config', destination: '/admin/mother-topics', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/api/:path*`,
      },
      // 内置监控大盘（后端自包含 HTML 页面，纯 Canvas 图表）
      {
        source: '/dashboard',
        destination: `${backendApiUrl}/dashboard`,
      },
      // Prometheus 标准采集端点（根路径别名）
      {
        source: '/metrics',
        destination: `${backendApiUrl}/metrics`,
      },
      // 健康检查端点
      {
        source: '/health/:path*',
        destination: `${backendApiUrl}/health/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
