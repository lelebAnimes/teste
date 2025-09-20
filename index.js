// index.js
import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_URL = "https://animefire.plus/";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};

function safeUrl(u, base) {
  try {
    return new URL(u, base).toString();
  } catch {
    return u || "";
  }
}

function pickText(root, sels) {
  for (const s of sels) {
    const t = root.find(s).first().text().trim();
    if (t) return t;
  }
  return "";
}

function pickAttr(root, sels, attr = "href") {
  for (const s of sels) {
    const v = root.find(s).first().attr(attr);
    if (v) return v;
  }
  return "";
}

export default async function handler(req, res) {
  const url = req.query.url || DEFAULT_URL;

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: HEADERS,
      // permitir seguir redirecionamentos
      maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const candidates = [];

    // Tentativas com seletores comuns
    const groups = [
      ".card",             // comum em muitos sites
      ".movie",            // classe genérica
      ".film",             // outra variação
      "article",           // bloco semântico
      ".item",             // genérico
      ".col"               // às vezes em grids
    ];

    for (const g of groups) {
      $(g).each((i, el) => {
        const root = $(el);
        const title = pickText(root, [".title", ".card-title", ".movie-title", "h2", "h3", "a"]);
        const year = pickText(root, [".year", ".meta-year", ".time"]);
        const link = pickAttr(root, ["a", "a.link", "a.title"], "href");
        const thumb = pickAttr(root, ["img", "img.thumb", "img.poster"], "src");

        if (title || thumb || link) {
          candidates.push({
            title: title || (root.find("a").attr("title") || "").trim(),
            year: year || "",
            link: safeUrl(link, url),
            thumb: safeUrl(thumb, url)
          });
        }
      });
      if (candidates.length) break; // se achar em um grupo, usa esse
    }

    // Se não encontrou com seletores, faz fallback: pega <a> com <img>
    if (candidates.length === 0) {
      $("a").each((i, el) => {
        const a = $(el);
        const img = a.find("img").first();
        if (img.length) {
          const title = a.attr("title") || img.attr("alt") || a.text().trim().slice(0, 80);
          const link = a.attr("href") || "";
          const thumb = img.attr("src") || "";
          if (link || thumb) {
            candidates.push({
              title: title || "",
              year: "",
              link: safeUrl(link, url),
              thumb: safeUrl(thumb, url)
            });
          }
        }
      });
    }

    // Remover duplicados simples (mesma link)
    const seen = new Set();
    const movies = candidates.filter((m) => {
      if (!m.link && !m.thumb && !m.title) return false;
      const key = (m.link || m.thumb || m.title).slice(0, 200);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Se estiver vazio e a resposta do site for um bloqueio (ex: Cloudflare), detecta possível 403-like
    if (movies.length === 0) {
      // tenta identificar se a página contém sinais de bloqueio
      const bodyLower = html.toLowerCase();
      const likelyBlocked =
        bodyLower.includes("cloudflare") ||
        bodyLower.includes("access denied") ||
        bodyLower.includes("forbidden") ||
        bodyLower.includes("captcha");

      if (likelyBlocked) {
        return res.status(403).json({
          error:
            "Acesso bloqueado pelo alvo (Cloudflare / Firewall). Considere usar proxy de scraping ou outro alvo."
        });
      }
    }

    return res.status(200).json(movies);
  } catch (err) {
    // Se o erro for 403 vindo do axios
    if (err.response && err.response.status === 403) {
      return res.status(403).json({
        error:
          "Falha na solicitação com código de status 403. O servidor alvo está bloqueando requisições. Tente usar um proxy de scraping ou testar localmente."
      });
    }

    return res.status(500).json({ error: err.message || "Erro desconhecido" });
  }
}
