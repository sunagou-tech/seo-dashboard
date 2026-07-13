import fs from "fs";
import path from "path";
import matter from "gray-matter";

const VAULT = path.join(process.cwd(), "vault");
const PROJECTS_DIR = path.join(VAULT, "案件");

export type Project = {
  slug: string;
  name: string;
  client?: string;
  siteUrl?: string;
  gscSite?: string;
  status?: string;
  started?: string;
  instructor?: { name?: string; profile?: string };
  pillarKeywords: string[];
  body: string;
};

export type Article = {
  file: string;
  title: string;
  url?: string;
  keyword?: string;
  published?: string;
  status?: string;
};

export type Insight = { file: string; title: string };

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

export function getProjects(): Project[] {
  return safeReaddir(PROJECTS_DIR)
    .filter((d) => {
      try {
        return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((slug) => getProject(slug))
    .filter((p): p is Project => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export function getProject(slug: string): Project | null {
  const infoPath = path.join(PROJECTS_DIR, slug, "案件情報.md");
  if (!fs.existsSync(infoPath)) return null;
  const { data, content } = matter(fs.readFileSync(infoPath, "utf-8"));
  const instructor = data["講師"] || data["instructor"] || {};
  return {
    slug,
    name: data.name || slug,
    client: data.client,
    siteUrl: data.site_url,
    gscSite: data.gsc_site,
    status: data.status,
    started: data.started ? String(data.started).slice(0, 10) : undefined,
    instructor: {
      name: instructor.name,
      profile: instructor.profile,
    },
    pillarKeywords: data.pillar_keywords || [],
    body: content,
  };
}

export function getArticles(slug: string): Article[] {
  const dir = path.join(PROJECTS_DIR, slug, "記事");
  return safeReaddir(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(dir, f), "utf-8"));
      return {
        file: f,
        title: data.title || f.replace(/\.md$/, ""),
        url: data.url,
        keyword: data.keyword,
        published: data.published
          ? String(data.published).slice(0, 10)
          : undefined,
        status: data.status,
      };
    })
    .sort((a, b) => (b.published || "").localeCompare(a.published || ""));
}

export function getInsights(slug: string): Insight[] {
  const dir = path.join(PROJECTS_DIR, slug, "知見");
  return safeReaddir(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse()
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const { content } = matter(raw);
      const h1 = content.match(/^# (.+)$/m);
      return { file: f, title: h1 ? h1[1] : f.replace(/\.md$/, "") };
    });
}

export type RankWeek = {
  week: string; // "2026-W29"
  date: string; // 記録日
  positions: Record<string, number | null>; // キーワード→順位（表示なしはnull）
};

/** 順位履歴（週次cronが vault/案件/<slug>/データ/rank-history.json に蓄積） */
export function getRankHistory(slug: string): RankWeek[] {
  const p = path.join(PROJECTS_DIR, slug, "データ", "rank-history.json");
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return Array.isArray(data.weeks) ? data.weeks : [];
  } catch {
    return [];
  }
}

/** 期間内に公開された記事数（published基準） */
export function countArticles(
  articles: Article[],
  startDate?: string,
  endDate?: string
): number {
  return articles.filter((a) => {
    if (!a.published) return false;
    if (startDate && a.published < startDate) return false;
    if (endDate && a.published > endDate) return false;
    return true;
  }).length;
}
