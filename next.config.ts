import type { NextConfig } from "next";

// GitHub Pages(정적 호스팅) 빌드: NEXT_PUBLIC_BASE_PATH=/cinema 로 실행하면 정적 export + basePath 적용.
// 정적 호스팅에는 서버 API 라우트(route.ts)가 없으므로 pageExtensions를 tsx로 제한해 제외한다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const staticExport = Boolean(basePath);

const nextConfig: NextConfig = {
  ...(staticExport
    ? { output: 'export', basePath, trailingSlash: true, images: { unoptimized: true }, pageExtensions: ['tsx'] }
    : {}),
};

export default nextConfig;
