import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ToiletHours {
  is_24h: boolean;
  open?: string;  // "HH:MM"
  close?: string;
}

/** 返回 true=开放 / false=关闭 / null=未知 */
export function isToiletOpen(hours: ToiletHours | null): boolean | null {
  if (!hours) return null;
  if (hours.is_24h) return true;
  if (!hours.open || !hours.close) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = hours.open.split(":").map(Number);
  const [ch, cm] = hours.close.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  // 支持跨夜（如 22:00–06:00）
  return closeMin > openMin
    ? nowMin >= openMin && nowMin < closeMin
    : nowMin >= openMin || nowMin < closeMin;
}

export interface Toilet {
  id: string;
  name: string;
  lng: number;
  lat: number;
  rating: number;
  tags: string[];
  image_url: string | null;
  hours: ToiletHours | null;
  created_at: string;
}

export interface Comment {
  id: string;
  toilet_id: string;
  content: string;
  created_at: string;
}

export async function fetchComments(toiletId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, content, created_at")
    .eq("toilet_id", toiletId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) { console.error(error.message); return []; }
  return data as Comment[];
}

export async function insertComment(toiletId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("comments")
    .insert({ toilet_id: toiletId, content });
  if (error) console.error(error.message);
}

export async function fetchToilets(): Promise<Toilet[]> {
  const { data, error } = await supabase
    .from("toilets_view")
    .select("id, name, lng, lat, rating, tags, image_url, hours, created_at");

  if (error) {
    console.error("fetchToilets error:", error.message);
    return [];
  }
  return data as Toilet[];
}
