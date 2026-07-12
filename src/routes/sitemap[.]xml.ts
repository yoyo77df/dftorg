import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://dftorftour.lovable.app";
const FIRESTORE_PROJECT = "dft-tournament-27a59";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/tournaments", changefreq: "hourly", priority: "0.9" },
          { path: "/auth", changefreq: "monthly", priority: "0.5" },
          { path: "/login", changefreq: "monthly", priority: "0.5" },
          { path: "/register", changefreq: "monthly", priority: "0.5" },
          { path: "/forgot-password", changefreq: "monthly", priority: "0.3" },
          { path: "/dashboard", changefreq: "weekly", priority: "0.4" },
          { path: "/profile", changefreq: "weekly", priority: "0.4" },
          { path: "/chat", changefreq: "weekly", priority: "0.4" },
          { path: "/support", changefreq: "weekly", priority: "0.4" },
          { path: "/wallet", changefreq: "weekly", priority: "0.4" },
          { path: "/admin/users", changefreq: "monthly", priority: "0.2" },
        ];

        // Pull live tournaments from Firestore REST (public read).
        try {
          const res = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/tournaments?pageSize=300`,
            { headers: { Accept: "application/json" } },
          );
          if (res.ok) {
            const json: any = await res.json();
            const docs: any[] = Array.isArray(json.documents) ? json.documents : [];
            for (const d of docs) {
              const id = String(d.name ?? "").split("/").pop();
              if (!id) continue;
              const status = d.fields?.status?.stringValue;
              if (status && !["upcoming", "live", "ongoing"].includes(status)) continue;
              const updated = d.updateTime || d.fields?.updated_at?.timestampValue;
              entries.push({
                path: `/tournaments/${id}`,
                changefreq: "hourly",
                priority: "0.8",
                lastmod: updated ? new Date(updated).toISOString() : undefined,
              });
            }
          }
        } catch {
          // Firestore unreachable — fall back to static entries.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});