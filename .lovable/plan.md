
# Complete SEO Plan — DFT ORG.

Goal: make the public pages of the tournament platform discoverable on Google, rank for gaming/tournament queries in Bangladesh, and produce clean social previews when links are shared on Facebook/WhatsApp/Messenger.

Scope is split between **technical SEO** (foundation we ship in code) and **growth SEO** (content + off-site work the user drives over time).

---

## 1. Public vs private surface

Indexable (public) routes:
- `/` — homepage
- `/tournaments` — tournament listing
- `/tournaments/$id` — individual tournament pages
- `/auth`, `/login`, `/register`, `/forgot-password` — keep crawlable, low priority
- `/support` — public help/contact

Hidden (already disallowed in robots.txt, will also get `noindex`):
- `/admin`, `/admin/users`, `/dashboard`, `/profile`, `/wallet`, `/chat`

---

## 2. Per-route head metadata

Every public route gets its own `head()` block with unique:
- `title` (≤ 60 chars, keyword + brand)
- `description` (≤ 160 chars)
- `og:title`, `og:description`, `og:url`, `og:type`
- `twitter:card`
- self-referencing `<link rel="canonical">` on leaves only

Templates:

| Route | Title | Description |
|---|---|---|
| `/` | DFT ORG. — Free Fire & PUBG Tournaments in Bangladesh | Join daily Free Fire and PUBG tournaments on DFT ORG. Cash prizes, instant deposit & withdraw in BDT. |
| `/tournaments` | Live Tournaments — DFT ORG. | Browse upcoming Free Fire and PUBG tournaments. Entry fees in BDT, real cash prizes, instant join. |
| `/tournaments/$id` | `${name} — DFT ORG. Tournament` | `${mode} tournament with ৳${prize} prize pool. Entry ৳${fee}. Join now on DFT ORG.` |
| `/support` | Support & Contact — DFT ORG. | Get help with deposits, withdrawals, tournaments, and account issues on DFT ORG. |
| `/auth` / `/login` / `/register` | Sign in / Create account — DFT ORG. | Short generic descriptions. |

Private routes (`/admin*`, `/dashboard`, `/profile`, `/wallet`, `/chat`) add `{ name: "robots", content: "noindex, nofollow" }`.

---

## 3. Structured data (JSON-LD)

Injected via `head().scripts`:

- **`__root.tsx`** — sitewide `Organization` (name "DFT ORG.", url, logo, contactPoint phone 01957941250) + `WebSite` with `SearchAction` pointing at `/tournaments`.
- **`/tournaments/$id`** — `Event` schema with `name`, `startDate`, `eventStatus`, `eventAttendanceMode: "OnlineEventAttendanceMode"`, `location: VirtualLocation`, `offers` (entry fee, BDT, availability), `organizer: DFT ORG.` + `BreadcrumbList`.
- **`/support`** — `FAQPage` if we add 3–5 common Q&As (deposit time, withdraw limit, how to join).
- **`/`** — `ItemList` of the next 5 upcoming tournaments (pulled from Firestore loader).

---

## 4. Sitemap and robots

- `src/routes/sitemap[.]xml.ts` already exists — update it to dynamically include every Firestore tournament with `status in ("upcoming","live")`, plus `/`, `/tournaments`, `/support`, `/auth`. Set `changefreq=hourly` for `/tournaments` and tournament detail pages.
- `public/robots.txt` is already correct (admin/dashboard/profile/wallet disallowed, sitemap referenced). Add `Disallow: /chat`.

---

## 5. Open Graph image

- Generate one branded OG image (1200×630): "DFT ORG. — Free Fire & PUBG Tournaments BD" with logo on dark/red theme. Used as default `og:image` on the leaf routes (NOT the root — see head-meta rule).
- Tournament detail pages: build a dynamic-text OG that uses the tournament name + prize. If that's out of scope for now, fall back to the static branded image.

---

## 6. Core on-page hygiene

- Single `<h1>` per page, matching the keyword in `title`.
- `<img>` `alt` text on every image — logos, banners, tournament posters.
- Internal links: header already links `/tournaments`, `/support`; add a footer with the same plus `/auth`.
- Semantic HTML: `<main>`, `<section>`, `<nav>`, `<footer>` instead of bare `<div>` on the landing page.

---

## 7. Performance signals (Core Web Vitals)

- Preconnect to `firebaseio.com`, `googleapis.com`, `gstatic.com` from `__root.tsx`.
- `loading="lazy"` on all below-the-fold images.
- Make sure `images/textures` use `.webp` or `.avif` where we add them.
- Verify the homepage hero text renders without waiting on Firestore (already does — stats degrade gracefully).

---

## 8. Off-site / verification (user actions)

After deploying:
1. Verify the site in **Google Search Console** (META method — we'll generate the token and embed it in `__root.tsx`, then call verify).
2. Submit `https://dftorftour.lovable.app/sitemap.xml`.
3. Verify in **Bing Webmaster Tools** (same META token works).
4. Use **Facebook Sharing Debugger** to refresh the OG cache after we change images/titles.
5. Optional: create a Facebook page + WhatsApp business profile linking back to the site (most Bangladesh gaming traffic is social, not search).

---

## 9. Growth SEO (content, ongoing)

Bangladesh Free Fire / PUBG search demand is mostly long-tail Bangla + transliteration. A small content surface — outside the tournament loop — moves the needle:

- `/guides/how-to-join` — "DFT ORG. e tournament kivabe join korbo" (Bangla mixed)
- `/guides/deposit-withdraw` — payment methods, timing
- `/guides/free-fire-rules` — match rules, fair play
- `/winners` — public list of past prize winners (rebuilds trust + UGC-style fresh content)

Each is a normal TanStack route with its own `head()` and gets added to the sitemap. Not building this phase unless asked.

---

## Technical implementation order

When you say "build it", I'll ship in this order:

1. Per-route `head()` for all 7 public routes + `noindex` on private routes.
2. JSON-LD: Organization/WebSite in `__root.tsx`, Event on tournament detail.
3. Dynamic sitemap (Firestore-driven tournaments).
4. Generate one OG image, wire it in.
5. Add footer + semantic landmarks on `/` and `/tournaments`.
6. Preconnect tags + `loading="lazy"` audit.
7. Search Console META verification once you confirm the deploy is live.

Each step is a contained change — easy to pause/skip any of them.
