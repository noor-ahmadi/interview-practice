import type { Question } from "./content.ts";
import {
  actors,
  application,
  cache,
  evolve,
  photos,
  queue,
  worker,
  sources as s,
} from "./scenario-authoring.ts";

const links = evolve(application, {
  customer: { name: "Visitors", purpose: "Open a short link" },
  restaurant: { name: "Link owners", purpose: "Create and manage links" },
  api: { purpose: "Create + redirect API" },
  database: { purpose: "Unique aliases + targets" },
});
const collisions = evolve(links, {
  database: { purpose: "Atomic alias insertion" },
});
const custom = evolve(collisions, {
  database: { purpose: "Alias owner + target" },
  api: { purpose: "Validate alias namespace" },
});
const enumeration = evolve(collisions, {
  api: { purpose: "Random opaque aliases" },
});
const hot = evolve(
  links,
  {},
  [cache],
  [
    ...links.connections,
    { from: "api", to: "cache", label: "Bounded cached lookups" },
  ],
);
const expiry = evolve(hot, {
  database: { purpose: "Targets + expiry deadlines" },
  cache: { purpose: "Target + expires_at" },
});
const clocks = evolve(expiry, {
  api: { purpose: "Check database deadline" },
  cache: { purpose: "Hint; verify deadline" },
});
const deleted = evolve(expiry, {
  database: { purpose: "Authoritative revocations" },
  cache: { purpose: "Hint; verify link status" },
});
const misses = evolve(hot, {
  api: { purpose: "Bounded lookup admission" },
  cache: { purpose: "Short-lived miss results" },
});
const campaigns = evolve(links, {
  restaurant: { name: "Marketing teams", purpose: "Manage owned campaigns" },
  database: { purpose: "Links + click records" },
});
const asynchronous = evolve(
  campaigns,
  { database: { purpose: "Links + event rollups" } },
  [queue, worker],
  [
    ...campaigns.connections,
    {
      from: "api",
      to: "queue",
      label: "Publish click event",
      via: [
        { x: 406, y: 240 },
        { x: 958, y: 240 },
      ],
    },
    { from: "queue", to: "worker", label: "At-least-once work" },
    {
      from: "worker",
      to: "database",
      label: "Commit rollup",
      via: [
        { x: 1180, y: 528 },
        { x: 1180, y: 48 },
        { x: 682, y: 48 },
      ],
      labelAt: { x: 930, y: 36 },
    },
  ],
);
const uniqueEvents = evolve(asynchronous, {
  database: { purpose: "Event IDs + rollups" },
});
const replay = evolve(uniqueEvents, {
  database: { purpose: "Replay-bounded dedup IDs" },
});
const definitions = evolve(uniqueEvents, {
  database: { purpose: "Defined request metrics" },
});
const backlog = evolve(asynchronous, {
  worker: { purpose: "Bounded batch workers" },
});
const tenants = evolve(campaigns, {
  api: { purpose: "Tenant-authorized API" },
  database: { purpose: "Tenant-scoped campaigns" },
});
const exportsFrame = evolve(
  tenants,
  { database: { purpose: "Campaigns + export jobs" } },
  [{ ...photos, purpose: "Private tenant exports" }],
  [
    ...tenants.connections,
    { from: "api", to: "photos", label: "Scoped export objects" },
  ],
);
const adminCache = evolve(
  tenants,
  {},
  [{ ...cache, purpose: "Tenant-keyed summaries" }],
  [
    ...tenants.connections,
    { from: "api", to: "cache", label: "Authorized cached views" },
  ],
);

export const shortenerVariants = [
  {
    id: "shortener-public",
    family: "shortener",
    root: "short-small-start",
    name: "Public short links",
    description:
      "A hypothetical URL shortener. Start small, then reason about identifiers, popular links, and changing validity rules.",
  },
  {
    id: "shortener-campaigns",
    family: "shortener",
    root: "short-campaign-start",
    name: "Campaign links",
    description:
      "A hypothetical campaign-link service. Explore redirect analytics and private tools for multiple marketing teams.",
  },
] as const;

export const shortenerQuestions: Record<string, Question> = {
  "short-small-start": {
    id: "short-small-start",
    title: "A small service makes shorter links.",
    difficulty: "Foundation",
    prompt:
      "Design a public URL shortener handling around 100 new links and 10,000 redirects a day. Owners create a link; visitors open its alias. What would you deploy first, and what must be durable?",
    givens: [
      "Only HTTP and HTTPS destinations are accepted",
      "Owners may change a target later",
      "A public alias is not a private-document access control",
    ],
    rubric: [
      "Persist a uniquely indexed alias-to-target mapping and its owner.",
      "Generate identifiers safely and validate allowed destination schemes.",
      "Use redirect and caching semantics compatible with mutable targets.",
    ],
    explanation:
      "Use an EC2 API and RDS PostgreSQL with a unique alias index. Generate opaque random candidates with a cryptographic generator, insert atomically, and retry bounded collisions. Validate destinations as HTTP or HTTPS URLs without fetching them from the server, and authorize owner edits. A 302 redirect with Cache-Control: no-store keeps the baseline free of cached permanent redirects while targets may change. Commit a creation before returning its short URL. Measure peak traffic and latency; a daily total alone is not a peak-capacity estimate.",
    alternatives:
      "Managed compute and a key-value store with conditional insertion can provide the same lookup boundary. Immutable links can choose different redirect/cache policies deliberately.",
    pitfall:
      "Using an in-memory alias map as the only record, or permanently caching a redirect whose target must remain changeable.",
    sources: [s.constraints, s.http, s.httpCache, s.random],
    questionFrame: actors(links),
    answerFrame: links,
    children: ["short-collisions", "short-hot-link"],
    focus: {
      question: ["customer", "restaurant"],
      answer: ["customer", "restaurant", "api", "database"],
      label: "Short-link lookup",
    },
  },
  "short-collisions": {
    id: "short-collisions",
    title: "Two creations choose the same alias.",
    difficulty: "Foundation",
    prompt:
      "Continue from the shortener design. Two API processes generate the same candidate alias at nearly the same time. How do you keep one link from overwriting the other, and how do you reason about collision risk?",
    givens: [
      "The database has a unique alias constraint",
      "Candidate generation can collide even when randomness is good",
      "A creation response is sent only after a successful insert",
    ],
    rubric: [
      "Let atomic uniqueness decide the winner.",
      "Generate another candidate after a collision without overwriting an existing target.",
      "Relate namespace size and created-link count rather than promising zero collisions.",
    ],
    explanation:
      "Attempt the insert under the unique constraint. On a duplicate-key outcome, generate a fresh random candidate and retry with a bound; other failures need their own handling. A prior SELECT does not reserve the name. With a roughly uniform namespace of size N and n generated links, collision risk grows on the birthday scale, approximately n(n-1)/(2N) while the probability is small. Choose length and entropy for projected volume and abuse requirements, monitor retries, and never turn a collision into an update of another owner's link.",
    alternatives:
      "A unique numeric sequence encoded in base62 avoids random collisions but is predictable. A distributed ID generator adds coordination and failure concerns that this workload does not yet require.",
    pitfall:
      "Checking that an alias is unused and then writing without a constraint, or claiming a random identifier can never collide.",
    sources: [s.constraints, s.random],
    questionFrame: links,
    answerFrame: collisions,
    children: ["short-custom-alias", "short-enumeration"],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database"],
      label: "Alias uniqueness",
    },
  },
  "short-custom-alias": {
    id: "short-custom-alias",
    title: "Two owners request the same custom name.",
    difficulty: "Intermediate",
    prompt:
      "Continue from atomic alias creation. Owners can now request custom names in the same case-sensitive namespace as generated aliases. How would you handle competing claims, reserved routes, and unauthorized changes?",
    givens: [
      "Custom names use an explicitly allowed ASCII format",
      "Names such as api and new are reserved routes",
      "Knowing an alias does not grant edit permission",
    ],
    rubric: [
      "Validate one consistent namespace and reserved-name policy.",
      "Atomically claim the alias under the same uniqueness constraint.",
      "Bind ownership and authorize later changes independently of alias knowledge.",
    ],
    explanation:
      "Validate the exact case-sensitive alias, its length and allowed characters, and reject reserved application routes. Attempt one atomic insert containing alias, authenticated owner, and target under the existing unique constraint. Report a conflict to the losing claimant; an availability preview is advisory. Generated candidates must obey the same reserved-route rules. Future edits check ownership and any expected revision instead of upserting by public alias alone. If names can be released, define reuse and stale-link behavior deliberately.",
    alternatives:
      "Separate custom and generated namespaces can simplify policy at the cost of different URL shapes. A reservation workflow needs expiry and atomic finalization if claims outlive one request.",
    pitfall:
      "Using a different case-normalization rule in the router and database, or allowing an upsert to transfer an existing name to the latest caller.",
    sources: [s.constraints, s.auth],
    questionFrame: collisions,
    answerFrame: custom,
    children: [],
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database"],
      label: "Custom alias ownership",
    },
  },
  "short-enumeration": {
    id: "short-enumeration",
    title: "Someone guesses neighboring short links.",
    difficulty: "Intermediate",
    prompt:
      "Continue from alias generation. A team suggests sequential aliases and assumes their document links will remain private because nobody has shared the short URLs yet. What security boundary is missing?",
    givens: [
      "The redirect endpoint is public",
      "Sequential values are enumerable",
      "Some destination documents contain private information",
    ],
    rubric: [
      "Distinguish identifier unpredictability from authorization.",
      "Require the destination or redirect service to enforce intended access.",
      "Explain the role and limits of random aliases, rate limits, and leakage controls.",
    ],
    explanation:
      "A public short link is a locator, not a membership check. Sequential values are easy to enumerate, and even high-entropy random aliases can leak through sharing, logs, or referrers. Use cryptographically random aliases to reduce guessing when appropriate, and rate-limit abuse, but keep private-document authorization at the destination or require authenticated authorization before redirecting. Avoid logging sensitive tokens unnecessarily. If the product deliberately uses bearer secret links, state that contract and entropy/expiry limits rather than presenting them as account-based privacy.",
    alternatives:
      "Authenticated share records can grant access to named recipients. Public marketing links can remain enumerable if their destination data is intentionally public.",
    pitfall:
      "Treating base62 encoding or a long random string as proof that the current visitor has permission to see the document.",
    sources: [s.auth, s.random],
    questionFrame: collisions,
    answerFrame: enumeration,
    children: [],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["customer", "api", "database"],
      label: "Identifier secrecy",
    },
  },
  "short-hot-link": {
    id: "short-hot-link",
    title: "One short link becomes very popular.",
    difficulty: "Foundation",
    prompt:
      "Continue from the initial shortener. One link now receives most of 2,000 redirects per second, and database lookup time dominates. How would you reduce that load while keeping a clear target-update policy?",
    givens: [
      "A changed destination may remain stale for at most 30 seconds",
      "The durable mapping still belongs in PostgreSQL",
      "Browser redirect responses still use no-store",
    ],
    rubric: [
      "Cache disposable alias mappings and protect the miss path.",
      "Bound freshness using source-read age and update behavior.",
      "Keep server-side mapping caching distinct from browser redirect caching.",
    ],
    explanation:
      "Put hot mapping records in ElastiCache. On a miss, read the indexed PostgreSQL mapping and cache it only until its source-read freshness deadline; discard delayed fills and invalidate after committed target changes. Use bounded source-query lifetimes or version checks so an old snapshot cannot gain a fresh 30-second lifetime. Coalesce concurrent misses and cap database fallback. Continue emitting the chosen no-store redirect response. The server can cache a mapping while independently preventing a browser from retaining an obsolete redirect.",
    alternatives:
      "A small local cache can help one process, with separate eviction and freshness on each instance. An edge redirect cache needs an explicit invalidation and validity model.",
    pitfall:
      "Resetting a full TTL when a very old read finally fills the cache, or assuming a server-cache purge clears a permanent browser redirect.",
    sources: [s.cache, s.httpCache],
    questionFrame: links,
    answerFrame: hot,
    children: ["short-expiry", "short-miss-storm"],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database", "cache"],
      label: "Popular-link reads",
    },
  },
  "short-expiry": {
    id: "short-expiry",
    title: "A cached link has an expiration time.",
    difficulty: "Intermediate",
    prompt:
      "Continue from cached mappings. Owners can now issue links with an absolute expiry deadline. How would you prevent a cached mapping from remaining usable merely because its cache entry has not been evicted?",
    givens: [
      "The authoritative record contains expires_at",
      "API clocks are assumed synchronized within a stated tolerance for this step",
      "Cache expiry and background cleanup may run late",
    ],
    rubric: [
      "Carry the absolute business deadline with the cached value.",
      "Check validity on each redirect and bound cache lifetime by the deadline.",
      "Separate record cleanup from the decision to accept a redirect.",
    ],
    explanation:
      "Store expires_at durably and include it in the cached mapping. Before redirecting, check that deadline using the defined server-time policy, and reject an expired link even if the cache still contains it. Limit cache lifetime to the earlier of the mapping freshness budget and business expiry. Cleanup can remove expired records later; it does not make them valid until cleanup runs. Define behavior exactly at the boundary and account for the stated clock tolerance. Previously issued redirects and already loaded destination pages cannot be recalled.",
    alternatives:
      "An authoritative database-time check on each request gives a different performance/clock boundary. Coarse expiry buckets can simplify cleanup without replacing request-time validation.",
    pitfall:
      "Treating cache eviction or a periodic delete job as the only enforcement of an expiration requirement.",
    sources: [s.cache, s.time],
    questionFrame: hot,
    answerFrame: expiry,
    children: ["short-clock-skew", "short-cache-delete"],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Link expiration",
    },
  },
  "short-clock-skew": {
    id: "short-clock-skew",
    title: "API servers disagree about the time.",
    difficulty: "Intermediate",
    prompt:
      "Continue from expiring cached links. An API clock is 20 seconds slow. The new requirement defines validity by the database clock at the redirect decision, with no 20-second grace. What must change?",
    givens: [
      "A local API timestamp cannot establish the database's current time exactly",
      "Database availability is required for this stricter decision",
      "Already authorized responses may still be in flight",
    ],
    rubric: [
      "Move the authoritative validity decision to the defined clock boundary.",
      "Avoid using transaction-start time after a long wait as current time.",
      "Explain the latency, availability, and in-flight-response tradeoffs.",
    ],
    explanation:
      "Check expires_at against current database time in an authoritative lookup or guarded database operation immediately at the defined decision point. PostgreSQL transaction-start timestamps can be stale after waits; select the time function and transaction boundaries deliberately. A cached target may be a hint, but it cannot independently prove current validity under this contract. This increases database work and couples availability to that check. Clock synchronization remains good operations, while an absolute guarantee about when a remote browser receives a response is a different and stronger promise.",
    alternatives:
      "Relax the contract to an explicit clock-skew allowance or a bounded validity lease if performance and availability matter more than that exact decision boundary.",
    pitfall:
      "Increasing a cache TTL or subtracting an arbitrary constant and calling the clocks perfectly synchronized.",
    sources: [s.time, s.isolation],
    questionFrame: expiry,
    answerFrame: clocks,
    children: [],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Authoritative expiry checks",
    },
  },
  "short-cache-delete": {
    id: "short-cache-delete",
    title: "A takedown must beat the cache.",
    difficulty: "Intermediate",
    prompt:
      "Continue from expiring cached links. A malicious destination is revoked. The product now requires every new redirect decision after committed revocation to reject that alias. How does that change the earlier 30-second cache policy?",
    givens: [
      "Old positive cache values may still exist on several instances",
      "The redirect response has not been permanently cached by the baseline",
      "Already delivered redirects cannot be undone",
    ],
    rubric: [
      "Recognize that ordinary asynchronous invalidation cannot meet the stronger contract alone.",
      "Use authoritative validity checks or a coordinated lease/revocation boundary.",
      "Define the decision point and account for cached negative and positive values.",
    ],
    explanation:
      "The new requirement is stronger than a 30-second stale mapping allowance. Put revocation state in the authoritative lookup used for every new decision, or use a coordinated lease protocol whose revocation waits for outstanding grants to end. Invalidate caches to reduce stale work, but do not treat best-effort broadcasts as the correctness boundary. A database-authorized decision can finish its response after a concurrent revocation; define the decision's ordering explicitly. Keep no-store redirects and explain that neither a cache purge nor revocation recalls a destination already delivered to a visitor.",
    alternatives:
      "A stated bounded takedown delay permits short leases or cached revocation lists and can reduce database reads.",
    pitfall:
      "Deleting one cache entry and claiming every replica, browser, and in-flight response has immediately forgotten the link.",
    sources: [s.cache, s.httpCache, s.isolation],
    questionFrame: expiry,
    answerFrame: deleted,
    children: [],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Revoked-link decisions",
    },
  },
  "short-miss-storm": {
    id: "short-miss-storm",
    title: "Most requested aliases do not exist.",
    difficulty: "Intermediate",
    prompt:
      "Continue from cached mappings. Bots request thousands of different nonexistent aliases each second. The positive cache no longer protects PostgreSQL. How would you keep legitimate creation and redirect work available?",
    givens: [
      "The safe database lookup budget is measured",
      "Random misses cannot all be coalesced under one key",
      "An alias that was missing may be created later",
    ],
    rubric: [
      "Bound server-side admission and fallback concurrency.",
      "Use short-lived negative caching with a creation invalidation policy.",
      "Distinguish cache protection from abuse control and preserve critical writes.",
    ],
    explanation:
      "Apply global and caller-aware admission limits, bound concurrent database misses, and reserve capacity for legitimate creates. Cache not-found results briefly when useful, invalidating or versioning them on creation so a newly valid alias is not hidden for an unexplained period. Per-key request coalescing helps repeated misses but not an unbounded stream of unique names. Monitor rejected work, miss cardinality, and database saturation; bound cache memory too. A probabilistic existence filter can reduce some work only with a correct update/rebuild protocol and a fallback for uncertainty.",
    alternatives:
      "Separate resource budgets for creation and redirect reads can isolate overload. Edge abuse controls can reject traffic before it consumes application capacity.",
    pitfall:
      "Caching only successful lookups, or allocating an unlimited negative-cache entry for every attacker-generated name.",
    sources: [s.overload, s.cache],
    questionFrame: hot,
    answerFrame: misses,
    children: [],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Missing-alias overload",
    },
  },
  "short-campaign-start": {
    id: "short-campaign-start",
    title: "Two teams track campaign links.",
    difficulty: "Foundation",
    prompt:
      "Design campaign links for two marketing teams and about 50 active campaigns. The measured peak is 500 redirects per second. Teams need private management and approximate click reports. What would your initial data model and request flow contain?",
    givens: [
      "Public redirects and private management have different access rules",
      "Reports may lag and may undercount failures",
      "Campaign and link ownership must be durable",
    ],
    rubric: [
      "Persist tenant-owned campaigns and unique public link mappings.",
      "Authorize private operations while keeping intended public redirects available.",
      "Define what a click record means and measure the initial write/read workload.",
    ],
    explanation:
      "An EC2 API and RDS PostgreSQL can store teams, memberships, campaigns, unique aliases, and small click records. Treat a click record as a server-observed redirect request, not proof a human reached the destination. Authorize management by tenant ownership; public redirect access follows each link's public policy. At measured load, a bounded best-effort click insert may be a simple start if the accepted report-loss policy is explicit. Do not let an analytics failure turn a valid redirect into an error. Measure latency, write load, and report queries before expanding the design.",
    alternatives:
      "A managed event collector can handle analytics from the start. If every event must be durable, define acceptance and failure behavior before choosing the pipeline.",
    pitfall:
      "Treating a public alias as permission to edit its campaign, or labeling raw redirect requests as unique people.",
    sources: [s.auth, s.transactions, s.http],
    questionFrame: actors(campaigns),
    answerFrame: campaigns,
    children: ["short-async-events", "short-tenant-scope"],
    focus: {
      question: ["customer", "restaurant"],
      answer: ["customer", "restaurant", "api", "database"],
      label: "Campaign links",
    },
  },
  "short-async-events": {
    id: "short-async-events",
    title: "Click logging is delaying redirects.",
    difficulty: "Intermediate",
    prompt:
      "Continue from campaign links. Synchronous click inserts now dominate redirect latency. How would you move analytics processing out of the request while making its delivery and loss policy explicit?",
    givens: [
      "A valid redirect must remain available when analytics is unavailable",
      "Reports may undercount failed event publication",
      "A successfully queued event should survive a worker restart",
    ],
    rubric: [
      "Queue bounded click events and process them independently.",
      "State the publish-failure policy without claiming atomicity with an HTTP redirect.",
      "Handle queue redelivery, capacity, and processing failures.",
    ],
    explanation:
      "Assign a server-generated event ID and send a small click event to SQS with a bounded enqueue budget. EC2 workers consume events and update PostgreSQL analytics independently. Monitor publication failures and account for accepted undercount when the redirect proceeds after a timeout or crash; an HTTP response and queue write are not one transaction. Once SQS accepts an event, workers must tolerate redelivery and delete only after successful processing. Restrict producer permissions and validate event shape. Queue durability does not make the metric equal to successful browser visits.",
    alternatives:
      "A transactional outbox can make a database-recorded event reliably publishable, at the cost of retaining a durable request-path write. A durable local collector has its own crash and drain guarantees.",
    pitfall:
      "Launching an untracked background promise and assuming the process will live long enough to publish every event.",
    sources: [s.queue, s.outbox],
    questionFrame: campaigns,
    answerFrame: asynchronous,
    children: ["short-duplicate-clicks", "short-queue-backlog"],
    focus: {
      question: ["api", "database"],
      answer: ["api", "queue", "worker", "database"],
      label: "Asynchronous click events",
    },
  },
  "short-duplicate-clicks": {
    id: "short-duplicate-clicks",
    title: "A retry adds the same click twice.",
    difficulty: "Intermediate",
    prompt:
      "Continue from queued click events. A worker commits a counter increment, then crashes before deleting its queue message. How would you make redelivery safe without losing a legitimate later click?",
    givens: [
      "Each observed redirect request has a stable server-generated event ID",
      "Different requests can target the same alias",
      "Deduplication and the counter share PostgreSQL",
    ],
    rubric: [
      "Deduplicate by event identity rather than alias alone.",
      "Commit a uniqueness claim and the aggregate change atomically.",
      "Delete the queue message only after the durable processing outcome is known.",
    ],
    explanation:
      "In one PostgreSQL transaction, insert the event ID into a unique processed-event ledger and increment the appropriate aggregate only if that insert succeeds. Commit both together, then delete the SQS message. Redelivery sees the existing event ID and makes no second increment. A different genuine request gets a different event ID and still counts. Retain deduplication records for the supported replay horizon. This provides one database aggregate effect per accepted event within that contract, not proof of one event per human or one transport delivery.",
    alternatives:
      "Store immutable raw events under unique IDs and derive aggregates from them. An idempotent upsert of raw events can simplify rebuilding reports.",
    pitfall:
      "Deduplicating only by short alias, or committing the processed flag separately from the counter increment.",
    sources: [s.constraints, s.transactions, s.queue],
    questionFrame: asynchronous,
    answerFrame: uniqueEvents,
    children: ["short-replay-window", "short-count-definition"],
    focus: {
      question: ["queue", "worker", "database"],
      answer: ["queue", "worker", "database"],
      label: "Idempotent click processing",
    },
  },
  "short-replay-window": {
    id: "short-replay-window",
    title: "An old export is replayed after deduplication expires.",
    difficulty: "Intermediate",
    prompt:
      "Continue from idempotent click processing. The team deletes processed-event IDs after seven days, then replays a month-old export into the same aggregates. What is wrong with the guarantee, and how would you change the recovery contract?",
    givens: [
      "Existing aggregates already include the old events",
      "A replay keeps the original event IDs",
      "Normal queue retention is not the only replay source",
    ],
    rubric: [
      "Relate deduplication retention to every permitted replay source.",
      "Either retain identities long enough or reject out-of-horizon incremental replay.",
      "Separate rebuilding aggregates from adding events to existing aggregates.",
    ],
    explanation:
      "The old ledger no longer remembers those event IDs, so adding them to the same counters increments them again. Define a supported replay horizon and retain identities for at least that window, accounting for archives and manual recovery as well as queue retention. Reject older incremental replays or rebuild a new version of the aggregate from a complete immutable source and atomically switch readers. Use trusted original event identity/time rather than replacing IDs during replay. A seven-day table cannot support an unlimited replay-deduplication promise.",
    alternatives:
      "Keep a durable unique raw-event store and recompute rollups. A bounded acceptance window can be sufficient when older event replay is intentionally unsupported.",
    pitfall:
      "Treating a queue's retention period as a proof that nobody can ever reintroduce older events.",
    sources: [s.constraints, s.transactions],
    questionFrame: uniqueEvents,
    answerFrame: replay,
    children: [],
    focus: {
      question: ["worker", "database"],
      answer: ["worker", "database"],
      label: "Replay retention contract",
    },
  },
  "short-count-definition": {
    id: "short-count-definition",
    title: "The report calls requests unique people.",
    difficulty: "Foundation",
    prompt:
      "Continue from deduplicated click events. A dashboard labels the event count as unique visitors. Bots, link previews, and browser retries all generate requests. What does the current pipeline actually measure, and what would a different metric require?",
    givens: [
      "Event deduplication removes repeated processing of the same event",
      "One person can make several real requests",
      "Many people can share a network address",
    ],
    rubric: [
      "Distinguish processing deduplication from visitor identity.",
      "Name the measured event and state known sources of bias.",
      "Define an identity/window/privacy policy before estimating unique visitors.",
    ],
    explanation:
      "The current aggregate counts accepted server-observed redirect events under the stated event-loss policy. It does not know whether a request was a bot, a preview, or a person who loaded the destination. Rename the metric accordingly. A unique-account count requires authenticated account identities and a time window; anonymous unique-visitor estimates need a deliberately chosen identity and privacy policy with stated uncertainty. IP addresses alone merge unrelated people and split mobile users. Pipeline deduplication improves processing correctness but cannot supply missing identity information.",
    alternatives:
      "Show raw request counts with an explicit bot-filtered estimate alongside them. Measure confirmed destination events separately when the destination can provide them lawfully and reliably.",
    pitfall:
      "Claiming that exactly one counter increment per event means exactly one visit per human.",
    sources: [s.http, s.queue],
    questionFrame: uniqueEvents,
    answerFrame: definitions,
    children: [],
    focus: {
      question: ["worker", "database"],
      answer: ["worker", "database"],
      label: "Analytics meaning",
    },
  },
  "short-queue-backlog": {
    id: "short-queue-backlog",
    title: "Analytics falls further behind each minute.",
    difficulty: "Intermediate",
    prompt:
      "Continue from queued click events. Incoming events reach 10,000 per second while workers sustain only 1,000. How would you recover useful reports without overwhelming the analytics database or hiding lost data?",
    givens: [
      "Queue retention is finite",
      "A database has a measured safe write budget",
      "Redirect availability has priority over exact reports",
    ],
    rubric: [
      "Recognize arrival rate exceeds processing capacity.",
      "Use bounded batching and measured scaling rather than queue depth alone.",
      "Monitor oldest-event age, retention risk, and explicit degradation policies.",
    ],
    explanation:
      "A queue absorbs bursts but cannot make a permanent 9,000-event-per-second deficit disappear. Batch work, optimize rollup writes, and add consumers only within the database's safe budget. Track oldest-event age and drain capacity, not just queue length. Reserve redirect-path capacity and define sampling or dropping explicitly if exact capture is outside the accepted contract. Route poisoned work for inspection and account for it in reports. If retention will expire before recovery, communicate the data gap or archive events through a separate bounded recovery path.",
    alternatives:
      "An analytics-oriented store or time-bucketed batch aggregation can support higher sustained volume. A separate ingest tier may isolate redirect latency.",
    pitfall:
      "Adding unlimited workers until the database fails, or assuming a durable queue has infinite space and retention.",
    sources: [s.queue, s.overload],
    questionFrame: asynchronous,
    answerFrame: backlog,
    children: [],
    focus: {
      question: ["queue", "worker", "database"],
      answer: ["queue", "worker", "database"],
      label: "Analytics backlog",
    },
  },
  "short-tenant-scope": {
    id: "short-tenant-scope",
    title: "A team guesses another campaign ID.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the initial campaign API. A member changes the campaign ID in a management request to one owned by another team. How would you make every private campaign operation enforce tenant ownership?",
    givens: [
      "Public redirects must remain intentionally public",
      "Campaign management and reports are private",
      "A member may belong to several teams",
    ],
    rubric: [
      "Derive caller identity and validate membership in the requested tenant.",
      "Scope reads and writes by tenant ownership, not resource ID alone.",
      "Apply the same boundary to reports, background work, and administrative endpoints.",
    ],
    explanation:
      "Authenticate the caller and verify membership in the requested team. Scope the campaign query by both tenant_id and campaign_id, and enforce allowed roles for editing and reports. Never trust a browser-supplied tenant ID without that membership check. Carry tenant identity into jobs and report queries, and keep public redirect lookup as a separate intentionally public operation. Database ownership policies can provide another enforcement boundary when configured correctly; a hard-to-guess campaign ID is not a substitute for authorization.",
    alternatives:
      "Separate databases can provide stronger tenant isolation with more operational cost. Shared tables with consistent tenant constraints are sufficient for this stated workload.",
    pitfall:
      "Checking that a user is signed in and then querying any campaign solely by its ID.",
    sources: [s.auth, s.constraints],
    questionFrame: campaigns,
    answerFrame: tenants,
    children: ["short-analytics-export", "short-shared-cache"],
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database"],
      label: "Tenant ownership",
    },
  },
  "short-analytics-export": {
    id: "short-analytics-export",
    title: "A private report becomes a downloadable file.",
    difficulty: "Intermediate",
    prompt:
      "Continue from tenant-scoped management. Teams can request large campaign-report exports. How would you generate and deliver files without letting a job ID or object key expose another team's report?",
    givens: [
      "Report generation can outlive one HTTP request",
      "S3 is private",
      "Current membership must be checked before issuing a download capability",
    ],
    rubric: [
      "Persist tenant-owned export jobs and authorize both creation and retrieval.",
      "Generate from tenant-scoped data into private objects with stable ownership metadata.",
      "Issue bounded download access and define cleanup and revocation limits.",
    ],
    explanation:
      "Create a durable export job containing tenant, campaign scope, requester, and status after authorization. A bounded background job reads only that scope and writes a private S3 object under an application-controlled key, then records its identity and expiry. Polling a job or requesting a download rechecks current tenant membership and ownership; knowing the job ID is insufficient. A short-lived presigned URL is a reusable capability until effective expiry, so choose that delay deliberately or proxy reads for per-request authorization. Clean up expired exports without deleting active referenced files.",
    alternatives:
      "Stream a small report synchronously when it fits time and memory limits. A dedicated worker can replace a scheduled database-backed job runner as load grows.",
    pitfall:
      "Making an exports prefix public or trusting a worker's unvalidated tenant/campaign parameters.",
    sources: [s.auth, s.uploads, s.s3],
    questionFrame: tenants,
    answerFrame: exportsFrame,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database", "photos"],
      label: "Private report exports",
    },
  },
  "short-shared-cache": {
    id: "short-shared-cache",
    title: "Two teams share an analytics cache.",
    difficulty: "Intermediate",
    prompt:
      "Continue from tenant-scoped management. A cache keyed only by campaign name returns another team's similarly named campaign report. How would you cache private summaries without weakening tenant isolation?",
    givens: [
      "Different tenants may reuse campaign names",
      "Authorized team admins see the same summary within a team",
      "A cached result must not grant membership",
    ],
    rubric: [
      "Include tenant and stable resource identity in the cache key.",
      "Authorize the current caller before serving a cached private view.",
      "Keep query scope, invalidation, and cache policy aligned with the authorization model.",
    ],
    explanation:
      "Key the summary by tenant ID, stable campaign ID, and summary/query version, not display name. Verify the caller's current team membership and required role before returning the view, whether it comes from ElastiCache or PostgreSQL. The source query must carry the same tenant scope. Define freshness and invalidation independently of access checks. If future viewers have different row visibility, include that visibility boundary in the key or cache only a safely shared underlying representation. Never let a cache hit bypass the membership decision.",
    alternatives:
      "Separate cache namespaces or instances can reduce accidental mixing, but authorization and correct source queries are still required.",
    pitfall:
      "Adding a tenant to the URL while leaving the cache key or database query globally scoped.",
    sources: [s.auth, s.cache],
    questionFrame: tenants,
    answerFrame: adminCache,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database", "cache"],
      label: "Tenant-safe cached views",
    },
  },
};
