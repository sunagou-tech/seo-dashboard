import "./globals.css";
import Link from "next/link";
import { getProjects } from "@/lib/vault";

export const metadata = { title: "SEOダッシュボード" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = getProjects();
  return (
    <html lang="ja">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="nav-title">📊 SEOダッシュボード</Link>
            <Link href="/" className="nav-tab">全体</Link>
            {projects.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="nav-tab">
                {p.name}
              </Link>
            ))}
          </div>
        </nav>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
