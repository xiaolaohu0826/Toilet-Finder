"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { fetchComments, insertComment, type Comment } from "@/lib/supabase";

const MAX_LEN = 50;

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export default function CommentSection({ toiletId }: { toiletId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchComments(toiletId).then((data) => {
      setComments(data);
      setLoading(false);
    });
  }, [toiletId]);

  const handleSubmit = async () => {
    const content = text.trim();
    if (!content) return;
    setSubmitting(true);
    // 乐观更新
    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      toilet_id: toiletId,
      content,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);
    setText("");
    await insertComment(toiletId, content);
    setSubmitting(false);
  };

  return (
    <div className="px-5 mt-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        吐槽板
      </p>

      {/* 输入框 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="说点什么… (限 50 字)"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 pr-10"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-300 pointer-events-none">
            {text.length}/{MAX_LEN}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 hover:bg-zinc-700 active:scale-95 transition-all disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* 留言列表 */}
      {loading ? (
        <p className="text-xs text-zinc-400">加载中…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-400">还没有吐槽，来抢沙发吧</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">💬</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-700 break-words">{c.content}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(c.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
