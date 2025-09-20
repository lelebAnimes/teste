// api/movies.js
import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_URL = "https://www.visioncine-1.com/movies";

async function fetchWithHeaders(targetUrl) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://www.google.com/"
  };
  return axios.get(targetUrl, { timeout: 15000, headers });
}

export default async function handler(req, res) {
  try {
    const url = req.query.url || DEFAULT_URL;
    const response = await fetchWithHeaders(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const itemSel = ".card";
    const titleSel = ".card-title";
    const yearSel = ".meta-year";
    const linkSel = "a";
    const thumbSel = "img";

    const movies = [];
    $(itemSel).each((i, el) => {
      const root = $(el);
      let t = root.find(titleSel).first().text().trim();
      let y = root.find(yearSel).first().text().trim();
      let l = root.find(linkSel).first().attr("href") || "";
      let th = root.find(thumbSel).first().attr("src") || "";

      try { l = new URL(l, url).toString(); } catch (e) {}
      try { th = new URL(th, url).toString(); } catch (e) {}

      if (t) {
        movies.push({ title: t, year: y, link: l, thumb: th });
      }
    });

    return res.status(200).json(movies);
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.statusText || err.message || "Erro desconhecido";
    return res.status(500).json({ error: msg, code: status });
  }
}
