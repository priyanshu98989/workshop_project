const logger = require('../utils/logger');

const SEARCH_URL = 'https://html.duckduckgo.com/html/';

function decodeEntities(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function extractRealUrl(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    if (u.pathname === '/l/') {
      return u.searchParams.get('uddg') || href;
    }
    return u.href;
  } catch {
    return href;
  }
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).trim();
}

function parseResults(html) {
  const results = [];
  const blocks = html.split('<div class="result results_links').slice(1);

  for (const block of blocks) {
    if (results.length >= 6) break;

    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>(.*?)<\/a>/s);

    if (!titleMatch) continue;

    const title = stripTags(titleMatch[2]);
    const url = extractRealUrl(titleMatch[1]);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : '';

    if (title) results.push({ title, url, snippet });
  }

  return results;
}

async function search(query, maxResults = 5) {
  try {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      body: `q=${encodeURIComponent(query)}`,
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`search engine returned ${res.status}`);
    }

    const html = await res.text();
    const results = parseResults(html).slice(0, maxResults);
    logger.info(`Web search "${query}" -> ${results.length} results`);
    return results;
  } catch (err) {
    logger.warn(`Web search failed (${err.message})`);
    return [];
  }
}

module.exports = { search };