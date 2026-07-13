import Link from "next/link";
import { getProjects, getArticles, countArticles } from "@/lib/vault";
import { getSummary, range, gscEnabled } from "@/lib/gsc";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = getProjects();
  const r = range(28);

  const rows = await Promise.all(
    projects.map(async (p) => {
      const articles = getArticles(p.slug);
      const summary = p.gscSite
        ? await getSummary(p.gscSite, r.startDate, r.endDate)
        : null;
      return { p, articles, summary };
    })
  );

  const totalClicks = rows.reduce((s, x) => s + (x.summary?.clicks || 0), 0);
  const totalImp = rows.reduce((s, x) => s + (x.summary?.impressions || 0), 0);
  const totalArticles = rows.reduce((s, x) => s + x.articles.length, 0);
  const recentArticles = rows.reduce(
    (s, x) => s + countArticles(x.articles, r.startDate),
    0
  );

  return (
    <main>
      <h1>全体サマリー</h1>
      <p className="sub">
        直近28日（{r.startDate} 〜 {r.endDate}）・案件 {projects.length} 件
      </p>

      {!gscEnabled() && (
        <div className="notice">
          ⚠️ Search Console未接続です。環境変数{" "}
          <code>GSC_SERVICE_ACCOUNT_JSON</code>{" "}
          を設定するとアクセスデータが表示されます（設定手順はREADME参照）。
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="label">クリック（28日）</div>
          <div className="value">{totalClicks.toLocaleString()}</div>
        </div>
        <div className="metric">
          <div className="label">表示回数（28日）</div>
          <div className="value">{totalImp.toLocaleString()}</div>
        </div>
        <div className="metric">
          <div className="label">記事数（累計）</div>
          <div className="value">{totalArticles}</div>
        </div>
        <div className="metric">
          <div className="label">記事数（28日）</div>
          <div className="value">{recentArticles}</div>
        </div>
      </div>

      <h2>案件一覧</h2>
      <div className="project-cards">
        {rows.map(({ p, articles, summary }) => (
          <Link key={p.slug} href={`/p/${p.slug}`} className="project-card">
            <div className="name">{p.name}</div>
            <div className="client">
              {p.client} {p.status && <span className="badge">{p.status}</span>}
            </div>
            <div className="stats">
              <div>
                <b>{articles.length}</b>記事
              </div>
              <div>
                <b>{summary ? summary.clicks.toLocaleString() : "–"}</b>
                クリック/28日
              </div>
              <div>
                <b>{summary ? summary.position.toFixed(1) : "–"}</b>平均順位
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
