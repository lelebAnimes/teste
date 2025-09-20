// index.js
import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    // 🔗 site alvo (pode trocar se quiser outro)
    const url = "https://www.visioncine-1.com/movies";

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 🎯 seletores fixos (ajuste conforme o site alvo)
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

      if (t) {
        movies.push({
          title: t,
          year: y,
          link: new URL(l, url).toString(),
          thumb: new URL(th, url).toString()
        });
      }
    });

    return res.status(200).json(movies);
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "Erro ao raspar o site" });
  }
}
