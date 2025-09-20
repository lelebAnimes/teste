// api/movies.js
import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_URL = "https://www.visioncine-1.com/movies";

// Se tiver um serviço de proxy de scraping (ex: ScrapingBee), coloque a chave em SCRAPINGBEE_KEY
// Exemplo de env: SCRAPINGBEE_KEY=suachave123

async function fetchWithOptionalProxy(targetUrl) {
  const scrapingBeeKey = process.env.SCRAPINGBEE_KEY || "";
  if (scrapingBeeKey) {
    // Usando ScrapingBee como exemplo — se tiver outra API mude a URL/params
    const proxyUrl = `https://app.scrapingbee.com/api/v1?api_key=${scrapingBeeKey}&url=${encodeURIComponent(targetUrl)}&render_js=false`;
    return axios.get(proxyUrl, { timeout: 20000 });
  }

  // Sem proxy: tenta acessar direto com headers de navegador
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://www.google.com/"
  };

  // Tentativa simples com retry
  let lastErr = null;
  const maxTries = 3;
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      return await axios.get(targetUrl, { timeout: 15000, headers });
    } catch (err) {
      lastErr = err;
      // backoff simples
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr;
}

export default async function handler(req, res) {
  try {
    const url = req.query.url || DEFAULT_URL;

    // Faz a requisição (direta ou via proxy se variável de ambiente estiver setada)
    const response = await fetchWithOptionalProxy(url);

    // Se o proxy retornou 200 mas conteúdo vazio, checar status
    if (!response || !response.data) {
      return res.status(502).json({ error: "Resposta inválida do destino." });
    }

    const html = response.data;
    const $ = cheerio.load(html);

    // Ajuste os seletores conforme o site real
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

      // normaliza links relativos
      try {
        l = new URL(l, url).toString();
      } catch (e) {}

      try {
        th = new URL(th, url).toString();
      } catch (e) {}

      if (t) {
        movies.push({ title: t, year: y, link: l, thumb: th });
      }
    });

    return res.status(200).json(movies);
  } catch (err) {
    // Exibe info útil no JSON para debugging local (não exponha muita coisa em produção)
    const status = err?.response?.status || 500;
    const msg = err?.response?.statusText || err.message || "Erro desconhecido";
    return res.status(500).json({
      error: `Falha ao buscar: ${msg}`,
      code: status,
      details: err?.response?.data || null
    });
  }
}
