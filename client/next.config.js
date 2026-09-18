const API_BASE = process.env.API_BASE_URL || 'https://civiceye-api-8huk.onrender.com';

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