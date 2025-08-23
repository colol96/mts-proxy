const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const TOKEN = process.env.50000c1b5f0ed810c790cec1c6c4487f93dcb98ecd01ddd2253bad509f071a5e;
const COLLECTION_ID = process.env.65c375ede1d584c57eab1c18;
// /api/courses.js — Webflow API v2 → returns ready-to-inject HTML

// Map your collection item to the fields you need
function toCard(it) {
    // Adjust these based on your collection's fields (see "Raw inspector" below)
    const name = it.name || '';
    const slug = it.slug || '';
    // Common v2 asset shapes: {fileId, url, ...} or nested field keys
    /*
    const image =
        it.mainImage?.url ||
        it.thumbnail?.url ||
        it.image?.url ||
        null;
    const price = it.price ?? it['course-price'] ?? null;

     */

    return { name, slug };
}

function renderHTML(items) {
    const cards = items.map(c => `
    <a class="mts-card" href="https://www.masterthescore.com/courses/${c.slug}">
      ${c.image ? `<img src="${c.image}" alt="">` : ''}
      <div class="meta">
        <div class="title">${c.name}</div>
        ${c.price ? `<div class="price">${c.price}</div>` : ''}
      </div>
    </a>
  `).join('');
    return `<section id="all-courses-content"><div class="mts-grid">${cards}</div></section>`;
}

module.exports = async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    if (!TOKEN || !COLLECTION_ID) {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        return res.status(500).send('Missing WEBFLOW_TOKEN or COLLECTION_ID');
    }

    try {
        const url = `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items?limit=100`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
        const text = await r.text();
        if (!r.ok) throw new Error(`v2 ${r.status} ${text.slice(0,180)}`);

        const data = JSON.parse(text); // {items:[...]}
        const items = (data.items || []).map(toCard);
        const html = renderHTML(items);

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(html);
    } catch (e) {
        console.error('[COURSES v2 ERROR]', e.message);
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.status(502).send('');
    }
};
