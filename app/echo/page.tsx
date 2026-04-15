"use client";

// 静的プリレンダリングを無効化（Supabase / 音声再生など client API を使うため）
export const dynamic = "force-dynamic";

import { SavedPhrasesTab } from "@/app/components/SavedPhrasesTab";
import { VoicePlayButton } from "@/app/components/VoicePlayButton";
import {
  GUEST_LIMIT,
  getGuestCount,
  incrementGuestCount,
  isGuestLimitReached,
} from "@/lib/guestUsage";
import { PRESET_SCENES, type PresetScene, getSceneById } from "@/lib/presetScenes";
import { PRESET_VOICES, type PresetVoice } from "@/lib/presetVoices";
import {
  type SceneSuggestCacheEntry,
  type SceneSuggestedPhrase,
  cacheKeyFor,
  isCacheEntryFresh,
  isSceneCompletedFromPhrases,
} from "@/lib/sceneSuggest";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGuestSelectedVoiceId } from "@/lib/voiceSessionStorage";
import Link from "next/link";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * `/echo` ルート — 分身の声で英フレーズを聞く独立画面（Sprint 2 / mvp-scope.md 7.Q9）。
 *
 * 構成：
 *   ヘッダー + 現在の分身の声 + タブ（プリセット場面 / 保存したフレーズ）
 *   場面タブ：カード一覧 → 場面詳細（3 フレーズ + 字幕トグル + ナビボタン）
 *   保存タブ：Sprint 5 まではプレースホルダ
 *
 * 分身の声作成フローは `/settings/voice` に分離（Sprint 2 で移設）。
 */

type AuthMode = boolean | null;
type Tab = "scenes" | "saved";

interface CurrentVoice {
  voice: PresetVoice;
  source: "auth" | "guest";
}

export default function EchoPage() {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [currentVoice, setCurrentVoice] = useState<CurrentVoice | null>(null);
  const [tab, setTab] = useState<Tab>("scenes");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  // ゲストの統合カウント。`/app` と同じく state で保持し、再生のたびに live 更新する
  const [guestCount, setGuestCount] = useState(0);

  // マウント時に auth 状態と selected_voice_id を解決
  useEffect(() => {
    let cancelled = false;

    const resolveVoice = (voiceId: string | null, source: "auth" | "guest") => {
      if (!voiceId) {
        setCurrentVoice(null);
        return;
      }
      const found = PRESET_VOICES.find((v) => v.voiceId === voiceId);
      setCurrentVoice(found ? { voice: found, source } : null);
    };

    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;

        if (user) {
          setAuthMode(true);
          try {
            const res = await fetch("/api/voice-session", { method: "GET" });
            if (cancelled) return;
            if (res.ok) {
              const json = (await res.json()) as { voiceId: string | null };
              resolveVoice(json.voiceId, "auth");
            } else {
              setCurrentVoice(null);
            }
          } catch {
            setCurrentVoice(null);
          }
        } else {
          setAuthMode(false);
          resolveVoice(getGuestSelectedVoiceId(), "guest");
          setGuestCount(getGuestCount());
          // ゲスト上限に既に到達していればモーダルを出す（他ページからの遷移ケース）
          if (isGuestLimitReached()) {
            setShowGuestLimitModal(true);
            posthog.capture("guest_limit_reached");
          }
        }
      } catch {
        if (cancelled) return;
        setAuthMode(false);
        resolveVoice(getGuestSelectedVoiceId(), "guest");
        setGuestCount(getGuestCount());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedScene = useMemo(
    () => (selectedSceneId ? getSceneById(selectedSceneId) : undefined),
    [selectedSceneId]
  );

  const handleSelectScene = useCallback((scene: PresetScene) => {
    setSelectedSceneId(scene.id);
    posthog.capture("scene_selected", { scene_id: scene.id });
  }, []);

  const handleBackToScenes = useCallback(() => {
    setSelectedSceneId(null);
  }, []);

  const voiceId = currentVoice?.voice.voiceId ?? null;
  const isGuest = authMode === false;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">場面で聞く</h1>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            トップ
          </Link>
          <span className="text-gray-700">|</span>
          <Link href="/app" className="text-gray-400 hover:text-white transition-colors">
            会話
          </Link>
          <span className="text-gray-700">|</span>
          <Link href="/settings/voice" className="text-gray-400 hover:text-white transition-colors">
            分身の声
          </Link>
        </nav>
      </header>

      {currentVoice ? (
        <CurrentVoiceBanner
          voice={currentVoice.voice}
          source={currentVoice.source}
          isAuth={authMode === true}
        />
      ) : authMode !== null ? (
        <NoVoiceCta />
      ) : null}

      {/* タブ */}
      <div className="flex border-b border-gray-800">
        <TabButton active={tab === "scenes"} onClick={() => setTab("scenes")}>
          プリセット場面
        </TabButton>
        <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
          保存したフレーズ
        </TabButton>
      </div>

      {tab === "scenes" ? (
        selectedScene ? (
          <SceneDetail
            scene={selectedScene}
            voiceId={voiceId}
            isGuest={isGuest}
            isAuth={authMode === true}
            onBack={handleBackToScenes}
            onPlayStart={() => {
              if (!isGuest) return true;
              // 上限到達後のクリックは即キャンセル（/app と同じ挙動）
              if (isGuestLimitReached()) {
                setShowGuestLimitModal(true);
                posthog.capture("guest_limit_reached");
                return false;
              }
              const newCount = incrementGuestCount("phrase_play");
              setGuestCount(newCount);
              posthog.capture("guest_usage_incremented", {
                event: "phrase_play",
                count: newCount,
              });
              // この回で上限に達したら、モーダルを出し再生はキャンセル（/app パターン）
              if (newCount >= GUEST_LIMIT) {
                setShowGuestLimitModal(true);
                return false;
              }
              return true;
            }}
            guestCount={guestCount}
          />
        ) : (
          <SceneList
            scenes={PRESET_SCENES}
            onSelect={handleSelectScene}
            hasVoice={voiceId !== null}
          />
        )
      ) : (
        <SavedPhrasesTab authMode={authMode} voiceId={voiceId} />
      )}

      {isGuest && !showGuestLimitModal && (
        <p className="text-center text-xs text-gray-500">
          ゲストモード（無料体験 {guestCount}/{GUEST_LIMIT}）
        </p>
      )}

      {showGuestLimitModal && <GuestLimitModal />}
    </main>
  );
}

// -------------------------------------------------------
// 共通パーツ
// -------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
        active ? "border-rose-400 text-white" : "border-transparent text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

// -------------------------------------------------------
// 現在の分身の声 / 未作成 CTA
// -------------------------------------------------------

function CurrentVoiceBanner({
  voice,
  source,
  isAuth,
}: {
  voice: PresetVoice;
  source: "auth" | "guest";
  isAuth: boolean;
}) {
  const savedLabel =
    source === "auth" || isAuth
      ? "アカウントに保存済み"
      : "ブラウザに保存（ログインで引き継ぎ可能）";

  return (
    <section
      className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 px-4 py-3 text-sm"
      aria-label="現在の分身の声"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-emerald-300/80">現在の分身の声</p>
          <p className="mt-0.5 truncate text-base font-semibold text-white">
            {voice.description}
            <span className="ml-2 text-xs text-emerald-200/60">枠 {voice.slot}</span>
          </p>
          <p className="mt-1 text-xs text-emerald-200/70">{savedLabel}</p>
        </div>
        <Link
          href="/settings/voice"
          className="shrink-0 rounded-lg border border-emerald-800/70 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/30 transition-colors"
        >
          選び直す
        </Link>
      </div>
    </section>
  );
}

function NoVoiceCta() {
  return (
    <section className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-5 text-center">
      <p className="text-base text-white">まだ分身の声が作られていません</p>
      <p className="mt-1 text-sm text-rose-200/80">
        10〜15 秒の録音から、あなたの声に似た 8 つの候補を選べます。
      </p>
      <Link
        href="/settings/voice"
        className="mt-4 inline-block rounded-full bg-rose-500 hover:bg-rose-400 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-rose-900/40 transition-colors"
      >
        分身の声を作る
      </Link>
    </section>
  );
}

// -------------------------------------------------------
// 場面カード一覧
// -------------------------------------------------------

function SceneList({
  scenes,
  onSelect,
  hasVoice,
}: {
  scenes: readonly PresetScene[];
  onSelect: (scene: PresetScene) => void;
  hasVoice: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      {!hasVoice && (
        <p className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-xs text-gray-400">
          分身の声を作成すると、各場面のフレーズを再生できるようになります。
        </p>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {scenes.map((scene) => (
          <li key={scene.id}>
            <button
              type="button"
              onClick={() => onSelect(scene)}
              className="w-full rounded-2xl border border-gray-800 bg-gray-900/60 p-4 text-left hover:border-rose-700 hover:bg-gray-900 transition-colors"
            >
              <p className="text-base font-semibold text-white">{scene.title}</p>
              <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{scene.situationJa}</p>
              <p className="mt-2 text-xs text-rose-300/80">AI が 3 フレーズを提案</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// -------------------------------------------------------
// 場面詳細
// -------------------------------------------------------

type FetchState = "idle" | "loading" | "ready" | "error";

function SceneDetail({
  scene,
  voiceId,
  isGuest,
  isAuth,
  onBack,
  onPlayStart,
  guestCount,
}: {
  scene: PresetScene;
  voiceId: string | null;
  isGuest: boolean;
  /** 認証済みなら保存ボタンを有効化。false はゲスト／解決前。 */
  isAuth: boolean;
  onBack: () => void;
  /** `false` で再生キャンセル（ゲスト上限などのゲートに使う） */
  onPlayStart: (phraseId: string) => boolean | undefined;
  /** 親が state で保持する統合カウント。live 表示に使う */
  guestCount: number;
}) {
  const [phrases, setPhrases] = useState<SceneSuggestedPhrase[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [isFallback, setIsFallback] = useState(false);
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [completedFired, setCompletedFired] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const loadPhrases = useCallback(
    async (options: { forceRefresh: boolean }) => {
      // 前回の fetch は abort
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const storageKey = cacheKeyFor(scene.id);

      // キャッシュ参照（forceRefresh でスキップ）
      if (!options.forceRefresh && typeof window !== "undefined") {
        try {
          const raw = window.sessionStorage.getItem(storageKey);
          if (raw) {
            const entry = JSON.parse(raw) as SceneSuggestCacheEntry;
            if (
              isCacheEntryFresh(entry) &&
              Array.isArray(entry.phrases) &&
              entry.phrases.length > 0
            ) {
              setPhrases(entry.phrases);
              setIsFallback(entry.fallback === true);
              setFetchState("ready");
              return;
            }
          }
        } catch {
          // JSON 破損等はキャッシュ無視
        }
      }

      setFetchState("loading");
      try {
        const res = await fetch("/api/scene-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene_id: scene.id,
            situation_ja: scene.situationJa,
            emotion_ja: scene.emotionJa,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("サジェストの生成に失敗しました");
        }
        const data = (await res.json()) as {
          phrases: SceneSuggestedPhrase[];
          fallback?: boolean;
        };
        if (controller.signal.aborted) return;
        setPhrases(data.phrases ?? []);
        setIsFallback(data.fallback === true);
        setFetchState("ready");
        if (typeof window !== "undefined") {
          try {
            const entry: SceneSuggestCacheEntry = {
              phrases: data.phrases ?? [],
              fallback: data.fallback === true,
              fetched_at: Date.now(),
            };
            window.sessionStorage.setItem(storageKey, JSON.stringify(entry));
          } catch {
            // quota 等は無視（キャッシュは best-effort）
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("scene-suggest fetch error:", err);
        setFetchState("error");
      }
    },
    [scene.id, scene.situationJa, scene.emotionJa]
  );

  // 場面切替時：状態リセット + 再生成。abort で古い fetch を打ち切る。
  useEffect(() => {
    setPlayedIds(new Set());
    setCompletedFired(false);
    setIsFallback(false);
    void loadPhrases({ forceRefresh: false });
    return () => {
      abortRef.current?.abort();
    };
  }, [loadPhrases]);

  const handleRegenerate = useCallback(() => {
    posthog.capture("scene_phrases_regenerated", { scene_id: scene.id });
    setPlayedIds(new Set());
    setCompletedFired(false);
    void loadPhrases({ forceRefresh: true });
  }, [loadPhrases, scene.id]);

  const handlePlayEnd = useCallback(
    (phraseId: string) => {
      setPlayedIds((prev) => {
        if (prev.has(phraseId)) return prev;
        const next = new Set(prev);
        next.add(phraseId);
        if (!completedFired && isSceneCompletedFromPhrases(phrases, next)) {
          posthog.capture("scene_completed", { scene_id: scene.id });
          setCompletedFired(true);
        }
        return next;
      });
    },
    [phrases, scene.id, completedFired]
  );

  const handleNextPhrase = useCallback(() => {
    const next = phrases.find((p) => !playedIds.has(p.phrase_id));
    if (!next) return;
    const el = document.getElementById(`phrase-${next.phrase_id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [phrases, playedIds]);

  const allPlayed = phrases.length > 0 && playedIds.size >= phrases.length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← 別の場面へ
        </button>
        <button
          type="button"
          onClick={() => setShowSubtitles((v) => !v)}
          className="text-xs rounded-full border border-gray-700 px-3 py-1 text-gray-300 hover:border-gray-500 transition-colors"
          aria-pressed={showSubtitles}
        >
          字幕 {showSubtitles ? "ON" : "OFF"}
        </button>
      </div>

      <header className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-xl font-bold text-white">{scene.title}</h2>
        <p className="mt-2 text-sm text-gray-300">{scene.situationJa}</p>
        <p className="mt-1 text-xs text-gray-500">{scene.emotionJa}</p>
      </header>

      {fetchState === "loading" && (
        <p className="text-center text-sm text-gray-400">サジェストを生成中…</p>
      )}

      {fetchState === "error" && (
        <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-4 text-center">
          <p className="text-sm text-rose-200">サジェストの生成に失敗しました。</p>
          <button
            type="button"
            onClick={handleRegenerate}
            className="mt-3 rounded-full bg-rose-500 hover:bg-rose-400 px-4 py-1.5 text-xs text-white transition-colors"
          >
            もう一度試す
          </button>
        </div>
      )}

      {fetchState === "ready" && isFallback && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-2 text-center text-xs text-amber-200">
          AI 応答が取得できなかったため、基本フレーズを表示しています
        </p>
      )}

      {fetchState === "ready" && phrases.length > 0 && (
        <ul className="flex flex-col gap-3">
          {phrases.map((phrase, idx) => {
            const played = playedIds.has(phrase.phrase_id);
            return (
              <li
                key={phrase.phrase_id}
                id={`phrase-${phrase.phrase_id}`}
                className={`rounded-2xl border p-4 transition-colors ${
                  played
                    ? "border-emerald-800/50 bg-emerald-950/20"
                    : "border-gray-800 bg-gray-900/60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-gray-500">フレーズ {idx + 1}</span>
                  {played && <span className="text-xs text-emerald-300">聴きました</span>}
                </div>
                <p className="mt-1.5 text-lg font-semibold text-white">{phrase.en_text}</p>
                {showSubtitles && <p className="mt-1 text-xs text-gray-400">{phrase.ja_intent}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <VoicePlayButton
                    phraseId={phrase.phrase_id}
                    enText={phrase.en_text}
                    voiceId={voiceId}
                    sceneId={scene.id}
                    source="scene-ai"
                    onPlayStart={onPlayStart}
                    onPlayEnd={handlePlayEnd}
                    label={played ? "▶ もう一度聞く" : undefined}
                  />
                  <SaveScenePhraseButton
                    phraseId={phrase.phrase_id}
                    enText={phrase.en_text}
                    jaIntent={phrase.ja_intent}
                    isAuth={isAuth}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {fetchState === "ready" && phrases.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleNextPhrase}
            disabled={allPlayed}
            className="rounded-full border border-gray-700 bg-gray-900/60 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 text-sm text-white transition-colors"
          >
            次のフレーズへ
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={fetchState !== "ready"}
            className="rounded-full border border-gray-700 bg-gray-900/60 hover:bg-gray-800 px-5 py-2 text-sm text-white transition-colors"
          >
            他の言い方を見る
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-gray-700 bg-gray-900/60 hover:bg-gray-800 px-5 py-2 text-sm text-white transition-colors"
          >
            別の場面へ
          </button>
        </div>
      )}

      {voiceId === null && fetchState === "ready" && (
        <p className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-3 text-center text-sm text-rose-200">
          先に{" "}
          <Link href="/settings/voice" className="underline hover:text-white">
            分身の声を作る
          </Link>{" "}
          と、このフレーズを再生できます。
        </p>
      )}

      {isGuest && (
        <p className="text-center text-xs text-gray-500">
          ゲストモード（無料体験 {guestCount}/{GUEST_LIMIT}）
        </p>
      )}
    </section>
  );
}

// -------------------------------------------------------
// 動的生成フレーズ → 保存（Sprint 5 後 / source: "scene-ai"）
// -------------------------------------------------------

function SaveScenePhraseButton({
  phraseId,
  enText,
  jaIntent,
  isAuth,
}: {
  phraseId: string;
  enText: string;
  jaIntent: string;
  isAuth: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAuth) {
    return (
      <Link
        href="/login"
        className="text-xs text-gray-400 underline hover:text-white transition-colors"
      >
        保存するにはログイン
      </Link>
    );
  }

  const handleClick = async () => {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/saved-phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          en_text: enText,
          ja_text: jaIntent,
          source: "scene-ai",
          phrase_id_ref: phraseId,
        }),
      });
      if (res.status === 409) {
        // 既に保存済み：UX 的には成功と同等（ユーザーの期待：保存されている）
        setState("saved");
        posthog.capture("phrase_saved_from_scene", { phrase_id: phraseId, already_saved: true });
        return;
      }
      if (!res.ok) {
        throw new Error("保存に失敗しました");
      }
      setState("saved");
      posthog.capture("phrase_saved_from_scene", { phrase_id: phraseId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存に失敗しました";
      setState("error");
      setErrorMsg(message);
    }
  };

  const label = state === "saved" ? "保存済み" : state === "saving" ? "保存中…" : "保存する";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "saving" || state === "saved"}
        className="rounded-full border border-gray-700 bg-gray-900/60 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-default px-4 py-2 text-xs text-gray-200 transition-colors"
      >
        {label}
      </button>
      {errorMsg && (
        <p className="text-xs text-rose-300" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------
// ゲスト上限モーダル（/app と同系デザイン）
// -------------------------------------------------------

function GuestLimitModal() {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="text-2xl">🎉</div>
        <h2 className="text-lg font-semibold text-white">{GUEST_LIMIT}回分の体験が終わりました</h2>
        <p className="text-gray-400 text-base">
          続けるにはログインが必要です。ログインするとフレーズ保存や会話履歴も引き継げます。
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/login"
            onClick={() =>
              posthog.capture("signup_cta_clicked", {
                source: "guest_limit_modal",
                action: "login",
              })
            }
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-base font-medium transition-colors"
          >
            ログインする
          </Link>
          <Link
            href="/login?mode=signup"
            onClick={() =>
              posthog.capture("signup_cta_clicked", {
                source: "guest_limit_modal",
                action: "signup",
              })
            }
            className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-base font-medium transition-colors"
          >
            新規登録（無料）
          </Link>
        </div>
      </div>
    </div>
  );
}
