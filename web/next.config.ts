import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This is a multi-package repo with several lockfiles; pin the Turbopack root
  // to this app's directory so Next stops inferring the wrong workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
