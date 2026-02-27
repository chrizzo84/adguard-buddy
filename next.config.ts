import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
