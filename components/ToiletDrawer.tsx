"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { type Toilet, isToiletOpen } from "@/lib/supabase";
import { getRatingStyle } from "@/lib/mockData";
import { CalendarDays, Flag, Navigation } from "lucide-react";
import CommentSection from "@/components/CommentSection";

interface Props {
  toilet: Toilet | null;
  onClose: () => void;
  onRate: (toilet: Toilet) => void;
  onNavigate: (lat: number, lng: number) => void;
}

const TAG_ICONS: Record<string, string> = {
  有纸: "🧻",
  信号强: "📶",
  卫洗丽: "🚿",
  带薪摸鱼: "💼",
};

export default function ToiletDrawer({ toilet, onClose, onRate, onNavigate }: Props) {
  if (!toilet) return null;

  const { color, emoji, label } = getRatingStyle(toilet.rating);
  const openStatus = isToiletOpen(toilet.hours);

  const formattedDate = new Date(toilet.created_at).toLocaleDateString(
    "zh-CN",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <Drawer open={!!toilet} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left px-5 pt-2 pb-0">
          {/* 评分徽章 */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-bold mb-2 w-fit"
            style={{ backgroundColor: color }}
          >
            <span>{emoji}</span>
            <span>{toilet.rating} 分</span>
            <span>·</span>
            <span>{label}</span>
          </div>

          <DrawerTitle className="text-lg font-bold text-zinc-900 leading-snug">
            {toilet.name}
          </DrawerTitle>

          {/* 营业时间 + 创建时间 */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {toilet.hours && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                openStatus === true ? "bg-green-100 text-green-700" :
                openStatus === false ? "bg-red-100 text-red-600" :
                "bg-zinc-100 text-zinc-500"
              }`}>
                {toilet.hours.is_24h
                  ? "🕐 24小时"
                  : openStatus === true
                  ? `🟢 营业中 ${toilet.hours.open}–${toilet.hours.close}`
                  : openStatus === false
                  ? `🔴 已关闭 ${toilet.hours.open}–${toilet.hours.close}`
                  : `🕐 ${toilet.hours.open}–${toilet.hours.close}`}
              </span>
            )}
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <CalendarDays className="w-3 h-3" />
              <span>{formattedDate} 收录</span>
            </div>
          </div>
        </DrawerHeader>

        {/* 评分可视化进度条 */}
        <div className="px-5 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 shrink-0">1</span>
            <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(toilet.rating / 10) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-xs text-zinc-400 shrink-0">10</span>
          </div>
        </div>

        {/* 设施标签 */}
        <div className="px-5 mt-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            设施
          </p>
          {toilet.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {toilet.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-sm font-medium"
                >
                  <span>{TAG_ICONS[tag] ?? "✓"}</span>
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">暂无设施标签</p>
          )}
        </div>

        <CommentSection toiletId={toilet.id} />

        <DrawerFooter className="px-5 pt-4 gap-2">
          <div className="flex items-center gap-2">
            {/* 步行导航 */}
            <button
              onClick={() => onNavigate(toilet.lat, toilet.lng)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 active:scale-95 transition-all"
            >
              <Navigation className="w-4 h-4" />
              步行导航
            </button>

            {/* 重新评分 */}
            <button
              onClick={() => onRate(toilet)}
              className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 active:scale-95 transition-all"
            >
              重新评分
            </button>

            {/* 我有异议（占位） */}
            <button
              disabled
              title="功能开发中"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 text-zinc-400 text-sm cursor-not-allowed"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
