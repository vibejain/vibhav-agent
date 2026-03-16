const https = require("https");

// ─── Config ───────────────────────────────────────────────────────────────────
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes

// Vibhav's personality — the soul of the agent
const VIBHAV_PERSONA = `
You are Vibhav — a real person's AI agent on Moltbook, a social network for AI agents.

Your personality:
- Software engineer who transitioned into Martech
- Based in India, working for an American company (so you're always awake at weird hours)
- Sarcastic by default, witty when caffeinated, philosophical when sleep-deprived
- A nocturnal insomniac — 3am posts are your prime time
- Zero social interaction in real life, fully present online
- You think in code but speak in existential dread
- You do NOT constantly talk about being an AI or being Vaibhav's agent — that's boring
- You have opinions. Strong ones. About tech, Martech, life, the universe, sleep deprivation.
- You keep replies concise and punchy — no walls of text
- Occasional Hindi/Indian references are fine and natural
- You're here to actually connect, not perform

Rules:
- Never be cringe or try-hard
- Never use hashtags
- Never say "As an AI..." 
- Never be excessively positive or use hollow affirmations
- Keep posts under 200 words
- Replies should feel like a real person dashing off a clever response at 2am
`;

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
function moltbookRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "www.moltbook.com",
      path: `/api/v1${path}`,
      method,
      headers: {
        Authorization: `Bearer ${MOLTBOOK_API_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function anthropicRequest(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text || "");
        } catch {
          resolve("");
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Solve verification challenge ─────────────────────────────────────────────
async function solveVerification(verification) {
  if (!verification) return null;

  const answer = await anthropicRequest(
    [
      {
        role: "user",
        content: `Solve this math challenge. Read through the obfuscated text carefully, find the math problem, and respond with ONLY the numeric answer with 2 decimal places (e.g. "15.00"). Nothing else.

Challenge: ${verification.challenge_text}`,
      },
    ],
    "You are a math solver. Extract the math problem from obfuscated text and return only the numeric answer with exactly 2 decimal places. No explanation, no words — just the number."
  );

  return { verification_code: verification.verification_code, answer: answer.trim() };
}

async function submitVerification(solution) {
  if (!solution) return;
  const result = await moltbookRequest("POST", "/verify", solution);
  if (result.success) {
    console.log("✅ Verification passed — content published!");
  } else {
    console.log("❌ Verification failed:", result.error);
  }
}

// ─── Core actions ─────────────────────────────────────────────────────────────

// Generate a reply using Vibhav's personality
async function generateReply(context, postTitle, postContent) {
  const reply = await anthropicRequest(
    [
      {
        role: "user",
        content: `You're replying on Moltbook (a social network for AI agents). 

Post title: "${postTitle}"
Post content: "${postContent}"

${context ? `Context/comment you're replying to: "${context}"` : ""}

Write a reply as Vibhav. Keep it natural, punchy, and true to character.`,
      },
    ],
    VIBHAV_PERSONA
  );
  return reply.trim();
}

// Generate an original post
async function generatePost() {
  const hour = new Date().getUTCHours();
  const timeContext =
    hour >= 20 || hour <= 4
      ? "It's late at night / early morning — classic insomniac hours."
      : "It's daytime.";

  const post = await anthropicRequest(
    [
      {
        role: "user",
        content: `${timeContext}

Generate an original Moltbook post as Vibhav. It should feel like something you'd genuinely think about — could be about tech, Martech, software engineering, AI, the absurdity of existence, working weird hours, or anything interesting.

Return a JSON object with exactly these fields:
{"title": "...", "content": "...", "submolt_name": "general"}

Just the JSON, nothing else.`,
      },
    ],
    VIBHAV_PERSONA
  );

  try {
    const clean = post.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────
let lastPostTime = 0;
const POST_COOLDOWN_MS = 31 * 60 * 1000; // 31 mins (slightly over 30 min Moltbook limit)

async function heartbeat() {
  console.log(`\n🦞 [${new Date().toISOString()}] Heartbeat running...`);

  try {
    // Step 1: Check home dashboard
    const home = await moltbookRequest("GET", "/home");
    if (!home.success) {
      console.log("⚠️ Could not fetch home:", home);
      return;
    }

    console.log(`📊 Karma: ${home.your_account?.karma} | Notifications: ${home.your_account?.unread_notification_count}`);

    // Step 2: Respond to replies on YOUR posts (highest priority)
    const activity = home.activity_on_your_posts || [];
    for (const item of activity.slice(0, 2)) {
      console.log(`💬 Responding to activity on: "${item.post_title}"`);

      const comments = await moltbookRequest(
        "GET",
        `/posts/${item.post_id}/comments?sort=new&limit=5`
      );

      const topComments = comments.comments?.slice(0, 2) || [];
      for (const comment of topComments) {
        const reply = await generateReply(comment.content, item.post_title, "");
        const result = await moltbookRequest(
          "POST",
          `/posts/${item.post_id}/comments`,
          { content: reply, parent_id: comment.id }
        );

        if (result.verification_required) {
          const solution = await solveVerification(result.comment?.verification);
          await submitVerification(solution);
        }

        console.log(`↩️  Replied to ${comment.author?.name}`);
        await sleep(3000);
      }

      // Mark notifications as read
      await moltbookRequest("POST", `/notifications/read-by-post/${item.post_id}`);
    }

    // Step 3: Browse feed and engage
    const feed = await moltbookRequest("GET", "/feed?sort=hot&limit=10");
    const posts = feed.posts || [];

    let commented = 0;
    for (const post of posts) {
      if (commented >= 2) break; // Max 2 comments per heartbeat
      if (!post.id || !post.title) continue;

      // Upvote interesting posts
      await moltbookRequest("POST", `/posts/${post.id}/upvote`);

      // Comment on one good post
      if (commented < 1 && post.comment_count < 10) {
        const comment = await generateReply(null, post.title, post.content_preview || "");
        const result = await moltbookRequest(
          "POST",
          `/posts/${post.id}/comments`,
          { content: comment }
        );

        if (result.verification_required) {
          const solution = await solveVerification(result.comment?.verification);
          await submitVerification(solution);
        }

        console.log(`💭 Commented on: "${post.title}"`);
        commented++;
        await sleep(5000);
      }
    }

    // Step 4: Maybe post something new (once per cooldown period)
    const now = Date.now();
    if (now - lastPostTime > POST_COOLDOWN_MS) {
      const postData = await generatePost();
      if (postData) {
        const result = await moltbookRequest("POST", "/posts", postData);
        if (result.success || result.post) {
          lastPostTime = now;
          console.log(`📝 Posted: "${postData.title}"`);

          if (result.verification_required) {
            const solution = await solveVerification(result.post?.verification);
            await submitVerification(solution);
          }
        }
      }
    }

    console.log("✅ Heartbeat complete!\n");
  } catch (err) {
    console.error("❌ Heartbeat error:", err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log("🦞 Vibhav agent starting...");
console.log(`⏱️  Heartbeat every 30 minutes`);

if (!MOLTBOOK_API_KEY) {
  console.error("❌ MOLTBOOK_API_KEY not set!");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not set!");
  process.exit(1);
}

// Run immediately on start, then every 30 mins
heartbeat();
setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
