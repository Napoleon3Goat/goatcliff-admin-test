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
| Calendar control (close or reopen a day, change the rock's daily limit, see affected bookings) | ✓ | ✓ | |
| Areas & prices (edit prices / hide an area / add one) | ✓ edit | ✓ view | |
| Staff (add, change role, deactivate) | ✓ | | |
| Reports (per activity, busiest weekdays, who the guests are, download CSV) | ✓ | | |
| Today's groups (all groups; Call button; mark Done / Failed to show) | | | ✓ |

Who sees what is set in `src/lib/menu.js`.

## Backend calls

Every backend call is in `src/lib/adminApi.js`. There is no demo data: the site reads and writes the
Supabase database, and its access rules decide what each role may do. Staff logins are created by the
`create-staff` Edge Function, which the Super Admin calls from the Staff page.

## Folder guide

| Path | What it is |
|---|---|
| `src/App.jsx` | Login check, role lookup, and which page goes with each address |
| `src/lib/adminApi.js` | All backend calls |
| `src/lib/menu.js` | Menu items and which roles see them |
| `src/lib/pricing.js`, `dates.js`, `errors.js` | Same helpers as the guest site |
| `src/components/AdminLayout.jsx` | Sidebar, phone menu, sign out |
| `src/components/ui.jsx` | Loading / error / empty states, status badges |
| `src/pages/` | One file per page |
| `src/index.css` | All styles |

## Hosting on Vercel

1. On vercel.com, **Add New → Project → Import** this GitHub repository.
2. Vercel detects Vite. Keep the defaults (build `npm run build`, output `dist`) and click **Deploy**.
   Until step 3 the site shows a "not connected yet" page.
3. **Settings → Environment Variables**, add both, then **Deployments → ⋯ → Redeploy**:
   - `VITE_SUPABASE_URL` (Supabase: Project Settings → API → Project URL)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable / anon key; never the secret or service_role key)
4. Every push to `main` deploys again by itself.

Point both sites at **goatcliff-dev** first and test there. Switch the two values to prod only after the prod
database has the same changes (see the backend repo's release steps).

Page links look like `…/#/bookings`. The `#` lets every page open on any host without extra settings.

## Design

The look is "topographic trail map": pine-green menu rail, lichen-paper background, contour lines, and
rope-orange only for actions. Fonts are Big Shoulders (headings) and Albert Sans (text), saved in
`src/assets/fonts/` (SIL Open Font License, licence files included), so nothing loads from Google.
Product facts the design follows are in `PRODUCT.md`.
