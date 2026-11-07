# Jon Bon Bogo the Bogo Guy

The website for **jonbonbogothebogoguy.com**: retail deals and credit card offers.

- **Deal Tracker:** anyone can post local or national deals (with an optional photo of the tag), vote "still on the shelf" or "gone", comment, and report problems.
- **Articles:** written by Jon (and guest columnists) from the admin page.
- **Card Offers:** guests write about a card they just got. Readers can request a referral, which is emailed privately to the guest.
- **Admin page** at `/admin`: approve guest posts and photos, handle reported deals and comments, write articles, see referral requests, and download the email list.

It runs on **Cloudflare Pages** (static pages plus small server functions), with a **D1** database, **R2** photo storage, and **Turnstile** spam protection. At this site's size, all of these fit Cloudflare's free plans. The only fixed cost is the domain.

---

## Going live: step by step

You'll need a GitHub account (the code lives there) and a Cloudflare account. Allow about 30–45 minutes. Cloudflare's dashboard menus move around from time to time; if a label doesn't match exactly, look for the closest equivalent.

### 1. Buy the domain

In Cloudflare, go to **Domain Registration → Register Domains** and search for `jonbonbogothebogoguy.com`. Buying it through Cloudflare means the DNS is set up for you automatically in step 8.

### 2. Create the Pages project from GitHub

1. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Authorize GitHub and pick this repository.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** leave empty
   - **Build output directory:** `public`
4. Click **Save and Deploy**. You'll get a test address like `jonbonbogo-site.pages.dev`. The pages load, but posting won't work until the next steps are done.

### 3. Create the database

1. Go to **Storage & Databases → D1 → Create database**. Name it `jonbonbogo-db`.
2. Open your Pages project → **Settings → Bindings → Add → D1 database**.
3. Variable name: `DB` (exactly). Database: `jonbonbogo-db`. Save.

The site creates its own tables the first time it runs. There is nothing to run by hand.

### 4. Create photo storage

1. Go to **R2 Object Storage**. Cloudflare may ask you to add a payment method to turn on R2, even though small usage is free.
2. **Create bucket** named `jonbonbogo-photos`. Leave it private (no public access needed).
3. In your Pages project → **Settings → Bindings → Add → R2 bucket**. Variable name: `PHOTOS` (exactly). Bucket: `jonbonbogo-photos`. Save.

Without this step the site still works, but the photo field is hidden.

### 5. Set up the spam check (Turnstile)

1. Go to **Turnstile → Add widget**.
2. Name it `Jon Bon Bogo`. Add hostnames: `jonbonbogothebogoguy.com` and your `.pages.dev` address.
3. Widget mode: **Managed**. Create it.
4. Copy the **Site Key** and the **Secret Key** for the next step.

### 6. Add the settings

In your Pages project → **Settings → Variables and Secrets**, add these for **Production**:

| Name | Type | Value |
|---|---|---|
| `ADMIN_PASSWORD` | Secret | A long password only you know. This is how you sign in at `/admin`. |
| `TURNSTILE_SITE_KEY` | Text | The Site Key from step 5 |
| `TURNSTILE_SECRET_KEY` | Secret | The Secret Key from step 5 |
| `CONTACT_EMAIL` | Text | Your public contact email (shown in the footer, used for "new guest post" alerts) |

Optional:

| Name | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | Secret | From resend.com (step 10). Lets the site email referral requests to guests. |
| `EMAIL_FROM` | Text | e.g. `Jon Bon Bogo <hello@jonbonbogothebogoguy.com>` (must be on a domain verified in Resend) |
| `REPORT_HIDE_THRESHOLD` | Text | How many reports hide a deal or comment until you review it. Default `3`. |

### 7. Redeploy

Settings only take effect on a new deployment. Go to **Deployments**, open the latest one, and choose **Retry deployment** (or push any change to GitHub).

### 8. Connect your domain

In your Pages project → **Custom domains → Set up a custom domain**. Add `jonbonbogothebogoguy.com`, then add `www.jonbonbogothebogoguy.com` too. If you bought the domain through Cloudflare, it configures DNS for you. HTTPS is automatic.

### 9. Sign in and check

Visit `https://jonbonbogothebogoguy.com/admin`, sign in with your `ADMIN_PASSWORD`, and open the **Setup** tab. Every line should say **Ready** (email sending is optional). Then post a test deal, approve its photo, and delete it.

### 10. (Optional) Email for referral requests

Without this, referral requests are saved and listed on the admin page, and you forward them to guests yourself.

1. Sign up at [resend.com](https://resend.com). The free plan allows 3,000 emails a month (100 a day).
2. Add your domain in Resend and add the DNS records it shows you in Cloudflare's **DNS** page.
3. Create an API key and add `RESEND_API_KEY` and `EMAIL_FROM` (step 6), then redeploy (step 7).

---

## Before you announce the site

- **Privacy and Terms pages** (`public/privacy.html`, `public/terms.html`) are plain-language starting points. Fill in the `[DATE]` placeholders and have them reviewed.
- **The name:** consider a quick trademark check on "Jon Bon Bogo" before you invest in branding or merch.
- **Write a first article** from the admin page so the Articles page isn't empty.

## Day to day

- **Review queue:** the admin page's **Review** tab shows guest posts and photos waiting for approval, plus anything readers reported. Deals and comments go live immediately; three reports (or your `REPORT_HIDE_THRESHOLD`) hide an item until you look at it.
- **Articles:** **Articles → Write a new article**. Leave a blank line between paragraphs, start headings with `## `, bullets with `- `, and use `**bold**` and `[link text](https://...)`. Tick **Published** to make it live and **Featured** to put it at the top.
- **Email list:** **Email list → Download CSV**, then import it into a newsletter tool such as Buttondown, Mailchimp or Kit.
- **Old deals** drop off the tracker after 45 days, or after their "good through" date.

## Making changes to the site

Every push to the GitHub repository's main branch redeploys the site automatically.

| What | Where |
|---|---|
| Page text and layout | `public/*.html` |
| Colors, fonts, spacing | `public/css/site.css` |
| Page behavior | `public/js/*.js` |
| Server logic (deals, comments, posts, admin) | `functions/api/**` |
| Database tables | `functions/_lib/db.js` (and `schema.sql` for reference) |
| Fireworks video | `public/media/fountain.mp4` |

### Running it on your own computer (optional)

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
echo 'ADMIN_PASSWORD=localtest' > .dev.vars
npm run dev
```

Then open http://localhost:8788 (admin password `localtest`). The local database and photos live in `.wrangler/` and are separate from the live site. The spam check is skipped locally when no Turnstile keys are set.

## How it fits together

```
public/            Static pages, styles, scripts, media (served as-is)
  index.html       Home
  deals.html       Deal Tracker
  articles.html    Article list      article.html  Single article
  card-offers.html Guest card posts
  admin.html       Admin page (noindex)
functions/         Server code (Cloudflare Pages Functions)
  _lib/            Shared helpers: database setup, auth, email, validation
  api/deals/...    List, post, vote, report, comment
  api/posts/...    Guest card posts and referral requests
  api/articles/... Published articles
  api/photos/...   Serves approved photos (pending ones only to the admin)
  api/admin/...    Sign-in and moderation (requires the admin session)
schema.sql         Readable copy of the database tables
```

Privacy notes: visitors' IP addresses are never stored (only a one-way scrambled fingerprint, used for spam limits and one vote per person). Photos are resized in the browser before upload, which strips hidden location data. Guest contact emails are never sent to the browser.

A note on hosting: Cloudflare now points brand-new projects toward Workers, but Pages remains supported and is the simplest fit here. If Cloudflare ever retires Pages, the same code can be moved to Workers.
