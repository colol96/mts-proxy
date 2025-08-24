// /api/courses.js — Webflow v2 → HTML for Teachable
// Env required: WEBFLOW_TOKEN, COLLECTION_ID, TEACHERS_COLLECTION_ID
// Optional: change TEACHABLE_ORIGIN if your school domain differs.

const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const TOKEN = process.env.WEBFLOW_TOKEN;
const COURSES_COLLECTION_ID = process.env.COLLECTION_ID;
const TEACHERS_COLLECTION_ID = process.env.TEACHERS_COLLECTION_ID;

// Webflow field keys we use
const IMAGE_FIELD_KEY = 'teaser-hero';  // <Image> field holding the thumbnail
const TEACHERS_FIELD_KEY = 'teachers';  // <Multi-reference> field (IDs of teachers)
const TEACHERS_PORTRAIT_KEY = 'teaser-profile';  // <Multi-reference> field (IDs of teachers)

// Fetch helper with v2 auth
const wfFetch = (url) => fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

// ---------- Helpers ----------
function courseHTML(c) {
    const teacherSpans = (c.teachers || []).map(t => {
        if (!t) return '';
        return `
      <span class="teacher">
        ${t.portrait ? `<img class="teacher-portrait" src="${t.portrait}" alt="${t.name}">` : ''}
        ${t.name}
      </span>
    `;
    }).join(', ');

    return `
    <a class="mts-card" href="https://www.masterthescore.com/courses/${c.slug}">
      ${c.image ? `<img src="${c.image}" alt="">` : ''}
      <div class="meta">
        <div class="title">${c.name}</div>
        ${teacherSpans ? `<div class="teachers">${teacherSpans}</div>` : ''}
      </div>
    </a>
  `;
}

function renderHTML(items) {
    return `<section id="all-courses-content"><div class="mts-grid">${items.map(courseHTML).join('')}</div></section>`;
}

function toCourseBase(item) {
    // v2 returns custom fields under item.fieldData
    const fd = item.fieldData || item;
    return {
        id: item.id,
        name: fd.name || '',
        slug: fd.slug || '',
        image: fd[IMAGE_FIELD_KEY]?.url || null,
        teacherIds: Array.isArray(fd[TEACHERS_FIELD_KEY]) ? fd[TEACHERS_FIELD_KEY] : []
    };
}

async function listItems(collectionId, limit = 100, offset = 0) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
    const text = await r.text();
    if (!r.ok) throw new Error(`List ${collectionId} ${r.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text); // { items: [...], pagination: {...} }
}

async function getItem(collectionId, itemId) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`);
    const text = await r.text();
    if (!r.ok) throw new Error(`Get ${collectionId}/${itemId} ${r.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

// Simple bounded concurrency for fetching teachers
async function fetchMany(ids, fn, concurrency = 8) {
    const results = {};
    let i = 0;
    async function worker() {
        while (i < ids.length) {
            const id = ids[i++];
            try {
                const x = await fn(id);
                results[id] = x;
            } catch (_) {
                // ignore missing/archived
            }
        }
    }
    await Promise.all(new Array(Math.min(concurrency, ids.length)).fill(0).map(worker));
    return results;
}

// ---------- Handler ----------
module.exports = async (req, res) => {
    const debug = 'debug' in (req.query || {});

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    try {
        if (!TOKEN || !COURSES_COLLECTION_ID) {
            throw new Error('Missing WEBFLOW_TOKEN or COLLECTION_ID');
        }

        // 1) Load courses
        const data = await listItems(COURSES_COLLECTION_ID, 100, 0);
        const baseCourses = (data.items || []).map(toCourseBase);

        // 2) Resolve teacher names (if TEACHERS_COLLECTION_ID is provided)
        let teacherMap = {};
        if (TEACHERS_COLLECTION_ID) {
            const allTeacherIds = Array.from(new Set(baseCourses.flatMap(c => c.teacherIds)));
            teacherMap = await fetchMany(allTeacherIds, async (id) => {
                const t = await getItem(TEACHERS_COLLECTION_ID, id);
                const fd = t.fieldData || t;
                return {
                    id,
                    name: fd.name || '',
                    portrait: fd[TEACHERS_PORTRAIT_KEY]?.url || null
                };
            });
        }

        // 3) Attach teachers and render
        const courses = baseCourses.map(c => ({
            name: c.name,
            slug: c.slug,
            image: c.image,
            teachers: (c.teacherIds || []).map(id => teacherMap[id]).filter(Boolean)
        }));

        const html = renderHTML(courses);

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).send(html);

    } catch (e) {
        if (debug) {
            res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(500).send(String(e));
        }
        console.error('[COURSES ERROR]', e);
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        return res.status(502).send('');
    }
};
