export type RecallCard = {
  id: string;
  title: string;
  topic: "System design" | "Algorithms";
  difficulty: "Foundation" | "Intermediate";
  prompt: string;
  explanation: string;
  rubric: string[];
  alternatives: string;
  pitfall: string;
  sources: { label: string; url: string }[];
};

const algorithms = {
  label: "MIT 6.006 lecture notes",
  url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
};

// Original questions. Shared IDs are permanent; private cards use a separate namespace.
export const recallCards: RecallCard[] = [
  {
    id: "recall-cache-aside",
    title: "A cache is not the source of truth.",
    topic: "System design",
    difficulty: "Foundation",
    prompt:
      "Your API uses cache-aside for restaurant menus. What happens on a cache miss, and what can go wrong after a menu changes?",
    explanation:
      "Read the cache first. On a miss, fetch the menu from the database, then cache it with an expiry. A write updates the database and invalidates or refreshes the cached entry. An older concurrent reader can still repopulate stale data after invalidation. Expiry bounds some stale reads; stricter freshness may need version checks or a different write/read protocol. ElastiCache can hold the hot entries; RDS PostgreSQL remains the durable source.",
    rubric: [
      "Describe the miss path through the database.",
      "Explain invalidation and the concurrent stale-fill race.",
      "Choose a freshness budget and consider cache failure.",
    ],
    alternatives:
      "Skip caching when the database already meets the load. Versioned keys or write-through caching can fit different consistency needs.",
    pitfall:
      "Calling a TTL a strong consistency guarantee, or failing the entire API whenever the cache is unavailable.",
    sources: [
      {
        label: "AWS caching strategies",
        url: "https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html",
      },
    ],
  },
  {
    id: "recall-binary-search",
    title: "Find the first true position.",
    topic: "Algorithms",
    difficulty: "Foundation",
    prompt:
      "A predicate is false and then true across indices 0 through n−1. Describe a binary search for the first true index, including the all-false case and its invariant.",
    explanation:
      "Keep a half-open candidate range [lo, hi), initially [0, n). Everything before lo is false; everything at or after hi is true when it is a real index. Test mid = lo + floor((hi − lo) / 2). If true, set hi = mid. Otherwise set lo = mid + 1. The range shrinks every iteration. When lo equals hi, return lo; n means no true index. With an O(1) predicate, time is O(log n), extra space O(1).",
    rubric: [
      "State the monotone predicate and half-open invariant.",
      "Give both updates and explain termination.",
      "Return n for all false; handle n = 0.",
    ],
    alternatives:
      "An inclusive range with a separate best answer works if its invariant and boundary updates are consistent.",
    pitfall:
      "Using hi = mid − 1 with this half-open invariant, or assuming arbitrary data gives a monotone predicate.",
    sources: [algorithms],
  },
  {
    id: "recall-idempotent-order",
    title: "A retry must not place another order.",
    topic: "System design",
    difficulty: "Intermediate",
    prompt:
      "A checkout request times out after the database commits. How can the client retry without creating a second order?",
    explanation:
      "Have the client reuse one idempotency key for the same logical checkout. Scope it to the authenticated customer, validate the payload, and atomically store the order and key/result under a unique constraint. A retry returns the recorded outcome; a reused key with different order details is rejected. A crash between separate key and order writes must not leave an inconsistent result. A downstream payment needs its own idempotency mechanism or a durable workflow.",
    rubric: [
      "Reuse a customer-scoped key across retries.",
      "Enforce uniqueness and commit key/result with the order.",
      "Handle different payloads and downstream side effects.",
    ],
    alternatives:
      "A client-generated order ID can provide the uniqueness boundary. A transactional outbox can coordinate later work.",
    pitfall:
      "Generating a fresh key on each retry, or claiming a database transaction also atomically commits an external payment.",
    sources: [
      {
        label: "PostgreSQL constraints",
        url: "https://www.postgresql.org/docs/current/ddl-constraints.html",
      },
    ],
  },
  {
    id: "recall-sliding-window",
    title: "When does a sliding window work?",
    topic: "Algorithms",
    difficulty: "Intermediate",
    prompt:
      "For nonnegative integers, find the shortest contiguous subarray whose sum is at least K > 0. Explain a linear sliding window and why negative numbers break its reasoning.",
    explanation:
      "Extend the right end and add its value. While the sum is at least K, record the length, remove the leftmost value, and advance left. Nonnegative values make extending unable to lower the sum and shrinking unable to raise it, so discarding a left boundary is safe. Each index enters and leaves once: O(n) time and O(1) extra space. With negatives, an invalid window can become valid just by shrinking, so this rule can miss answers.",
    rubric: [
      "Shrink repeatedly while valid, recording candidates first.",
      "Use nonnegativity to justify discarding boundaries.",
      "Explain O(n) pointer movement and the negative-number limitation.",
    ],
    alternatives:
      "With negative values, prefix sums and a monotonic deque solve the shortest-at-least-K version in O(n); binary search on an arbitrary window sum does not restore monotonicity.",
    pitfall:
      "Using the nonnegative-window algorithm unchanged for arrays with negative values.",
    sources: [algorithms],
  },
  {
    id: "recall-queue-redelivery",
    title: "A message can arrive twice.",
    topic: "System design",
    difficulty: "Foundation",
    prompt:
      "An Amazon SQS standard-queue worker emails order receipts. It sends an email, then crashes before deleting the message. What must the design account for?",
    explanation:
      "Standard queues provide at-least-once delivery. After the visibility timeout, another worker can receive the message, and duplicates can also occur independently. Delete only after successful processing, extend visibility for long work, and use a stable business event ID for deduplication. A database sent flag alone cannot atomically cover an external email send; use an email provider with idempotency support, or explicitly accept and limit rare duplicate receipts. A dead-letter queue handles repeatedly failing work.",
    rubric: [
      "Explain redelivery and visibility timeout.",
      "Use stable event IDs and delete after processing.",
      "Identify the external-send crash window and a practical policy.",
    ],
    alternatives:
      "A transactional outbox ensures an order event is durably published. FIFO deduplication can help publishing but does not make an arbitrary email side effect exactly once.",
    pitfall:
      "Promising exactly-once external effects because the queue is FIFO or because a worker checks a flag.",
    sources: [
      {
        label: "SQS at-least-once delivery",
        url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html",
      },
    ],
  },
  {
    id: "recall-bfs-shortest",
    title: "Why does BFS find a shortest path?",
    topic: "Algorithms",
    difficulty: "Foundation",
    prompt:
      "In an unweighted graph, why does BFS give shortest path lengths from one source? When should a vertex be marked visited?",
    explanation:
      "A FIFO queue processes vertices in nondecreasing distance from the source. When a vertex at distance d discovers a neighbor for the first time, that neighbor gets distance d + 1; no later discovery can offer fewer edges. Mark visited when enqueuing, so multiple parents do not enqueue the same vertex. Store a predecessor to reconstruct a path. With adjacency lists, time is O(V + E) and extra space O(V).",
    rubric: [
      "Explain the distance-layer invariant.",
      "Mark vertices at enqueue time.",
      "State the unweighted assumption and complexity.",
    ],
    alternatives:
      "Use multi-source BFS for distance from the nearest source. Use 0–1 BFS for weights 0 and 1, or Dijkstra for general nonnegative weights.",
    pitfall:
      "Treating fewer edges as smaller total weight in a weighted graph.",
    sources: [algorithms],
  },
  {
    id: "recall-replica-freshness",
    title: "A read replica can be behind.",
    topic: "System design",
    difficulty: "Foundation",
    prompt:
      "You add an RDS PostgreSQL read replica. A customer places an order, refreshes, and sees no order. Explain a plausible cause and a way to preserve their read-after-write experience.",
    explanation:
      "RDS read replicas receive changes asynchronously. A write can commit on the primary before the replica applies it. Route freshness-sensitive reads, such as the confirmation page, to the primary. Another option is to track a write position and wait for a replica to catch up, with a bounded fallback. Replicas can scale eligible reads; they do not remove primary write limits or automatically provide strong freshness.",
    rubric: [
      "Identify asynchronous replication lag.",
      "Route read-after-write requests appropriately.",
      "Distinguish read scaling from write scaling and failover.",
    ],
    alternatives:
      "Return the committed order in the write response and keep it in the UI while reconciling. Measure lag and define which reads can tolerate staleness.",
    pitfall:
      "Assuming a successful write means every replica can immediately serve it, or equating a read replica with every Multi-AZ deployment.",
    sources: [
      {
        label: "RDS read replicas",
        url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html",
      },
    ],
  },
  {
    id: "recall-monotonic-stack",
    title: "Find the next warmer day.",
    topic: "Algorithms",
    difficulty: "Intermediate",
    prompt:
      "For every temperature, find the distance to the next strictly warmer day. What does a monotonic stack store, and why is the total work linear?",
    explanation:
      "Store indices of unresolved days in a stack whose temperatures are nonincreasing from bottom to top. At index i, pop while the temperature at the top is strictly smaller than today’s. For each popped index j, answer i − j: no intervening day was warmer, or it would already have resolved j. Push i. Each index is pushed once and popped at most once, giving O(n) total time and O(n) extra space. Remaining indices have no warmer day.",
    rubric: [
      "Store indices and state the monotone invariant.",
      "Pop only strictly colder days and compute the distance.",
      "Use amortized counting rather than claiming each loop is constant.",
    ],
    alternatives:
      "A reverse scan can keep candidate future days, removing temperatures that cannot answer the current day.",
    pitfall:
      "Popping equal temperatures when the question asks for a strictly warmer day, or storing only temperatures and losing positions.",
    sources: [algorithms],
  },
  {
    id: "recall-object-storage",
    title: "Objects and rows have different jobs.",
    topic: "System design",
    difficulty: "Foundation",
    prompt:
      "A restaurant uploads menu photos. Why put bytes in Amazon S3 and metadata in PostgreSQL? What does a presigned upload URL authorize?",
    explanation:
      "S3 stores the image objects; PostgreSQL stores ownership, approved object keys, and relational metadata. A presigned URL temporarily authorizes a particular signed operation on a specified object, subject to its signing credentials and applicable policies. Treat it as a bearer credential. It does not validate image contents or make an object public. Upload into a private staging location, validate, and promote to a separate serving key or pin an approved version before publication.",
    rubric: [
      "Separate object bytes from relational metadata.",
      "Explain the limited signed operation and bearer access.",
      "Validate uploads and prevent a later overwrite of approved content.",
    ],
    alternatives:
      "Small images can live in a database when simplicity and workload justify it. A controlled proxy upload can enforce server-side validation before storage.",
    pitfall:
      "Assuming presigned URLs are single-use, or serving a staging key that remains writable after validation.",
    sources: [
      {
        label: "S3 presigned URLs",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html",
      },
    ],
  },
  {
    id: "recall-prefix-sum",
    title: "Count subarrays without trying every pair.",
    topic: "Algorithms",
    difficulty: "Intermediate",
    prompt:
      "How do prefix sums and a frequency map count contiguous subarrays with sum K when the array can contain negative numbers?",
    explanation:
      "Let prefix[0] = 0 and prefix[j] be the sum before index j. A subarray [i, j) sums to K exactly when prefix[i] = prefix[j] − K. Scan the values, maintaining a running sum and counts of earlier prefix sums. Initialize count[0] = 1. For each new sum s, add count[s − K] to the answer, then increment count[s]. With expected O(1) hash operations this takes O(n) time and O(n) extra space.",
    rubric: [
      "Derive the difference of two prefix sums.",
      "Seed zero and query before inserting the current sum.",
      "Count frequencies, including repeated prefix sums and negatives.",
    ],
    alternatives:
      "An ordered map gives O(n log n) time with deterministic ordered-map operations. For a longest-subarray variant, store earliest indices instead of counts.",
    pitfall:
      "Inserting first when K = 0 and accidentally counting an empty subarray, or using a set that loses multiplicity.",
    sources: [algorithms],
  },
];

export type PrivateCard = {
  id: string;
  title: string;
  prompt: string;
  explanation: string;
  topic: "System design" | "Algorithms";
  updatedAt: string;
};
