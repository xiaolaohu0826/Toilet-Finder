"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { supabase, type ToiletHours } from "@/lib/supabase";
import { getRatingStyle } from "@/lib/mockData";

const ALL_TAGS = ["有纸", "信号强", "卫洗丽", "带薪摸鱼"];

export interface OptimisticToilet {
  name: string;
  lng: number;
  lat: number;
  rating: number;
  tags: string[];
  hours: ToiletHours | null;
}

interface Props {
  open: boolean;
  lng: number;
  lat: number;
  defaultName?: string;
  onClose: () => void;
  // 立即返回用户填写的数据，用于乐观更新；DB 写入在后台完成
  onSuccess: (toilet: OptimisticToilet) => void;
}

export default function AddToiletModal({
  open,
  lng,
  lat,
  defaultName = "",
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [is24h, setIs24h] = useState(true);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setRating(5);
      setTags([]);
      setIs24h(true);
      setOpenTime("08:00");
      setCloseTime("22:00");
      setError("");
    }
  }, [open, defaultName]);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("请填写厕所名称");
      return;
    }

    const hours: ToiletHours = is24h
      ? { is_24h: true }
      : { is_24h: false, open: openTime, close: closeTime };

    const toilet: OptimisticToilet = {
      name: name.trim(),
      lng,
      lat,
      rating,
      tags,
      hours,
    };

    // 立即关闭 + 乐观更新
    onSuccess(toilet);

    // 后台写入 DB（不阻塞 UI）
    supabase
      .from("toilets")
      .insert({
        name: toilet.name,
        location: `POINT(${lng} ${lat})`,
        rating,
        tags,
        hours,
      })
      .then(({ error: dbError }) => {
        if (dbError) console.error("DB 写入失败:", dbError.message);
      });
  };

  const { color, emoji, label } = getRatingStyle(rating);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>📍 标记新厕所</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <p className="text-xs text-zinc-400">
            坐标：{lat.toFixed(5)}, {lng.toFixed(5)}
          </p>

          {/* 名称 */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">
              厕所名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="如：星巴克 B1 卫生间"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          {/* 评分 */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-3">
              评分
              <span className="ml-2 text-base font-bold" style={{ color }}>
                {emoji} {rating} 分 · {label}
              </span>
            </label>
            <Slider
              min={1}
              max={10}
              step={0.5}
              value={[rating]}
              onValueChange={(vals) => {
                const v = Array.isArray(vals) ? vals[0] : vals;
                setRating(v as number);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>1 烂</span>
              <span>10 佳</span>
            </div>
          </div>

          {/* 标签 */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-2">
              设施标签
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    tags.includes(tag)
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 营业时间 */}
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-2">营业时间</label>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setIs24h((v) => !v)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  is24h ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200"
                }`}
              >
                24 小时
              </button>
              {!is24h && (
                <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                  <input
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="border border-zinc-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                  <span className="text-zinc-400">–</span>
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="border border-zinc-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={handleSubmit} className="w-full">
            确认标记
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
