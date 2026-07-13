import { notFound } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";
import {
  getProject,
  getArticles,
  getInsights,
  countArticles,
} from "@/lib/vault";
import { getDaily, getTop, getSummary, range, gscEnabled } from "@/lib/gsc";
import MetricsChart from "@/components/MetricsChart";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; days: number }> = {
  week: { label: "週", days: 7 },
  month: { label: "月", days: 28 },
  all: { label: "全期間", days: 480 },
};

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { period?: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const project = getProject(slug);
  if (!project) notFound();

  const periodKey = PERIODS[searchParams.period || ""] ? searchParams.period! : "month";
  const { days } = PERIODS[periodKey];
  const r = range(days);

  const articles = getArticles(slug);
  const insights = getInsights(slug);
  const articlesInPeriod = countArticles(articles, r.startDate);

  const site = project.gscSite || "";
  const [summary, daily, topQueries, topPages] = await Promise.all([
    getSummary(site, r.startDate, r.endDate),
    getDaily(site, r.startDate, r.endDate),
    getTop(site, r.startDate, r.endDate, "query", 20),
    getTop(site, r.startDate, r.endDate, "page", 10),
  ]);

  return (
    <main>
      <h1>{project.name}</h1>
      <p className="sub">
        {project.client}
        {project.siteUrl && (
          <>
            {" ・ "}
            <a href={project.siteUrl} target="_blank" style={{ textDecoration: "underline" }}>
              {project.siteUrl}
            </a>
          </>
        )}
        {project.started && ` ・ 開始 ${project.started}`}
        {project.status && (
          <>
            {" "}
            <span className="badge">{project.status}</span>
          </>
        )}
      </p>

      <div className="period-tabs">
        {Object.entries(PERIODS).map(([key, v]) => (
          <Link
            key={key}
            href={`/p/${slug}?period=${key}`}
            className={key === periodKey ? "active" : ""}
          >
            {v.label}
          </Link>
        ))}
      </div>
      <p className="sub">
        {r.startDate} 〜 {r.endDate}（GSCデータは約2日遅れ）
      </p>

      {!gscEnabled() && (
        <div className="notice">⚠️ Search Console未接続（README参照）</div>
      )}
      {gscEnabled() && !summary && site && (
        <div className="notice">
          ⚠️ GSCデータを取得できませんでした。サービスアカウントが{" "}
          <code>{site}</code> に追加されているか確認してください。
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="label">クリック</div>
          <div className="value">{summary ? summary.clicks.toLocaleString() : "–"}</div>
        </div>
        <div className="metric">
          <div className="label">表示回数</div>
          <div className="value">{summary ? summary.impressions.toLocaleString() : "–"}</div>
        </div>
        <div className="metric">
          <div className="label">CTR</div>
          <div className="value">
            {summary ? (summary.ctr * 100).toFixed(1) : "–"}
            <span className="unit">%</span>
          </div>
        </div>
        <div className="metric">
          <div className="label">平均順位</div>
          <div className="value">{summary ? summary.position.toFixed(1) : "–"}</div>
        </div>
        <div className="metric">
          <div className="label">記事作成数</div>
          <div className="value">
            {articlesInPeriod}
            <span className="unit"> / 累計{articles.length}</span>
          </div>
        </div>
      </div>

      {daily && daily.length > 0 && (
        <div className="card">
          <MetricsChart
            data={daily.map((d) => ({
              date: d.date,
              clicks: d.clicks,
              impressions: d.impressions,
            }))}
          />
        </div>
      )}

      <div className="grid2">
        <section>
          <h2>検索ワード TOP20</h2>
          <div className="card">
            {topQueries && topQueries.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>キーワード</th>
                    <th className="num">クリック</th>
                    <th className="num">表示</th>
                    <th className="num">順位</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((q) => (
                    <tr key={q.key}>
                      <td>{q.key}</td>
                      <td className="num">{q.clicks}</td>
                      <td className="num">{q.impressions}</td>
                      <td
                        className={
                          "num " +
                          (q.position <= 3
                            ? "pos-good"
                            : q.position <= 10
                            ? "pos-mid"
                            : "")
                        }
                      >
                        {q.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="sub" style={{ margin: 0 }}>データなし</p>
            )}
          </div>
        </section>

        <section>
          <h2>人気ページ TOP10</h2>
          <div className="card">
            {topPages && topPages.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>ページ</th>
                    <th className="num">クリック</th>
                    <th className="num">順位</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((p) => (
                    <tr key={p.key}>
                      <td>
                        <a href={p.key} target="_blank">
                          {p.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
                        </a>
                      </td>
                      <td className="num">{p.clicks}</td>
                      <td className="num">{p.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="sub" style={{ margin: 0 }}>データなし</p>
            )}
          </div>
        </section>
      </div>

      <h2>記事一覧（{articles.length}本）</h2>
      <div className="card">
        {articles.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>公開日</th>
                <th>タイトル</th>
                <th>狙いキーワード</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.file}>
                  <td>{a.published || "–"}</td>
                  <td>
                    {a.url ? (
                      <a href={a.url} target="_blank" style={{ textDecoration: "underline" }}>
                        {a.title}
                      </a>
                    ) : (
                      a.title
                    )}
                  </td>
                  <td>{a.keyword || "–"}</td>
                  <td>{a.status || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="sub" style={{ margin: 0 }}>
            まだ記事がありません。vault/案件/{slug}/記事/ にMarkdownを追加してください。
          </p>
        )}
      </div>

      <div className="grid2">
        <section>
          <h2>案件詳細</h2>
          <div className="card prose">
            {project.instructor?.name && (
              <p>
                <b>講師:</b> {project.instructor.name}
                {project.instructor.profile && ` — ${project.instructor.profile}`}
              </p>
            )}
            {project.pillarKeywords.length > 0 && (
              <p>
                <b>ピラーKW:</b> {project.pillarKeywords.join(" / ")}
              </p>
            )}
            <div
              dangerouslySetInnerHTML={{
                __html: marked.parse(project.body) as string,
              }}
            />
          </div>
        </section>

        <section>
          <h2>知見（{insights.length}件）</h2>
          <div className="card">
            {insights.length > 0 ? (
              <ul style={{ paddingLeft: 20, fontSize: 14 }}>
                {insights.map((i) => (
                  <li key={i.file}>{i.title}</li>
                ))}
              </ul>
            ) : (
              <p className="sub" style={{ margin: 0 }}>
                vault/案件/{slug}/知見/ にノートを追加すると表示されます。
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
