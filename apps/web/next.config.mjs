/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are pre-compiled to plain ESM JS (see each package's
  // "build" script) and consumed from dist/, so they don't need
  // transpilePackages — Next treats them like any other npm dependency.
  serverExternalPackages: ["better-sqlite3", "playwright"],
};

export default nextConfig;
