import type { Component, DiagramFrame } from "./content.ts";
import {
  actors,
  application,
  branchQuestions,
  cache,
  evolve,
  queue,
  sources,
  worker,
} from "./scenario-authoring.ts";

export const feedVariants = [
  {
    id: "feed-following",
    family: "feed",
    root: "feed-following-start",
    name: "Following feed",
    description:
      "Design a chronological feed, then adapt it as reads or publishing traffic grow.",
  },
  {
    id: "feed-community",
    family: "feed",
    root: "feed-community-start",
    name: "Ranked community feed",
    description:
      "Design a ranked community feed with stable pagination and changing visibility rules.",
  },
] as const;

const replicaSource = {
  label: "Amazon RDS read replicas",
  url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html",
};
const shardingSource = {
  label: "DynamoDB write sharding",
  url: "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html",
};
const following = evolve(
  application,
  {
    customer: { name: "Readers", purpose: "Read followed authors" },
    restaurant: { name: "Authors", purpose: "Publish posts" },
    api: { purpose: "Build and publish feed" },
    database: { purpose: "Posts and follow edges" },
  },
  [],
  [
    { from: "customer", to: "api", label: "Read feed" },
    { from: "restaurant", to: "api", label: "Publish post" },
    { from: "api", to: "database", label: "Ordered query" },
  ],
);
const pageCache = evolve(
  following,
  {},
  [{ ...cache, purpose: "Recent feed IDs" }],
  [
    ...following.connections,
    { from: "api", to: "cache", label: "Read page cache" },
  ],
);
const fanout = evolve(
  following,
  {
    api: { purpose: "API and outbox relay" },
    database: { purpose: "Posts and timeline IDs" },
  },
  [
    { ...queue, x: 300, purpose: "Fan-out batches" },
    { ...worker, x: 576, y: 292, purpose: "Populate timelines" },
  ],
  [
    ...following.connections,
    { from: "api", to: "queue", label: "Relay outbox" },
    { from: "queue", to: "worker", label: "Claim batch" },
    { from: "worker", to: "database", label: "Insert IDs" },
  ],
);
const replay = evolve(fanout, {
  worker: { purpose: "Deduplicate inserts" },
  database: { purpose: "Unique timeline entries" },
});

const ranked = evolve(following, {
  customer: { name: "Members", purpose: "Browse community posts" },
  restaurant: { name: "Publishers", purpose: "Submit posts" },
  api: { purpose: "Rank and serve posts" },
  database: { purpose: "Posts, scores, members" },
});
const snapshot = evolve(
  ranked,
  {
    api: { purpose: "Serve pinned rankings" },
    database: { purpose: "Rankings by version" },
  },
  [{ ...cache, purpose: "Cached ranking IDs" }],
  [
    ...ranked.connections,
    { from: "api", to: "cache", label: "Fetch snapshot" },
  ],
);
const groups = evolve(ranked, {
  api: { purpose: "Filter by current access" },
  database: { purpose: "Posts and memberships" },
});
const replica: Component = {
  id: "feed-replica",
  name: "Amazon RDS",
  purpose: "Regional read replica",
  kind: "database",
  service: "rds",
  x: 576,
  y: 292,
};
const regional: DiagramFrame = evolve(
  groups,
  {
    api: { purpose: "Regional read routing" },
  },
  [replica],
  [
    ...groups.connections,
    { from: "api", to: replica.id, label: "Read public posts" },
    { from: "database", to: replica.id, label: "Async replication" },
  ],
);

export const feedQuestions = {
  ...branchQuestions(actors(following), {
    "feed-following-start": {
      title: "Design a following feed",
      prompt:
        "A small photography community wants a reverse-chronological feed of posts from people each member follows. What do you store and how do you serve the first and second pages?",
      givens: [
        "5,000 daily readers with up to 100 follows each",
        "Text and image references fit in a post row",
        "New posts may appear at the top on refresh",
      ],
      rubric: [
        "Separate follow edges from posts and name the access paths.",
        "Use a stable order with a unique tie-breaker and a scoped cursor.",
        "Explain when pulling on read becomes expensive.",
      ],
      explanation:
        "Use an EC2 API and RDS PostgreSQL. Index follow edges by reader and posts by author, creation time, and post ID. For a small follow set, select matching posts and order by descending (created_at, post_id). The second page takes rows strictly before the last tuple. Derive the reader from the authenticated request and bind the cursor to the selected feed. Measure actual scanned rows and p95 latency before materializing a timeline for every reader.",
      alternatives:
        "Fetch a bounded recent slice per followed author and merge the sorted streams. The bound must allow a prolific author to fill a page.",
      pitfall:
        "Offset pagination can repeat or skip entries as posts arrive. Ordering only by a timestamp also leaves ties ambiguous.",
      difficulty: "Foundation",
      answerFrame: following,
      view: {
        label: "Read and publish",
        ids: ["customer", "restaurant", "api", "database"],
      },
      sources: [sources.indexes, sources.pagination],
    },
    "feed-reader-burst": {
      parent: "feed-following-start",
      title: "Handle a read spike",
      prompt:
        "Readers refresh several times after each push notification. The original indexed feed query now saturates the database. What can you reuse across requests, and how stale can it be?",
      givens: [
        "The existing feed is assembled on read",
        "Most refreshes ask for page one",
        "Ordinary post freshness can lag by 20 seconds",
      ],
      rubric: [
        "Cache a bounded page of IDs under a viewer-scoped key.",
        "State a freshness boundary and how follow changes are handled.",
        "Explain what happens on misses and how to measure the benefit.",
      ],
      explanation:
        "Keep a short-lived page-one list of post IDs in ElastiCache. Use reader, feed policy, and any follow-set version in the cache key. Hydrate the IDs in order and drop items that fail current access checks. Read the database on a miss with a concurrency limit. Age the cached list from the time it was computed. Measure hit rate, expired-page rebuilds, database reads, and first-page latency.",
      alternatives:
        "Materialize a bounded first page asynchronously for very active readers. That moves cost to writes and can lag under backlog.",
      pitfall:
        "A shared first-page cache can send one reader another reader’s feed. TTL alone also cannot enforce access revocation.",
      difficulty: "Intermediate",
      answerFrame: pageCache,
      view: {
        label: "First-page reads",
        ids: ["customer", "api", "database", "cache"],
      },
      sources: [sources.cache, sources.auth],
    },
    "feed-cache-visibility": {
      parent: "feed-reader-burst",
      title: "Enforce a post’s visibility change",
      prompt:
        "An author changes a post from public to followers-only. Old page IDs still sit in the cache and a reader has an old cursor. Where do you enforce the new rule?",
      givens: [
        "Cached pages store ordered post IDs",
        "The post’s visibility rule changes in PostgreSQL",
        "Requests authorized after the change must honor it",
      ],
      rubric: [
        "Authorize posts against current policy when serving them.",
        "Treat cached IDs and old cursors as candidates.",
        "Define how filtering affects page length and continuation.",
      ],
      explanation:
        "Resolve cached IDs through an authorization-aware fetch using the current visibility and follow relationship. An ID, cached ordering, or valid cursor gives no access by itself. Invalidate or age out the cached page asynchronously to reduce misses during hydration. A page can be shorter after filtering, or the service can advance through a bounded number of candidates. Track the last examined position so a hidden item cannot trap pagination.",
      alternatives:
        "Include an authorization epoch in cache keys when the application can update and check that epoch atomically with policy changes.",
      pitfall:
        "Purging one feed page leaves other pages, earlier cursors, and direct post requests with stale assumptions.",
      difficulty: "Intermediate",
      answerFrame: evolve(pageCache, {
        api: { purpose: "Recheck post visibility" },
        cache: { purpose: "Candidate IDs only" },
      }),
      view: {
        label: "Visibility checks",
        ids: ["customer", "api", "database", "cache"],
      },
      sources: [sources.auth, sources.cache],
    },
    "feed-cache-stampede": {
      parent: "feed-reader-burst",
      title: "Protect the database on cache failure",
      prompt:
        "ElastiCache becomes unreachable while notifications are still driving refreshes. How do you keep the database healthy and distinguish an unavailable feed from an empty one?",
      givens: [
        "The indexed query can serve only part of peak traffic",
        "Post visibility rules still apply",
        "Refresh retries can amplify the spike",
      ],
      rubric: [
        "Bound fallback concurrency and reject excess work.",
        "Use one rebuild per key where useful and cap total work.",
        "Return an explicit temporary failure and measure recovery.",
      ],
      explanation:
        "Open a circuit after sustained cache errors and use an admission limit before touching PostgreSQL. Coalesce concurrent misses for the same reader when possible, while limiting the number of distinct keys in flight. Serve a smaller authorized page under load or return a retryable unavailable response with jittered retry guidance. Keep separate signals for cache errors, fallback saturation, and database latency. Increase fallback gradually after recovery.",
      alternatives:
        "Keep a very short local last-known page per worker if each candidate is still authorized on read and stale results are acceptable.",
      pitfall:
        "An unlimited direct database fallback turns cache loss into a database outage. An empty success response hides the failure.",
      difficulty: "Intermediate",
      answerFrame: evolve(pageCache, {
        api: { purpose: "Bound database fallback" },
        cache: { unavailable: true },
      }),
      view: {
        label: "Degraded read path",
        ids: ["customer", "api", "database", "cache"],
      },
      sources: [sources.overload, sources.retries],
    },
    "feed-author-burst": {
      parent: "feed-following-start",
      title: "Move feed assembly to publish time",
      prompt:
        "Most authors have a few hundred followers, and the read path is repeatedly joining the same posts. How would you build timelines asynchronously without losing posts on a worker crash?",
      givens: [
        "Post publication is authoritative in PostgreSQL",
        "Timeline entries can appear within 30 seconds",
        "SQS workers can be retried",
      ],
      rubric: [
        "Commit the post and an outbox event together.",
        "Materialize bounded per-reader timeline entries idempotently.",
        "Quantify write amplification and monitor queue age.",
      ],
      explanation:
        "Commit the post and a stable outbox event in one PostgreSQL transaction. A relay sends durable batches to SQS. EC2 workers add (reader_id, post_id) records with a uniqueness constraint, then acknowledge only after the batch commits. Paginate the follower scan and define whether membership is evaluated at publish or delivery. With 100 posts per second and 200 eligible followers per post, budget about 20,000 timeline inserts per second before retries.",
      alternatives:
        "Keep pull-on-read for infrequent readers or authors above an explicit fan-out threshold.",
      pitfall:
        "Publishing only to the queue after the database commit leaves a crash window. Deleting a batch before writes are durable loses timeline entries.",
      difficulty: "Intermediate",
      answerFrame: fanout,
      view: {
        label: "Publish and materialize",
        ids: ["api", "database", "queue", "worker"],
      },
      sources: [sources.outbox, sources.queue, sources.constraints],
    },
    "feed-celebrity": {
      parent: "feed-author-burst",
      title: "Handle a celebrity author",
      prompt:
        "One author has eight million followers and publishes several times per minute. Ordinary fan-out is falling behind. What changes for this author, and how do reads combine the results?",
      givens: [
        "Most authors still benefit from precomputed timelines",
        "A celebrity’s posts remain ordered in the source store",
        "Readers can follow both kinds of author",
      ],
      rubric: [
        "Use a hybrid push and pull policy with a measurable threshold.",
        "Merge streams under a common total order and deduplicate IDs.",
        "Describe how crossing the threshold avoids gaps.",
      ],
      explanation:
        "Fan out ordinary posts and read recent posts for high-fan-out authors at request time. Merge materialized and pulled candidates by the same (created_at, post_id) order before applying access rules. A transition can use a recorded cutover position and briefly read both paths, deduplicating by ID. Bound the per-reader heavy-author scan and measure p95 read cost alongside time to materialize ordinary posts.",
      alternatives:
        "Partition fan-out by follower shard and reserve dedicated worker capacity if the product requires precomputed celebrity timelines.",
      pitfall:
        "Switching the source without a cutover position can drop posts in flight or return the same post from both paths.",
      difficulty: "Intermediate",
      answerFrame: evolve(fanout, {
        api: { purpose: "Merge push and pull" },
        worker: { purpose: "Fan out ordinary posts" },
      }),
      view: {
        label: "Hybrid delivery",
        ids: ["customer", "api", "database", "worker"],
      },
      sources: [sources.indexes, shardingSource],
    },
    "feed-worker-replay": {
      parent: "feed-author-burst",
      title: "Retry a half-written batch",
      prompt:
        "A worker commits two of five timeline chunks, then dies before acknowledging the SQS message. Walk through what the next worker does.",
      givens: [
        "The event retains the same post ID across retries",
        "Each chunk commits independently",
        "Duplicate delivery and concurrent workers are possible",
      ],
      rubric: [
        "Use an immutable deduplication identity for each destination entry.",
        "Make writes and any progress markers atomic within a chunk.",
        "Acknowledge only after every required chunk is durable.",
      ],
      explanation:
        "On redelivery, reprocess the chunks using a unique (reader_id, post_id) key and idempotent insertion. If there is a progress table, write its checkpoint in the same transaction as that chunk. Use stable follower boundaries and defined membership semantics so a retry knows what it owes. Bound or extend visibility for long work, accept overlapping execution, and ack only after all chunks are confirmed.",
      alternatives:
        "Make each bounded follower range a separate message with its own stable range ID and retry policy.",
      pitfall:
        "Using a delivery receipt as the deduplication key misses redeliveries. Recording progress before the rows commit can skip work permanently.",
      difficulty: "Intermediate",
      answerFrame: replay,
      view: {
        label: "Retry boundaries",
        ids: ["api", "database", "queue", "worker"],
      },
      sources: [sources.queue, sources.constraints, sources.transactions],
    },
    "feed-stuck-recipient": {
      parent: "feed-worker-replay",
      title: "Isolate a failing chunk",
      prompt:
        "A single invalid follower record makes the same chunk fail on every retry. What should happen to the rest of the feed updates, and how do you recover the failed work?",
      givens: [
        "Completed chunks are idempotent",
        "A corrupt record can need manual repair",
        "Operators must see what was skipped or deferred",
      ],
      rubric: [
        "Separate permanent validation failures from transient errors.",
        "Bound retries and retain stable identity and context in a dead-letter queue.",
        "Describe repair, redrive, and an age or completeness signal.",
      ],
      explanation:
        "Use bounded chunks and classify validation errors. Record the affected follower and original event in a repairable failure record, or fail that chunk into a DLQ after a bounded retry budget. Other chunks can continue independently. Redrive only after fixing the cause, using the same IDs so already-written rows are safe. Alert on oldest pending event age, DLQ growth, and missing materialization ranges.",
      alternatives:
        "Run a reconciliation job that derives expected entries for a bounded interval and repairs missing rows after fixing the bad record.",
      pitfall:
        "Acknowledge-and-forget hides data loss. Retrying the whole publisher indefinitely delays unrelated timelines.",
      difficulty: "Intermediate",
      answerFrame: evolve(replay, {
        queue: { purpose: "Batches and dead letters" },
        worker: { purpose: "Isolate failed chunks" },
      }),
      view: {
        label: "Failure isolation",
        ids: ["api", "database", "queue", "worker"],
      },
      sources: [
        sources.queue,
        {
          label: "SQS dead-letter queues",
          url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html",
        },
      ],
    },
    "feed-rebuild": {
      parent: "feed-worker-replay",
      title: "Rebuild derived timelines",
      prompt:
        "An indexing bug corrupted a day of precomputed timelines. Posts and the event history are intact. How do you rebuild while new posts continue to arrive?",
      givens: [
        "Timeline IDs are derived data",
        "The event log supports a full day of replay",
        "Readers cannot see a partially rebuilt generation",
      ],
      rubric: [
        "Rebuild a separate generation from a named watermark.",
        "Catch up changes after the watermark and compare completeness.",
        "Switch readers atomically and leave a rollback path.",
      ],
      explanation:
        "Capture a consistent source snapshot or durable event watermark. Build timeline generation B separately, replay deltas after the watermark with stable IDs, and verify sample timelines plus coverage and lag. At cutover, serialize the reader pointer change with the last catch-up boundary or dual-apply the tail until the switch is committed. Keep the prior generation briefly for rollback and continue enforcing current access.",
      alternatives:
        "Fall back to pull-on-read for affected readers while a per-reader backfill completes, with a strict admission limit.",
      pitfall:
        "Clearing the live table first breaks reads. Taking a snapshot without accounting for the following write tail leaves a gap.",
      difficulty: "Intermediate",
      answerFrame: evolve(replay, {
        database: { purpose: "Versioned timeline rows" },
        worker: { purpose: "Rebuild and catch up" },
      }),
      view: {
        label: "Timeline recovery",
        ids: ["api", "database", "queue", "worker"],
      },
      sources: [sources.isolation, sources.outbox],
    },
  }),
  ...branchQuestions(actors(ranked), {
    "feed-community-start": {
      title: "Design a ranked community feed",
      prompt:
        "A discussion site wants the top posts per community, with a score based on recent votes and age. Design a first version and explain what one refresh promises.",
      givens: [
        "There are 30 communities and hundreds of recent posts per community",
        "Votes are durable and scores may lag by one minute",
        "The first version serves public posts only",
      ],
      rubric: [
        "Separate vote truth from derived ranking scores.",
        "Bound ranking work and order ties by a stable ID.",
        "Define score freshness and how to validate the ranking.",
      ],
      explanation:
        "Store posts and vote identities in PostgreSQL, with a uniqueness rule for the voter and post. Recompute scores on a bounded set of recent posts at a documented cadence and query by community and (score, post_id). Treat the score as a derived value. Define how refreshing may move posts and measure candidate-set size, update lag, and read latency. An EC2 API can serve both submissions and reads at this scale.",
      alternatives:
        "Rank a small recent candidate set at read time and cache it briefly if the site can tolerate variations between requests.",
      pitfall:
        "A duplicate vote can inflate the score if only an increment is stored. A timestamp or score alone does not uniquely order posts.",
      difficulty: "Foundation",
      answerFrame: ranked,
      view: {
        label: "Vote and rank",
        ids: ["customer", "restaurant", "api", "database"],
      },
      sources: [sources.constraints, sources.indexes],
    },
    "feed-ranking-cursor": {
      parent: "feed-community-start",
      title: "Keep ranking pages stable",
      prompt:
        "Vote updates move posts across the page boundary while a reader scrolls. How can five minutes of scrolling use a consistent ranking without holding a database transaction open?",
      givens: [
        "Scores change at least once a minute",
        "A new refresh should see the latest ranking",
        "A cursor can expire after five minutes",
      ],
      rubric: [
        "Pin a ranking generation in the cursor.",
        "Retain ordered IDs or scores for that generation until cursors expire.",
        "Describe cursor expiry and the treatment of deleted posts.",
      ],
      explanation:
        "Publish immutable ranked IDs and scores by community and generation. A signed cursor binds the generation and last position to the community. Keep the durable ranking version until the maximum cursor lifetime and cache popular snapshots in ElastiCache. New refreshes choose the newest ready generation. Fetch current post visibility at read time, skip deleted rows, and return a clear restart response for an expired generation.",
      alternatives:
        "Use a fixed set of immutable score epochs and index per epoch, instead of storing a dense list of ranked IDs.",
      pitfall:
        "A cursor carrying yesterday’s score but querying today’s order still skips and duplicates entries. A transaction held across client pages ties up resources.",
      difficulty: "Intermediate",
      answerFrame: snapshot,
      view: {
        label: "Ranking generations",
        ids: ["customer", "api", "database", "cache"],
      },
      sources: [sources.pagination, sources.isolation, sources.cache],
    },
    "feed-ranking-edits": {
      parent: "feed-ranking-cursor",
      title: "Remove a post from an old snapshot",
      prompt:
        "A moderator removes a post after a reader has opened a pinned ranking. How do you preserve stable scrolling without serving removed content?",
      givens: [
        "Snapshots keep ranked IDs for five minutes",
        "A removal must take effect for new authorized reads",
        "Readers may already have downloaded a page",
      ],
      rubric: [
        "Keep ordering and current authorization separate.",
        "Filter tombstoned posts during hydration and continue from a scanned position.",
        "State what can be done for already-rendered clients.",
      ],
      explanation:
        "Maintain the snapshot order but check each post’s current moderation state before returning its content. Advance the cursor over examined IDs and bound the scan when many rows are missing. The API can send a removal hint to connected clients or have clients revalidate, but the system cannot erase bytes previously delivered. Record the removal and invalidate display caches as a secondary cleanup.",
      alternatives:
        "Stop serving a contaminated generation and ask the reader to refresh if a policy change is broad enough to justify lost scroll position.",
      pitfall:
        "Keeping an immutable snapshot of full post bodies and serving it directly allows the old content to survive removal.",
      difficulty: "Intermediate",
      answerFrame: evolve(snapshot, {
        api: { purpose: "Filter removed posts" },
        cache: { purpose: "Snapshot IDs only" },
      }),
      view: {
        label: "Moderated pagination",
        ids: ["customer", "api", "database", "cache"],
      },
      sources: [sources.auth, sources.httpCache],
    },
    "feed-ranking-hot": {
      parent: "feed-ranking-cursor",
      title: "Serve a hot community",
      prompt:
        "A news event sends half the site’s feed reads to one community. The snapshot cache uses one key per generation. How do you reduce hot-key pressure and control rebuild work?",
      givens: [
        "The ranked ID list is immutable within a generation",
        "Most readers start at the same first page",
        "Generation publication still has a single durable boundary",
      ],
      rubric: [
        "Distinguish read hot spots from mutable write bottlenecks.",
        "Replicate or partition immutable pages without changing cursor semantics.",
        "Coalesce rebuilds and measure per-key saturation.",
      ],
      explanation:
        "Cache immutable slices keyed by community, generation, and page range. Replicate the hottest first slice across read paths or use a bounded local cache, so adding shards does not leave all traffic on one key. Publish a generation pointer only after its data is durable. Limit concurrent misses and rebuilds, expire old versions after cursor TTL, and observe latency and traffic per key.",
      alternatives:
        "For a truly public immutable slice, use an explicitly cacheable CDN response. Keep personalized hydration and authorization on an appropriate private path.",
      pitfall:
        "A uniform hash of community IDs cannot split a single hot key. Per-request generation creation also multiplies write load.",
      difficulty: "Intermediate",
      answerFrame: evolve(snapshot, {
        cache: { purpose: "Replicated page slices" },
        api: { purpose: "Coalesce page misses" },
      }),
      view: {
        label: "Hot snapshot reads",
        ids: ["customer", "api", "database", "cache"],
      },
      sources: [shardingSource, sources.cache, sources.httpCache],
    },
    "feed-private-groups": {
      parent: "feed-community-start",
      title: "Add private communities",
      prompt:
        "Private communities want the same ranked feed. How will you prevent posts from crossing a membership boundary in feeds, direct links, and shared caches?",
      givens: [
        "Only current community members can view private posts",
        "Ranked IDs are reusable within an allowed audience",
        "Membership can change while a device is signed in",
      ],
      rubric: [
        "Check membership at every private-content entry point.",
        "Define a data and cache boundary for public and private pages.",
        "Explain how a membership change affects existing sessions and cursors.",
      ],
      explanation:
        "Authenticate the requester and authorize the community and post on the API path for list and direct reads. Keep public cache keys and responses separate from private data. A shared private ID list is only a candidate list behind the authorization boundary. Resolve the current membership from the authority or a versioned policy cache with an explicit revocation contract. A cursor identifies a position and cannot grant membership.",
      alternatives:
        "Materialize per-member views if different members need different visibility, accepting higher fan-out and invalidation cost.",
      pitfall:
        "Treating an unguessable link or a cache key as proof of membership bypasses the actual access rule.",
      difficulty: "Intermediate",
      answerFrame: groups,
      view: {
        label: "Community access",
        ids: ["customer", "restaurant", "api", "database"],
      },
      sources: [sources.auth, sources.httpCache],
    },
    "feed-moderation": {
      parent: "feed-private-groups",
      title: "Race a ban against a publish",
      prompt:
        "A moderator bans a member while that member is submitting a post. The product needs a clear rule for which write wins. Where is the decision made?",
      givens: [
        "A ban and a submission can hit different API processes",
        "Publish must respect a ban that commits first",
        "The moderator’s change and each post need an audit record",
      ],
      rubric: [
        "Name an authoritative order for membership and publishing.",
        "Use a transaction with locking or a verified equivalent.",
        "Specify the treatment of earlier posts and retried submissions.",
      ],
      explanation:
        "Serialize publish and ban against the same authoritative membership row in PostgreSQL. The publishing transaction locks and checks the current row, then writes the post and its audit or outbox record before committing. The ban changes that row under the same lock. Define separately whether already-committed posts are removed. Retried submissions use a stable operation ID so a lost response does not produce another post.",
      alternatives:
        "Use serializable transactions with bounded retries and confirm the conflict actually covers the membership read and post write.",
      pitfall:
        "Checking membership in a separate request before inserting the post leaves a time-of-check race.",
      difficulty: "Intermediate",
      answerFrame: evolve(groups, {
        api: { purpose: "Check access in commit" },
        database: { purpose: "Membership and audit" },
      }),
      view: {
        label: "Publish authorization",
        ids: ["customer", "restaurant", "api", "database"],
      },
      sources: [sources.locks, sources.isolation],
    },
    "feed-read-region": {
      parent: "feed-private-groups",
      title: "Serve readers in a second region",
      prompt:
        "Public feed reads from a second region are slow. Private access changes must still take effect promptly. Which reads can move closer to users and what remains authoritative?",
      givens: [
        "The primary handles writes and membership changes",
        "Public posts can tolerate measured replication lag",
        "Private access must be verified against current policy",
      ],
      rubric: [
        "Route eligible public reads to an asynchronous replica.",
        "Keep writes and freshness-sensitive policy checks on an authoritative path.",
        "Define lag limits, fallback, and what the user sees.",
      ],
      explanation:
        "Use a regional RDS read replica for public feed candidates while the primary remains authoritative for writes and policy. Classify which data can lag. For private posts, query current authorization on the authoritative path and avoid serving stale body versions when visibility can change. Gate replica use on measured lag and provide a bounded fallback or explicit degraded response.",
      alternatives:
        "Replicate a separate projection of posts whose public-access contract permits the lag and keep private reads at the primary.",
      pitfall:
        "A read replica improves proximity but does not make reads immediately reflect a membership or visibility update.",
      difficulty: "Intermediate",
      answerFrame: regional,
      view: {
        label: "Regional read routing",
        ids: ["customer", "api", "database", "feed-replica"],
      },
      sources: [replicaSource, sources.auth],
    },
    "feed-region-lag": {
      parent: "feed-read-region",
      title: "Show a newly published post",
      prompt:
        "An author sees a successful publish, then the regional replica feed misses the post for a few seconds. How can you provide read-your-write behavior without sending all reads to the primary?",
      givens: [
        "Replica apply can lag after the primary commits",
        "Other readers accept the stated lag",
        "A client can carry a server-issued commit marker",
      ],
      rubric: [
        "Return a marker or route the writer to the primary.",
        "Compare the replica’s applied position or enforce a bounded wait.",
        "Separate read-your-write for the author from global freshness.",
      ],
      explanation:
        "Return an operation marker tied to the committed post. On a subsequent read, serve from the replica only when the service can verify it has applied the required position. Otherwise wait briefly or route that request to the primary with a capacity limit. A client can also render a clearly pending local item while it waits for confirmation. Keep the ordinary public read path on replicas.",
      alternatives:
        "Use a short sticky-primary period after publishing, with an explicit fallback if actual lag can exceed the period.",
      pitfall:
        "Sleeping a fixed time after publish without checking the replica cannot guarantee the post is visible.",
      difficulty: "Intermediate",
      answerFrame: evolve(regional, {
        api: { purpose: "Route by applied position" },
        "feed-replica": { purpose: "Measured replay position" },
      }),
      view: {
        label: "Read after publish",
        ids: ["customer", "api", "database", "feed-replica"],
      },
      sources: [
        replicaSource,
        {
          label: "PostgreSQL recovery information functions",
          url: "https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-RECOVERY-INFO-TABLE",
        },
      ],
    },
    "feed-region-outage": {
      parent: "feed-read-region",
      title: "Degrade when a region fails",
      prompt:
        "The regional replica is unreachable. Redirecting every reader at once could overload the primary. Choose a degraded mode and explain how to recover.",
      givens: [
        "The primary still handles all writes",
        "Primary read capacity is limited",
        "Private requests require an authoritative access check",
      ],
      rubric: [
        "Protect primary capacity with priority and bounded fallback.",
        "Specify what stale public data is safe to serve.",
        "Restore traffic gradually based on health and lag.",
      ],
      explanation:
        "Fail the broken replica out of routing, cap fallback concurrency, and prioritize correctness-sensitive operations. A cached public snapshot is acceptable only where the visibility and freshness contract allows it. Otherwise return a retryable unavailable response. Continue authoritative access checks for private requests. Bring the replica back through a measured ramp after health and replay lag recover.",
      alternatives:
        "Add an independently sized read pool for public failover when the expected outage traffic justifies it.",
      pitfall:
        "Opening the primary to every retry can turn a regional read outage into a write outage.",
      difficulty: "Intermediate",
      answerFrame: evolve(regional, {
        api: { purpose: "Limit fallback reads" },
        "feed-replica": { unavailable: true },
      }),
      view: {
        label: "Regional fallback",
        ids: ["customer", "api", "database", "feed-replica"],
      },
      sources: [replicaSource, sources.overload],
    },
  }),
};
