// netlify/functions/fact-api.mjs — shared storage for FACT. debates.
//
//   GET    /api/fact/debates        list of debates (summaries)
//   POST   /api/fact/debates        open a new debate  {motion, context, cat, author}
//   GET    /api/fact/debates/:id    one debate, as seen by the caller
//   POST   /api/fact/debates/:id    apply one action   {type, ...}  (see fact/core.mjs)
//   DELETE /api/fact/debates/:id    delete a debate (its author or a moderator)
//   GET    /api/fact/me             {admin: bool} — checks a moderator key
//
// Each debate is one JSON blob ("d/<id>") in the Netlify Blobs store "fact".
// Every change is a read → apply → conditional write on the blob's ETag, so
// two people voting at the same moment can't overwrite each other.
//
// Identity: there are no accounts. The browser makes a random voter id once
// and sends it as X-Fact-Voter. It decides "one vote per browser", lets
// authors delete their own posts, and is never returned to anyone.
//
// Moderation: set FACT_ADMIN_KEY in Netlify's environment variables. A browser
// that enters that key at /fact/#/mod can delete any debate, point or rebuttal.
//
// No CORS headers on purpose: only pages on this site can call the API.

import { getStore } from '@netlify/blobs';
import { newDebate, apply, toView, toSummary, sampleDebates, canDeleteDebate, RuleError, LIMITS } from '../../fact/core.mjs';

const PREFIX = 'd/';
const VOTER_RE = /^[A-Za-z0-9_-]{16,64}$/;
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const MAX_BODY = 8000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
const fail = (message, status = 400) => json({ error: message }, status);

function sameString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new RuleError('Too long.', 413);
  try { return JSON.parse(text || '{}'); } catch { throw new RuleError('Bad request.'); }
}

async function allDocs(store) {
  const { blobs } = await store.list({ prefix: PREFIX });
  const docs = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json', consistency: 'strong' }).catch(() => null)));
  return docs.filter(Boolean);
}

// First visit ever: put the sample debates in. The marker makes sure this
// happens once, even if two visitors arrive together or every debate is
// later deleted.
async function seedOnce(store) {
  const mark = await store.setJSON('meta/seeded', { at: Date.now() }, { onlyIfNew: true });
  if (!mark.modified) return false;
  await Promise.all(sampleDebates().map((d) => store.setJSON(PREFIX + d.id, d)));
  return true;
}

// Read → change → write only if nobody else wrote in between; retry if they did.
async function update(store, id, change) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await store.getWithMetadata(PREFIX + id, { type: 'json', consistency: 'strong' });
    if (!cur) throw new RuleError('No such debate.', 404);
    const doc = cur.data;
    const result = change(doc);
    const w = cur.etag
      ? await store.setJSON(PREFIX + id, doc, { onlyIfMatch: cur.etag })
      : await store.setJSON(PREFIX + id, doc);
    if (w.modified) return { doc, result };
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
  }
  throw new RuleError('Busy debate — try that again.', 409);
}

// Exported so it can run against any store (local tests use a local one).
export async function handle(req, { store, adminKey }) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/fact\/?/, '').split('/').filter(Boolean);
  const vid = req.headers.get('x-fact-voter') || '';
  const admin = !!adminKey && sameString(req.headers.get('x-fact-admin') || '', adminKey);
  const needVoter = () => { if (!VOTER_RE.test(vid)) throw new RuleError('Missing voter id.', 401); };

  try {
    if (parts[0] === 'me' && parts.length === 1 && req.method === 'GET') return json({ admin });

    if (parts[0] !== 'debates') return fail('Not found.', 404);

    if (parts.length === 1) {
      if (req.method === 'GET') {
        let docs = await allDocs(store);
        if (!docs.length && await seedOnce(store)) docs = await allDocs(store);
        return json({ debates: docs.map(toSummary) });
      }
      if (req.method === 'POST') {
        needVoter();
        const body = await readBody(req);
        const { blobs } = await store.list({ prefix: PREFIX });
        if (blobs.length >= LIMITS.debates) throw new RuleError('FACT. is full right now. Try again later.', 429);
        const doc = newDebate(body, vid);
        await store.setJSON(PREFIX + doc.id, doc, { onlyIfNew: true });
        return json({ debate: toView(doc, vid, { admin }) }, 201);
      }
      return fail('Method not allowed.', 405);
    }

    const id = parts[1];
    if (parts.length !== 2 || !ID_RE.test(id)) return fail('Not found.', 404);

    if (req.method === 'GET') {
      const doc = await store.get(PREFIX + id, { type: 'json', consistency: 'strong' });
      if (!doc) return fail('No such debate.', 404);
      return json({ debate: toView(doc, vid, { admin }) });
    }
    if (req.method === 'POST') {
      needVoter();
      const body = await readBody(req);
      const { doc, result } = await update(store, id, (d) => apply(d, vid, body, { admin }));
      return json({ debate: toView(doc, vid, { admin }), result: result || null });
    }
    if (req.method === 'DELETE') {
      needVoter();
      const doc = await store.get(PREFIX + id, { type: 'json', consistency: 'strong' });
      if (!doc) return fail('No such debate.', 404);
      if (!canDeleteDebate(doc, vid, admin)) return fail('You can only delete debates you opened.', 403);
      await store.delete(PREFIX + id);
      return json({ ok: true });
    }
    return fail('Method not allowed.', 405);
  } catch (e) {
    if (e instanceof RuleError) return fail(e.message, e.status);
    console.error('fact-api error:', e);
    return fail('Something went wrong. Try again.', 500);
  }
}

export default async (req) => {
  const store = getStore({ name: 'fact', consistency: 'strong' });
  const adminKey = (globalThis.Netlify && Netlify.env.get('FACT_ADMIN_KEY')) || process.env.FACT_ADMIN_KEY || '';
  return handle(req, { store, adminKey });
};

export const config = { path: ['/api/fact', '/api/fact/*'] };
