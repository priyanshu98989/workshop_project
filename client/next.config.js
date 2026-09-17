const API_BASE = process.env.API_BASE_URL || 'http://localhost:6000';

module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};