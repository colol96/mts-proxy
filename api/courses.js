// /api/courses.js
const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const SOURCE_URL = 'https://www.masterthescore.com/courses';

// grab the element with id="all-courses-content"
function extractSection(html) {
    const re = /<([a-zA-Z0-9:-]+)[^>]*\sid=["']all-courses-content["'][^>]*>([\s\S]*?)<\/\1>/i;
    const m = html.match(re);
    return m ? m[0] : '';
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
    }

    try {
        const r = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'MTS-Teachable-Proxy' } });
        const html = await r.text();
        const section = extractSection(html);

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(section ? 200 : 204).send(section);
    } catch (e) {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.status(502).send('');
    }
};