import { beforeEach, describe, expect, it, vi } from "vitest";

// -------------------------------------------------------
// /api/saved-phrases — インテグレーションテスト
//
// Sprint 5 で GET / DELETE を追加。Supabase クライアントをモックし、
// 認証 / source フィルタ / RLS 隔離（他ユーザー行を返さない）/ 404 を検証する。
//
// RLS は本テストで再現しないが、Supabase クライアント側で user A の select に対して
// user B の行を返さないことを「モックの振る舞い」として表現する（= Supabase 本番と同等の前提）。
// -------------------------------------------------------

interface Row {
  id: string;
  user_id: string;
  ja_text: string | null;
  en_text: string;
  en_text_normalized: string;
  source: "preset" | "user" | "suggest";
  phrase_id_ref: string | null;
  created_at: string;
}

const store: { rows: Row[] } = { rows: [] };
const authState: { user: { id: string } | null } = { user: null };

function buildQuery(table: string) {
  if (table !== "saved_phrases") {
    throw new Error(`unexpected table: ${table}`);
  }
  const filters: Array<(r: Row) => boolean> = [];
  // RLS 相当：常に auth user の行に絞る
  filters.push((r) => authState.user !== null && r.user_id === authState.user.id);

  let order: { column: keyof Row; asc: boolean } | null = null;
  let limit: number | null = null;

  const selectQuery = {
    eq(col: keyof Row, val: unknown) {
      filters.push((r) => r[col] === val);
      return selectQuery;
    },
    order(col: keyof Row, opts: { ascending: boolean }) {
      order = { column: col, asc: opts.ascending };
      return selectQuery;
    },
    limit(n: number) {
      limit = n;
      return selectQuery;
    },
    // Supabase クエリビルダーは PromiseLike（await 可能）なので then を実装する。
    // biome-ignore lint/suspicious/noThenProperty: 本物の Supabase クライアントと同じ thenable 振る舞いを模倣する
    then(resolve: (value: { data: Row[]; error: null }) => void) {
      let result = store.rows.filter((r) => filters.every((f) => f(r)));
      if (order) {
        const { column, asc } = order;
        result = [...result].sort((a, b) => {
          const av = a[column] ?? "";
          const bv = b[column] ?? "";
          if (av < bv) return asc ? -1 : 1;
          if (av > bv) return asc ? 1 : -1;
          return 0;
        });
      }
      if (limit !== null) result = result.slice(0, limit);
      resolve({ data: result, error: null });
    },
  };

  const deleteQuery = {
    eq(col: keyof Row, val: unknown) {
      filters.push((r) => r[col] === val);
      return deleteQuery;
    },
    select(_cols: string) {
      return {
        // biome-ignore lint/suspicious/noThenProperty: Supabase delete().select() も thenable
        then(resolve: (value: { data: Array<{ id: string }>; error: null }) => void) {
          const matched = store.rows.filter((r) => filters.every((f) => f(r)));
          store.rows = store.rows.filter((r) => !matched.includes(r));
          resolve({ data: matched.map((r) => ({ id: r.id })), error: null });
        },
      };
    },
  };

  return {
    select(_cols: string) {
      return selectQuery;
    },
    insert(row: Omit<Row, "id" | "created_at">) {
      const dup = store.rows.find(
        (r) => r.user_id === row.user_id && r.en_text_normalized === row.en_text_normalized
      );
      if (dup) {
        return {
          select(_c: string) {
            return {
              single() {
                return Promise.resolve({ data: null, error: { code: "23505" } });
              },
            };
          },
        };
      }
      const inserted: Row = {
        ...row,
        id: `id-${store.rows.length + 1}`,
        created_at: new Date().toISOString(),
      };
      store.rows.push(inserted);
      return {
        select(_c: string) {
          return {
            single() {
              return Promise.resolve({
                data: { id: inserted.id, created_at: inserted.created_at },
                error: null,
              });
            },
          };
        },
      };
    },
    delete() {
      return deleteQuery;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () =>
        authState.user
          ? { data: { user: authState.user }, error: null }
          : { data: { user: null }, error: null },
    },
    from: (table: string) => buildQuery(table),
  }),
}));

import { DELETE, GET, POST } from "./route";

function buildRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

function seed(rows: Array<Partial<Row>>) {
  store.rows = rows.map((r, i) => ({
    id: r.id ?? `seed-${i + 1}`,
    user_id: r.user_id ?? "user-a",
    ja_text: r.ja_text ?? null,
    en_text: r.en_text ?? "Hello.",
    en_text_normalized: r.en_text_normalized ?? "hello",
    source: r.source ?? "user",
    phrase_id_ref: r.phrase_id_ref ?? null,
    created_at: r.created_at ?? new Date(2026, 3, 14, 10, i).toISOString(),
  }));
}

describe("/api/saved-phrases", () => {
  beforeEach(() => {
    store.rows = [];
    authState.user = null;
  });

  describe("GET", () => {
    it("未認証は 401", async () => {
      const res = await GET(buildRequest("http://localhost/api/saved-phrases"));
      expect(res.status).toBe(401);
    });

    it("認証済みは自分の行のみ新しい順で返す", async () => {
      authState.user = { id: "user-a" };
      seed([
        { user_id: "user-a", en_text: "A1", created_at: "2026-04-14T10:00:00Z" },
        { user_id: "user-a", en_text: "A2", created_at: "2026-04-14T11:00:00Z" },
        { user_id: "user-b", en_text: "B1", created_at: "2026-04-14T12:00:00Z" },
      ]);
      const res = await GET(buildRequest("http://localhost/api/saved-phrases"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { items: Array<{ en_text: string }> };
      expect(data.items.map((i) => i.en_text)).toEqual(["A2", "A1"]);
    });

    it("source フィルタで絞り込める", async () => {
      authState.user = { id: "user-a" };
      seed([
        { user_id: "user-a", en_text: "P", source: "preset", en_text_normalized: "p" },
        { user_id: "user-a", en_text: "U", source: "user", en_text_normalized: "u" },
        { user_id: "user-a", en_text: "S", source: "suggest", en_text_normalized: "s" },
      ]);
      const res = await GET(buildRequest("http://localhost/api/saved-phrases?source=preset"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { items: Array<{ en_text: string }> };
      expect(data.items.map((i) => i.en_text)).toEqual(["P"]);
    });

    it("不正な source は 400", async () => {
      authState.user = { id: "user-a" };
      const res = await GET(buildRequest("http://localhost/api/saved-phrases?source=bad"));
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("未認証は 401", async () => {
      const res = await DELETE(buildRequest("http://localhost/api/saved-phrases?id=x"));
      expect(res.status).toBe(401);
    });

    it("id 未指定は 400", async () => {
      authState.user = { id: "user-a" };
      const res = await DELETE(buildRequest("http://localhost/api/saved-phrases"));
      expect(res.status).toBe(400);
    });

    it("自分の行を削除できる", async () => {
      authState.user = { id: "user-a" };
      seed([{ id: "row-1", user_id: "user-a" }]);
      const res = await DELETE(buildRequest("http://localhost/api/saved-phrases?id=row-1"));
      expect(res.status).toBe(200);
      expect(store.rows).toHaveLength(0);
    });

    it("他ユーザーの行は 404（RLS により削除対象 0 件）", async () => {
      authState.user = { id: "user-a" };
      seed([{ id: "row-b", user_id: "user-b" }]);
      const res = await DELETE(buildRequest("http://localhost/api/saved-phrases?id=row-b"));
      expect(res.status).toBe(404);
      expect(store.rows).toHaveLength(1); // 残存
    });

    it("存在しない id は 404", async () => {
      authState.user = { id: "user-a" };
      const res = await DELETE(buildRequest("http://localhost/api/saved-phrases?id=nope"));
      expect(res.status).toBe(404);
    });
  });

  describe("POST（Sprint 3 回帰）", () => {
    it("認証済みで preset 保存が通る", async () => {
      authState.user = { id: "user-a" };
      const res = await POST(
        buildRequest("http://localhost/api/saved-phrases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            en_text: "Card, please.",
            ja_text: "カードで",
            source: "preset",
            phrase_id_ref: "checkout_card",
          }),
        })
      );
      expect(res.status).toBe(200);
      expect(store.rows).toHaveLength(1);
      expect(store.rows[0].source).toBe("preset");
    });

    it("同じ正規化テキストの再保存は 409 ALREADY_SAVED", async () => {
      authState.user = { id: "user-a" };
      seed([
        {
          user_id: "user-a",
          en_text: "Hello.",
          en_text_normalized: "hello",
          source: "user",
        },
      ]);
      const res = await POST(
        buildRequest("http://localhost/api/saved-phrases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ en_text: "Hello.", source: "user" }),
        })
      );
      expect(res.status).toBe(409);
      const data = (await res.json()) as { code: string };
      expect(data.code).toBe("ALREADY_SAVED");
    });
  });
});
