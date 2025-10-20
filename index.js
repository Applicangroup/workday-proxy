import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Proxy endpoint: fetch Workday job listings
app.get("/jobs", async (req, res) => {
  try {
    const { host, tenant, board, limit = 20, offset = 0 } = req.query;

    if (!host || !tenant || !board) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const url = `https://${host}/wday/cxs/${tenant}/${board}/jobs`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: Number(limit),
        offset: Number(offset),
        searchText: "",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Workday proxy running on port ${PORT}`);
});
