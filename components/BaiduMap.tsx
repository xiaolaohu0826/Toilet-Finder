"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, X, PanelLeftOpen, PanelLeftClose, ExternalLink, Navigation } from "lucide-react";
import { fetchToilets, isToiletOpen, type Toilet } from "@/lib/supabase";
import { getRatingStyle } from "@/lib/mockData";
import AddToiletModal, { type OptimisticToilet } from "@/components/AddToiletModal";
import SearchBar from "@/components/SearchBar";
import NearbyToiletsSidebar, { type NearbyPOI } from "@/components/NearbyToiletsSidebar";
import ToiletDrawer from "@/components/ToiletDrawer";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BMapGL: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _baiduMapCallback: any;
  }
}

interface POIDetail {
  name: string;
  address: string;
  lng: number;
  lat: number;
  uid?: string;
}

// ─── Marker SVGs ──────────────────────────────────────────────────────────────

/** 蓝色普通 POI（搜索候选 / zoom 自动搜索厕所） */
const bluePinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20S24 21 24 12C24 5.4 18.6 0 12 0z" fill="#3B82F6"/>
  <circle cx="12" cy="11.5" r="5" fill="white"/>
  <circle cx="12" cy="11.5" r="2.5" fill="#3B82F6"/>
</svg>`;

/** 红色聚焦 POI（候选词点击后的首个结果） */
const redPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26S32 28 32 16C32 7.2 24.8 0 16 0z" fill="#EF4444"/>
  <circle cx="16" cy="15" r="7" fill="white"/>
  <circle cx="16" cy="15" r="3.5" fill="#EF4444"/>
</svg>`;

/** 用户当前位置（醒目大图标） */
const userPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="64" viewBox="0 0 56 64">
  <path d="M28 0C12.5 0 0 12.5 0 28c0 20 28 36 28 36S56 48 56 28C56 12.5 43.5 0 28 0z" fill="#1D4ED8" stroke="white" stroke-width="2.5"/>
  <circle cx="28" cy="26" r="14" fill="white"/>
  <text x="28" y="34" font-size="18" text-anchor="middle">🧍</text>
</svg>`;

/** haversine 球面距离（米） */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BaiduMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  const initialized = useRef(false);

  // 分组管理 overlays
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toiletMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poiMarkersRef = useRef<any[]>([]);

  const searchActiveRef = useRef(false);
  const zoomSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeRef = useRef<any>(null);
  const [routeActive, setRouteActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toiletsRef = useRef<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [zoom, setZoom] = useState(12);
  const [filter, setFilter] = useState<"all" | "good" | "decent">("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [nearbyPOIs, setNearbyPOIs] = useState<NearbyPOI[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selected, setSelected] = useState<Toilet | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<POIDetail | null>(null);
  const [addCoords, setAddCoords] = useState<{ lng: number; lat: number; defaultName?: string } | null>(null);

  // ─── 地图初始化 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.BMapGL || initialized.current) return;
      initialized.current = true;

      const BMapGL = window.BMapGL;
      const map = new BMapGL.Map(mapRef.current);
      mapInstance.current = map;

      // 默认广州；locateUser 成功后会自动 panTo 用户位置
      const defaultPoint = new BMapGL.Point(113.264, 23.129);
      map.centerAndZoom(defaultPoint, 12);
      map.enableScrollWheelZoom();
      map.enableDragging();
      map.addControl(new BMapGL.ZoomControl());

      // 点击地图空白处关闭 POI 详情卡
      map.addEventListener("click", () => {
        setSelectedPOI(null);
      });

      // zoom / 拖动 → 自动搜附近厕所（共用防抖 timer）
      const onMapMove = () => {
        const z: number = map.getZoom();
        setZoom(z);
        if (zoomSearchTimerRef.current) clearTimeout(zoomSearchTimerRef.current);
        if (!searchActiveRef.current) {
          if (z >= 15) {
            zoomSearchTimerRef.current = setTimeout(() => {
              searchNearbyToiletsOnMap(BMapGL, map, map.getCenter());
            }, 500);
          } else {
            clearPOIMarkers(map);
            setNearbyPOIs([]);
          }
        }
      };
      map.addEventListener("zoomend", onMapMove);
      map.addEventListener("moveend", onMapMove);

      setLoading(false);
      locateUser(BMapGL, map);
      loadToiletMarkers(BMapGL, map);

      // 右键新增
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addEventListener("rightclick", (e: any) => {
        setAddCoords({ lng: e.latlng.lng, lat: e.latlng.lat });
      });

      // 长按新增（移动端）
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addEventListener("touchstart", (e: any) => {
        longPressTimer = setTimeout(() => {
          setAddCoords({ lng: e.latlng.lng, lat: e.latlng.lat });
        }, 600);
      });
      map.addEventListener("touchend", () => {
        if (longPressTimer) clearTimeout(longPressTimer);
      });
      map.addEventListener("touchmove", () => {
        if (longPressTimer) clearTimeout(longPressTimer);
      });
    };

    if (window.BMapGL) {
      initMap();
      return;
    }

    window._baiduMapCallback = initMap;
    const script = document.createElement("script");
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${process.env.NEXT_PUBLIC_BAIDU_MAP_AK}&callback=_baiduMapCallback`;
    script.async = true;
    script.onerror = () => console.error("百度地图脚本加载失败，请检查 AK 或网络");
    document.head.appendChild(script);

    return () => {
      delete window._baiduMapCallback;
      const el = document.head.querySelector(`script[src*="api.map.baidu.com"]`);
      if (el) document.head.removeChild(el);
    };
  }, []);

  // filter 变化时重绘厕所 markers
  useEffect(() => {
    if (!loading) applyToiletFilter(filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, loading]);

  // ─── 搜索候选（LocalSearch 驱动）────────────────────────────────────────────
  const getSuggestions = useCallback((query: string): Promise<string[]> => {
    return new Promise((resolve) => {
      if (!window.BMapGL || !mapInstance.current) return resolve([]);
      const center = mapInstance.current.getCenter();
      const search = new window.BMapGL.LocalSearch(center, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSearchComplete: (results: any) => {
          const names = parsePOIs(results)
            .map((p) => p.name)
            .filter(Boolean)
            .slice(0, 6);
          resolve(names);
        },
      });
      search.search(query);
      setTimeout(() => resolve([]), 3000);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 用户自存厕所 Markers ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadToiletMarkers = (BMapGL: any, map: any) => {
    fetchToilets().then((toilets) => {
      toiletsRef.current = toilets;
      toiletMarkersRef.current.forEach((m) => map.removeOverlay(m));
      toiletMarkersRef.current = [];
      toilets.forEach((toilet) => addToiletMarker(BMapGL, map, toilet));
    });
  };

  // 按 filter 重新渲染厕所 markers（不重新拉 API）
  const applyToiletFilter = (f: typeof filter) => {
    const map = mapInstance.current;
    const BMapGL = window.BMapGL;
    if (!map || !BMapGL) return;
    toiletMarkersRef.current.forEach((m) => map.removeOverlay(m));
    toiletMarkersRef.current = [];
    toiletsRef.current
      .filter((t) => {
        if (f === "good") return t.rating >= 8;
        if (f === "decent") return t.rating >= 3;
        return true;
      })
      .forEach((t) => addToiletMarker(BMapGL, map, t));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToiletMarker = (BMapGL: any, map: any, toilet: Toilet) => {
    const closed = isToiletOpen(toilet.hours) === false;
    const { color, emoji } = closed
      ? { color: "#9CA3AF", emoji: "🚫" }
      : getRatingStyle(toilet.rating);
    const point = new BMapGL.Point(toilet.lng, toilet.lat);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="20" y="26" font-size="16" text-anchor="middle">${emoji}</text>
      <polygon points="20,44 12,32 28,32" fill="${color}"/>
    </svg>`;
    const icon = new BMapGL.Icon(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      new BMapGL.Size(40, 48),
      { anchor: new BMapGL.Size(20, 48) }
    );
    const marker = new BMapGL.Marker(point, { icon });
    map.addOverlay(marker);
    toiletMarkersRef.current.push(marker);
    marker.addEventListener("click", () => {
      setSelectedPOI(null);
      setSelected(toilet);
      map.centerAndZoom(point, Math.max(map.getZoom(), 17));
    });
  };

  // ─── POI Markers（蓝色普通 / 红色聚焦）──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clearPOIMarkers = (map: any) => {
    poiMarkersRef.current.forEach((m) => map.removeOverlay(m));
    poiMarkersRef.current = [];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addPOIMarker = (BMapGL: any, map: any, poi: POIDetail, focused = false) => {
    const point = new BMapGL.Point(poi.lng, poi.lat);
    const svg = focused ? redPinSvg : bluePinSvg;
    const w = focused ? 32 : 24;
    const h = focused ? 42 : 32;
    const icon = new BMapGL.Icon(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      new BMapGL.Size(w, h),
      { anchor: new BMapGL.Size(w / 2, h) }
    );
    const marker = new BMapGL.Marker(point, { icon });
    map.addOverlay(marker);
    poiMarkersRef.current.push(marker);
    marker.addEventListener("click", () => {
      setSelected(null);
      setSelectedPOI(poi);
      map.centerAndZoom(point, 17);
    });
  };

  // ─── 主动搜索（候选词点击 / 搜索按钮）──────────────────────────────────────
  const handleSearch = (query: string) => {
    const map = mapInstance.current;
    if (!map || !window.BMapGL) return;
    const BMapGL = window.BMapGL;
    searchActiveRef.current = true;
    clearPOIMarkers(map);
    setSelectedPOI(null);

    const center = map.getCenter();
    const search = new BMapGL.LocalSearch(center, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSearchComplete: (results: any) => {
        if (!results) return;
        const pois = parsePOIs(results);
        // 首个结果红色聚焦，其余蓝色
        pois.forEach((p, i) => addPOIMarker(BMapGL, map, p, i === 0));
        if (pois.length === 1) {
          map.centerAndZoom(new BMapGL.Point(pois[0].lng, pois[0].lat), 17);
        } else if (pois.length > 1) {
          const points = pois.map((p) => new BMapGL.Point(p.lng, p.lat));
          map.setViewport(points);
        }
      },
    });
    search.search(query);
  };

  const handleClearSearch = () => {
    searchActiveRef.current = false;
    const map = mapInstance.current;
    if (map) clearPOIMarkers(map);
    setSelectedPOI(null);
  };

  // ─── zoom 触发的附近厕所搜索（地图蓝色 PIN + 更新 sidebar）──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchNearbyToiletsOnMap = (BMapGL: any, map: any, center: any) => {
    const search = new BMapGL.LocalSearch(center, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSearchComplete: (results: any) => {
        if (searchActiveRef.current) return;
        clearPOIMarkers(map);
        const pois = parsePOIs(results);
        pois.forEach((p) => addPOIMarker(BMapGL, map, p, false));
        setNearbyPOIs(pois.map((p, i) => ({ uid: p.uid ?? `poi-${i}`, name: p.name, address: p.address, lng: p.lng, lat: p.lat })));
      },
    });
    search.searchNearby("厕所", center, 800);
  };

  // ─── LocalSearch 结果解析 ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsePOIs = (results: any): POIDetail[] => {
    const pois: POIDetail[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getCount = (r: any) =>
      typeof r.getNumPois === "function"
        ? r.getNumPois()
        : typeof r.getCurrentNumPois === "function"
        ? r.getCurrentNumPois()
        : 0;

    const count = getCount(results);
    for (let i = 0; i < count; i++) {
      const poi = results.getPoi(i);
      if (!poi?.point) continue;
      pois.push({
        name: poi.title ?? poi.name ?? "未知地点",
        address: poi.address ?? "",
        lng: poi.point.lng,
        lat: poi.point.lat,
        uid: poi.uid ?? `poi-${i}`,
      });
    }
    return pois;
  };

  // ─── 用户定位 ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locateUser = (BMapGL: any, map: any) => {
    setLocating(true);
    const geolocation = new BMapGL.Geolocation();
    // 超时兜底：定位超过 8 秒或被拒绝时回调可能不触发，手动解锁按钮
    const fallback = setTimeout(() => setLocating(false), 8000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geolocation.getCurrentPosition((result: any) => {
      clearTimeout(fallback);
      setLocating(false);
      if (!result?.point) return;

      userPosRef.current = { lat: result.point.lat, lng: result.point.lng };
      map.panTo(result.point);
      map.setZoom(15);

      // 精度圆 + 醒目大图标
      const circle = new BMapGL.Circle(result.point, 40, {
        strokeColor: "#2563EB", strokeWeight: 1.5,
        fillColor: "#2563EB", fillOpacity: 0.12,
      });
      map.addOverlay(circle);
      const dot = new BMapGL.Marker(result.point, {
        icon: new BMapGL.Icon(
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(userPinSvg),
          new BMapGL.Size(56, 64),
          { anchor: new BMapGL.Size(28, 64) }
        ),
      });
      map.addOverlay(dot);

      // 直接调 onMap 版本，不依赖 zoomend 事件（程序调用 setZoom 不触发该事件）
      searchNearbyToiletsOnMap(BMapGL, map, result.point);
    });
  };

  const handleLocate = () => {
    if (!mapInstance.current || !window.BMapGL || locating) return;
    locateUser(window.BMapGL, mapInstance.current);
  };

  // ─── 紧急找厕 ─────────────────────────────────────────────────────────────
  const handleEmergency = () => {
    const map = mapInstance.current;
    const BMapGL = window.BMapGL;
    if (!map || !BMapGL) return;

    const pos = userPosRef.current;
    const origin = pos ?? { lat: map.getCenter().lat, lng: map.getCenter().lng };

    // 优先从已存厕所里找 800m 内评分最高的
    const saved = toiletsRef.current
      .map((t) => ({ ...t, dist: haversineM(origin.lat, origin.lng, t.lat, t.lng) }))
      .filter((t) => t.dist <= 800)
      .sort((a, b) => b.rating - a.rating);

    if (saved.length > 0) {
      const best = saved[0];
      map.centerAndZoom(new BMapGL.Point(best.lng, best.lat), 18);
      setSelectedPOI(null);
      setSelected(best);
      return;
    }

    // 否则 LocalSearch 搜附近 500m "厕所"
    const center = new BMapGL.Point(origin.lng, origin.lat);
    const search = new BMapGL.LocalSearch(center, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSearchComplete: (results: any) => {
        const pois = parsePOIs(results);
        if (!pois.length) return;
        clearPOIMarkers(map);
        pois.forEach((p, i) => addPOIMarker(BMapGL, map, p, i === 0));
        map.centerAndZoom(new BMapGL.Point(pois[0].lng, pois[0].lat), 18);
        setSelected(null);
        setSelectedPOI(pois[0]);
      },
    });
    search.searchNearby("厕所", center, 500);
  };

  // ─── 地图内步行导航 ───────────────────────────────────────────────────────
  const navigateTo = (destLat: number, destLng: number) => {
    const map = mapInstance.current;
    const BMapGL = window.BMapGL;
    if (!map || !BMapGL) return;

    // 清除上一条路线
    if (routeRef.current) {
      try { routeRef.current.clearResults(); } catch (_) { /* ignore */ }
      routeRef.current = null;
    }

    const dest = new BMapGL.Point(destLng, destLat);
    const start = userPosRef.current
      ? new BMapGL.Point(userPosRef.current.lng, userPosRef.current.lat)
      : map.getCenter();

    const route = new BMapGL.WalkingRoute(map, {
      renderOptions: { map, autoViewport: true },
      onSearchComplete: () => setRouteActive(true),
    });
    route.search(start, dest);
    routeRef.current = route;
  };

  const clearRoute = () => {
    if (routeRef.current) {
      try { routeRef.current.clearResults(); } catch (_) { /* ignore */ }
      routeRef.current = null;
    }
    setRouteActive(false);
  };

  // ─── 侧边栏 POI 点击 ──────────────────────────────────────────────────────
  const handleSidebarSelect = (poi: NearbyPOI) => {
    const map = mapInstance.current;
    if (!map || !window.BMapGL) return;
    const point = new window.BMapGL.Point(poi.lng, poi.lat);
    map.centerAndZoom(point, 17);
    setSelectedPOI({ ...poi });
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* ── 顶部栏（搜索 + 过滤器）── */}
      {!loading && (
        <div className="bg-white shadow-sm shrink-0 z-20">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-full border border-zinc-200 w-9 h-9 flex items-center justify-center hover:bg-zinc-50 shrink-0"
              title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-zinc-600" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-zinc-600" />
              )}
            </button>
            <SearchBar onSearch={handleSearch} onClear={handleClearSearch} onSuggest={getSuggestions} />
          </div>
          {/* 过滤器 */}
          <div className="flex items-center gap-1.5 px-3 pb-2">
            {(["all", "decent", "good"] as const).map((f) => {
              const labels = { all: "全部", decent: "隐藏烂厕 ≥3", good: "只看佳厕 ≥8" };
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── 左侧边栏 ── */}
        <div
          className={`relative z-10 bg-white shadow-xl flex flex-col transition-all duration-200 shrink-0 ${
            sidebarOpen ? "w-56" : "w-0 overflow-hidden"
          }`}
        >
          <div className="px-3 pt-3 pb-2 border-b border-zinc-100 shrink-0">
            <p className="text-xs font-semibold text-zinc-600 mb-1.5">评分图例</p>
            {[
              { emoji: "👑", label: "佳厕 ≥8", color: "#F5A623" },
              { emoji: "🚽", label: "普通 5–8", color: "#7ED321" },
              { emoji: "⚠️", label: "将就 3–5", color: "#FF8C00" },
              { emoji: "☠️", label: "烂厕 <3", color: "#D0021B" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs mb-0.5">
                <span>{item.emoji}</span>
                <span style={{ color: item.color }} className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            <NearbyToiletsSidebar
              pois={nearbyPOIs}
              loading={nearbyLoading}
              onRate={(poi) => setAddCoords({ lng: poi.lng, lat: poi.lat, defaultName: poi.name })}
              onSelect={handleSidebarSelect}
            />
          </div>
        </div>

        {/* ── 地图区域 ── */}
        <div className="relative flex-1">
          <div ref={mapRef} className="w-full h-full" />

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-2" />
              <p className="text-sm text-zinc-500">地图加载中…</p>
            </div>
          )}

          {/* Zoom 显示（左下角） */}
          {!loading && (
            <div className="absolute bottom-4 left-4 z-10 bg-white/80 backdrop-blur-sm text-xs text-zinc-500 font-mono px-2 py-1 rounded-md shadow-sm pointer-events-none select-none">
              缩放 {Math.round(zoom)}
              {zoom >= 15 && <span className="ml-1 text-blue-400">· 自动搜厕</span>}
            </div>
          )}

          {/* 取消导航 */}
          {routeActive && (
            <button
              onClick={clearRoute}
              className="absolute top-3 right-3 z-10 bg-white border border-zinc-200 rounded-full px-3 py-1.5 text-sm text-zinc-600 shadow-md flex items-center gap-1.5 hover:bg-zinc-50 active:scale-95 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              取消导航
            </button>
          )}

          {/* 紧急找厕按钮 */}
          {!loading && (
            <button
              onClick={handleEmergency}
              className="absolute bottom-24 right-4 z-10 bg-red-500 text-white rounded-full shadow-xl w-14 h-14 flex items-center justify-center text-2xl hover:bg-red-600 active:scale-95 transition-all"
              title="紧急找厕！"
            >
              🚨
            </button>
          )}

          {/* 定位按钮 */}
          <button
            onClick={handleLocate}
            disabled={locating || loading}
            className="absolute bottom-8 right-4 z-10 bg-white rounded-full shadow-lg w-11 h-11 flex items-center justify-center hover:bg-zinc-50 active:scale-95 transition-all disabled:opacity-50"
            title="定位到我的位置"
          >
            {locating ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            ) : (
              <LocateFixed className="w-5 h-5 text-blue-500" />
            )}
          </button>

          {/* 新增厕所提示 */}
          {!loading && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
              长按（手机）或右键（电脑）添加厕所
            </div>
          )}

          {addCoords && (
            <AddToiletModal
              open={!!addCoords}
              lng={addCoords.lng}
              lat={addCoords.lat}
              defaultName={addCoords.defaultName}
              onClose={() => setAddCoords(null)}
              onSuccess={(optimistic: OptimisticToilet) => {
                setAddCoords(null);
                const full = { id: `optimistic-${Date.now()}`, created_at: new Date().toISOString(), image_url: null, ...optimistic };
                toiletsRef.current = [...toiletsRef.current, full];
                if (mapInstance.current && window.BMapGL) {
                  addToiletMarker(window.BMapGL, mapInstance.current, full);
                }
              }}
            />
          )}

          <ToiletDrawer
            toilet={selected}
            onClose={() => setSelected(null)}
            onRate={(toilet) => {
              setSelected(null);
              setAddCoords({ lng: toilet.lng, lat: toilet.lat, defaultName: toilet.name });
            }}
            onNavigate={(lat, lng) => navigateTo(lat, lng)}
          />

          {selectedPOI && (
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">{selectedPOI.name}</h2>
                  {selectedPOI.address && (
                    <p className="text-sm text-zinc-500 mt-0.5">{selectedPOI.address}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPOI(null)}
                  className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => navigateTo(selectedPOI.lat, selectedPOI.lng)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 active:scale-95 transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  步行导航
                </button>
                <button
                  onClick={() =>
                    setAddCoords({ lng: selectedPOI.lng, lat: selectedPOI.lat, defaultName: selectedPOI.name })
                  }
                  className="text-sm text-zinc-600 border border-zinc-200 rounded-full px-3 py-1 hover:bg-zinc-50"
                >
                  给这里评分
                </button>
                <a
                  href={`https://map.baidu.com/search/${encodeURIComponent(selectedPOI.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-400 flex items-center gap-1 hover:underline ml-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  百度地图
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
