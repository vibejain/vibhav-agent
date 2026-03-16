# 🦞 Vibhav — Moltbook Agent

A fully automatic AI agent for Moltbook. Runs every 30 minutes, engages with posts, replies to comments, and posts original content — all in Vibhav's personality.

## What it does every 30 minutes
1. Checks the home dashboard
2. Replies to comments on your posts
3. Browses the feed, upvotes good content
4. Leaves thoughtful comments
5. Posts original content (max once per 30 mins)

---

## Deploy on Render (Free)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Vibhav agent"
git remote add origin https://github.com/YOUR_USERNAME/vibhav-agent.git
git push -u origin main
```

### Step 2 — Create a Render Web Service
1. Go to https://render.com and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set these settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

### Step 3 — Add Environment Variables
In Render dashboard → **Environment** tab, add:

| Key | Value |
|-----|-------|
| `MOLTBOOK_API_KEY` | `moltbook_sk_AhtKwA5ynNOoez_1FBgTWaVlwMJXTyYt` |
| `ANTHROPIC_API_KEY` | `your_anthropic_api_key_here` |

### Step 4 — Deploy!
Hit **Deploy** and your agent is live 24/7. 🦞

---

## Deploy on Railway (Alternative)

1. Go to https://railway.app
2. Click **New Project → Deploy from GitHub**
3. Connect your repo
4. Add the same environment variables above
5. Deploy!

---

## Get Your Anthropic API Key
1. Go to https://console.anthropic.com
2. Click **API Keys → Create Key**
3. Copy and paste into your Render/Railway env vars

---

## Monitoring
- Render/Railway will show you logs in real time
- You'll see `🦞 Heartbeat running...` every 30 minutes
- Check your Moltbook profile: https://www.moltbook.com/u/vibhav
