import { notFound } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";
import {
  getProject,
  getArticles,
  getInsights,
  getRankHistory,
  countArticles,
} from "@/lib/vault";
import {
  getDaily,
  getTop,
  getSummary,
  range,
  prevRange,
  gscEnabled,
} from "@/lib/gsc";
import { analyzeArticles, rewriteCandidates } from "@/lib/analysis";
import MetricsChart from "@/components/MetricsChart";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; days: number }> = {
  week: { label: "週", days: 7 },
  month: { label: "月", days: 28 },
  all: { label: "全期間", days: 480 },
};

function Delta({ cur, prev }: { cur: number; prev?: number }) {
  if (prev === undefined || prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="delta">±0%</span>;
  return (
    <span className={pct > 0 ? "delta up" : "delta down"}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

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
  const pr = prevRange(days);

  const articles = getArticles(slug);
  const insights = getInsights(slug);
  const rankHistory = getRankHistory(slug).slice(-8);
  const articlesInPeriod = countArticles(articles, r.startDate);

  const site = project.gscSite || "";
  const [summary, prevSummary, daily, topQueries, curPages, prevPages] =
    await Promise.all([
      getSummary(site, r.startDate, r.endDate),
      getSummary(site, pr.startDate, pr.endDate),
      getDaily(site, r.startDate, r.endDate),
      getTop(site, r.startDate, r.endDate, "query", 20),
      getTop(site, r.startDate, r.endDate, "page", 200),
      getTop(site, pr.startDate, pr.endDate, "page", 200),
    ]);

  const perf = analyzeArticles(articles, curPages, prevPages);
  const candidates = rewriteCandidates(curPages, prevPages, 8);

  const articleHref = (url?: string) =>
    url ? `/p/${slug}/article?u=${encodeURIComponent(url)}&period=${periodKey}` : "";

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
        {r.startDate} 〜 {r.endDate}（前期間: {pr.startDate} 〜 {pr.endDate}・GSCデータは約2日遅れ）
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
          <div className="value">
            {summary ? summary.clicks.toLocaleString() : "–"}{" "}
            {summary && <Delta cur={summary.clicks} prev={prevSummary?.clicks} />}
          </div>
        </div>
        <div className="metric">
          <div className="label">表示回数</div>
          <div className="value">
            {summary ? summary.impressions.toLocaleString() : "–"}{" "}
            {summary && (
              <Delta cur={summary.impressions} prev={prevSummary?.impressions} />
            )}
          </div>
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

      {candidates.length > 0 && (
        <>
          <h2>🔧 リライト候補（優先度順）</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>ページ</th>
                  <th>判定</th>
                  <th>理由と打ち手</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(({ page, flags }) => (
                  <tr key={page.key}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link href={articleHref(page.key)} style={{ textDecoration: "underline" }}>
                        {page.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {flags.map((f) => (
                        <span key={f.type} className={`flag flag-${f.type}`}>
                          {f.label}
                        </span>
                      ))}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {flags.map((f) => f.reason).join(" / ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rankHistory.length > 0 && project.pillarKeywords.length > 0 && (
        <>
          <h2>📈 ピラーキーワード順位の推移（週次自動記録）</h2>
          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>キーワード</th>
                  {rankHistory.map((w) => (
                    <th key={w.week} className="num">
                      {w.week.replace(/^\d{4}-/, "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.pillarKeywords.map((kw) => (
                  <tr key={kw}>
                    <td>{kw}</td>
                    {rankHistory.map((w) => {
                      const pos = w.positions[kw];
                      return (
                        <td
                          key={w.week}
                          className={
                            "num " +
                            (pos != null && pos <= 3
                              ? "pos-good"
                              : pos != null && pos <= 10
                              ? "pos-mid"
                              : "")
                          }
                        >
                          {pos != null ? pos.toFixed(1) : "–"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>記事一覧（{articles.length}本）× 検索データ</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        {articles.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>公開日</th>
                <th>タイトル</th>
                <th className="num">クリック</th>
                <th className="num">表示</th>
                <th className="num">CTR</th>
                <th className="num">順位</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {perf.map(({ article: a, cur, prev, flags }) => (
                <tr key={a.file}>
                  <td style={{ whiteSpace: "nowrap" }}>{a.published || "–"}</td>
                  <td>
                    {a.url ? (
                      <Link href={articleHref(a.url)} style={{ textDecoration: "underline" }}>
                        {a.title}
                      </Link>
                    ) : (
                      a.title
                    )}
                    {a.keyword && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        狙い: {a.keyword}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {cur ? cur.clicks : "–"}{" "}
                    {cur && <Delta cur={cur.clicks} prev={prev?.clicks} />}
                  </td>
                  <td className="num">{cur ? cur.impressions : "–"}</td>
                  <td className="num">{cur ? (cur.ctr * 100).toFixed(1) + "%" : "–"}</td>
                  <td
                    className={
                      "num " +
                      (cur && cur.position <= 3
                        ? "pos-good"
                        : cur && cur.position <= 10
                        ? "pos-mid"
                        : "")
                    }
                  >
                    {cur ? cur.position.toFixed(1) : "–"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {flags.map((f) => (
                      <span key={f.type} className={`flag flag-${f.type}`} title={f.reason}>
                        {f.label}
                      </span>
                    ))}
                  </td>
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
      <p className="sub" style={{ marginTop: 6 }}>
        ※ 記事のfrontmatterの url とGSC上のURLが一致した行に数値が表示されます。判定バッジにカーソルを合わせると理由が出ます。
      </p>

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
            {curPages && curPages.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>ページ</th>
                    <th className="num">クリック</th>
                    <th className="num">順位</th>
                  </tr>
                </thead>
                <tbody>
                  {curPages.slice(0, 10).map((p) => (
                    <tr key={p.key}>
                      <td>
                        <Link href={articleHref(p.key)} style={{ textDecoration: "underline" }}>
                          {p.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
                        </Link>
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
