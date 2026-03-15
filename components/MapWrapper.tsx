"use client";

import dynamic from "next/dynamic";

const BaiduMap = dynamic(() => import("@/components/BaiduMap"), {
  ssr: false,
});

export default function MapWrapper() {
  return (
    <div className="w-full h-full">
      <BaiduMap />
    </div>
  );
}
