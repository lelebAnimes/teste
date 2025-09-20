// api/index.js (Vercel serverless) — scraping do seu próprio site
import axios from "axios";
import * as cheerio from "cheerio";
import NodeCache from "node-cache";

const CACHE = new NodeCache({ stdTTL: 60 }); // guarda 60s

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml"
};

function safeUrl(u, base) {
  try { return new URL(u, base).toString(); } catch { return u || ""; }
}

export default async function handler(req, res) {
  const url = req.query.url || "https://animefire.plus/"; // ou seu caminho específico
  const cacheKey = `scrape:${url}`;

  const cached = CACHE.get(cacheKey);
  if (cached) return res.status(200).json(cached);

  try {
    const r = await axios.get(url, { timeout: 15000, headers: HEADERS, maxRedirects: 5 });
    const $ = cheerio.load(r.data);

    // Ajuste os seletores abaixo conforme o HTML do seu site
    const itemSel = ".card, .anime, .movie, article, .item";
    const items = [];

    $(itemSel).each((i, el) => {
      const root = $(el);
      const title = root.find(".title, h2, h3, .card-title, .name").first().text().trim();
      const link = root.find("a").first().attr("href") || "";
      const thumb = root.find("img").first().attr("src") || "";
      const year = root.find(".year, .meta-year").first().text().trim() || "";

      if (title || thumb || link) {
        items.push({
          title: title || $(el).text().trim().slice(0, 80),
          link: safeUrl(link, url),
          thumb: safeUrl(thumb, url),
          year
        });
      }
    });

    // fallback: <a> com <img>
    if (items.length === 0) {
      $("a").each((i, el) => {
        const a = $(el);
        const img = a.find("img").first();
        if (img.length) {
          items.push({
            title: a.attr("title") || img.attr("alt") || a.text().trim().slice(0,80),
            link: safeUrl(a.attr("href") || "", url),
            thumb: safeUrl(img.attr("src") || "", url),
            year: ""
          });
        }
      });
    }

    // dedupe simples
    const seen = new Set();
    const results = items.filter(m => {
      const key = (m.link || m.thumb || m.title).slice(0,200);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    CACHE.set(cacheKey, results);
    res.setHeader("Access-Control-Allow-Origin", "*"); // CORS para iOS/testes
    return res.status(200).json(results);
  } catch (err) {
    if (err.response && err.response.status === 403) {
      return res.status(403).json({ error: "Acesso negado (403). Considere usar proxy." });
    }
    return res.status(500).json({ error: err.message || "Erro desconhecido" });
  }
}
