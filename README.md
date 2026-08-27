# POS Suite — Frontend (Phase 1)

React (Vite) + Supabase multi-tenant POS. This phase covers **Sign Up, Sign In,
Dashboard, and User Management**, built directly against your schema and the
navy/white color spec.

## Setup

```bash
npm install
cp .env.example .env
# then edit .env with your real Supabase URL + anon key (Project Settings -> API)
npm run dev
```

Your schema is already applied in Supabase, so no SQL needs to run — just
point `.env` at your project.

### Supabase Auth settings to check
- **Authentication → URL Configuration**: set your site URL (e.g.
  `http://localhost:5173` while developing) so password-reset emails link
  back correctly.
- **Authentication → Email**: if you want employees to start working
  immediately without confirming email first, you can disable "Confirm
  email" for now and re-enable it later — the app handles both cases.
- Because Row Level Security is presumably on for these tables, make sure
  your policies allow: a signed-in user to `select` their own `users` row
  and their own `businesses` row (by `business_id`), and an owner to
  `insert`/`update`/`select` rows in `users`, `role_permissions`, and
  `user_locations` scoped to their own `business_id`. Without matching RLS
  policies, sign up / sign in will succeed in Auth but the app won't be
  able to read or write the profile data.

## What's implemented

- **Sign Up** — two-step form: business details, then owner account. Creates
  the Supabase Auth user, the `businesses` row (status defaults to `trial`
  per the schema), a generated shareable `referral_code` (`REF` + 5-digit
  business id, fitting the `CHAR(8)` column), the owner's `users` row, and a
  default "Main Location".
- **Sign In / Forgot Password** — standard Supabase email auth.
- **Dashboard** — today's sales, open orders, pending shipments, and low
  stock counts, computed live from `sales`, `shipments`, and `stock_ledger`
  (never a stored "current stock" field, per your schema's design notes).
  Includes header notifications, a profile menu, and an inline calculator.
- **User Management** — list, add, and edit employees; per-module
  `role_permissions` grid (view/create/edit/delete for the 10 modules named
  in your schema comment); multi-location assignment via `user_locations`.
  Owners are always treated as full-access, matching the schema's note that
  owner rows don't need `role_permissions` rows.
- Every other sidebar module (POS, Sales, Purchases, Products, Contacts,
  Stock, Expenses, Reports, Settings) is routed and permission-gated but
  shows a "coming up next" placeholder — ready to be built module by module
  as instructed.

## Known limitations to revisit

1. **Creating an employee's login from the browser.** Supabase doesn't
   provide a safe way to create another user's Auth account from client-side
   code without a service role key (which must never ship to the browser).
   As a stopgap, employee creation currently calls `supabase.auth.signUp()`
   through a second, isolated Supabase client (see
   `src/lib/supabaseClient.js`) so it doesn't clobber the owner's active
   session. The correct long-term fix is a small Supabase Edge Function (or
   any tiny backend) that uses `service_role` server-side and calls
   `supabase.auth.admin.createUser()` — this also lets you skip email
   confirmation for staff accounts the owner is vouching for.
2. **Referral rewards.** The schema's `businesses.referral_code` is
   generated and stored on sign up. The code a *new* business enters as
   "referred by" is currently saved into `businesses.settings` (the
   general-purpose JSONB column) rather than a dedicated column, since the
   schema doesn't have a `referred_by_business_id` field yet. Crediting a
   reward (`reward_status_enum`) needs that column added before it can be
   automated — flagging this rather than inventing a field that wasn't in
   your schema.
3. **Trial → inactive automation.** The schema doesn't store a trial length
   or end date, so nothing currently flips `businesses.status` from `trial`
   to `inactive` automatically — that's described in the instructions as a
   job for the platform owner / a scheduled process, not something this
   phase implements.

## Project structure

```
src/
 ├── lib/supabaseClient.js       Supabase client(s)
 ├── context/AuthContext.jsx     session, profile, business, permissions
 ├── components/                 Sidebar, Header, AppLayout, ProtectedRoute
 ├── pages/
 │    ├── login.jsx / .css
 │    ├── signup.jsx / .css
 │    ├── forgotPassword.jsx
 │    ├── dashboard.jsx / .css
 │    ├── users.jsx / .css       (list)
 │    ├── userForm.jsx / .css    (add/edit + permissions + locations)
 │    ├── accountInactive.jsx
 │    └── placeholder.jsx        (unbuilt modules)
 └── index.css                   design tokens (navy/white system) + shared UI classes
```

## Next module in the build order

Contacts (Customers & Suppliers), then Products — say the word and I'll pick
up from here using the same patterns (AppLayout, `data-table`, `.field`
form system) already established.
