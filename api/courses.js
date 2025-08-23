// api/courses.js
// Step A: first run — just fetch items and return JSON so you can inspect field names.

const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const WEBFLOW_TOKEN = process.env.52faf5b60be0a68021a1c38932ddf23289a4cc4bc8bc641a883b88d0324a120b;
const COLLECTION_ID = process.env.65c375ede1d584c57eab1c18;

// Toggle to inspect fields first:
const DEBUG_RAW_JSON = true; // set true temporarily to inspect fields

module.exports = async (req, res) => {
    if (!WEBFLOW_TOKEN || !COLLECTION_ID) {
        res.status(500).send('Missing WEBFLOW_TOKEN or COLLECTION_ID');
        return;
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
    }

    try {
        // Webflow API: v1 style endpoint (commonly used)
        const url = `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items?live=true&limit=100`;
        const r = await fetch(url, {
            headers: {
                //Authorization: `Bearer ${WEBFLOW_TOKEN}`,
                // Some workspaces require this header for v1 API:
                // 'accept-version': '1.0.0'
                Authorization: `Bearer ${WEBFLOW_TOKEN}`,
                'accept-version': '1.0.0'
            }
        });

        if (!r.ok) throw new Error(`Webflow API ${r.status}`);
        const data = await r.json(); // {items: [...]}

        if (DEBUG_RAW_JSON) {
            res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(200).send(JSON.stringify(data, null, 2));
            return;
        }

        // ---- Map fields (adjust these keys to match your collection) ----
        const items = (data.items || []).map(it => ({
            id: it._id,
            name: it.name,                     // string
            slug: it.slug,                     // string
        }));

        // ---- Render HTML (cards) ----
        const cards = items.map(it => `
      <a class="mts-card" href="https://www.masterthescore.com/courses/${it.slug}">
        ${it.image ? `<img src="${it.image}" alt="">` : ''}
        <div class="meta">
          <div class="title">${it.name || ''}</div>
          ${it.price ? `<div class="price">${it.price}</div>` : ''}
        </div>
      </a>
    `).join('');

        const html = `
      <section id="all-courses-content">
        <div class="mts-grid">
          ${cards}
        </div>
      </section>
    `;

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(html);
    } catch (e) {
        console.error(e);
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.status(502).send('');
    }
};
