import type { Article } from "./vault";
import type { TopRow } from "./gsc";

/** 記事×GSCデータの結合と、リライト候補の自動判定。
 * 判定ロジックは元記事（チャエン氏）の観点を再現:
 * - 主力記事の特定→さらに強化（FAQ追加等）
 * - 「あと一歩」（4〜15位で表示多い）を上位化
 * - 順位のわりにCTRが低い→タイトル・メタ改善
 * - クリック下落の検知
 */

export type Flag = {
  type: "pillar" | "chance" | "title" | "drop";
  label: string;
  reason: string;
};

export type ArticlePerf = {
  article: Article;
  cur?: TopRow;
  prev?: TopRow;
  flags: Flag[];
};

export function normalizeUrl(u: string): string {
  return u
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/** 順位ごとのCTRのおおよその目安 */
export function expectedCtr(pos: number): number {
  if (pos <= 1) return 0.25;
  if (pos <= 2) return 0.15;
  if (pos <= 3) return 0.1;
  if (pos <= 5) return 0.06;
  if (pos <= 10) return 0.03;
  if (pos <= 20) return 0.012;
  return 0.005;
}

export function judgeFlags(
  cur: TopRow | undefined,
  prev: TopRow | undefined,
  totalImpressions: number
): Flag[] {
  const flags: Flag[] = [];
  if (!cur) return flags;

  if (totalImpressions > 0 && cur.impressions / totalImpressions >= 0.3) {
    flags.push({
      type: "pillar",
      label: "主力",
      reason: `サイト全体の表示回数の${Math.round(
        (cur.impressions / totalImpressions) * 100
      )}%を占める。FAQ追加・内容拡充でさらに強化する価値が高い`,
    });
  }
  if (cur.position >= 4 && cur.position <= 15 && cur.impressions >= 50) {
    flags.push({
      type: "chance",
      label: "あと一歩",
      reason: `${cur.position.toFixed(1)}位で表示${
        cur.impressions
      }回。見出し追加・内部リンク・情報更新で上位化すれば流入が大きく増える`,
    });
  }
  if (cur.impressions >= 100 && cur.ctr < expectedCtr(cur.position) * 0.6) {
    flags.push({
      type: "title",
      label: "タイトル改善",
      reason: `CTR ${(cur.ctr * 100).toFixed(1)}%は${cur.position.toFixed(
        0
      )}位の目安（${(expectedCtr(cur.position) * 100).toFixed(
        0
      )}%前後）より低い。タイトル・説明文の見直し候補`,
    });
  }
  if (prev && prev.clicks >= 10 && cur.clicks < prev.clicks * 0.7) {
    flags.push({
      type: "drop",
      label: "下落",
      reason: `クリックが前期間${prev.clicks}→${cur.clicks}に減少。順位変動・鮮度低下を確認`,
    });
  }
  return flags;
}

export function analyzeArticles(
  articles: Article[],
  curPages: TopRow[] | null,
  prevPages: TopRow[] | null
): ArticlePerf[] {
  const curMap = new Map(
    (curPages || []).map((r) => [normalizeUrl(r.key), r])
  );
  const prevMap = new Map(
    (prevPages || []).map((r) => [normalizeUrl(r.key), r])
  );
  const totalImpressions = (curPages || []).reduce(
    (s, r) => s + r.impressions,
    0
  );

  return articles.map((a) => {
    const cur = a.url ? curMap.get(normalizeUrl(a.url)) : undefined;
    const prev = a.url ? prevMap.get(normalizeUrl(a.url)) : undefined;
    return { article: a, cur, prev, flags: judgeFlags(cur, prev, totalImpressions) };
  });
}

/** vault未登録も含む、GSC上の全ページからのリライト候補抽出（cron・一覧用） */
export function rewriteCandidates(
  curPages: TopRow[] | null,
  prevPages: TopRow[] | null,
  limit = 10
): { page: TopRow; flags: Flag[] }[] {
  if (!curPages) return [];
  const prevMap = new Map(
    (prevPages || []).map((r) => [normalizeUrl(r.key), r])
  );
  const totalImpressions = curPages.reduce((s, r) => s + r.impressions, 0);
  return curPages
    .map((p) => ({
      page: p,
      flags: judgeFlags(p, prevMap.get(normalizeUrl(p.key)), totalImpressions),
    }))
    .filter((x) => x.flags.length > 0)
    .sort((a, b) => b.page.impressions - a.page.impressions)
    .slice(0, limit);
}
