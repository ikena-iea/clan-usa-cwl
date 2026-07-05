# Clan USA — CWL leaderboard

A static site that auto-fetches CWL attack data from the Clash of Clans API
and shows a leaderboard scored with a TH-gap-adjusted point formula.

## How it works

```
GitHub Actions (hourly)  -->  RoyaleAPI proxy  -->  Clash of Clans API
        |
        v (writes)
    data.json  (committed to this repo)
        |
        v (served by)
    GitHub Pages
        |
        v (fetched by)
    index.html  -->  renders leaderboard in your browser
```

## One-time setup

### 1. Get a Clash of Clans API token registered to the RoyaleAPI proxy

1. Go to https://developer.clashofclans.com and create a developer account
2. Create a new API key
3. For "Allowed IP addresses," use the RoyaleAPI proxy IPs listed at
   https://docs.royaleapi.com/proxy.html (NOT your own IP — GitHub Actions
   runners don't have a fixed IP, so the request must go through the proxy)
4. Copy the generated API token

### 2. Create the GitHub repo

1. Create a new repository on GitHub (public, so GitHub Pages works on the
   free tier)
2. Upload all files from this folder, keeping the same structure:
   ```
   .github/workflows/update-cwl.yml
   scripts/fetch-cwl.mjs
   index.html
   data.json
   README.md
   ```

### 3. Add your secrets

In the repo: Settings -> Secrets and variables -> Actions -> New repository secret

- `COC_API_TOKEN` — the token from step 1
- `CLAN_TAG` — your clan tag, e.g. `#2CGG82GUJ`

### 4. Enable GitHub Pages

Settings -> Pages -> Source: "Deploy from a branch" -> Branch: `main` / root

Your site will be live at `https://<your-username>.github.io/<repo-name>/`

### 5. Run the Action for the first time

Go to the Actions tab -> "Update CWL data" -> Run workflow (manual trigger).
This runs the fetch script once immediately instead of waiting for the next
hourly schedule, and writes the first real `data.json`.

## Adjusting the point formula

The scoring logic lives in `index.html` inside the `computeAttackPoints` and
`medalFor` functions:

- Missed attack: flat -3 points
- Otherwise: `(stars + destruction/100) * TH-gap multiplier`
- TH-gap multiplier: `1 + 0.3 * (defenderTH - attackerTH)`, clamped between
  0.4 and 1.8
- Medal tiers (average points per attack): Gold >= 4.0, Silver >= 2.8,
  Bronze >= 1.5

Edit these directly in `index.html` and commit — no need to touch the fetch
script or the workflow.

## Changing the fetch schedule

Edit the cron line in `.github/workflows/update-cwl.yml`:

```yaml
schedule:
  - cron: '0 * * * *'   # every hour, on the hour
```

Cron syntax reference: https://crontab.guru
