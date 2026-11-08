// fact/core.mjs — the rules of a FACT. debate, in one place.
//
// The browser and the server both run this file:
//   - netlify/functions/fact-api.mjs applies every change through it, so the
//     shared, live debates follow exactly these rules;
//   - fact/index.html uses it directly when the API can't be reached (opened
//     from disk, local preview), keeping debates in that browser only.
//
// A stored debate ("doc") keeps raw per-voter records. Counts are never
// stored; they are derived from those records, so they can't drift. The
// public view (toView) returns counts plus the caller's own choices, never
// other people's voter ids.

export const CATS = ['Society', 'Tech', 'Science', 'Economy', 'Education', 'Culture'];
export const SIDES = ['for', 'against', 'undecided'];

export const LIMITS = {
  motionMin: 10, motionMax: 140,
  contextMax: 400,
  pointMin: 12, pointMax: 400,
  replyMin: 3, replyMax: 280,
  nameMax: 24, srcMax: 500,
  pointsPerDebate: 300,
  repliesPerPoint: 50,
  debates: 500,
};

export class RuleError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function uid() {
  try { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }
  catch { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
}

export function safeUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
  } catch { return ''; }
}

const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const cleanBlock = (s, max) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
export function cleanName(s) { return clean(s, LIMITS.nameMax).replace(/\s+/g, '_') || 'anonymous'; }
const isSide = (s) => s === 'for' || s === 'against';

/* ---------- creating ---------- */

export function newDebate(input, vid, now = Date.now()) {
  const motion = clean(input && input.motion, 1000);
  if (motion.length < LIMITS.motionMin) throw new RuleError('Write a full motion — at least 10 characters.');
  if (motion.length > LIMITS.motionMax) throw new RuleError('Keep the motion under 140 characters.');
  if (/\?$/.test(motion)) throw new RuleError('That’s a question. Make it a statement people can be for or against.');
  const cat = CATS.includes(input.cat) ? input.cat : CATS[0];
  return {
    id: uid(), motion, cat,
    context: cleanBlock(input.context, LIMITS.contextMax),
    author: cleanName(input.author), authorVid: vid || '',
    created: now, sample: false,
    voters: {}, points: [],
  };
}

/* ---------- changing ---------- */

function findPoint(doc, pid) {
  const p = doc.points.find((x) => x.id === pid);
  if (!p) throw new RuleError('That point no longer exists.', 404);
  return p;
}

// Apply one action from voter `vid`. Mutates `doc`. Throws RuleError when the
// action breaks a rule. `admin` lets a moderator delete anything.
export function apply(doc, vid, action, { now = Date.now(), admin = false } = {}) {
  if (!vid) throw new RuleError('Missing voter id.', 401);
  const a = action || {};
  const me = doc.voters[vid];

  switch (a.type) {
    case 'stance': {
      if (!SIDES.includes(a.side)) throw new RuleError('Pick for, against or undecided.');
      if (!me) doc.voters[vid] = { b: a.side, n: a.side, by: null };
      else { me.n = a.side; me.by = null; }
      return;
    }
    case 'convince': {
      const p = findPoint(doc, a.pid);
      if (!me) throw new RuleError('Pick a side first, then let the arguments move you.');
      if (me.n === p.side) throw new RuleError('You’re already on that side.');
      me.n = p.side; me.by = p.id;
      return;
    }
    case 'vote': {
      const p = findPoint(doc, a.pid);
      const k = { strong: 's', verify: 'v', dispute: 'd' }[a.kind];
      if (!k) throw new RuleError('Unknown vote.');
      if (k !== 's' && p.kind !== 'fact') throw new RuleError('Only facts can be checked or disputed.');
      const v = p.votes[vid] || (p.votes[vid] = {});
      if (v[k]) delete v[k]; else v[k] = 1;
      if (k === 'v' && v.v) delete v.d;
      if (k === 'd' && v.d) delete v.v;
      if (!v.s && !v.v && !v.d) delete p.votes[vid];
      return;
    }
    case 'point': {
      if (!isSide(a.side)) throw new RuleError('Post to FOR or AGAINST.');
      if (doc.points.length >= LIMITS.pointsPerDebate) throw new RuleError('This debate is full.');
      const kind = a.kind === 'opinion' ? 'opinion' : 'fact';
      const text = clean(a.text, 1000);
      if (text.length < LIMITS.pointMin) throw new RuleError('Make a real point — at least 12 characters.');
      if (text.length > LIMITS.pointMax) throw new RuleError('Keep it to one point — under 400 characters.');
      let src = '';
      if (kind === 'fact') {
        if (!String(a.src || '').trim()) throw new RuleError('Facts need a source. Add a link, or post it as an opinion.');
        src = safeUrl(a.src);
        if (!src || src.length > LIMITS.srcMax) throw new RuleError('That link doesn’t look right. Use a full https:// address.');
      }
      const id = uid();
      doc.points.push({ id, side: a.side, kind, text, src, author: cleanName(a.author), authorVid: vid, created: now, votes: {}, replies: [] });
      return id;
    }
    case 'reply': {
      const p = findPoint(doc, a.pid);
      if (p.replies.length >= LIMITS.repliesPerPoint) throw new RuleError('This thread is full.');
      const text = clean(a.text, 1000);
      if (text.length < LIMITS.replyMin) throw new RuleError('Say a little more.');
      if (text.length > LIMITS.replyMax) throw new RuleError('Keep rebuttals under 280 characters.');
      const side = me && isSide(me.n) ? me.n : (p.side === 'for' ? 'against' : 'for');
      p.replies.push({ id: uid(), side, author: cleanName(a.author), authorVid: vid, text, created: now });
      return;
    }
    case 'deletePoint': {
      const p = findPoint(doc, a.pid);
      if (!admin && p.authorVid !== vid) throw new RuleError('You can only delete your own points.', 403);
      doc.points = doc.points.filter((x) => x.id !== p.id);
      for (const v of Object.values(doc.voters)) if (v.by === p.id) v.by = null;
      return;
    }
    case 'deleteReply': {
      const p = findPoint(doc, a.pid);
      const r = p.replies.find((x) => x.id === a.rid);
      if (!r) throw new RuleError('That rebuttal no longer exists.', 404);
      if (!admin && r.authorVid !== vid) throw new RuleError('You can only delete your own rebuttals.', 403);
      p.replies = p.replies.filter((x) => x.id !== r.id);
      return;
    }
    default:
      throw new RuleError('Unknown action.');
  }
}

export function canDeleteDebate(doc, vid, admin) {
  return !!admin || (!!vid && doc.authorVid === vid);
}

/* ---------- reading ---------- */

function tally(doc) {
  const before = { for: 0, against: 0, undecided: 0 };
  const now = { for: 0, against: 0, undecided: 0 };
  const changed = {};
  for (const v of Object.values(doc.voters)) {
    if (before[v.b] != null) before[v.b]++;
    if (now[v.n] != null) now[v.n]++;
    if (v.by) changed[v.by] = (changed[v.by] || 0) + 1;
  }
  return { before, now, changed };
}

// Public view of one debate for voter `vid`: counts plus the caller's own
// stance and votes. No other voter's id or author id leaves this function.
export function toView(doc, vid, { admin = false } = {}) {
  const t = tally(doc);
  const mine = doc.voters[vid];
  return {
    id: doc.id, motion: doc.motion, context: doc.context, cat: doc.cat,
    author: doc.author, created: doc.created, sample: !!doc.sample,
    before: t.before, now: t.now,
    mine: mine ? { before: mine.b, now: mine.n, by: mine.by } : null,
    canDelete: canDeleteDebate(doc, vid, admin),
    points: doc.points.map((p) => {
      let strong = 0, verified = 0, disputed = 0;
      for (const v of Object.values(p.votes)) { if (v.s) strong++; if (v.v) verified++; if (v.d) disputed++; }
      const my = p.votes[vid] || {};
      return {
        id: p.id, side: p.side, kind: p.kind, text: p.text, src: p.src,
        author: p.author, created: p.created,
        strong, verified, disputed, changed: t.changed[p.id] || 0,
        myVote: { strong: !!my.s, verify: !!my.v, dispute: !!my.d },
        canDelete: admin || (!!vid && p.authorVid === vid),
        replies: p.replies.map((r) => ({
          id: r.id, side: r.side, author: r.author, text: r.text, created: r.created,
          canDelete: admin || (!!vid && r.authorVid === vid),
        })),
      };
    }),
  };
}

// Short summary for the debate list.
export function toSummary(doc) {
  const t = tally(doc);
  return {
    id: doc.id, motion: doc.motion, cat: doc.cat, created: doc.created, sample: !!doc.sample,
    before: t.before, now: t.now,
    points: doc.points.length,
    facts: doc.points.filter((p) => p.kind === 'fact').length,
    activity: doc.points.length * 5 + Object.keys(doc.voters).length,
  };
}

/* ---------- sample debates ---------- */

// Arguments only — sample debates start with no votes, so every count you see
// on them is real.
export function sampleDebates(now = Date.now()) {
  const H = 3600000;
  let k = 0;
  const P = (side, kind, text, src, author, replies = []) => ({
    id: uid(), side, kind, text, src: src || '', author, authorVid: '', created: now - (++k) * 3 * H, votes: {},
    replies: replies.map(([rs, ra, rt]) => ({ id: uid(), side: rs, author: ra, authorVid: '', text: rt, created: now - k * 2 * H })),
  });
  const D = (hoursAgo, cat, motion, context, points) => ({
    id: uid(), cat, motion, context, author: 'fact.team', authorVid: '', created: now - hoursAgo * H,
    sample: true, voters: {}, points,
  });
  return [
    D(72, 'Science', 'Nuclear power is the fastest route to a zero-carbon grid.',
      'Renewables are cheap and quick to build. Nuclear is reliable but slow and expensive. Which gets a country to clean electricity first?', [
      P('for', 'fact', 'Across its life cycle, nuclear electricity has greenhouse-gas emissions in the same low range as wind and far below coal and gas.',
        'https://en.wikipedia.org/wiki/Life-cycle_greenhouse_gas_emissions_of_energy_sources', 'grid_nerd',
        [['against', 'sunny_side', 'Low emissions per kWh is not the same as fast. The motion is about speed.']]),
      P('for', 'fact', 'France built most of its nuclear fleet in roughly 15 years in the 1970s–80s and now runs one of the lowest-carbon grids in Europe.',
        'https://en.wikipedia.org/wiki/Nuclear_power_in_France', 'ohm_my'),
      P('for', 'opinion', 'A grid needs power when the wind is still. Firm, always-on supply is what lets you actually switch the coal plants off.', '', 'baseload_ben'),
      P('against', 'fact', 'Several recent Western reactor projects ran years late and billions over budget, among them Flamanville 3 in France.',
        'https://en.wikipedia.org/wiki/Flamanville_Nuclear_Power_Plant', 'sunny_side',
        [['for', 'grid_nerd', 'Those were first-of-a-kind builds after decades of not building. Repeat builds get faster.']]),
      P('against', 'fact', 'Solar and wind are now among the cheapest sources of new electricity in much of the world.',
        'https://en.wikipedia.org/wiki/Cost_of_electricity_by_source', 'watt_if'),
      P('against', 'opinion', 'Every dollar locked into a 15-year reactor build is a dollar not spent on panels, batteries and transmission that can go live this year.', '', 'kilo_watt'),
    ]),
    D(48, 'Society', 'City centres should be car-free.',
      'Some cities have pedestrianised their cores. Others say it kills shops and shuts out people who need to drive.', [
      P('for', 'fact', 'Pontevedra in Spain banned most cars from its historic centre in 1999 and has become a widely studied example of pedestrian-first planning.',
        'https://en.wikipedia.org/wiki/Pontevedra', 'walk_this_way'),
      P('for', 'opinion', 'Streets are the biggest public space a city owns. Using most of it to store parked cars is a choice, not a law of nature.', '', 'curb_appeal'),
      P('against', 'opinion', 'Car-free cores work for tourists and the young. Disabled residents, tradespeople with tools, and parents with three kids get left out.', '', 'van_life',
        [['for', 'walk_this_way', 'Most schemes allow access for disabled drivers, deliveries and residents. "Car-free" rarely means zero vehicles.']]),
      P('against', 'fact', 'Congestion pricing, as used in London and Stockholm, cuts traffic without banning cars outright.',
        'https://en.wikipedia.org/wiki/Congestion_pricing', 'toll_free'),
    ]),
    D(24, 'Education', 'Primary schools should abolish homework.',
      'Is homework for young children building good habits, or just stress at the kitchen table?', [
      P('for', 'opinion', 'After six hours of school, a seven-year-old learns more from play, reading for fun and sleep than from worksheets.', '', 'recess_now'),
      P('for', 'fact', 'Some countries, Finland among them, are known for giving young pupils little homework and still score well internationally.',
        'https://en.wikipedia.org/wiki/Education_in_Finland', 'nordic_notes'),
      P('against', 'opinion', 'A little homework is how parents get to see what their child is learning. Abolishing it cuts families out of school.', '', 'pta_pat'),
      P('against', 'fact', 'Reviews of the research find the benefit of homework is much clearer for older students than for young children. That argues for less homework, not none.',
        'https://en.wikipedia.org/wiki/Homework', 'data_dad',
        [['for', 'recess_now', '"Less" for young kids is pretty close to "none". The motion is about primary school.']]),
    ]),
    D(6, 'Tech', 'Social media apps should be banned for under-16s.',
      'Some governments are moving to set a minimum age for social media. Is that protection or overreach?', [
      P('for', 'fact', 'Australia passed a law in 2024 setting a minimum age of 16 for many social media platforms.',
        'https://www.esafety.gov.au/', 'policy_wonk'),
      P('for', 'opinion', 'We already set ages for driving, drinking and gambling. Apps built to be addictive belong on that list.', '', 'screen_time'),
      P('against', 'opinion', 'A ban just teaches teens to lie about their age, and pushes them to corners of the internet with even less moderation.', '', 'vpn_kid'),
      P('against', 'opinion', 'Enforcing it means age checks for everyone, which means handing ID to tech companies. That is a privacy cost for adults too.', '', 'priv_acy'),
    ]),
  ];
}
