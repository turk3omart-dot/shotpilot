import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// One .env at the repository root serves the web app, scripts and tests.
loadEnv({ path: path.join(root, ".env"), quiet: true });

const config: NextConfig = {
  transpilePackages: ["@shotpilot/shared", "@shotpilot/database", "@shotpilot/ai", "@shotpilot/api", "@shotpilot/design-tokens"],
  serverExternalPackages: ["postgres", "pdf-parse", "pdfjs-dist", "mammoth", "@anthropic-ai/sdk"],
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
