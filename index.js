import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * GET /jobs?host=...&tenant=...&board=...&limit=50&offset=0&q=
 */
app.get("/jobs", async (req, res) => {
  const host   = req.query.host;
  const tenant = req.query.tenant;
  const board  = req.query.board;
  const limit  = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);
  const searchText = String(req.query.q || "");

  if (!host || !tenant || !board) {
    return res.status(400).json({ error: "Missing host, tenant, or board" });
  }

  const careersUrl = `https://${host}/${board}`;
  const jobsUrl    = `https://${host}/wday/cxs/${tenant}/${board}/jobs`;

  try {
    // ---- Step 1: visit careers page to get cookies + CSRF token
    const pageResp = await fetch(careersUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });

    const setCookies = pageResp.headers.raw()["set-cookie"] || [];
    const cookieHeader = setCookies.map(c => c.split(";")[0]).join("; ");

    const html = await pageResp.text();
    // CSRF may be set as a cookie OR present in HTML
    let csrf = "";
    for (const c of setCookies) {
      const m = c.match(/CALYPSO_CSRF_TOKEN=([a-f0-9-]+)/i);
      if (m) { csrf = m[1]; break; }
    }
    if (!csrf) {
      const m2 = html.match(/CALYPSO_CSRF_TOKEN=([a-f0-9-]+)/i);
      if (m2) csrf = m2[1];
    }

    // ---- Step 2: call JSON endpoint with proper headers
    const body = { appliedFacets: {}, limit, offset, searchText };

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": `https://${host}`,
      "Referer": careersUrl,
      "User-Agent": "Mozilla/5.0"
    };
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    if (csrf) headers["x-calypso-csrf-token"] = csrf;

    let apiResp = await fetch(jobsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    // Fallback: some tenants accept GET with query params
    if (!apiResp.ok) {
      const altUrl = `${jobsUrl}?limit=${limit}&offset=${offset}&searchText=${encodeURIComponent(searchText)}`;
      const alt = await fetch(altUrl, { method: "GET", headers });
      if (!alt.ok) {
        const text = await apiResp.text().catch(() => "");
        return res.status(apiResp.status).json({ error: "Upstream error", status: apiResp.status, text });
      }
      const altData = await alt.json();
      return res.json(altData);
    }

    const data = await apiResp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get("/", (_req, res) => {
  res.send("Workday proxy is live. Use /jobs?host=...&tenant=...&board=...");
});

app.listen(PORT, () => {
  console.log(`✅ Workday proxy running on port ${PORT}`);
});
