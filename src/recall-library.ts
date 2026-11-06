import type { RecallCard } from "./cards.ts";
import { sources as s } from "./scenario-authoring.ts";

type Entry = Omit<RecallCard, "topic">;
const mit = {
  label: "MIT algorithm lecture notes",
  url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
};
const dynamo = {
  label: "Amazon Dynamo paper",
  url: "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf",
};

const systemCards: Entry[] = [
  {
    id: "recall-cache-stampede",
    title: "One expiry creates a thousand reads.",
    difficulty: "Intermediate",
    prompt:
      "A hot cache key expires and 1,000 requests miss together. Why is adding a cache insufficient, and how would you protect the source?",
    explanation:
      "All misses can reach the database before any fill completes. Coalesce concurrent loads per key, bound total source concurrency, and use expiry jitter to spread different keys' refreshes. Serve bounded stale data only if the product permits it. A failed loader needs a timeout and recovery; a distributed lock without expiry can become another outage. Per-process coalescing reduces work but still allows one load per process.",
    rubric: [
      "Explain the simultaneous-miss amplification.",
      "Bound and coalesce source work.",
      "State freshness and loader-failure behavior.",
    ],
    alternatives:
      "Refresh hot entries before expiry or keep a small local read layer when the freshness contract allows it.",
    pitfall:
      "Assuming a higher cache hit rate guarantees the database survives every cache restart.",
    sources: [s.cache, s.overload],
  },
  {
    id: "recall-negative-cache",
    title: "A missing record can be cached too.",
    difficulty: "Foundation",
    prompt:
      "When does caching a not-found result help, and what changes when the missing record is created?",
    explanation:
      "A short-lived negative entry avoids repeatedly looking up the same absent key. Its lifetime and creation invalidation must fit the time a new record may remain invisible. Distinguish a definite authorized not-found result from a database timeout or permission failure. Bound negative-cache memory and fallback admission: an attacker generating unique keys can bypass per-key reuse and fill the cache.",
    rubric: [
      "Describe repeated-miss reduction.",
      "Define creation visibility and expiry.",
      "Separate absence from errors and bound memory.",
    ],
    alternatives:
      "An existence filter can reduce some misses if updates and false-positive handling are correct.",
    pitfall:
      "Caching a timeout as not found or retaining unlimited attacker-chosen keys.",
    sources: [s.cache, s.overload],
  },
  {
    id: "recall-ttl-freshness",
    title: "A fresh TTL can contain an old read.",
    difficulty: "Intermediate",
    prompt:
      "A reader loads an old menu snapshot, stalls, then fills the cache with a fresh 30-second TTL after a newer update. What guarantee does the TTL fail to establish?",
    explanation:
      "An expiry measured from cache insertion bounds entry residence, not the age of the source data. A delayed old reader can refill after invalidation. Carry a source version and freshness deadline, bound snapshot/query lifetime, reject late fills, or use a protocol that prevents an older version replacing a newer one. Strong freshness requires a stronger read/write boundary than an arbitrary TTL alone.",
    rubric: [
      "Identify the stale-fill race.",
      "Distinguish residence time from source age.",
      "Propose version or age checks and define the remaining guarantee.",
    ],
    alternatives:
      "Read the authoritative source for operations that require current state.",
    pitfall: "Calling cache invalidation plus a TTL linearizable consistency.",
    sources: [s.cache, s.isolation],
  },
  {
    id: "recall-transactional-outbox",
    title: "Two writes leave a crash window.",
    difficulty: "Intermediate",
    prompt:
      "An order transaction commits, then the process dies before publishing its event. How does an outbox change the failure boundary?",
    explanation:
      "Commit the order and an outbox record in one database transaction. A relay publishes pending records and records progress after acceptance. A crash after publishing but before marking progress can publish twice, so consumers need stable event IDs and idempotent effects. The outbox closes the committed-order-with-no-durable-event gap; it does not create one distributed transaction across the database, broker, and every external effect.",
    rubric: [
      "Commit business data and event together.",
      "Explain relay retries and duplicate publication.",
      "Require consumer idempotency and backlog monitoring.",
    ],
    alternatives:
      "A suitable committed change-data stream can relay events with its own retention and delivery contract.",
    pitfall:
      "Publishing before the database commits or promising exactly-once external effects from an outbox alone.",
    sources: [s.outbox, s.queue],
  },
  {
    id: "recall-backpressure",
    title: "A queue cannot fix a permanent deficit.",
    difficulty: "Foundation",
    prompt:
      "Events arrive at 2,000 per second and workers sustain 1,500. What happens to backlog, and what decisions are required?",
    explanation:
      "Ignoring existing backlog and variability, unfinished work grows by roughly 500 events per second. A finite queue eventually exhausts retention or capacity. Increase sustainable processing within downstream budgets, reduce admitted work, or explicitly sample/drop when the contract permits it. Track oldest-item age and drain time as well as depth. More workers help only while the database or dependency can support their combined work.",
    rubric: [
      "Compute the sustained deficit.",
      "Explain finite buffering and retention.",
      "Choose bounded capacity or admission changes.",
    ],
    alternatives:
      "Batching or a different aggregate representation can reduce work per event.",
    pitfall:
      "Calling a queue durable and therefore assuming it can absorb unlimited sustained overload.",
    sources: [s.overload, s.queue],
  },
  {
    id: "recall-retry-jitter",
    title: "Retries can multiply an outage.",
    difficulty: "Foundation",
    prompt:
      "A three-layer call chain retries each failed call three times. Why can this worsen overload, and how would you bound retries?",
    explanation:
      "If each layer makes three total attempts, one top-level call can trigger up to 27 downstream attempts. Define whether a number means retries or total attempts. Retry at a deliberate layer with a total deadline, bounded attempts, backoff, and jitter. Retry only appropriate failures and make side effects safe to repeat. A timeout means the outcome may be unknown, not necessarily that nothing happened.",
    rubric: [
      "Explain multiplicative amplification with clear attempt semantics.",
      "Bound retries and spread them with jitter.",
      "Account for uncertain outcomes and idempotency.",
    ],
    alternatives: "A retry budget can limit added traffic across requests.",
    pitfall:
      "Immediately retrying every timeout at every layer with a new idempotency key.",
    sources: [s.retries],
  },
  {
    id: "recall-timeout-budget",
    title: "A child call must fit the remaining deadline.",
    difficulty: "Intermediate",
    prompt:
      "An API has a 900 ms total deadline and has already spent 600 ms. Why is a fresh 900 ms dependency timeout misleading?",
    explanation:
      "Only about 300 ms remains, before allowing for response work and scheduling. Propagate the remaining deadline and budget connection setup, retries, and processing within it. Timeouts should reflect observed dependency latency and the acceptable false-timeout rate. Cancellation can reduce wasted work but does not prove a remote operation rolled back; record and reconcile uncertain side effects.",
    rubric: [
      "Use the remaining end-to-end budget.",
      "Include connection/retry/response costs.",
      "Separate cancellation from remote rollback.",
    ],
    alternatives:
      "Parallelize independent calls when it improves the actual critical path and resource budget.",
    pitfall:
      "Resetting the full deadline at every hop or assuming a canceled payment never committed.",
    sources: [s.retries],
  },
  {
    id: "recall-circuit-breaker",
    title: "Stop repeatedly calling a failed dependency.",
    difficulty: "Foundation",
    prompt:
      "How does a circuit breaker differ from a timeout or rate limit, and how should it recover?",
    explanation:
      "A timeout bounds one wait. A rate limit bounds admitted work. A circuit breaker temporarily rejects calls to a dependency judged unhealthy, then permits bounded probes to determine recovery. Define failure signals, an open interval, and conservative half-open concurrency so every caller does not probe at once. The fallback must preserve meaning: temporarily unavailable is not the same as an empty record.",
    rubric: [
      "Distinguish the three controls.",
      "Describe open, probe, and recovery behavior.",
      "Define an honest bounded fallback.",
    ],
    alternatives:
      "Admission limits and short timeouts can be enough for a simple dependency without a separate breaker state machine.",
    pitfall:
      "Sending all rejected cache traffic to an already overloaded database.",
    sources: [s.retries, s.overload],
  },
  {
    id: "recall-index-prefix",
    title: "An index follows an access pattern.",
    difficulty: "Foundation",
    prompt:
      "Why can a B-tree index on (conversation_id, position) help a query for one conversation's next 50 messages? What does it not make free?",
    explanation:
      "The equality filter narrows the leading key, then a position range and matching ordering can find a small ordered page. The planner still considers selectivity and cost; an index does not guarantee a particular plan. Maintaining it adds write and storage cost, and arbitrary text search or globally ordering by an unrelated column is a different access pattern. Validate with a representative query plan and data distribution.",
    rubric: [
      "Connect equality, range, order, and limit to the index.",
      "Acknowledge planner and distribution effects.",
      "Explain write/storage cost and unsupported access patterns.",
    ],
    alternatives:
      "Another index order may fit another dominant query; adding every possible index increases maintenance cost.",
    pitfall:
      "Assuming every predicate becomes fast merely because some index exists on the table.",
    sources: [s.indexes, s.pagination],
  },
  {
    id: "recall-write-skew",
    title: "Two valid snapshots break a shared rule.",
    difficulty: "Intermediate",
    prompt:
      "Two doctors each see the other on call and independently go off call. Why can snapshot-based transactions violate the rule that someone must remain on call?",
    explanation:
      "Each transaction reads a valid earlier snapshot and writes a different row. Their individual writes may not conflict even though the combined result violates a predicate across rows. Protect the shared invariant with appropriate locking of a common decision boundary or serializable transactions with bounded retry handling. A transaction alone is not a promise of serial execution at every isolation level.",
    rubric: [
      "Explain the cross-row read/write dependency.",
      "Distinguish atomicity from serializability.",
      "Offer a correct coordination or serializable-retry boundary.",
    ],
    alternatives:
      "Redesign a simple invariant around one constrained row when business semantics permit it.",
    pitfall:
      "Claiming repeatable reads or separate per-doctor row updates prevent every write-skew anomaly.",
    sources: [s.isolation, s.locks],
  },
  {
    id: "recall-optimistic-version",
    title: "A stale editor must not overwrite a newer one.",
    difficulty: "Foundation",
    prompt:
      "Two devices edit version 7 of the same note. How does an expected-version update avoid a silent lost update?",
    explanation:
      "Update the row only where its current version equals 7, and increment the version atomically with the content change. One succeeds; the other observes no matching row and must reload, merge, or ask for an explicit overwrite. The version check and write must share one atomic operation. Retry request identity is a separate concern: an already applied identical request should be recognized rather than counted as a second edit.",
    rubric: [
      "Compare and increment atomically.",
      "Handle conflict explicitly.",
      "Distinguish concurrency versions from duplicate request IDs.",
    ],
    alternatives:
      "A row lock can serialize a short server-side edit; a merge protocol can combine independent fields when its rules are well defined.",
    pitfall:
      "Reading a version, checking it in application memory, and then issuing an unconditional update.",
    sources: [s.transactions, s.locks],
  },
  {
    id: "recall-cap-partition",
    title: "A partition forces a concrete decision.",
    difficulty: "Intermediate",
    prompt:
      "During a network partition, why can't every replica both answer every request and preserve one linearizable shared value? What should an interview answer specify?",
    explanation:
      "Separated replicas cannot coordinate the order of conflicting operations. If both sides must always answer, one may return a result incompatible with a single real-time order; preserving that consistency may require rejecting or delaying requests on a side. Specify the operation, failure model, and acceptable behavior. This is not a permanent instruction to pick any two letters, nor a claim that all consistency models are identical.",
    rubric: [
      "Describe a concrete partition and conflicting operations.",
      "Explain the consistency/availability conflict during that failure.",
      "State the chosen behavior per operation.",
    ],
    alternatives:
      "Different operations can tolerate different guarantees, such as stale catalog reads but guarded stock reservations.",
    pitfall:
      "Using CAP as a three-option shopping list without naming a partition or the consistency definition.",
    sources: [
      {
        label: "Gilbert and Lynch CAP result",
        url: "https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer2.pdf",
      },
    ],
  },
  {
    id: "recall-quorum-overlap",
    title: "Overlapping quorums are not the whole protocol.",
    difficulty: "Intermediate",
    prompt:
      "For N replicas, what intuition does R + W > N provide, and why does that inequality alone not prove linearizability?",
    explanation:
      "With fixed replica sets, a read quorum and a completed write quorum must intersect. That overlap can expose a recent version, but the protocol still needs version ordering, conflict handling, concurrent-operation semantics, and failure/reconfiguration rules. Sloppy quorums may use different physical nodes, weakening the simple intersection assumption. A read cannot blindly choose any returned value and infer correctness from the arithmetic alone.",
    rubric: [
      "Explain set intersection under fixed membership.",
      "Name ordering/concurrency assumptions.",
      "Identify sloppy quorum or reconfiguration limitations.",
    ],
    alternatives:
      "A consensus-based leader protocol can provide a clearer strong-consistency boundary at different availability and latency costs.",
    pitfall:
      "Writing R + W > N and declaring every replicated store linearizable.",
    sources: [dynamo],
  },
  {
    id: "recall-hot-shard",
    title: "A balanced hash can still have a hot key.",
    difficulty: "Intermediate",
    prompt:
      "A store hashes keys evenly across 20 shards, but one celebrity account generates half the traffic. Why doesn't adding evenly distributed keys fix that shard?",
    explanation:
      "Balanced key counts do not imply balanced request load. One hot key still maps to one shard. Cache eligible reads, replicate read views, partition work within the key when semantics allow it, or bound admitted traffic. Splitting an ordered counter or feed may require aggregation and a changed consistency model. Measure per-key traffic and latency rather than only disk usage per shard.",
    rubric: [
      "Distinguish key distribution from traffic distribution.",
      "Propose a workload-specific mitigation.",
      "Explain ordering or aggregation tradeoffs.",
    ],
    alternatives:
      "A specialized hot-key path can be simpler than repartitioning every ordinary key.",
    pitfall:
      "Assuming consistent hashing automatically divides one hot record's writes across all nodes.",
    sources: [dynamo, s.overload],
  },
  {
    id: "recall-consistent-hash",
    title: "Moving a node should not remap every key.",
    difficulty: "Foundation",
    prompt:
      "What problem does consistent hashing solve compared with hash(key) modulo node_count, and what remains unsolved?",
    explanation:
      "Changing a modulo divisor can remap a large fraction of keys. Consistent hashing assigns keys and nodes to a ring or equivalent structure so adding/removing a node usually changes a smaller subset. Virtual nodes can improve balance and movement flexibility. It does not supply replication correctness, membership agreement, data migration, or relief for one hot key; those remain explicit protocols and workload concerns.",
    rubric: [
      "Explain remapping under modulo changes.",
      "Describe limited reassignment and virtual nodes.",
      "Separate placement from correctness and hot-key behavior.",
    ],
    alternatives:
      "Rendezvous hashing provides another placement approach with its own lookup and weighting properties.",
    pitfall:
      "Presenting a hash ring as a complete distributed database design.",
    sources: [dynamo],
  },
  {
    id: "recall-token-bucket",
    title: "Allow bursts without unlimited average traffic.",
    difficulty: "Foundation",
    prompt:
      "How does a token bucket with refill r and capacity B admit bursts, and what changes across API replicas?",
    explanation:
      "Tokens accumulate at rate r up to B; a request consumes the required tokens or is rejected/delayed. An idle bucket can permit a burst up to B while limiting sustained admission. Use elapsed monotonic time for local refill calculations. Independent full buckets on k replicas can admit roughly k times the intended aggregate budget, so choose shared coordination or conservatively partition budgets. Limiting admission does not guarantee downstream capacity by itself.",
    rubric: [
      "Describe refill, capacity, and consumption.",
      "Explain burst versus sustained rate.",
      "Account for aggregate replica budgets.",
    ],
    alternatives:
      "A sliding-window log provides different boundary behavior with more state; a fixed window is simpler but allows boundary bursts.",
    pitfall:
      "Configuring the same global limit independently on every replica and calling it a global cap.",
    sources: [
      {
        label: "IETF token bucket meter",
        url: "https://www.rfc-editor.org/rfc/rfc2697",
      },
      s.overload,
    ],
  },
  {
    id: "recall-socket-resume",
    title: "A live connection is not durable history.",
    difficulty: "Intermediate",
    prompt:
      "What state is needed to resume a message stream after reconnect, and where can a naive fetch-then-subscribe flow lose data?",
    explanation:
      "Keep durable ordered message identities and a last-applied cursor. If history is fetched before subscribing, a message can commit between those operations and be absent from both results. Use a defined boundary: subscribe and buffer bounded hints, catch up through a durable high-water mark, then merge by stable ID and reconcile later gaps. Expired cursors require explicit resynchronization, and replay overlap must not duplicate local messages.",
    rubric: [
      "Persist an applied cursor against a durable log.",
      "Identify the handoff race.",
      "Handle duplicates and retention gaps.",
    ],
    alternatives:
      "A resumable broker stream or periodic durable polling can supply the boundary.",
    pitfall:
      "Assuming a successful WebSocket reconnect replays everything sent while disconnected.",
    sources: [s.sockets, s.pagination],
  },
  {
    id: "recall-keyset-page",
    title: "An opaque cursor is still a position.",
    difficulty: "Foundation",
    prompt:
      "How does keyset pagination differ from OFFSET, and what must be true about its ordering key and authorization?",
    explanation:
      "Continue above or below the last returned unique ordering key, using an index that matches the filter and order. This avoids repeatedly computing a growing skipped prefix. A nonunique timestamp needs a stable tie-breaker. The cursor should be validated and bound to its query/resource, but a valid signature never replaces current authorization. Keyset ordering alone does not freeze edits or deletions into a historical snapshot.",
    rubric: [
      "Describe the strict continuation boundary.",
      "Require a total stable order and matching index.",
      "Separate cursor validity from access and snapshot guarantees.",
    ],
    alternatives:
      "OFFSET is fine for small bounded lists or occasional page jumps where its cost is acceptable.",
    pitfall:
      "Using only a timestamp with ties or describing an encoded cursor as an immutable snapshot.",
    sources: [s.pagination, s.auth],
  },
  {
    id: "recall-cdn-origin",
    title: "A private origin is not viewer authorization.",
    difficulty: "Intermediate",
    prompt:
      "CloudFront uses origin access control to read private S3 objects. Does that decide which end users may view a file?",
    explanation:
      "OAC authenticates and signs CloudFront's origin requests to S3. The bucket policy can restrict the permitted distribution and object scope. End-user access is a separate decision: public approved images may be public through CloudFront, while private content needs viewer authorization such as signed URLs/cookies or another gate. Do not expose staging objects just because the whole origin is private. Versioned URLs and cache policy also determine update behavior.",
    rubric: [
      "Explain the origin identity boundary.",
      "Separate viewer authorization.",
      "Scope approved objects and account for caching.",
    ],
    alternatives:
      "An authorized proxy can serve private objects with per-request membership checks.",
    pitfall:
      "Assuming OAC makes every viewer an authorized application member.",
    sources: [
      {
        label: "CloudFront private S3 origins",
        url: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html",
      },
    ],
  },
  {
    id: "recall-signed-url-revoke",
    title: "A capability outlives a permission change.",
    difficulty: "Intermediate",
    prompt:
      "Why can removing a user from an application leave their already issued presigned S3 URL usable?",
    explanation:
      "The URL is a bearer capability for a signed operation under the signing credentials and applicable S3 policies. S3 does not consult an application membership table on each use. Its effective lifetime can end through expiry, credential expiry/revocation, or policy changes, but deleting an application membership alone is not that change. Use short lifetimes for a bounded delay or an authorized delivery layer when every new request must check current membership. Previously downloaded bytes remain outside recall.",
    rubric: [
      "Identify bearer capability semantics.",
      "Explain the separate membership and S3 policy boundaries.",
      "Choose a delivery policy matching revocation needs.",
    ],
    alternatives:
      "A private proxy or appropriate edge authorization can check each request; broader policy revocation can invalidate existing direct capabilities during a cutover.",
    pitfall:
      "Calling a presigned URL single-use or immediately revoked by a database membership deletion.",
    sources: [s.uploads, s.auth],
  },
  {
    id: "recall-tail-latency",
    title: "A fast average can hide a slow tail.",
    difficulty: "Foundation",
    prompt:
      "An API's average latency is 40 ms and p99 is 2 seconds. What does p99 mean, and why shouldn't you average per-instance p99 values into a fleet p99?",
    explanation:
      "For the measured population/window, roughly 99% of observations are at or below the p99 boundary. The mean can hide a slow minority. Averages of per-instance percentiles do not reconstruct the combined request distribution, especially with unequal traffic. Aggregate compatible histograms or observations with known error and scope, then compute the fleet percentile. Include failures and timeout policy deliberately rather than silently measuring only successful fast requests.",
    rubric: [
      "Interpret the percentile and its population.",
      "Explain why percentiles are not directly additive or averageable.",
      "Use a compatible aggregate distribution and clear error scope.",
    ],
    alternatives:
      "An SLO threshold and fraction of requests meeting it can be easier to aggregate across services.",
    pitfall:
      "Reading p99 as a maximum latency or averaging two p99 numbers into a correct global p99.",
    sources: [
      {
        label: "Google SRE monitoring",
        url: "https://sre.google/sre-book/monitoring-distributed-systems/",
      },
    ],
  },
  {
    id: "recall-littles-law",
    title: "Latency consumes concurrency.",
    difficulty: "Foundation",
    prompt:
      "At a stable average throughput of 100 requests/s and average time in system of 0.2 s, what average in-flight count does Little's law suggest? What assumptions matter?",
    explanation:
      "L = lambda × W gives about 20 requests in flight on average. The arrival/throughput rate, time, and population must refer to the same system boundary and stable long-run conditions. This is an average relation, not a safe maximum connection-pool size or a p99 estimate. Bursts, queuing, failures, and variability still determine headroom. A growing unstable backlog is not a steady state that can be summarized by the same fixed average waiting time.",
    rubric: [
      "Compute 20 with consistent units.",
      "State stable averages and a common boundary.",
      "Separate average concurrency from safe capacity.",
    ],
    alternatives:
      "Use load tests and queueing measurements to choose actual concurrency limits and headroom.",
    pitfall:
      "Multiplying a percentile latency by average traffic and calling the result a guaranteed maximum.",
    sources: [
      {
        label: "Little's original queueing relation",
        url: "https://pubsonline.informs.org/doi/10.1287/opre.9.3.383",
      },
    ],
  },
  {
    id: "recall-rpo-rto",
    title: "A backup is not a recovery time.",
    difficulty: "Foundation",
    prompt:
      "What do RPO and RTO describe, and why isn't a successful backup job enough to prove either target is met?",
    explanation:
      "Recovery point objective states the tolerated data-loss window; recovery time objective states the target duration to restore the defined service. Backup frequency alone does not prove recoverability, and a stored backup says little about restore, replay, dependency recovery, or traffic cutover time. Rehearse recovery with representative data, validate integrity, and measure the whole service boundary. Replication and failover may reduce downtime while still replicating accidental deletions.",
    rubric: [
      "Distinguish data loss from service recovery duration.",
      "Include restore and dependency/cutover work.",
      "Require measured recovery and integrity checks.",
    ],
    alternatives:
      "Point-in-time recovery, warm standby, or multi-site designs offer different cost and recovery tradeoffs.",
    pitfall:
      "Claiming zero data loss and instant recovery merely because backups or replicas exist.",
    sources: [
      {
        label: "AWS disaster recovery objectives",
        url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_planning_for_recovery_objective_defined_recovery.html",
      },
    ],
  },
  {
    id: "recall-event-order",
    title: "The last arrival may describe an older state.",
    difficulty: "Intermediate",
    prompt:
      "An old preparing event arrives after an order is ready. Why is arrival-time overwrite unsafe, and how can a consumer protect state?",
    explanation:
      "Network and retry order need not match business order. Carry a stable aggregate identity and trustworthy version or sequence, apply only legal expected transitions, and commit the new version with the state. Duplicates become no-ops; gaps may require fetching the authoritative state or replaying missing events. An arbitrary client timestamp is not a reliable global ordering oracle. Ordering is usually per aggregate, not every event in the system.",
    rubric: [
      "Distinguish transport arrival from business order.",
      "Use guarded state/version transitions and stable IDs.",
      "Define duplicates and gap recovery.",
    ],
    alternatives:
      "A serialized per-key log can preserve a useful ordering boundary, with replay and consumer correctness still required.",
    pitfall:
      "Using last-arrival-wins or trusting unsynchronized client clocks to resolve every conflict.",
    sources: [s.transactions, s.queue],
  },
  {
    id: "recall-observability-signals",
    title: "Choose evidence for the question.",
    difficulty: "Foundation",
    prompt:
      "How do metrics, logs, and traces complement one another when investigating slow checkout requests?",
    explanation:
      "Metrics show aggregate rates, errors, latency distributions, and saturation. Traces connect work across request spans to locate where sampled requests spent time. Logs provide discrete diagnostic events and context, ideally correlated with request/trace IDs. Sampling, missing instrumentation, and high-cardinality labels affect what can be concluded. Correlation guides an investigation; one slow span or coincident CPU spike does not by itself establish root cause.",
    rubric: [
      "Match each signal to its useful evidence.",
      "Correlate identities and timestamps.",
      "Account for sampling, cardinality, and causal limits.",
    ],
    alternatives:
      "Profiles can explain CPU or allocation cost inside a process once the slow path is located.",
    pitfall:
      "Putting unbounded user IDs into metric labels or calling a correlated graph a proven diagnosis.",
    sources: [
      {
        label: "OpenTelemetry signals",
        url: "https://opentelemetry.io/docs/concepts/signals/",
      },
    ],
  },
];

const algorithmCards: Entry[] = [
  {
    id: "recall-greedy-exchange",
    title: "A greedy choice needs an exchange argument.",
    difficulty: "Intermediate",
    prompt:
      "For the largest set of nonoverlapping intervals, why does repeatedly choosing the compatible interval that finishes earliest work? Assume touching endpoints are compatible.",
    explanation:
      "Sort by finish time. Choose the earliest-finishing interval compatible with the last choice. In an optimal remaining schedule, replace its first interval with this choice: it finishes no later, so every later interval in that schedule is still feasible. Repeating the exchange proves an optimal count. Sorting costs O(n log n), then scanning costs O(n). This proof concerns unweighted interval count; assigning values to intervals changes the objective and can invalidate the rule.",
    rubric: [
      "State the earliest-finish choice and compatibility rule.",
      "Explain the replacement preserving later feasibility.",
      "Give complexity and the unweighted limitation.",
    ],
    alternatives:
      "Weighted interval scheduling uses dynamic programming over compatible predecessors.",
    pitfall:
      "Choosing the shortest duration or earliest start without a proof, or applying the count rule to weighted rewards.",
    sources: [mit],
  },
  {
    id: "recall-two-pointers",
    title: "Discard an endpoint with a reason.",
    difficulty: "Foundation",
    prompt:
      "In a sorted array, find two distinct indices whose values sum to a target. Why is moving the left pointer safe when the current endpoint sum is too small?",
    explanation:
      "Keep left < right. If a[left] + a[right] is too small, pairing that left value with any remaining index no farther right cannot make a larger sum, so discard left. If too large, every remaining partner for the right value is at least as large as the current left value, so discard right. Each move removes an impossible endpoint: O(n) time and O(1) extra space, assuming the input is already sorted.",
    rubric: [
      "Use sorted order to justify both discards.",
      "Keep distinct indices with left < right.",
      "State time/space and the sorting assumption.",
    ],
    alternatives:
      "A hash map gives expected O(n) time on unsorted input with O(n) space; preserve original indices if sorting first.",
    pitfall:
      "Applying the endpoint proof to an unsorted array or reusing one index twice.",
    sources: [mit],
  },
  {
    id: "recall-cycle-pointers",
    title: "A faster pointer catches a cycle.",
    difficulty: "Intermediate",
    prompt:
      "Why do slow/fast pointers detect a linked-list cycle, and how can they locate its entry without extra visited storage?",
    explanation:
      "Move one pointer one step and the other two, checking null safely. In a cycle, their relative distance changes by one modulo the cycle length, so they meet. At the meeting, reset one pointer to the head and advance both one step; the distance equations imply they meet at the entry. A list with a tail into a cycle is handled as well as a cycle beginning at the head. Time is O(n), extra space O(1).",
    rubric: [
      "Explain the relative-motion argument.",
      "Describe the reset-and-walk entry step.",
      "Handle no-cycle/null cases and complexity.",
    ],
    alternatives:
      "A visited-node identity set gives a simpler entry detector with O(n) space.",
    pitfall:
      "Comparing node values instead of identities or dereferencing fast.next before checking it exists.",
    sources: [mit],
  },
  {
    id: "recall-list-reversal",
    title: "Save the suffix before reversing a link.",
    difficulty: "Foundation",
    prompt:
      "What invariant makes iterative singly linked-list reversal safe, and why must the next pointer be saved first?",
    explanation:
      "prev heads the already reversed prefix; curr heads the untouched suffix. Save next = curr.next, point curr.next to prev, then move prev to curr and curr to next. The two regions still contain every original node exactly once, with the boundary advanced. When curr is null, prev is the new head. This handles empty and one-node lists in O(n) time and O(1) extra space.",
    rubric: [
      "State the reversed-prefix/untouched-suffix invariant.",
      "Save next before overwriting the link.",
      "Return prev and cover boundaries/complexity.",
    ],
    alternatives:
      "Recursive reversal uses O(n) call-stack space and needs a correct tail-link update.",
    pitfall:
      "Overwriting curr.next and then trying to use it to find the remaining suffix.",
    sources: [mit],
  },
  {
    id: "recall-merge-intervals",
    title: "Only the last merged interval can overlap next.",
    difficulty: "Foundation",
    prompt:
      "How do you merge overlapping closed intervals, and why is comparing the next interval only with the last output interval sufficient after sorting?",
    explanation:
      "Sort by start. Maintain disjoint merged intervals in start order. If the next start is at most the last end, extend that end to the larger end; otherwise append a new interval. Earlier output intervals end before the last starts, so a new interval cannot overlap one while skipping the last. Closed intervals touching at an endpoint merge under this policy. Time is O(n log n) for sorting; output can use O(n) space, with sorting space depending on the implementation.",
    rubric: [
      "Sort and state the disjoint-output invariant.",
      "Use max end when merging nested intervals.",
      "Define touching endpoints and complexity.",
    ],
    alternatives:
      "A sweep of endpoints can support overlap counts and different boundary semantics.",
    pitfall:
      "Replacing the last end with a smaller nested end or mixing open and closed interval rules.",
    sources: [mit],
  },
  {
    id: "recall-heap-top-k",
    title: "Keep only the best k seen so far.",
    difficulty: "Foundation",
    prompt:
      "How does a min-heap of size k retain the largest k values of a stream, and what invariant supports its complexity?",
    explanation:
      "Fill a min-heap up to k. Afterward, discard values no larger than its minimum, or replace that minimum with a larger value. The heap contains the largest k values of the prefix seen so far; its root is the smallest retained candidate. Processing n values takes O(n log k) time for 1 <= k <= n and O(k) extra space. Handle k = 0 separately, and define duplicates as separate occurrences if that is the task.",
    rubric: [
      "State the retained-prefix invariant.",
      "Use a min-heap and replace only the threshold.",
      "Give O(n log k), O(k), and boundary behavior.",
    ],
    alternatives:
      "Sort a fixed array in O(n log n), or use selection when all data is available and ordered output is unnecessary.",
    pitfall:
      "Using a max-heap of size k and discarding the largest retained item.",
    sources: [
      {
        label: "Princeton priority queues",
        url: "https://algs4.cs.princeton.edu/24pq/",
      },
    ],
  },
  {
    id: "recall-quickselect",
    title: "Partitioning need not sort both sides.",
    difficulty: "Intermediate",
    prompt:
      "Why can randomized quickselect find a kth order statistic in expected linear time, and what are its worst-case and duplicate-value concerns?",
    explanation:
      "Partition around a pivot, then recurse only into the partition containing the desired rank. Random pivots give expected O(n) total partition work, but repeatedly extreme pivots can produce O(n squared) worst-case time. A three-way partition groups values below, equal to, and above the pivot, so ranks in the equal range finish immediately. Be explicit about zero- versus one-based rank and in-place mutation.",
    rubric: [
      "Recurse into only the relevant rank partition.",
      "Distinguish expected O(n) from worst-case O(n squared).",
      "Handle equal values and rank indexing.",
    ],
    alternatives:
      "Median-of-medians gives worst-case linear selection with more implementation cost; sorting gives a simple O(n log n) bound.",
    pitfall:
      "Claiming randomized selection is always linear or recursing into both partitions as if sorting were required.",
    sources: [
      {
        label: "Princeton quicksort and selection",
        url: "https://algs4.cs.princeton.edu/23quicksort/",
      },
    ],
  },
  {
    id: "recall-dijkstra",
    title: "The smallest unsettled distance becomes final.",
    difficulty: "Intermediate",
    prompt:
      "What invariant justifies Dijkstra's algorithm, and why do negative edges break it?",
    explanation:
      "With nonnegative edge weights, the smallest tentative-distance vertex cannot later receive a shorter route through an unsettled vertex: that route must already cost at least the chosen distance before adding more edges. Settle it and relax outgoing edges. A binary heap with adjacency lists supports O((V + E) log V) for a standard decrease-key implementation. A lazy heap may hold O(E) entries and should skip stale distances; its precise bound depends on graph representation.",
    rubric: [
      "State the nonnegative-weight finalization argument.",
      "Describe relaxation and stale-entry handling if used.",
      "Give complexity with the chosen heap model.",
    ],
    alternatives:
      "BFS handles unit weights; Bellman-Ford supports negative edges and detects reachable negative cycles.",
    pitfall:
      "Finalizing a vertex on discovery or using Dijkstra unchanged with negative weights.",
    sources: [mit],
  },
  {
    id: "recall-topological-sort",
    title: "An unprocessed predecessor blocks a task.",
    difficulty: "Foundation",
    prompt:
      "How does Kahn's algorithm order a directed acyclic graph, and how does it detect a cycle?",
    explanation:
      "Compute indegrees and queue all zero-indegree vertices. Repeatedly output one and decrement each outgoing neighbor's indegree, queueing it when it reaches zero. A queued vertex has no unprocessed predecessor, so emitting it preserves the dependency order. If fewer than V vertices are emitted, the remaining subgraph contains a directed cycle. Time is O(V + E), extra space O(V) beyond the graph.",
    rubric: [
      "Explain zero-indegree eligibility.",
      "Update each outgoing edge once.",
      "Detect a cycle by incomplete output and state complexity.",
    ],
    alternatives:
      "DFS reverse finishing order works with explicit cycle detection; a priority queue can choose a deterministic smallest eligible vertex at extra cost.",
    pitfall:
      "Assuming a topological order exists for every directed graph or forgetting disconnected vertices.",
    sources: [mit],
  },
  {
    id: "recall-disjoint-set",
    title: "Connectivity changes without rebuilding the graph.",
    difficulty: "Intermediate",
    prompt:
      "What do union-find's representative, path compression, and union by rank/size accomplish, and which graph operation is outside the basic structure's contract?",
    explanation:
      "Each set is represented by a rooted parent tree. find follows parents and compresses the path; union attaches roots using size or rank to avoid tall trees. Across a sequence of operations, these heuristics give near-constant amortized O(alpha(n)) cost, not a literal constant worst case per call. The basic structure supports merging connectivity, not arbitrary edge deletion or reconstructing an actual graph path.",
    rubric: [
      "Explain representatives and both heuristics.",
      "State the amortized bound accurately.",
      "Identify deletion/path-query limits.",
    ],
    alternatives:
      "BFS/DFS is simpler for one static connectivity query; rollback or dynamic-connectivity structures solve different workloads.",
    pitfall:
      "Attaching arbitrary non-root nodes or interpreting the parent forest as the graph's original edges.",
    sources: [
      {
        label: "Princeton union-find",
        url: "https://algs4.cs.princeton.edu/15uf/",
      },
    ],
  },
  {
    id: "recall-iterative-dfs",
    title: "A stack can replace recursion, but order still matters.",
    difficulty: "Foundation",
    prompt:
      "How would you traverse a deep graph without recursion overflow, and what extra state is needed when you need DFS exit times rather than only reachability?",
    explanation:
      "Use an explicit stack and a visited set for reachability, marking on scheduling to avoid repeated work. To reproduce recursive entry/exit behavior, keep frames with a vertex and next-neighbor position, or explicit enter/exit events. A stack of vertex IDs alone does not automatically reproduce recursive finishing order. Adjacency-list traversal costs O(V + E) time and O(V) auxiliary visited/frame state with a bounded scheduling policy.",
    rubric: [
      "Use explicit stack state and avoid duplicate scheduling.",
      "Distinguish reachability from recursive exit semantics.",
      "State graph complexity and deep-input behavior.",
    ],
    alternatives:
      "BFS is suitable when only reachability or unweighted distances are needed.",
    pitfall:
      "Using an arbitrary stack pop order as a valid DFS finishing order for cycle or topological reasoning.",
    sources: [mit],
  },
  {
    id: "recall-binary-answer",
    title: "Search the answer only after proving monotonicity.",
    difficulty: "Intermediate",
    prompt:
      "Given positive package weights in fixed order, why can you binary-search the smallest ship capacity that finishes within D days?",
    explanation:
      "For a fixed capacity, greedily fill each day until the next package would exceed it, then start another day. This minimizes days under that capacity because sending a shorter prefix cannot let later days start farther ahead. Feasibility is monotone: more capacity cannot require more days. Search from the largest weight to the total weight. Each check is O(n), giving O(n log S) time over an integer range of size on the order of total weight S and O(1) extra space.",
    rubric: [
      "Prove or justify the greedy feasibility test.",
      "State the monotone direction and valid bounds.",
      "Include check cost and integer-range complexity.",
    ],
    alternatives:
      "Direct enumeration can be sufficient when the capacity range is tiny.",
    pitfall:
      "Binary-searching a nonmonotone score or allowing reordering when the problem requires fixed order.",
    sources: [mit],
  },
  {
    id: "recall-dp-state",
    title: "A memo key must contain the future's relevant facts.",
    difficulty: "Foundation",
    prompt:
      "What makes a dynamic-programming state sufficient, and how do you estimate its time complexity?",
    explanation:
      "Two histories may share one state only if their remaining choices and objective contribution are equivalent given that state. Identify the subproblem, transitions, base cases, and an acyclic evaluation order or terminating recursion. Estimate reachable states times work per state, including transition enumeration and copying. Memoization removes repeated subproblems; it does not make exponentially many distinct states polynomial.",
    rubric: [
      "Explain why the state summarizes all relevant history.",
      "Define transitions and base cases.",
      "Count states and transition work.",
    ],
    alternatives:
      "A greedy invariant can remove state when a proof supports it; otherwise brute force provides a small-instance correctness oracle.",
    pitfall:
      "Memoizing by index alone when remaining capacity or previous choices affect the future.",
    sources: [mit],
  },
  {
    id: "recall-knapsack-direction",
    title: "Loop direction decides whether an item is reusable.",
    difficulty: "Intermediate",
    prompt:
      "In one-dimensional 0/1 knapsack DP with positive item weights, why do capacities run downward for each item? What changes for unbounded reuse?",
    explanation:
      "When updating dp[c] from dp[c - weight] for a 0/1 item, descending c ensures the source still represents the previous item set, so the current item is used at most once. Ascending c can read a state already improved by that same item, allowing repeated use. That is appropriate for an unbounded version under its assumptions. Time is O(nC), space O(C), which is pseudopolynomial in numeric capacity rather than polynomial in its bit length.",
    rubric: [
      "Connect descending order to the previous-item invariant.",
      "Explain ascending reuse.",
      "State O(nC), O(C), and pseudopolynomial meaning.",
    ],
    alternatives:
      "A two-dimensional item-by-capacity table makes the dependency explicit at higher space cost.",
    pitfall:
      "Changing loop direction for convenience while silently changing 0/1 selection into unbounded selection.",
    sources: [mit],
  },
  {
    id: "recall-lis-tails",
    title: "The smallest tail leaves room to grow.",
    difficulty: "Intermediate",
    prompt:
      "What does tails[i] mean in the O(n log n) longest strictly increasing subsequence algorithm, and is the tails array itself necessarily a subsequence?",
    explanation:
      "tails[i] is the smallest possible ending value of an increasing subsequence of length i + 1 in the processed prefix. For each value, replace the first tail greater than or equal to it, or append if none exists. Smaller tails preserve more extension possibilities. Binary search gives O(n log n) time and O(n) space. Entries may come from incompatible histories, so reconstructing an actual subsequence needs predecessor and representative-index tracking.",
    rubric: [
      "State the minimal-tail invariant.",
      "Use lower_bound semantics for strict increase.",
      "Distinguish length computation from reconstruction.",
    ],
    alternatives:
      "O(n squared) DP is simple and useful for reconstruction or small inputs; nondecreasing subsequences use a different equality boundary.",
    pitfall:
      "Returning tails as the actual subsequence or letting equal values extend a strictly increasing sequence.",
    sources: [mit],
  },
  {
    id: "recall-backtrack-restore",
    title: "Each sibling starts from the same parent state.",
    difficulty: "Foundation",
    prompt:
      "What must choose, recurse, and undo preserve in an in-place backtracking search? How does pruning differ from memoization?",
    explanation:
      "Before exploring a child, modify the current candidate and constraint state. After returning, restore exactly the parent state so a sibling does not inherit the child's choices. Copy completed results when mutable storage will be reused. Pruning skips branches proven infeasible or unable to improve the objective; memoization reuses equivalent subproblem results. Complexity depends on the search tree and per-node work, and can remain exponential despite useful pruning.",
    rubric: [
      "State the parent-state restoration invariant.",
      "Avoid aliasing stored mutable results.",
      "Distinguish pruning, memoization, and worst-case search size.",
    ],
    alternatives:
      "Immutable copies simplify restoration at a copying cost; explicit frames can avoid recursion-depth limits.",
    pitfall:
      "Appending the same mutable path object to every result or pruning without a correctness argument.",
    sources: [mit],
  },
  {
    id: "recall-trie-prefix",
    title: "A prefix is a path, not always a complete word.",
    difficulty: "Foundation",
    prompt:
      "How does a trie support prefix lookup, and why does a terminal marker matter? What memory tradeoff should you mention?",
    explanation:
      "Follow one edge per character. Reaching a node proves that a stored key has that prefix, but only a terminal marker proves the exact word exists. Lookup or insertion is O(L) for key length L under constant-time child access. Dense child arrays can waste memory on sparse alphabets; maps reduce empty slots but add lookup overhead. Unicode normalization and the chosen unit of character processing belong to the input contract.",
    rubric: [
      "Separate prefix existence from exact-word membership.",
      "State length-based complexity and child-access assumptions.",
      "Explain dense versus sparse memory choices.",
    ],
    alternatives:
      "A sorted string set with prefix-range searches can be simpler for a mostly static dictionary.",
    pitfall:
      "Returning true for every visited prefix as if it were a complete inserted word.",
    sources: [
      {
        label: "Princeton tries",
        url: "https://algs4.cs.princeton.edu/52trie/",
      },
    ],
  },
  {
    id: "recall-tree-postorder",
    title: "Compute a parent after its children.",
    difficulty: "Foundation",
    prompt:
      "Why is postorder natural for tree height or subtree sums, and how much stack space can recursive traversal use?",
    explanation:
      "A parent's result depends on already computed child results: height is one plus the maximum child height, while a subtree sum combines the node and child sums. Postorder evaluates children before their parent. A traversal visits n nodes in O(n) time, with O(h) active recursion for height h; a skewed tree can make h = n. Define whether empty height is -1 or 0 and use that convention consistently.",
    rubric: [
      "Explain the child-before-parent dependency.",
      "Give an explicit empty/base convention.",
      "Distinguish balanced O(log n) depth from worst-case O(n).",
    ],
    alternatives:
      "Explicit stack frames can avoid a runtime recursion limit, while breadth-first traversal can compute height by levels using width-dependent space.",
    pitfall:
      "Claiming every binary-tree traversal uses only O(log n) stack space.",
    sources: [mit],
  },
  {
    id: "recall-bst-bounds",
    title: "Local child checks cannot validate a search tree.",
    difficulty: "Foundation",
    prompt:
      "Why is checking left child < parent < right child insufficient to validate a binary search tree, and what invariant works?",
    explanation:
      "A deeper node must satisfy bounds imposed by every ancestor, not just its parent. Recurse with an allowed interval: a left subtree tightens the upper bound and a right subtree tightens the lower bound. Define whether duplicates are allowed and on which side. An inorder traversal with the appropriate monotonicity condition is another approach. Validation is O(n) time and O(h) stack space, without arithmetic sentinel tricks that can overflow at integer extremes.",
    rubric: [
      "Identify an ancestor-bound counterexample.",
      "Propagate valid bounds consistently.",
      "Define duplicate policy and complexity.",
    ],
    alternatives:
      "Inorder validation works with a retained previous value and a clearly defined duplicate rule.",
    pitfall:
      "Only comparing immediate children or subtracting one from a minimum integer bound.",
    sources: [
      {
        label: "Princeton binary search trees",
        url: "https://algs4.cs.princeton.edu/32bst/",
      },
    ],
  },
  {
    id: "recall-tree-lca",
    title: "Two subtrees can identify an ancestor.",
    difficulty: "Intermediate",
    prompt:
      "For a general binary tree with two distinct target nodes guaranteed present, how does a recursive lowest-common-ancestor search work, and what changes if presence is not guaranteed?",
    explanation:
      "Return a target node when encountered, otherwise combine results from left and right children. If both are nonnull, the current node is the lowest split joining the targets; if one is nonnull, pass it upward. This is O(n) time and O(h) recursion space. The presence guarantee matters: the same algorithm may return the only existing target when the other is absent. Without that guarantee, also track found-target evidence or verify membership.",
    rubric: [
      "Explain the split and pass-up cases.",
      "Use node identities and the presence assumption.",
      "Handle absent targets and complexity deliberately.",
    ],
    alternatives:
      "Parent pointers let you intersect ancestor chains; many static-tree queries can justify preprocessing.",
    pitfall:
      "Using BST value ordering on an arbitrary binary tree or ignoring a missing-target requirement.",
    sources: [mit],
  },
  {
    id: "recall-amortized-array",
    title: "Occasional expensive growth can still average constant.",
    difficulty: "Foundation",
    prompt:
      "Why does doubling a dynamic array give amortized O(1) append, while growing capacity by one each time does not?",
    explanation:
      "Across n appends with geometric growth, copied capacities form a geometric series whose total is O(n), plus the n ordinary writes. A single append can still cost O(n) when it copies existing elements; the amortized bound concerns a sequence of operations. Growing by one copies 1 + 2 + ... + (n-1), giving O(n squared) total work. Geometric growth trades unused capacity for fewer reallocations.",
    rubric: [
      "Sum geometric copying across operations.",
      "Distinguish amortized from worst-case per operation.",
      "Contrast linear growth and memory tradeoffs.",
    ],
    alternatives:
      "Chunked storage can avoid moving every element at once but changes locality and indexing tradeoffs.",
    pitfall:
      "Calling amortized constant time a probabilistic average over random inputs.",
    sources: [mit],
  },
  {
    id: "recall-hash-complexity",
    title: "Expected constant lookup has assumptions.",
    difficulty: "Foundation",
    prompt:
      "When is hash-table lookup expected O(1), and why is that not an unconditional worst-case guarantee?",
    explanation:
      "With a suitable hash distribution and controlled load factor, expected bucket/probe work is bounded. Collisions, adversarial keys, resizing, and expensive key hashing/equality affect real cost. Basic collision-handling schemes can degrade to linear lookup in the number of stored entries. State the implementation model; some runtimes add tree buckets or randomized hashing. A key of length L may itself require O(L) hashing even when the table probes are expected constant.",
    rubric: [
      "State distribution and load-factor assumptions.",
      "Mention collision and key-cost limits.",
      "Separate expected, amortized, and worst-case claims.",
    ],
    alternatives:
      "Balanced ordered trees provide deterministic O(log n) structural operations and ordered traversal.",
    pitfall:
      "Treating every hash operation as a literal constant regardless of key size, collisions, or implementation.",
    sources: [mit],
  },
  {
    id: "recall-counting-sort",
    title: "A bounded key range changes the sorting cost.",
    difficulty: "Foundation",
    prompt:
      "How does counting sort achieve O(n + K) time for integer keys in a range of size K, and when is it a poor choice?",
    explanation:
      "Count key occurrences in a K-sized array. Counts can emit sorted keys directly, or cumulative counts can place full records stably when processed in the correct order. Time and auxiliary count space depend on K, not merely n; a huge sparse numeric domain can make it impractical. The comparison-sorting lower bound does not forbid this result because the algorithm exploits key structure beyond pairwise comparisons.",
    rubric: [
      "Explain counting and output placement.",
      "State range-dependent time/space and stability needs.",
      "Relate the model to comparison-sort bounds.",
    ],
    alternatives:
      "Comparison sorting handles arbitrary ordered keys; radix sorting uses bounded-digit passes with additional assumptions.",
    pitfall:
      "Calling counting sort O(n) while ignoring an unbounded or enormous key range.",
    sources: [mit],
  },
  {
    id: "recall-bitmask-state",
    title: "A compact set can still describe exponentially many states.",
    difficulty: "Intermediate",
    prompt:
      "For a shortest tour over k required locations, why might DP use (visited_mask, last), and what costs remain despite representing the set as an integer?",
    explanation:
      "Future choices depend on which locations were visited and the current endpoint. A mask encodes the visited subset; last identifies the endpoint. A typical transition tries an unvisited next location, yielding O(2^k k squared) time and O(2^k k) stored states. Compact representation does not remove the exponential number of subsets. Specify machine-integer/bit-operation limits and edge feasibility, and keep unreachable states distinct from valid zero-cost paths.",
    rubric: [
      "Explain why subset and endpoint are both needed.",
      "Count states and transitions.",
      "Acknowledge exponential scale and representation limits.",
    ],
    alternatives:
      "Backtracking with pruning can suit tiny instances; approximation or problem-specific structure may be necessary at larger k.",
    pitfall:
      "Claiming a bitmask makes exponential subset enumeration linear or memoizing only the visited set when endpoints matter.",
    sources: [mit],
  },
  {
    id: "recall-bellman-ford",
    title: "One more improvement can expose a negative cycle.",
    difficulty: "Intermediate",
    prompt:
      "Why does Bellman-Ford use up to V−1 edge-relaxation passes, and what does a further possible improvement mean?",
    explanation:
      "After i full passes, the distance bounds include shortest paths using at most i edges. Without a reachable negative cycle, a shortest simple path uses at most V−1 edges. An additional reachable relaxation indicates a reachable negative cycle; only vertices reachable from such a cycle lack a finite minimum through it. Skip relaxations from infinity. Standard time is O(VE), with O(V) distance/predecessor state beyond the graph; an unchanged pass allows early termination.",
    rubric: [
      "State the edge-count induction.",
      "Explain V−1 and reachable negative-cycle detection.",
      "Handle infinity and report complexity.",
    ],
    alternatives:
      "Dijkstra is faster under nonnegative weights; a DAG can be relaxed in topological order even with negative edges.",
    pitfall:
      "Reporting an unreachable negative cycle as affecting the source's paths, or adding an edge weight to an infinity sentinel without guarding it.",
    sources: [mit],
  },
];

export const additionalCards: RecallCard[] = systemCards.flatMap<RecallCard>(
  (card, index) => [
    { ...card, topic: "System design" },
    { ...algorithmCards[index]!, topic: "Algorithms" },
  ],
);
