// /api/courses.js — Webflow v2, with multi-ref teacher resolution
const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const TOKEN = process.env.WEBFLOW_TOKEN;
const COURSES_COLLECTION_ID = process.env.COLLECTION_ID;
const TEACHERS_FIELD_KEY = 'teachers';     // multi-reference field
const IMAGE_FIELD_KEY = 'teaser-hero';     // image field to display

// Helper: fetch with Webflow v2 auth
const wfFetch = (url) => fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

// Build HTML for one course card
function courseHTML(c) {
    const teacherNames = c.teachers?.map(t => t.name).join(', ') || '';
    return `
    <a class="mts-card" href="https://www.masterthescore.com/courses/${c.slug}">
      ${c.image ? `<img src="${c.image}" alt="">` : ''}
      <div class="meta">
        <div class="title">${c.name}</div>
        ${teacherNames ? `<div class="teachers">${teacherNames}</div>` : ''}
      </div>
    </a>
  `;
}

function renderHTML(items) {
    return `<section id="all-courses-content"><div class="mts-grid">${items.map(courseHTML).join('')}</div></section>`;
}

// Convert raw item → base course object
function toCourseBase(it) {
    const fd = it.fieldData || it;
    return {
        id: it.id,
        name: fd.name || '',
        slug: fd.slug || '',
        image: fd[IMAGE_FIELD_KEY]?.url || null,
        teacherIds: Array.isArray(fd[TEACHERS_FIELD_KEY]) ? fd[TEACHERS_FIELD_KEY] : []
    };
}

async function listItems(collectionId, limit = 100, offset = 0) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
    const text = await r.text();
    if (!r.ok) throw new Error(`Items ${collectionId} ${r.status}: ${text.slice(0,200)}`);
    return JSON.parse(text);
}

async function getCollectionSchema(collectionId) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}`);
    if (!r.ok) throw new Error(`Schema ${collectionId} ${r.status}`);
    return r.json();
}

async function getItem(collectionId, itemId) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`);
    const text = await r.text();
    if (!r.ok) throw new Error(`Item ${itemId} ${r.status}: ${text.slice(0,200)}`);
    return JSON.parse(text);
}

module.exports = async (req, res) => {
    const debug = 'debug' in (req.query || {});

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    try {
        if (!TOKEN || !COURSES_COLLECTION_ID) throw new Error('Missing WEBFLOW_TOKEN or COLLECTION_ID');

        // 1. Get schema of Courses collection → find Teachers field target collection
        const schema = await getCollectionSchema(COURSES_COLLECTION_ID);
        const teacherField = (schema.fields || []).find(f => f.key === TEACHERS_FIELD_KEY);
        const teachersCollectionId = teacherField?.metadata?.collectionId;
        if (!teachersCollectionId) throw new Error('Could not resolve teachers collection ID');

        // 2. Get Courses
        const data = await listItems(COURSES_COLLECTION_ID, 100, 0);
        const courses = (data.items || []).map(toCourseBase);

        // 3. Collect all teacher IDs
        const allTeacherIds = new Set();
        courses.forEach(c => c.teacherIds.forEach(id => allTeacherIds.add(id)));

        // 4. Fetch teachers by ID
        const teacherMap = {};
        const ids = Array.from(allTeacherIds);
        for (const id of ids) {
            try {
                const t = await getItem(teachersCollectionId, id);
                const fd = t.fieldData || t;
                teacherMap[id] = { id, name: fd.name || '' };
            } catch (e) {
                if (debug) console.warn('Teacher fetch failed for', id, e.message);
            }
        }

        // 5. Attach teacher names
        const coursesWithTeachers = courses.map(c => ({
            ...c,
            teachers: c.teacherIds.map(id => teacherMap[id]).filter(Boolean)
        }));

        // 6. Render HTML
        const html = renderHTML(coursesWithTeachers);

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(html);
    } catch (e) {
        if (debug) {
            res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(500).send(String(e));
        }
        console.error('[COURSES ERROR]', e);
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.status(502).send('');
    }
};