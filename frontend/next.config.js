/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev" : "https://*.clerk.accounts.com https://clerk.com"} https://vercel.live`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${process.env.NODE_ENV === 'development' ? 'https://images.clerk.dev' : 'https://images.clerk.com'} https://img.clerk.com`,
      "font-src 'self'",
      `connect-src 'self' ${process.env.NODE_ENV === 'development' ? 'https://*.clerk.accounts.dev http://localhost:8000 ws://localhost:8000' : 'https://*.clerk.accounts.com https://cofounder-api.onrender.com wss://cofounder-api.onrender.com'} https://clerk-telemetry.com https://api.resend.com https://venkatmcajj.github.io`,
      "worker-src 'self' blob:",
      "frame-src https://vercel.live",
    ].join("; "),
  },
]

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "images.clerk.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
