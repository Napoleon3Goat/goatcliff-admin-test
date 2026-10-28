# Goatcliff Admin (frontend)

Admin side of the Goatcliff reservation system. React + Vite, connected to Supabase.
Same theme as the guest site (`User_frontend`).

## First-time setup

Needs Node.js 20.19 or newer (`node -v` to check). On Windows, use `npm.cmd` if `npm` is blocked.

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the Project URL and publishable key
   (Supabase → Project Settings → API). Never use the secret / service_role key here.
3. `npm run dev` and open the address it prints (usually http://localhost:5173).

Login needs the backend rule "Admins can read their own account" (see `supabase-snippets/`).

## Pages and who sees them

| Page | Super Admin | Staff Admin | Field Staff |
|---|---|---|---|
| Today (rock headcount for 14 days, camping map for tonight, arrivals with money to collect) | ✓ | ✓ | |
| Bookings + booking details (payments, attendance, reschedule / refund / cancel) | ✓ | ✓ | |
| New booking (walk-ins, Messenger and phone bookings; price preview; daily limit check) | ✓ | ✓ | |
| GCash checks (find by GC- reference, record the GCash payment, release an unpaid spot) | ✓ | ✓ | |
| Requests (reschedules, refunds, cancellations) | ✓ | ✓ | |
| Calendar & closures (close a day, change the rock's daily limit, see affected bookings) | ✓ | ✓ | |
| Areas & prices (edit prices / hide an area / add one) | ✓ edit | ✓ view | |
| Staff (add, change role, deactivate) | ✓ | | |
| Reports (per activity, busiest weekdays, who the guests are, download CSV) | ✓ | | |
| Today's groups (all groups; Call button; mark Done / Failed to show) | | | ✓ |

Who sees what is set in `src/lib/menu.js`.

## Real data vs demo data

Every backend call is in `src/lib/adminApi.js`.

- **REAL:** activities (reads the `activities` table).
- **DEMO:** everything else uses sample bookings kept in the browser, with the same column names as the
  database tables. "Reset demo data" is at the bottom of the Today page.

When a backend piece is ready (access rules per role, booking function, staff Edge Function, analytics
queries), replace that function in `adminApi.js`. The pages don't change.

## Folder guide

| Path | What it is |
|---|---|
| `src/App.jsx` | Login check, role lookup, and which page goes with each address |
| `src/lib/adminApi.js` | All backend calls (real + demo) |
| `src/lib/menu.js` | Menu items and which roles see them |
| `src/lib/pricing.js`, `dates.js`, `errors.js` | Same helpers as the guest site |
| `src/components/AdminLayout.jsx` | Sidebar, phone menu, sign out |
| `src/components/ui.jsx` | Loading / error / empty states, status badges |
| `src/pages/` | One file per page |
| `src/index.css` | All styles |

## Demo mode and GitHub Pages

- **No `.env` file (or empty Supabase settings) = DEMO MODE.** The site uses made-up data from
  `src/lib/demoClient.js` and never touches the database. Any email and password signs in; put "staff" or
  "field" in the email to see those roles.
- **Publish on GitHub Pages:** push this folder to the `main` branch, then in the repository go to
  **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow in
  `.github/workflows/deploy.yml` builds and publishes the site. The link appears under **Actions** and
  **Settings → Pages** (for example `https://napoleon3goat.github.io/admin_frontend/`).
- Page links look like `…/admin_frontend/#/bookings`. The `#` lets every page open on GitHub Pages.
- To connect the real database later, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under
  **Settings → Secrets and variables → Actions → Variables**. Leave them out to stay in demo mode.

## Design

The look is "topographic trail map": pine-green menu rail, lichen-paper background, contour lines, and
rope-orange only for actions. Fonts are Big Shoulders (headings) and Albert Sans (text), saved in
`src/assets/fonts/` (SIL Open Font License, licence files included), so nothing loads from Google.
Product facts the design follows are in `PRODUCT.md`.
