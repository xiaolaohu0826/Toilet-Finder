/** 根据评分返回 Marker 颜色配置 */
export function getRatingStyle(rating: number): {
  color: string;
  emoji: string;
  label: string;
} {
  if (rating >= 8) return { color: "#F5A623", emoji: "👑", label: "佳厕" };
  if (rating >= 5) return { color: "#7ED321", emoji: "🚽", label: "普通" };
  if (rating >= 3) return { color: "#FF8C00", emoji: "⚠️", label: "将就" };
  return { color: "#D0021B", emoji: "☠️", label: "烂厕" };
}
