// /api/courses.js — Webflow v2 → HTML for Teachable
// Env required: WEBFLOW_TOKEN, COLLECTION_ID, TEACHERS_COLLECTION_ID
// Optional: change TEACHABLE_ORIGIN if your school domain differs.

const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const TOKEN = process.env.WEBFLOW_TOKEN;
const COURSES_COLLECTION_ID = process.env.COLLECTION_ID;
const TEACHERS_COLLECTION_ID = process.env.TEACHERS_COLLECTION_ID;

// Webflow field keys we use
const PUBLISH_FIELD_KEY = 'publish';
const IMAGE_FIELD_KEY = 'teaser-hero';  // <Image> field holding the thumbnail
const TEACHERS_FIELD_KEY = 'teachers';  // <Multi-reference> field (IDs of teachers)
const TEACHERS_PORTRAIT_KEY = 'teaser-profile';  // <Multi-reference> field (IDs of teachers)

// Category sections (boolean fields on Course items)
const SECTIONS = [
    {
        title: 'Music Composition & Orchestration Courses',
        key: 'courses-composition-music',
    },
    {
        title: 'Music Production Courses',
        key: 'courses-music-production',
    },
    {
        title: 'Trailer Music Courses',
        key: 'courses-trailer-music',
    },
];

// Fetch helper with v2 auth
const wfFetch = (url) => fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

// ---------- Render helpers ----------
function teacherSpan(t) {
    if (!t) return '';
    return `
    <span class="teacher">
      ${t.portrait ? `<img class="teacher-portrait" src="${t.portrait}" alt="${t.name}">` : ''}
      ${t.name}
    </span>
  `;
}

function courseCardHTML(c) {
    const teachersHTML = (c.teachers || []).map(teacherSpan);
    return `
    <a class="mts-card" href="https://www.masterthescore.com/courses/${c.slug}">
      ${c.image ? `<img src="${c.image}" alt="">` : ''}
      <div class="meta">
        <div class="title">${c.name}</div>
        ${teachersHTML ? `<div class="teachers">${teachersHTML}</div>` : ''}
      </div>
    </a>
  `;
}

function sectionHTML(title, items) {
    if (!items || !items.length) return '';
    return `
    <section class="mts-section">
      <h2 class="mts-section-title">${title}</h2>
      <div class="mts-grid">
        ${items.map(courseCardHTML).join('')}
      </div>
    </section>
  `;
}

function renderSectionsHTML(grouped) {
    return grouped.map(g => sectionHTML(g.title, g.items)).join('');
}

/*
function renderHTML(items) {
    return `<section id="all-courses-content"><div class="mts-grid">${items.map(courseHTML).join('')}</div></section>`;
}
*/

// Instead of just returning <section>...</section>
function renderHTML(items) {
    const cards = items.map(courseHTML).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Courses Preview</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      padding: 2rem;
      background: #f9fafb;
    }
    .mts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(284px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .mts-card {
      display: flex;
      background: transparent;
      border: 1px solid #b69a5d;
      border-radius: 8px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      /*box-shadow: 0 2px 6px rgba(0,0,0,0.05);*/
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      flex-direction: column;
      align-items: stretch;
    }
    .mts-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.1);
    }
    .mts-card img {
      display: block;
      width: 100%;
      aspect-ratio: 7/5;
      object-fit: cover;
    }
    .mts-card .meta {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      padding: 0.75rem 1rem;
    }
    .mts-card .title {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.25rem;
      line-height: 1.3;
    }
    .mts-card .teachers {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-top: 0.25rem;
      font-size: 0.85rem;
      color: #6b7280;
    }
    .mts-card .teacher {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .mts-card .teacher-portrait {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: cover;
    }
  </style>
</head>
<body>
  <section id="all-courses-content">
    <div class="mts-grid">
      ${cards}
    </div>
  </section>
</body>
</html>`;
}

// ---------- Data mapping ----------
function toCourseBase(item) {
    const fd = item.fieldData || item;
    return {
        id: item.id,
        name: fd.name || '',
        slug: fd.slug || '',
        image: fd[IMAGE_FIELD_KEY]?.url || null,
        teacherIds: Array.isArray(fd[TEACHERS_FIELD_KEY]) ? fd[TEACHERS_FIELD_KEY] : [],
        // capture category flags for grouping
        categories: SECTIONS.reduce((acc, s) => {
            acc[s.key] = !!fd[s.key];
            return acc;
        }, {})
    };
}

// ---------- Webflow fetchers ----------
async function listItems(collectionId, limit = 100, offset = 0) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
    const text = await r.text();
    if (!r.ok) throw new Error(`List ${collectionId} ${r.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text); // { items: [...], pagination:{...} }
}

async function getItem(collectionId, itemId) {
    const r = await wfFetch(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`);
    const text = await r.text();
    if (!r.ok) throw new Error(`Get ${collectionId}/${itemId} ${r.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

// bounded concurrency
async function fetchMany(ids, fn, concurrency = 8) {
    const results = {};
    let i = 0;
    async function worker() {
        while (i < ids.length) {
            const id = ids[i++];
            try {
                results[id] = await fn(id);
            } catch (_) {}
        }
    }
    await Promise.all(new Array(Math.min(concurrency, ids.length)).fill(0).map(worker));
    return results;
}

// ---------- Handler ----------
module.exports = async (req, res) => {
    const debug = 'debug' in (req.query || {});
    const preview = 'preview' in (req.query || {}); // ?preview=1 shows full page w/ CSS

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    try {
        if (!TOKEN || !COURSES_COLLECTION_ID) throw new Error('Missing WEBFLOW_TOKEN or COLLECTION_ID');

        // 1) Load all courses
        const data = await listItems(COURSES_COLLECTION_ID, 100, 0);

        // 2) Filter to published only
        const publishedItems = (data.items || []).filter(it => {
            const fd = it.fieldData || it;
            return fd[PUBLISH_FIELD_KEY] === true;
        });

        // 3) Map to base course
        const baseCourses = publishedItems.map(toCourseBase);

        // 4) Resolve teacher names + portraits (optional if TEACHERS_COLLECTION_ID exists)
        let teacherMap = {};
        if (TEACHERS_COLLECTION_ID) {
            const allTeacherIds = Array.from(new Set(baseCourses.flatMap(c => c.teacherIds)));
            teacherMap = await fetchMany(allTeacherIds, async (id) => {
                const t = await getItem(TEACHERS_COLLECTION_ID, id);
                const fd = t.fieldData || t;
                return {
                    id,
                    name: fd.name || '',
                    portrait: fd[TEACHER_PORTRAIT_KEY]?.url || null
                };
            });
        }

        // 5) Attach teachers to each course
        const courses = baseCourses.map(c => ({
            name: c.name,
            slug: c.slug,
            image: c.image,
            teachers: (c.teacherIds || []).map(id => teacherMap[id]).filter(Boolean),
            categories: c.categories
        }));

        // 6) Group by the 3 sections (include course in every section whose flag is true)
        const grouped = SECTIONS.map(s => ({
            title: s.title,
            key: s.key,
            items: courses.filter(c => c.categories[s.key])
        }));

        // 7) Render
        const sectionsHTML = renderSectionsHTML(grouped);

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Cache-Control', 'public, max-age=300');

        if (preview) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(renderFullPage(sectionsHTML));
        } else {
            // Teachable injection mode: return only the sections, no <html> wrapper
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(sectionsHTML);
        }
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