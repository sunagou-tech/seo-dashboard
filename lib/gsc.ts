import { GoogleAuth } from "google-auth-library";

/** Search Console APIクライアント。
 * 環境変数 GSC_SERVICE_ACCOUNT_JSON にサービスアカウントのJSONキー全文を入れる。
 * 未設定でもダッシュボードは動く（GSC欄が「未接続」表示になる）。
 */

export function gscEnabled(): boolean {
  return !!process.env.GSC_SERVICE_ACCOUNT_JSON;
}

let _auth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!_auth) {
    _auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON!),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
  }
  return _auth;
}

// 1時間のインメモリキャッシュ（GSC APIのクォータ節約）
const cache = new Map<string, { t: number; v: any }>();
const TTL = 60 * 60 * 1000;

async function query(site: string, body: any): Promise<any | null> {
  if (!gscEnabled() || !site) return null;
  const key = site + JSON.stringify(body);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    const client = await getAuth().getClient();
    const res = await client.request({
      url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        site
      )}/searchAnalytics/query`,
      method: "POST",
      data: body,
    });
    cache.set(key, { t: Date.now(), v: res.data });
    return res.data;
  } catch (e: any) {
    console.error(`GSC query failed for ${site}:`, e?.message || e);
    return null;
  }
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GSCデータは約2日遅れなので、endは今日-2日 */
export function range(days: number): { startDate: string; endDate: string } {
  const end = new Date(Date.now() - 2 * 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return { startDate: dateStr(start), endDate: dateStr(end) };
}

export type DailyRow = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type TopRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Summary = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function getDaily(
  site: string,
  startDate: string,
  endDate: string
): Promise<DailyRow[] | null> {
  const data = await query(site, {
    startDate,
    endDate,
    dimensions: ["date"],
    rowLimit: 500,
  });
  if (!data) return null;
  return (data.rows || []).map((r: any) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export async function getTop(
  site: string,
  startDate: string,
  endDate: string,
  dimension: "query" | "page",
  limit = 20
): Promise<TopRow[] | null> {
  const data = await query(site, {
    startDate,
    endDate,
    dimensions: [dimension],
    rowLimit: limit,
  });
  if (!data) return null;
  return (data.rows || []).map((r: any) => ({
    key: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export async function getSummary(
  site: string,
  startDate: string,
  endDate: string
): Promise<Summary | null> {
  const data = await query(site, { startDate, endDate, rowLimit: 1 });
  if (!data) return null;
  const r = (data.rows || [])[0];
  if (!r) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  };
}
