"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  RotateCcw,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// =====================================================
// 型定義
// =====================================================
type Status = "ok" | "maybe" | "ng";
type Profile = {
  id: string;
  discord_user_id: string | null;
  display_name: string;
  avatar_url: string | null;
};
type ScheduleRow = {
  user_id: string;
  schedule_date: string;
  status: Status;
};
type MemoRow = {
  user_id: string;
  content: string;
};
type DayStatusMap = Record<
  string,
  Record<string, Status>
>;
type MemoMap = Record<string, string>;
// =====================================================
// ステータス設定
// =====================================================
const statusMeta = {
  ok: {
	symbol: "〇",
	label: "参加できる",
	tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  maybe: {
	symbol: "△",
	label: "未定・条件付き",
	tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  ng: {
	symbol: "×",
	label: "参加できない",
	tone: "border-rose-200 bg-rose-50 text-rose-700",
  },
};
// =====================================================
// 日付処理
// =====================================================
function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}
function monthRange(year: number, month: number) {
  return {
	start: localDateKey(new Date(year, month, 1)),
	end: localDateKey(new Date(year, month + 1, 1)),
  };
}
// =====================================================
// アイコン
// =====================================================
function fallbackAvatar(name: string) {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}`;
}
function StatusAvatar({
  profile,
  status,
  size = 24,
}: {
  profile: Profile;
  status: Status;
  size?: number;
}) {
  const image =
	profile.avatar_url ||
	fallbackAvatar(profile.display_name);
  if (status === "maybe") {
	return (
  	<div
    	title={`${profile.display_name}：△`}
    	className="relative shrink-0 overflow-hidden"
    	style={{
      	width: size,
      	height: size,
      	clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
      	backgroundColor: "#7c3aed",
    	}}
  	>
    	<img
      	src={image}
      	alt={profile.display_name}
      	className="absolute object-cover"
      	style={{
        	width: "82%",
        	height: "82%",
        	left: "9%",
        	top: "10%",
        	objectPosition: "50% 50%",
      	}}
    	/>
  	</div>
	);
  }
  return (
	<img
  	src={image}
  	alt={profile.display_name}
  	title={`${profile.display_name}：〇`}
  	className="shrink-0 rounded-full border-2 border-blue-500 bg-white object-cover"
  	style={{
    	width: size,
    	height: size,
  	}}
	/>
  );
}
// =====================================================
// メイン
// =====================================================
export default function SupabaseScheduleCalendar() {
 const [today, setToday] = useState<Date | null>(null);

const [cursor, setCursor] = useState(
  new Date(2025, 0, 1)
);
useEffect(() => {
  const now = new Date();

  setToday(now);

  setCursor(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    )
  );
}, []);
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [statuses, setStatuses] = useState<DayStatusMap>({});
  const [selectedDate, setSelectedDate] =
	useState<Date | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  // ---------------------------------------------------
  // メモ用State
  // ---------------------------------------------------
  const [memos, setMemos] = useState<MemoMap>({});
  const [myMemoDraft, setMyMemoDraft] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoMessage, setMemoMessage] = useState("");
  // ---------------------------------------------------
  // 基本情報
  // ---------------------------------------------------
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const currentProfile =
	profiles.find((p) => p.id === user?.id) ?? null;
  // ---------------------------------------------------
  // カレンダー42マス
  // ---------------------------------------------------
  const cells = useMemo(() => {
	const firstDay = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(
  	year,
  	month + 1,
  	0
	).getDate();
	return Array.from({ length: 42 }, (_, index) => {
  	const day = index - firstDay + 1;
  	return day >= 1 && day <= daysInMonth
    	? new Date(year, month, day)
    	: null;
	});
  }, [year, month]);
  // =====================================================
  // Discord認証
  // =====================================================
  useEffect(() => {
	let mounted = true;
	supabase.auth.getUser().then(({ data, error }) => {
  	if (!mounted) return;
  	if (error) {
    	console.error("認証確認エラー:", error);
  	}
  	setUser(data.user ?? null);
  	setAuthLoading(false);
	});
	const { data: listener } =
  	supabase.auth.onAuthStateChange(
    	(_event, session) => {
      	if (!mounted) return;
      	setUser(session?.user ?? null);
      	setAuthLoading(false);
    	}
  	);
	return () => {
  	mounted = false;
  	listener.subscription.unsubscribe();
	};
  }, []);
  // =====================================================
  // カレンダー取得
  // =====================================================
  const loadMonth = useCallback(async () => {
	if (!user) return;
	setCalendarLoading(true);
	const { start, end } = monthRange(year, month);
	const [profilesResult, schedulesResult] =
  	await Promise.all([
    	supabase
      	.from("profiles")
      	.select(
        	"id, discord_user_id, display_name, avatar_url"
      	)
      	.order("display_name"),
    	supabase
      	.from("schedules")
      	.select("user_id, schedule_date, status")
      	.gte("schedule_date", start)
      	.lt("schedule_date", end),
  	]);
	if (profilesResult.error || schedulesResult.error) {
  	setMessage(
    	profilesResult.error?.message ||
      	schedulesResult.error?.message ||
      	"カレンダーの読み込みに失敗しました。"
  	);
  	setCalendarLoading(false);
  	return;
	}
	setProfiles((profilesResult.data ?? []) as Profile[]);
	const next: DayStatusMap = {};
	((schedulesResult.data ?? []) as ScheduleRow[]).forEach(
  	(row) => {
    	next[row.schedule_date] ??= {};
    	next[row.schedule_date][row.user_id] = row.status;
  	}
	);
	setStatuses(next);
	setCalendarLoading(false);
  }, [user?.id, year, month]);
  useEffect(() => {
	loadMonth();
  }, [loadMonth]);
  // =====================================================
  // メモ取得
  // =====================================================
  const loadMemos = useCallback(async () => {
	if (!user) return;
	setMemoLoading(true);
	setMemoMessage("");
	const { data, error } = await supabase
  	.from("memos")
  	.select("user_id, content");
	if (error) {
  	setMemoMessage(
    	`メモの読み込みに失敗しました：${error.message}`
  	);
  	setMemoLoading(false);
  	return;
	}
	const next: MemoMap = {};
	((data ?? []) as MemoRow[]).forEach((row) => {
  	next[row.user_id] = row.content;
	});
	setMemos(next);
	setMyMemoDraft(next[user.id] ?? "");
	setMemoLoading(false);
  }, [user?.id]);
  useEffect(() => {
	loadMemos();
  }, [loadMemos]);
  // =====================================================
  // ログイン
  // =====================================================
  const login = async () => {
	const { error } = await supabase.auth.signInWithOAuth({
  	provider: "discord",
  	options: {
    	redirectTo: window.location.origin,
  	},
	});
	if (error) {
  	console.error("Discordログインエラー:", error);
	}
  };
  // =====================================================
  // ログアウト
  // =====================================================
  const logout = async () => {
	const { error } = await supabase.auth.signOut();
	if (error) {
  	console.error("ログアウトエラー:", error);
  	return;
	}
	setUser(null);
	setProfiles([]);
	setStatuses({});
	setMemos({});
	setMyMemoDraft("");
	setSelectedDate(null);
  };
  // =====================================================
  // 〇 △ × 保存
  // =====================================================
  const saveStatus = async (status: Status) => {
	if (!user || !selectedDate || saving) return;
	setSaving(true);
	setMessage("");
	const scheduleDate = localDateKey(selectedDate);
	const { error } = await supabase
  	.from("schedules")
  	.upsert(
    	{
      	user_id: user.id,
      	schedule_date: scheduleDate,
      	status,
    	},
    	{
      	onConflict: "user_id,schedule_date",
    	}
  	);
	if (error) {
  	setMessage(`保存できませんでした：${error.message}`);
	} else {
  	setStatuses((current) => ({
    	...current,
    	[scheduleDate]: {
      	...(current[scheduleDate] ?? {}),
      	[user.id]: status,
    	},
  	}));
  	setMessage("予定を保存しました。");
	}
	setSaving(false);
  };
  // =====================================================
  // 未回答に戻す
  // =====================================================
  const clearStatus = async () => {
	if (!user || !selectedDate || saving) return;
	setSaving(true);
	setMessage("");
	const scheduleDate = localDateKey(selectedDate);
	const { error } = await supabase
  	.from("schedules")
  	.delete()
  	.eq("user_id", user.id)
  	.eq("schedule_date", scheduleDate);
	if (error) {
  	setMessage(
    	`未回答に戻せませんでした：${error.message}`
  	);
	} else {
  	setStatuses((current) => {
    	const next = { ...current };
    	const day = {
      	...(next[scheduleDate] ?? {}),
    	};
    	delete day[user.id];
    	if (Object.keys(day).length === 0) {
      	delete next[scheduleDate];
    	} else {
      	next[scheduleDate] = day;
    	}
    	return next;
  	});
  	setMessage("未回答に戻しました。");
	}
	setSaving(false);
  };
  // =====================================================
  // 自分のメモ保存
  // =====================================================
 const saveMyMemo = async () => {
  if (!user || memoSaving || memoLoading) return;
  setMemoSaving(true);
  setMemoMessage("");
  const memo = myMemoDraft;

	// 空白・改行だけなら削除
	if (memo.trim() === "") {
  	const { error } = await supabase
    	.from("memos")
    	.delete()
    	.eq("user_id", user.id);
  	if (error) {
    	setMemoMessage(
      	`メモを削除できませんでした：${error.message}`
    	);
  	} else {
    	setMemos((current) => {
      	const next = { ...current };
      	delete next[user.id];
      	return next;
    	});
    	setMyMemoDraft("");
    	setMemoMessage("メモを削除しました。");
  	}
  	setMemoSaving(false);
  	return;
	}
	// メモ保存
	const { error } = await supabase
  	.from("memos")
  	.upsert(
    	{
      	user_id: user.id,
      	content: memo,
    	},
    	{
      	onConflict: "user_id",
    	}
  	);
	if (error) {
  	setMemoMessage(
    	`メモを保存できませんでした：${error.message}`
  	);
	} else {
  	setMemos((current) => ({
    	...current,
    	[user.id]: memo,
  	}));
  	setMemoMessage("メモを保存しました。");
	}
	setMemoSaving(false);
  };
  // =====================================================
  // 認証読み込み
  // =====================================================
  if (authLoading) {
	return (
  	<main className="flex min-h-screen items-center justify-center">
    	<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  	</main>
	);
  }
  // =====================================================
  // 未ログイン
  // =====================================================
  if (!user) {
	return (
  	<main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    	<Card className="w-full max-w-md rounded-3xl p-6 text-center shadow-xl">
      	<CalendarDays className="mx-auto h-12 w-12 text-blue-600" />
      	<h1 className="mt-4 text-2xl font-bold">
        	みんなの予定カレンダー
      	</h1>
      	<p className="mt-2 text-sm text-slate-500">
        	予定の閲覧・登録にはDiscordログインが必要です。
      	</p>
      	<Button
        	onClick={login}
        	className="mt-6 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700"
      	>
        	Discordでログイン
      	</Button>
    	</Card>
  	</main>
	);
  }
  // =====================================================
  // 選択日の情報
  // =====================================================
  const selectedKey = selectedDate
	? localDateKey(selectedDate)
	: "";
  const selectedStatuses = selectedKey
	? statuses[selectedKey] ?? {}
	: {};
  const myStatus = selectedStatuses[user.id];
  // =====================================================
  // 画面
  // =====================================================
  return (
	<main className="min-h-screen overflow-x-auto bg-gradient-to-br from-slate-50 via-white to-blue-50 p-3 text-slate-800 sm:p-6">
  	<div className="mx-auto w-[704px] min-w-[704px] max-w-[704px]">
    	{/* ===============================================
        	ヘッダー
    	=============================================== */}
    	<header className="mb-5 flex items-end justify-between gap-3">
      	<div>
        	<div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-600">
          	<CalendarDays className="h-4 w-4" />
          	予定管理
        	</div>
        	<h1 className="text-3xl font-bold">
          	みんなの予定カレンダー
        	</h1>
        	<p className="mt-1 text-sm text-slate-500">
          	日付をタップして、自分の都合を登録します。
        	</p>
      	</div>
      	<div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm">
        	{currentProfile && (
          	<img
            	src={
              	currentProfile.avatar_url ||
              	fallbackAvatar(currentProfile.display_name)
            	}
            	alt={currentProfile.display_name}
            	className="h-9 w-9 rounded-full border-2 border-blue-500 object-cover"
          	/>
        	)}
        	<div>
          	<p className="text-xs text-slate-400">
            	ログイン中
          	</p>
          	<p className="max-w-28 truncate text-sm font-semibold">
            	{currentProfile?.display_name ||
              	user.email ||
              	"Discord User"}
          	</p>
        	</div>
        	<Button
          	variant="ghost"
          	size="icon"
          	onClick={logout}
        	>
          	<LogOut className="h-4 w-4" />
        	</Button>
      	</div>
    	</header>
    	{/* ===============================================
        	カレンダー
    	=============================================== */}
    	<Card className="h-[768px] w-[704px] overflow-hidden rounded-3xl bg-white shadow-xl">
      	<CardHeader className="h-[80px] border-b px-5 py-4">
        	<div className="flex h-full items-center justify-between">
          	<div className="flex items-center gap-2">
            	<Button
              	variant="outline"
              	size="icon"
              	onClick={() =>
                	setCursor(new Date(year, month - 1, 1))
              	}
            	>
              	<ChevronLeft />
            	</Button>
            	<CardTitle className="w-[170px] text-center text-2xl">
              	{year}年 {month + 1}月
            	</CardTitle>
            	<Button
              	variant="outline"
              	size="icon"
              	onClick={() =>
                	setCursor(new Date(year, month + 1, 1))
              	}
            	>
              	<ChevronRight />
            	</Button>
          	</div>
          	<div className="flex items-center gap-2">
            	<select
              	value={year}
              	onChange={(e) =>
                	setCursor(
                  	new Date(Number(e.target.value), month, 1)
                	)
              	}
              	className="h-9 w-[88px] rounded-xl border px-2 text-xs"
            	>
              	{Array.from(
                	{ length: 11 },
                	(_, i) =>
  (today?.getFullYear() ?? 2025) - 5 + i
              	).map((value) => (
                	<option key={value} value={value}>
                  	{value}年
                	</option>
              	))}
            	</select>
            	<select
              	value={month}
              	onChange={(e) =>
                	setCursor(
                  	new Date(year, Number(e.target.value), 1)
                	)
              	}
              	className="h-9 w-[72px] rounded-xl border px-2 text-xs"
            	>
              	{Array.from({ length: 12 }, (_, i) => (
                	<option key={i} value={i}>
                  	{i + 1}月
                	</option>
              	))}
            	</select>
            	<Button
              	variant="secondary"
              	className="h-9"
              	onClick={() =>
                	setCursor(
                  	today
  ? new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  : new Date(2025, 0, 1)
                	)
              	}
            	>
              	今月
            	</Button>
          	</div>
        	</div>
      	</CardHeader>
      	<CardContent className="h-[688px] p-0">
        	{/* 曜日 */}
        	<div className="grid h-11 grid-cols-7 border-b bg-slate-50 text-xs font-semibold">
          	{["日", "月", "火", "水", "木", "金", "土"].map(
            	(label, i) => (
              	<div
                	key={label}
                	className={`flex items-center justify-center ${
                  	i === 0
                    	? "text-rose-500"
                    	: i === 6
                    	? "text-blue-500"
                    	: "text-slate-500"
                	}`}
              	>
                	{label}
              	</div>
            	)
          	)}
        	</div>
        	{/* 日付42マス */}
        	<div className="relative grid h-[644px] grid-cols-7 grid-rows-6">
          	{calendarLoading && (
            	<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              	<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            	</div>
          	)}
          	{cells.map((date, index) => {
            	if (!date) {
              	return (
                	<div
                  	key={`empty-${index}`}
                  	className="min-h-0 min-w-0 border-b border-r bg-slate-50/40"
                	/>
              	);
            	}
            	const key = localDateKey(date);
            	const day = statuses[key] ?? {};
            	const visible = profiles.filter(
              	(profile) =>
                	day[profile.id] === "ok" ||
                	day[profile.id] === "maybe"
            	);
            	const isToday =
  today !== null &&
  date.toDateString() === today.toDateString();
            	return (
              	<motion.button
                	key={key}
                	whileHover={{
                  	backgroundColor: "#eff6ff",
                	}}
                	onClick={() => {
                  	setSelectedDate(date);
                  	setMessage("");
                	}}
                	className="min-h-0 min-w-0 overflow-hidden border-b border-r p-2 text-left"
              	>
                	<span
                  	className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    	isToday
                      	? "bg-blue-600 text-white"
                      	: ""
                  	}`}
                	>
                  	{date.getDate()}
                	</span>
                	<div className="mt-2 grid grid-cols-4 place-items-center gap-1">
                  	{visible.slice(0, 8).map((profile) => (
                    	<StatusAvatar
                      	key={profile.id}
                      	profile={profile}
                      	status={day[profile.id]}
                    	/>
                  	))}
                	</div>
              	</motion.button>
            	);
          	})}
        	</div>
      	</CardContent>
    	</Card>
    	{/* ===============================================
        	メンバーメモ
    	=============================================== */}
    	<section className="mt-5 w-[704px] rounded-3xl border bg-white p-5 shadow-xl">
      	<div className="mb-5">
        	<h2 className="text-xl font-bold">
          	メンバーメモ
        	</h2>
        	<p className="mt-1 text-sm text-slate-500">
          	全員のメモを確認できます。
          	編集できるのは自分のメモだけです。
        	</p>
      	</div>
      	{/* メモ読み込み中 */}
      	{memoLoading && (
        	<div className="mb-4 flex items-center gap-2 text-sm text-blue-600">
          	<Loader2 className="h-4 w-4 animate-spin" />
          	メモを読み込み中...
        	</div>
      	)}
      	{/* メンバーがいない場合 */}
      	{profiles.length === 0 && (
        	<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          	メンバー情報を読み込み中です。
        	</p>
      	)}
      	{/* メンバー別メモ */}
      	<div className="space-y-4">
        	{profiles.map((profile) => {
          	const isMe = profile.id === user.id;
          	const image =
            	profile.avatar_url ||
            	fallbackAvatar(profile.display_name);
          	return (
            	<div
              	key={profile.id}
              	className={
                	isMe
                  	? "rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-4"
                  	: "rounded-2xl border border-slate-200 bg-slate-50 p-4"
              	}
            	>
              	{/* アイコンと名前 */}
              	<div className="mb-3 flex items-center gap-3">
                	<img
                  	src={image}
                  	alt={profile.display_name}
                  	className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm"
                	/>
                	<div className="min-w-0 flex-1">
                  	<div className="flex items-center gap-2">
                    	<p className="truncate font-semibold text-slate-800">
                      	{profile.display_name}
                    	</p>
                    	{isMe && (
                      	<span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                        	自分
                      	</span>
                    	)}
                  	</div>
                  	<p className="text-xs text-slate-400">
                    	{isMe
                      	? "この欄だけ編集できます"
                      	: "閲覧のみ"}
                  	</p>
                	</div>
              	</div>
              	{/* 自分のメモ */}
              	{isMe ? (
                	<>
                  	<textarea
                    	value={myMemoDraft}
                    	onChange={(event) => {
                      	setMyMemoDraft(event.target.value);
                      	setMemoMessage("");
                    	}}
                    	disabled={memoLoading || memoSaving}
                    	rows={4}
                    	placeholder="予定に関する補足や希望時間などを入力してください"
                    	className="w-full resize-y rounded-xl border border-blue-200 bg-white p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  	/>
                  	<div className="mt-2 flex items-center justify-between">
                    	<span className="text-xs text-slate-400">
                      	文字数制限なし
                    	</span>
                    	<Button
                      	type="button"
                      	disabled={memoSaving || memoLoading}
                      	onClick={saveMyMemo}
                      	className="rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-700"
                    	>
                      	{memoSaving
                        	? "保存中..."
                        	: "メモを保存"}
                    	</Button>
                  	</div>
                  	{memoMessage && (
                    	<p className="mt-2 text-sm text-blue-700">
                      	{memoMessage}
                    	</p>
                  	)}
                	</>
              	) : (
                	/* 他人のメモ */
                	<div className="min-h-[76px] whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
                  	{memos[profile.id]?.trim()
                    	? memos[profile.id]
                    	: "メモはまだありません。"}
                	</div>
              	)}
            	</div>
          	);
        	})}
      	</div>
      	{/* メモの再取得 */}
      	<div className="mt-5 flex justify-end">
        	<Button
          	variant="outline"
          	onClick={loadMemos}
          	disabled={memoLoading || memoSaving}
          	className="rounded-xl"
        	>
          	<RotateCcw className="mr-2 h-4 w-4" />
          	メモを更新
        	</Button>
      	</div>
    	</section>
  	</div>
  	{/* ===============================================
      	日付詳細画面
  	=============================================== */}
  	<AnimatePresence>
    	{selectedDate && (
      	<motion.div
        	initial={{ opacity: 0 }}
        	animate={{ opacity: 1 }}
        	exit={{ opacity: 0 }}
        	className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        	onClick={() => setSelectedDate(null)}
      	>
        	<motion.div
          	initial={{ y: 30, opacity: 0 }}
          	animate={{ y: 0, opacity: 1 }}
          	exit={{ y: 30, opacity: 0 }}
          	onClick={(e) => e.stopPropagation()}
          	className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        	>
          	{/* 日付 */}
          	<div className="flex justify-between">
            	<div>
              	<p className="text-sm font-semibold text-blue-600">
                	予定を登録
              	</p>
              	<h2 className="text-2xl font-bold">
                	{selectedDate.getFullYear()}年
                	{selectedDate.getMonth() + 1}月
                	{selectedDate.getDate()}日
              	</h2>
            	</div>
            	<Button
              	variant="ghost"
              	size="icon"
              	onClick={() => setSelectedDate(null)}
            	>
              	<X />
            	</Button>
          	</div>
          	{/* 自分の予定 */}
          	<div className="mt-5 rounded-2xl border bg-slate-50 p-4">
            	<p className="mb-3 font-semibold">
              	現在：
              	{myStatus
                	? `${statusMeta[myStatus].symbol} ${statusMeta[myStatus].label}`
                	: "未回答"}
            	</p>
            	<div className="grid grid-cols-4 gap-2">
              	{(Object.entries(statusMeta) as [
                	Status,
                	(typeof statusMeta)[Status]
              	][]).map(([key, meta]) => (
                	<button
                  	key={key}
                  	disabled={saving}
                  	onClick={() => saveStatus(key)}
                  	className={`rounded-2xl border p-3 text-center disabled:opacity-50 ${
                    	meta.tone
                  	} ${
                    	myStatus === key
                      	? "ring-2 ring-blue-500 ring-offset-2"
                      	: ""
                  	}`}
                	>
                  	<span className="block text-3xl font-bold">
                    	{meta.symbol}
                  	</span>
                  	<span className="text-[11px] font-semibold">
                    	{meta.label}
                  	</span>
                	</button>
              	))}
              	{/* 未回答 */}
              	<button
                	disabled={saving}
                	onClick={clearStatus}
                	className={`rounded-2xl border bg-white p-3 text-center disabled:opacity-50 ${
                  	!myStatus
                    	? "ring-2 ring-blue-500 ring-offset-2"
                    	: ""
                	}`}
              	>
                	<RotateCcw className="mx-auto h-7 w-7" />
                	<span className="mt-2 block text-[11px] font-semibold">
                  	未回答に戻す
                	</span>
              	</button>
            	</div>
            	{message && (
              	<p className="mt-3 text-sm text-blue-700">
                	{message}
              	</p>
            	)}
          	</div>
          	{/* 〇 △ × 一覧 */}
          	<div className="mt-6 space-y-5">
            	{(Object.entries(statusMeta) as [
              	Status,
              	(typeof statusMeta)[Status]
            	][]).map(([status, meta]) => {
              	const list = profiles.filter(
                	(profile) =>
                  	selectedStatuses[profile.id] === status
              	);
              	return (
                	<section key={status}>
                  	<div className="mb-2 flex items-center gap-2">
                    	<span
                      	className={`rounded-lg border px-2 py-1 font-bold ${meta.tone}`}
                    	>
                      	{meta.symbol}
                    	</span>
                    	<h3 className="font-semibold">
                      	{meta.label}
                    	</h3>
                    	<span className="text-sm text-slate-400">
                      	{list.length}人
                    	</span>
                  	</div>
                  	{list.length ? (
                    	<div className="grid grid-cols-3 gap-2">
                      	{list.map((profile) => (
                        	<div
                          	key={profile.id}
                          	className="flex items-center gap-2 rounded-xl border p-2"
                        	>
                          	<img
                            	src={
                              	profile.avatar_url ||
                              	fallbackAvatar(profile.display_name)
                            	}
                            	alt={profile.display_name}
                            	className="h-8 w-8 rounded-full"
                          	/>
                          	<span className="truncate text-sm">
                            	{profile.display_name}
                          	</span>
                        	</div>
                      	))}
                    	</div>
                  	) : (
                    	<p className="rounded-xl bg-slate-50 p-2 text-sm text-slate-400">
                      	該当者はいません
                    	</p>
                  	)}
                	</section>
              	);
            	})}
          	</div>
          	<Button
            	variant="outline"
            	className="mt-6 w-full rounded-xl"
            	onClick={() => setSelectedDate(null)}
          	>
            	閉じる
          	</Button>
        	</motion.div>
      	</motion.div>
    	)}
  	</AnimatePresence>
	</main>
  );
}
