// One spoken-length answer per shared recall card, condensed from its explanation.
export const shortAnswers: Record<string, string> = {
  "recall-cache-aside":
    "On a miss, read the database and cache the result with a TTL; on a write, update the database and invalidate. A slow reader can still refill stale data, so a TTL is not strong freshness.",
  "recall-binary-search":
    "Keep a half-open range where everything before lo is false and everything from hi on is true. Shrink it toward the boundary and return lo, which is n when nothing is true.",
  "recall-idempotent-order":
    "The client reuses one idempotency key for the checkout, and the server stores that key with the order in one transaction under a unique constraint, so a retry gets the first result back.",
  "recall-sliding-window":
    "With nonnegative values, growing the window cannot lower the sum and shrinking cannot raise it, so each index enters and leaves once: O(n). Negative values break that.",
  "recall-queue-redelivery":
    "Standard SQS delivers at least once, so the email can go out twice. Delete after processing, deduplicate on a stable event ID, and accept or limit rare duplicate sends.",
  "recall-bfs-shortest":
    "BFS visits vertices in order of edge count from the source, so the first time it reaches a vertex is along a shortest path. Mark vertices visited when you enqueue them.",
  "recall-replica-freshness":
    "Read replicas apply changes asynchronously, so a new order may not be there yet. Send read-after-write requests to the primary, or wait until the replica has caught up.",
  "recall-monotonic-stack":
    "Keep a stack of unresolved day indices; a warmer day pops and answers each colder one. Every index is pushed and popped at most once, so the total work is O(n).",
  "recall-object-storage":
    "Bytes go in S3; ownership and metadata go in PostgreSQL. A presigned URL is a temporary bearer credential for one signed operation, and it does not validate the content.",
  "recall-prefix-sum":
    "A subarray sums to K when two prefix sums differ by K. Seed a count of zero, then for each running sum add the count of sum − K before recording the sum itself.",
  "recall-cache-stampede":
    "Every miss can reach the database before the first fill finishes. Coalesce loads per key, cap concurrency at the source, and add jitter to expiry times.",
  "recall-greedy-exchange":
    "Sort by finish time and keep taking the earliest-finishing compatible interval. Swapping it into any optimal schedule keeps that schedule valid, so the greedy count is optimal.",
  "recall-negative-cache":
    "Cache a confirmed not-found briefly to stop repeated lookups, and invalidate it when the record is created. Never cache a timeout or permission failure as not-found.",
  "recall-two-pointers":
    "If the sum is too small, the left value cannot reach the target with any remaining partner, so drop it; if it is too large, drop the right. O(n) on sorted input.",
  "recall-ttl-freshness":
    "A TTL bounds how long the entry stays in the cache, not how old its data is. A delayed reader can refill old data, so carry versions or reject stale fills.",
  "recall-cycle-pointers":
    "In a cycle the fast pointer closes the gap by one step per move, so they meet. Then restart one pointer at the head and move both one step at a time: they meet at the entry.",
  "recall-transactional-outbox":
    "Write the order and its event to an outbox table in one transaction, and let a relay publish them. Events can then repeat, so consumers must be idempotent.",
  "recall-list-reversal":
    "prev holds the reversed part and curr the rest. Save curr.next first, point curr back at prev, then advance both. When curr is null, prev is the new head.",
  "recall-backpressure":
    "The backlog grows by about 500 events a second and never drains. Add sustainable processing capacity, admit less work, or shed load if the contract allows, and watch the oldest item's age.",
  "recall-merge-intervals":
    "Sort by start; after that, only the last merged interval can overlap the next one, so either extend it or start a new interval. O(n log n) for the sort.",
  "recall-retry-jitter":
    "Three attempts at each of three layers is 3 × 3 × 3 = 27 calls at the bottom. Retry at one deliberate layer, within a total deadline, with backoff and jitter.",
  "recall-heap-top-k":
    "Keep a min-heap of the k largest values so far and replace its root whenever a larger value arrives. That is O(n log k) time and O(k) space.",
  "recall-timeout-budget":
    "Only about 300 ms remain, so the dependency call must get the remaining deadline, not a fresh 900 ms. Pass the deadline down through retries and dependencies.",
  "recall-quickselect":
    "Partition around a random pivot and recurse only into the side holding rank k: expected O(n), worst case O(n²). Use three-way partitioning for duplicates.",
  "recall-circuit-breaker":
    "A timeout bounds one wait and a rate limit bounds admitted work; a breaker stops calling a failing dependency for a while, then lets a few probes test recovery.",
  "recall-dijkstra":
    "With nonnegative weights, the closest unsettled vertex cannot get a shorter path later, so you can finalize it. A negative edge could undercut a distance already settled.",
  "recall-index-prefix":
    "The index narrows to one conversation and then reads positions in order, so the page is a short range scan. It still costs writes and storage and helps only that access pattern.",
  "recall-topological-sort":
    "Queue every vertex with zero indegree, emit one at a time, and decrement its neighbors' indegrees. If fewer than V vertices come out, the graph has a cycle.",
  "recall-write-skew":
    "Each transaction reads a valid snapshot and updates a different row, so neither conflicts, but together they break the rule. Lock a shared guard row, or use serializable and retry.",
  "recall-disjoint-set":
    "Each set is a tree whose root represents it; path compression and union by size keep trees flat, giving near-constant amortized operations. It merges sets but cannot delete edges.",
  "recall-optimistic-version":
    "Update only where the version is still 7, and increment it in the same write. One device wins; the other matches no row and must reload or merge.",
  "recall-iterative-dfs":
    "Use an explicit stack and a visited set. For exit times, push frames that hold the vertex and its next neighbor, or push explicit enter and exit events.",
  "recall-cap-partition":
    "When replicas cannot communicate, a side that keeps answering can return results no single order explains. Say per operation whether you reject requests or accept stale answers during the partition.",
  "recall-binary-answer":
    "More capacity never needs more days, so feasibility is monotone. Binary-search capacity between the heaviest package and the total, checking each guess greedily in O(n).",
  "recall-quorum-overlap":
    "R + W > N means every read quorum overlaps the latest write quorum, so a read can see the newest version. You still need versions, conflict rules, and failure handling.",
  "recall-dp-state":
    "Two paths at the same item can have different capacity left, so the state is (item, remaining capacity). That gives O(nC) states, which is pseudopolynomial in the capacity.",
  "recall-hot-shard":
    "Even key distribution does not mean even traffic: one hot key always lands on one shard. Cache its reads, replicate it, split its work, or limit its traffic.",
  "recall-knapsack-direction":
    "Going downward means dp[c − w] still reflects the previous items, so each item is used once. Going upward lets an item reuse itself, which is the unbounded version.",
  "recall-consistent-hash":
    "With modulo, changing the node count remaps most keys; on a hash ring, mostly the keys next to the changed node move. It does not solve replication, migration, or hot keys.",
  "recall-lis-tails":
    "tails[i] is the smallest ending value of any increasing subsequence of length i + 1. Binary-search each value's position for O(n log n); tails itself need not be a real subsequence.",
  "recall-token-bucket":
    "Tokens refill at rate r up to B, so an idle client can burst B and then sustain r. Independent full buckets on k replicas admit roughly k times the intended limit.",
  "recall-backtrack-restore":
    "Choose, recurse, then undo exactly what you changed so each sibling starts from the parent's state. Pruning skips hopeless branches; memoization reuses repeated subproblem results.",
  "recall-socket-resume":
    "Keep a durable cursor of the last applied message. Fetch-then-subscribe can miss a message committed in between, so subscribe first, catch up from the cursor, and deduplicate by ID.",
  "recall-trie-prefix":
    "Walk one edge per character: reaching a node proves a prefix exists, but only a terminal marker proves the whole word. Lookups are O(L), and child arrays trade memory for speed.",
  "recall-keyset-page":
    "Continue after the last row's unique sort key instead of skipping OFFSET rows, so each page is an index seek. Add a tie-breaker, and still check authorization on every request.",
  "recall-tree-postorder":
    "A node's height or sum depends on its children's results, so compute the children first. It is O(n) time and O(h) stack, and h can reach n in a skewed tree.",
  "recall-cdn-origin":
    "No. OAC only proves to S3 that CloudFront is asking. Who may view a file is a separate decision, enforced with signed URLs, signed cookies, or another check.",
  "recall-bst-bounds":
    "Every node must respect bounds from all of its ancestors, not just its parent. Pass a lower and upper bound down the recursion and tighten them at each step.",
  "recall-signed-url-revoke":
    "S3 checks the URL's signature, expiry, and policies, not your app's membership table, so the link keeps working until one of those changes. Use short expiry when access must be revocable.",
  "recall-tree-lca":
    "Return a target when you find it. If both subtrees return something, this node is the lowest common ancestor; otherwise pass the non-null result up. O(n) time, O(h) space.",
  "recall-tail-latency":
    "p99 means about 99% of requests finish at or below that time, and the average hides the slow 1%. Merge histograms across instances; averaging per-instance p99 values is wrong.",
  "recall-amortized-array":
    "Doubling makes the total copying a geometric series under 2n, so appends average O(1). Growing by one copies 1 + 2 + … + (n − 1), which is O(n²).",
  "recall-littles-law":
    "L = λW, so 100 requests a second × 0.2 seconds is about 20 in flight on average. It is a steady-state average, not a peak or a connection-pool size.",
  "recall-hash-complexity":
    "Lookups are expected O(1) with a good hash and a bounded load factor. Collisions, adversarial keys, and expensive hashing can make a single lookup much slower.",
  "recall-rpo-rto":
    "RPO is how much data you can afford to lose; RTO is how long recovery may take. A successful backup proves neither until you have restored it and timed the whole service.",
  "recall-counting-sort":
    "Count each key in an array of size K, then read the counts back in order: O(n + K). It is a poor fit when K is huge or the keys are sparse.",
  "recall-event-order":
    "Arrival order is not business order, so give each order a version or sequence and apply only newer, legal transitions. Duplicates then become no-ops.",
  "recall-bitmask-state":
    "What remains depends on which stops you have visited and where you are now, so the state is (mask, last). That is O(2^k · k²) time, still exponential.",
  "recall-observability-signals":
    "Metrics show that checkout is slow and how often; traces show which span takes the time; logs explain what happened in that request. Correlate them by trace ID.",
  "recall-bellman-ford":
    "After i passes you have every shortest path using up to i edges, and a simple path needs at most V − 1. Any improvement on pass V means a reachable negative cycle.",
  "recall-fanout-budget":
    "80 posts × 250 readers is about 20,000 timeline writes a second on average, but one 2-million-follower post dominates. Consider merging heavy authors' posts at read time.",
  "recall-heap-merge":
    "Keep each stream's current head in a min-heap. Pop the smallest, then push the next item from that same stream: about O(n log k) time and O(k) space.",
  "recall-snapshot-watermark":
    "Pin every snapshot page to one generation with a watermark W, then apply only changes after W. If the retained log no longer reaches W, take a fresh snapshot.",
  "recall-state-bfs":
    "Two arrivals at the same cell can have different breaks left, so the BFS state is (row, column, breaks left), giving O(R·C·k) states.",
  "recall-multipart-publish":
    "Complete the upload with the ordered parts, verify the final object's size and checksum, then point metadata at that exact version. Clean up abandoned uploads separately.",
  "recall-stream-median":
    "Keep a max-heap for the lower half and a min-heap for the upper half, with the lower one equal or one larger. The median is its top or the average of both tops.",
  "recall-writer-fencing":
    "Give each lease holder an increasing fencing token, and have the protected store reject writes with an older token. Rechecking the lease inside the worker is not enough.",
  "recall-edit-distance":
    "d[i][j] is the cost of turning the first i characters into the first j. Take the cheapest of delete, insert, or substitute-or-match, with d[i][0] = i and d[0][j] = j.",
  "recall-coordinated-recovery":
    "Find the newest point where the manifest and every file it references are both in the recovery region, and measure that point's age. Database lag alone does not show it.",
  "recall-ring-buffer":
    "Track head and a live count, and write at (head + count) mod capacity. The count tells full from empty when both would point at the same slot.",
  "recall-ranking-snapshot":
    "Put a ranking generation, the last position, and a tie-breaker in the cursor, and keep that generation alive. Still check current visibility before returning each post.",
  "recall-tree-path-sum":
    "Return the best one-branch path down from each node, but score the path through both children separately. Start the best at negative infinity for all-negative trees.",
  "recall-replication-failover":
    "Asynchronous replication can lose commits the standby had not received; synchronous replication closes that gap at the cost of latency and stalled commits. Fence the old primary either way.",
  "recall-shard-key":
    "Choose a key that spreads load across many values and that your main queries include. Tenant ID keeps queries local but needs a plan for one very large tenant.",
  "recall-lb-health":
    "Route on a local health check, not a dependency check, or one slow shared database marks every server unhealthy at once. Drain servers before removing them.",
  "recall-https-path":
    "DNS resolves the name, TCP opens a reliable stream, TLS authenticates the server and encrypts the channel, then HTTP sends the request. Reusing the connection skips the setup.",
  "recall-tcp-stream":
    "Not a bug: TCP is an ordered byte stream with no message boundaries. Frame messages yourself, for example with a length prefix, and read until each one is complete.",
  "recall-partitioned-log":
    "Same key, same partition, so order holds per device but not across the topic. Each partition has one consumer per group, so 12 partitions cap a group at 12 active consumers.",
  "recall-consumer-offset":
    "Save the offset first and a crash loses messages; write first and a crash replays them. Choose at-least-once with an idempotent write, or commit the offset with the rows.",
  "recall-event-time":
    "Window by event time, emit when the watermark passes the window's end, and decide explicitly whether late events are dropped, update the result, or go to a side output.",
  "recall-schema-evolution":
    "Old and new code must read each other's data. Add fields freely, never change or reuse a field number, and reserve the numbers of fields you remove.",
  "recall-safe-rollout":
    "Ship it in two steps: first a version that reads both formats, then one that writes the new format. Release each to a small slice first, with automatic rollback.",
  "recall-merge-sort":
    "Split, sort each half, and merge with two pointers: T(n) = 2T(n/2) + O(n), so O(n log n) on every input. It needs O(n) extra space and is stable.",
  "recall-quicksort":
    "Partition around a pivot and recurse on both sides in place: expected O(n log n), but O(n²) when pivots are extreme. Randomize the pivot; it is not stable.",
  "recall-sort-choice":
    "Merge sort is worst-case n log n, stable, with O(n) space. Quicksort is expected n log n, in place, not stable. Heapsort is worst-case n log n, in place, not stable.",
  "recall-heap-structure":
    "Children of i sit at 2i + 1 and 2i + 2, and every parent is at least its children. Insert sifts up and delete-max sifts down, both O(log n); building is O(n).",
  "recall-recurrence-cost":
    "Halving with constant work is O(log n); two halves with linear work is O(n log n); shrinking by one with linear work is O(n²); two calls on n − 1 is O(2ⁿ).",
  "recall-recursion-pitfalls":
    "Every recursion needs a base case and a smaller subproblem. Deep recursion can overflow the stack, and repeated subproblems, as in naive Fibonacci, need memoization.",
  "recall-lru-cache":
    "A hash map finds the node and a doubly linked list keeps recency order. Move a node to the front on every get or put, and evict from the tail.",
  "recall-graph-representation":
    "Adjacency lists use Θ(V + E) space and list neighbors in degree time; a matrix uses Θ(V²) and tests an edge in O(1). For ten million sparse accounts, use lists.",
  "recall-bit-tricks":
    "(x >> k) & 1 tests bit k, and x & (x − 1) clears the lowest set bit, so a positive x is a power of two when that is zero. XOR everything to leave the single value.",
  "recall-test-cases":
    "Trace one normal input through the code, then check empty input, k = 0, k larger than the distinct count, ties, invalid input, and a very large list, saying what each returns.",
};
