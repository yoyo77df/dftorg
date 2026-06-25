import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { FirebaseAuthProvider } from "@/context/AuthContext";
import { useEffect } from "react";
import { applyTheme, getSavedTheme, subscribePublicTheme } from "@/lib/themes";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DFT ORG. — Premium Esports Tournament Platform" },
      { name: "description", content: "Compete in Free Fire, PUBG, COD, Valorant tournaments. Win cash prizes, climb the leaderboard, join clans." },
      { property: "og:title", content: "DFT ORG. — Premium Esports Tournament Platform" },
      { property: "og:description", content: "Compete in Free Fire, PUBG, COD, Valorant tournaments. Win cash prizes, climb the leaderboard, join clans." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "DFT ORG." },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "DFT ORG. — Premium Esports Tournament Platform" },
      { name: "twitter:description", content: "Compete in Free Fire, PUBG, COD, Valorant tournaments. Win cash prizes, climb the leaderboard, join clans." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5c97f9e9-cde0-43c6-a477-cb311cfe0cfd" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5c97f9e9-cde0-43c6-a477-cb311cfe0cfd" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DFT ORG.",
          url: "https://dftorftour.lovable.app",
          description: "Premium esports tournament platform for Free Fire, PUBG, COD, and Valorant.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "DFT ORG.",
          url: "https://dftorftour.lovable.app",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const saved = getSavedTheme();
    if (saved && saved !== "none") applyTheme(saved);
    // public theme broadcast — admin choice overrides for everyone
    const unsub = subscribePublicTheme();
    return () => unsub();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseAuthProvider>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
        <Toaster />
      </FirebaseAuthProvider>
    </QueryClientProvider>
  );
}
