"use client";

import { Loader2, Star, ExternalLink } from "lucide-react";

export interface NearbyPOI {
  uid: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
}

interface Props {
  pois: NearbyPOI[];
  loading: boolean;
  onRate: (poi: NearbyPOI) => void;
  onSelect: (poi: NearbyPOI) => void;
}

export default function NearbyToiletsSidebar({
  pois,
  loading,
  onRate,
  onSelect,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-zinc-100 shrink-0">
        <p className="font-semibold text-sm text-zinc-800">🚽 附近公共厕所</p>
        <p className="text-xs text-zinc-400 mt-0.5">来自百度地图 · 可点击评分</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 h-24 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">搜索中…</span>
          </div>
        )}
        {!loading && pois.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-zinc-400">
            附近暂无结果
          </div>
        )}
        {pois.map((poi) => (
          <div
            key={poi.uid}
            className="px-3 py-2.5 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
            onClick={() => onSelect(poi)}
          >
            <p className="text-sm font-medium text-zinc-800 truncate">
              {poi.name}
            </p>
            {poi.address && (
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                {poi.address}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRate(poi);
                }}
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                <Star className="w-3 h-3" />
                评分
              </button>
              <a
                href={`https://map.baidu.com/search/${encodeURIComponent(poi.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                百度地图
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
