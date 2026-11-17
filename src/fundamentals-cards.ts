import type { RecallCard } from "./cards.ts";

const kafkaDesign = {
  label: "Apache Kafka design: consumer position and delivery semantics",
  url: "https://kafka.apache.org/44/design/design/",
};
const princetonSorts = {
  label: "Princeton: stability and choosing a sort",
  url: "https://algs4.cs.princeton.edu/25applications/",
};
const mitSorting = {
  label: "MIT 6.006: sorting and solving recurrences",
  url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec3/",
};
const mitHeaps = {
  label: "MIT 6.006: binary heaps",
  url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec8/",
};
const tcp = {
  label: "RFC 9293: Transmission Control Protocol",
  url: "https://www.rfc-editor.org/rfc/rfc9293.html",
};

// Interview fundamentals and data-platform topics.
export const fundamentalsCards: RecallCard[] = [
  {
    id: "recall-replication-failover",
    topic: "System design",
    difficulty: "Foundation",
    title: "Failover can lose acknowledged writes.",
    prompt:
      "A PostgreSQL primary streams changes to a standby asynchronously. The primary dies and you promote the standby. What can be lost, what would synchronous replication change, and what must happen to the old primary?",
    explanation:
      "With asynchronous replication the primary acknowledges a commit before the standby has it. Transactions that were not yet shipped are lost on promotion, and the loss grows with the replication delay at that moment. Synchronous replication makes each commit wait for a standby to confirm. That closes the loss window but adds at least a network round trip to every write, and commits wait when no synchronous standby is reachable. Before the standby takes writes, the old primary must be prevented from accepting them, or two primaries diverge. PostgreSQL does not detect the failure for you; separate tooling decides, promotes, and redirects clients.",
    rubric: [
      "Tie the possible loss to replication delay at failover.",
      "State the latency and availability cost of synchronous commit.",
      "Fence the old primary and name who detects failure and redirects clients.",
    ],
    alternatives:
      "Wait for a quorum of several standbys so one slow standby does not stall commits. A managed service such as Amazon RDS Multi-AZ packages detection and promotion.",
    pitfall:
      "Saying a standby gives high availability without stating what is lost on failover, or letting a restarted old primary keep serving writes.",
    sources: [
      {
        label: "PostgreSQL: log-shipping standby servers and synchronous replication",
        url: "https://www.postgresql.org/docs/current/warm-standby.html",
      },
      {
        label: "PostgreSQL: failover",
        url: "https://www.postgresql.org/docs/current/warm-standby-failover.html",
      },
    ],
  },
  {
    id: "recall-shard-key",
    topic: "System design",
    difficulty: "Intermediate",
    title: "The partition key decides which queries stay local.",
    prompt:
      "An events table is outgrowing one database. Compare tenant ID, creation day, and event ID as the partition key. What do you check before choosing?",
    explanation:
      "The key decides which partition serves each read and write, so check two things: load spreads over many key values, and the common queries can name the key. Creation day fails the first test, because all of today's writes land on one partition. Event ID spreads writes evenly, but listing one tenant's events must ask every partition. Tenant ID keeps a tenant's queries on one partition and spreads load when there are many similar tenants; one very large tenant then becomes a hot partition. A composite key such as tenant plus a time bucket splits that tenant at the cost of multi-bucket reads. Changing the key later means moving the data.",
    rubric: [
      "Judge each key on load spread and on whether queries can target it.",
      "Explain why a time-based key concentrates current writes.",
      "Name the skew risk of the chosen key and a way to split it.",
    ],
    alternatives:
      "Range partitioning by time suits append-only data that is queried and expired by time, when one partition can absorb the current write rate.",
    pitfall:
      "Choosing the key only for even distribution and discovering that every important query fans out to all partitions.",
    sources: [
      {
        label: "DynamoDB: designing partition keys to distribute workload",
        url: "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-uniform-load.html",
      },
    ],
  },
  {
    id: "recall-lb-health",
    topic: "System design",
    difficulty: "Foundation",
    title: "A health check can take down a healthy fleet.",
    prompt:
      "A load balancer sends traffic to 20 servers. What should its health check test, and what happens if the check calls a shared database that slows down?",
    explanation:
      "The load balancer routes only to targets that pass the check and stops routing to ones that fail. A liveness check proves the process accepts connections and answers. A local check also tests things that server does not share with its peers, such as disk and critical processes. A check that calls a shared dependency fails on every server at once, so the balancer can remove a whole fleet that could still do useful work. Keep the routing check local and report dependency trouble through metrics and alarms. Some balancers fail open and route to all targets when too few are healthy. When removing a server, deregister it and let in-flight requests drain first.",
    rubric: [
      "Distinguish liveness, local, and dependency checks.",
      "Explain the correlated failure when every server checks a shared dependency.",
      "Mention fail-open behavior and draining on removal.",
    ],
    alternatives:
      "A layer 4 balancer assigns each TCP connection to one target for its lifetime; a layer 7 balancer routes each HTTP request and can use paths, headers, and least outstanding requests.",
    pitfall:
      "Making the health check as deep as possible, so a slow dependency turns into a full outage.",
    sources: [
      {
        label: "AWS: implementing health checks",
        url: "https://aws.amazon.com/builders-library/implementing-health-checks/",
      },
      {
        label: "How Elastic Load Balancing works",
        url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html",
      },
    ],
  },
  {
    id: "recall-https-path",
    topic: "System design",
    difficulty: "Foundation",
    title: "Four layers run before the first response byte.",
    prompt:
      "A client has never contacted https://api.example.com. Walk through what must happen before the first response arrives, and what each step contributes.",
    explanation:
      "DNS resolves the name to an IP address, and the answer is cached for its time-to-live. TCP's handshake then sets up a reliable, ordered byte stream to port 443. TLS 1.3 runs on top: the client sends a ClientHello with a key share, and the server answers with its key share, its certificate, a signature over the handshake, and Finished. The client checks the certificate chain and the host name. That gives server authentication, confidentiality, and integrity, normally in one round trip. Only then does the HTTP request go out, with a method, path, and headers, and a status code comes back. Reusing the connection skips all of this for later requests.",
    rubric: [
      "Order the steps: name resolution, TCP, TLS, then HTTP.",
      "Say what TLS provides and what the client verifies.",
      "Explain why connection reuse lowers latency.",
    ],
    alternatives:
      "HTTP/3 carries the same HTTP semantics over QUIC on UDP, which combines the transport and TLS handshakes.",
    pitfall:
      "Treating TLS as encryption only and skipping certificate and host name verification, or assuming every request pays the full setup.",
    sources: [
      {
        label: "RFC 8446: TLS 1.3 overview and handshake",
        url: "https://www.rfc-editor.org/rfc/rfc8446.html#section-2",
      },
      tcp,
      {
        label: "RFC 9110: HTTP semantics",
        url: "https://www.rfc-editor.org/rfc/rfc9110.html",
      },
    ],
  },
  {
    id: "recall-tcp-stream",
    topic: "System design",
    difficulty: "Foundation",
    title: "TCP delivers bytes, not messages.",
    prompt:
      "A service sends two 100-byte messages over one TCP connection. The receiver's first read returns 150 bytes. Is that a bug? What does TCP guarantee, and what must the application add?",
    explanation:
      "It is not a bug. TCP provides a reliable, in-order byte stream and promises no relation between the sender's writes and the receiver's reads. The application must frame its messages, for example with a length prefix, and keep reading until a whole message has arrived. Reliability comes from sequence numbers, cumulative acknowledgments, and retransmission, so a lost segment delays every byte behind it. TCP has no built-in liveness detection: an idle connection to a dead peer can look healthy, so add timeouts or heartbeats. A TCP acknowledgment means the peer's TCP received the bytes, not that the application processed them; that needs an application-level reply.",
    rubric: [
      "State the byte-stream guarantee and the missing message boundaries.",
      "Describe framing and reading until a message is complete.",
      "Separate transport delivery from application processing and liveness.",
    ],
    alternatives:
      "Use a protocol that already frames messages, such as HTTP, gRPC, or WebSocket. UDP preserves datagram boundaries but gives no delivery or ordering guarantee.",
    pitfall:
      "Assuming one send equals one receive because it happened to work on a local machine.",
    sources: [tcp],
  },
  {
    id: "recall-partitioned-log",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Order holds inside one partition only.",
    prompt:
      "Security events flow into a Kafka topic with 12 partitions, keyed by device ID. What ordering do consumers get, how does a consumer group share the work, and what limits parallelism?",
    explanation:
      "Events with the same key go to the same partition, and a consumer reads a partition's events in the order they were written. There is no ordering across partitions, so you get per-device order and nothing global. Within a consumer group each partition is read by exactly one consumer at a time, so 12 partitions allow at most 12 active consumers in that group. A consumer's progress is one offset per partition. Events are not deleted when read, so a second group, or a replay from an older offset, can read them again. Two limits follow: a very busy device loads one partition, and with key hashing, adding partitions changes where a key's new events land.",
    rubric: [
      "State per-key, per-partition ordering and the lack of global order.",
      "Explain one consumer per partition per group and the parallelism cap.",
      "Mention offsets, retention after reads, and hot keys.",
    ],
    alternatives:
      "A queue such as Amazon SQS, where any worker can take any message, scales workers freely when per-key order and replay are not needed.",
    pitfall:
      "Promising total order across a multi-partition topic, or adding consumers beyond the partition count and expecting more throughput.",
    sources: [
      {
        label: "Apache Kafka introduction: topics, keys, and partitions",
        url: "https://kafka.apache.org/intro",
      },
      kafkaDesign,
    ],
  },
  {
    id: "recall-consumer-offset",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Commit order decides loss or duplicates.",
    prompt:
      "A consumer reads a batch from a partitioned log, writes rows to a database, and saves its offset. It can crash between those two steps. What happens in each ordering, and how do you avoid duplicate rows?",
    explanation:
      "If it saves the offset first and crashes before writing, the replacement starts after those messages and they are never processed: at most once. If it writes first and crashes before saving, the replacement reads the same messages again: at least once. Most pipelines choose at least once and make the write idempotent, for example an upsert keyed by a stable event ID, so a replay changes nothing. The alternative is to store the offset in the same database transaction as the rows, so output and position move together. A rebalance that hands a partition to another consumer causes the same replay, so a clean shutdown path is not enough.",
    rubric: [
      "Map each ordering to at-most-once or at-least-once.",
      "Make the effect idempotent or commit offset and output atomically.",
      "Note that rebalances and restarts replay uncommitted work.",
    ],
    alternatives:
      "Kafka transactions can commit consumed offsets and produced records together when the output is another Kafka topic.",
    pitfall:
      "Claiming exactly-once processing while the offset and the database write are two separate commits.",
    sources: [kafkaDesign],
  },
  {
    id: "recall-event-time",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Late data needs an explicit policy.",
    prompt:
      "You count failed logins per device in 5-minute windows. A phone was offline and uploads its events 20 minutes late. Which clock defines the window, when can a result be emitted, and what happens to the late events?",
    explanation:
      "Event time is when the event happened on the device; processing time is the clock of the machine handling it. Window by event time, so the count does not depend on arrival delay. The system tracks progress with a watermark: a watermark at time t declares that event time has reached t. A window's result can be emitted once the watermark passes the window's end. Events that arrive behind the watermark are late. In Apache Flink the default drops them. Allowed lateness keeps the window open longer, and a late event then emits an updated result that downstream must treat as a correction. Anything later can go to a side output. Waiting longer is more complete and costs delay and state.",
    rubric: [
      "Distinguish event time from processing time and pick one for the window.",
      "Explain what a watermark asserts and when a window fires.",
      "Choose among dropping, updating, and side-routing late events.",
    ],
    alternatives:
      "Processing-time windows are simpler and suit monitoring the pipeline itself. A periodic batch job can recompute final counts after late data has settled.",
    pitfall:
      "Windowing by arrival time and reporting a spike that is only a backlog being uploaded.",
    sources: [
      {
        label: "Apache Flink: event time, processing time, and watermarks",
        url: "https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/",
      },
      {
        label: "Apache Flink windows: allowed lateness",
        url: "https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/#allowed-lateness",
      },
    ],
  },
  {
    id: "recall-schema-evolution",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Old and new readers share one stream.",
    prompt:
      "Producers and consumers of an event deploy at different times. Which schema changes are safe, and what must never happen to a field's identifier?",
    explanation:
      "During a rollout, and for as long as stored events live, new code reads old data and old code reads new data. Both directions must work. In Protocol Buffers the field number identifies a field on the wire, so it must never change or be reused. Adding a field is safe: old binaries ignore it, and new code reading old data sees the type's default, such as zero or an empty string. So do not give the default a special meaning. Removing a field is safe if its number is reserved so nobody reuses it. Unsafe changes include reusing a number, switching to an incompatible type, and making new code require a field that old data lacks.",
    rubric: [
      "State that both old-reads-new and new-reads-old must work.",
      "Keep field identifiers stable and reserve removed ones.",
      "Explain defaults for missing fields and name an unsafe change.",
    ],
    alternatives:
      "Avro resolves a writer schema against a reader schema, usually with a schema registry enforcing compatibility. A breaking change can go to a new topic or versioned event type.",
    pitfall:
      "Renumbering or reusing a field, or deploying a consumer that crashes on events written before the new field existed.",
    sources: [
      {
        label: "Protocol Buffers: updating a message type",
        url: "https://protobuf.dev/programming-guides/proto3/#updating",
      },
    ],
  },
  {
    id: "recall-safe-rollout",
    topic: "System design",
    difficulty: "Intermediate",
    title: "A release must survive its own rollback.",
    prompt:
      "A new version changes the format of records it writes to a shared store. How do you deploy it so a bad release can still be rolled back, and how do you limit the damage a bad release can do?",
    explanation:
      "If the new version writes a format the old version cannot read, rolling back strands that data and breaks other readers. Split the change in two. First deploy a version that can read both formats and still writes the old one, and let it run. Then deploy the version that writes the new format. Each deployment can be rolled back one step. To limit damage, release to a small slice of production first, watch error rate and latency for a set time, and expand in stages. Roll back automatically when alarms fire. Test rollback itself by upgrading part of a fleet, running old and new side by side, and downgrading.",
    rubric: [
      "Explain why writing a new format blocks rollback.",
      "Separate the read-both deployment from the write-new deployment.",
      "Stage the release with monitoring, wait time, and automatic rollback.",
    ],
    alternatives:
      "A feature flag can separate deploying the code from switching the write format, as long as turning the flag off is also safe for data already written.",
    pitfall:
      "Shipping reader and writer changes in one release, or treating rollback as safe without ever testing a downgrade.",
    sources: [
      {
        label: "AWS: ensuring rollback safety during deployments",
        url: "https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/",
      },
      {
        label: "AWS: automating safe, hands-off deployments",
        url: "https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments/",
      },
    ],
  },
  {
    id: "recall-merge-sort",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Merge sort costs the same on every input.",
    prompt:
      "Explain merge sort on an array: the recurrence, why it is O(n log n) in every case, its extra space, and what makes it stable.",
    explanation:
      "Split the array in half, sort each half recursively, then merge the two sorted halves with two pointers, always taking the smaller front item. A range of length one is the base case. The cost is T(n) = 2T(n/2) + Θ(n). The recursion tree has about log n levels and each level does Θ(n) merging in total, so the time is Θ(n log n) whatever the input order. Merging an array needs an auxiliary array of Θ(n). The sort is stable when the merge takes from the left half on ties, so equal keys keep their original order.",
    rubric: [
      "Describe split, recursive sort, and the two-pointer merge.",
      "Derive Θ(n log n) from the recurrence or recursion tree.",
      "State the Θ(n) extra space and the tie rule that gives stability.",
    ],
    alternatives:
      "Bottom-up merge sort merges runs of length 1, 2, 4, and so on without recursion. Linked lists can be merged by relinking nodes instead of copying.",
    pitfall:
      "Taking from the right half on equal keys, which silently breaks stability, or forgetting the auxiliary array when asked about space.",
    sources: [
      {
        label: "Princeton: mergesort",
        url: "https://algs4.cs.princeton.edu/22mergesort/",
      },
      mitSorting,
    ],
  },
  {
    id: "recall-quicksort",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Quicksort is fast only with good pivots.",
    prompt:
      "Explain quicksort's partition step, its expected and worst-case costs, and what goes wrong on already sorted input or many duplicate keys.",
    explanation:
      "Pick a pivot and partition the range so smaller items are on its left and larger ones on its right. The pivot is then in its final place; recurse on both sides. It sorts in place with only a recursion stack. With a random pivot the expected time is O(n log n). If the pivot is always an extreme value, one side is empty each time and the cost is about n²/2 comparisons. A first-element pivot does exactly that on sorted input, so shuffle the input or choose pivots at random. With many equal keys, use three-way partitioning into less, equal, and greater so the equal block is never revisited. Quicksort is not stable.",
    rubric: [
      "Describe partitioning and the pivot's final position.",
      "Give expected O(n log n) and the O(n²) worst case with its cause.",
      "Handle duplicates and state that it is in place but not stable.",
    ],
    alternatives:
      "Median-of-three pivots and switching to insertion sort on small ranges are common tuning steps. Recursing into the smaller side first keeps the stack at O(log n).",
    pitfall:
      "Calling quicksort O(n log n) without saying expected, or using a fixed pivot on input that may already be sorted.",
    sources: [
      {
        label: "Princeton: quicksort",
        url: "https://algs4.cs.princeton.edu/23quicksort/",
      },
      princetonSorts,
    ],
  },
  {
    id: "recall-sort-choice",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Pick a sort by its guarantees.",
    prompt:
      "Compare merge sort, quicksort, and heapsort on worst-case time, extra space, and stability. Why can't a comparison sort beat n log n, and when does stability matter?",
    explanation:
      "Merge sort is O(n log n) in the worst case, uses Θ(n) extra space, and is stable. Quicksort is O(n log n) expected and O(n²) worst case, sorts in place, and is not stable. Heapsort is O(n log n) worst case and in place, and is not stable. A comparison sort must tell apart n! possible input orders, which takes at least lg(n!) comparisons in the worst case, about n lg n. A stable sort keeps equal keys in their original order. That matters when records are sorted by one field and then another: sort by time, then stably by user, and each user's records stay in time order.",
    rubric: [
      "Give time, space, and stability for the three sorts.",
      "Explain the lower bound by counting input orders.",
      "Define stability and give a case that needs it.",
    ],
    alternatives:
      "Library sorts are hybrids: Java has used a quicksort variant for primitives and a merge sort variant for objects, trading memory for stability and guaranteed time.",
    pitfall:
      "Calling every O(n log n) sort interchangeable, or applying the comparison lower bound to counting and radix sorts.",
    sources: [
      princetonSorts,
      {
        label: "Princeton: mergesort and the comparison lower bound",
        url: "https://algs4.cs.princeton.edu/22mergesort/",
      },
      mitHeaps,
    ],
  },
  {
    id: "recall-heap-structure",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "A heap is a tree stored in an array.",
    prompt:
      "A binary max-heap lives in an array. Give the child and parent indices, describe insert and delete-max, and explain why building a heap from n items takes O(n).",
    explanation:
      "With zero-based indices, node i has children at 2i + 1 and 2i + 2 and its parent at floor((i − 1) / 2). Every node is at least as large as its children, so the maximum is at index 0; siblings have no order between them. To insert, append the item and swap it with its parent while it is larger. To delete the maximum, swap the root with the last item, remove the last slot, and swap the new root down with its larger child until the property holds. Both walk one root-to-leaf path: O(log n). To build, sift down every node from the last parent back to the root. Most nodes are near the bottom and move only a few levels, so the total is O(n).",
    rubric: [
      "Give the index formulas and the heap property.",
      "Describe sift-up for insert and sift-down for delete-max.",
      "Justify O(n) build versus O(n log n) for n separate inserts.",
    ],
    alternatives:
      "Use a balanced search tree when you also need ordered iteration or deletion of arbitrary keys.",
    pitfall:
      "Treating a heap as a sorted array, or sifting down with the smaller child in a max-heap.",
    sources: [mitHeaps],
  },
  {
    id: "recall-recurrence-cost",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Read the running time off the recursion tree.",
    prompt:
      "Give the running time for each recurrence and justify it with a recursion tree: T(n) = T(n/2) + O(1); T(n) = 2T(n/2) + O(n); T(n) = T(n − 1) + O(n); T(n) = 2T(n − 1) + O(1).",
    explanation:
      "Draw the calls as a tree and add up the work on each level. T(n/2) + O(1) is a single chain of about log n calls with constant work each: O(log n), as in binary search. 2T(n/2) + O(n) has about log n levels and every level's pieces total n: O(n log n), as in merge sort. T(n − 1) + O(n) is a chain of n calls doing n, n − 1, down to 1 work: O(n²). 2T(n − 1) + O(1) doubles the number of calls on each of n levels: O(2ⁿ). The recursion depth also gives the stack space: log n for the halving cases and n for the others.",
    rubric: [
      "Give all four bounds.",
      "Justify each by levels times work per level.",
      "Relate recursion depth to stack space.",
    ],
    alternatives:
      "Guess a bound and verify it by substitution, or apply the master theorem to divide-and-conquer recurrences of the form aT(n/b) + f(n).",
    pitfall:
      "Counting only the number of calls and ignoring the work done inside each call, or the reverse.",
    sources: [mitSorting],
  },
  {
    id: "recall-recursion-pitfalls",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "A recursion needs a base case and a smaller problem.",
    prompt:
      "What must every recursive function have, and how does one fail in practice? Use naive Fibonacci and a linked list of 100,000 nodes as examples.",
    explanation:
      "It needs a base case that returns without recursing and a reduction step whose arguments move toward that base case. Four failures follow. A missing base case never returns. A subproblem that is not smaller never reaches the base case. Deep recursion runs out of stack: each active call holds a frame, so recursing once per node down a 100,000-node list can overflow where a loop would not. Repeated subproblems waste time: naive Fibonacci recomputes the same values and takes exponential time, while memoizing each value makes it O(n). When stating complexity, count the recursion depth as space.",
    rubric: [
      "Name the base case and the reduction toward it.",
      "Explain stack depth as a space cost and a failure mode.",
      "Identify repeated subproblems and fix them with memoization.",
    ],
    alternatives:
      "Rewrite deep linear recursion as a loop or use an explicit stack. Bottom-up dynamic programming avoids both the recursion depth and the recomputation.",
    pitfall:
      "Reporting O(1) space for a recursive solution, or assuming the language removes tail calls when it does not.",
    sources: [
      {
        label: "Princeton: recursion and its pitfalls",
        url: "https://introcs.cs.princeton.edu/java/23recursion/",
      },
    ],
  },
  {
    id: "recall-lru-cache",
    topic: "Algorithms",
    difficulty: "Intermediate",
    title: "Two structures make an O(1) LRU cache.",
    prompt:
      "Design a cache with O(1) get and put that evicts the least recently used key when it is over capacity. Which two structures do you combine, and what does each operation do?",
    explanation:
      "Combine a hash map from key to list node with a doubly linked list ordered from most to least recently used. get looks up the node, moves it to the front, and returns its value, or reports a miss. put updates an existing node and moves it to the front, or inserts a new node at the front; if the size now exceeds capacity, it removes the tail node and deletes that node's key from the map. The list must be doubly linked so a node can be unlinked in O(1) from a reference to it. Each node stores its key so eviction can find the map entry. Sentinel head and tail nodes remove the empty-list special cases. Operations are O(1) expected, space O(capacity).",
    rubric: [
      "Pair a hash map with a doubly linked recency list.",
      "Update recency on get as well as put.",
      "Evict the tail and remove its key from the map.",
    ],
    alternatives:
      "An insertion-ordered map, such as Java's LinkedHashMap in access order or Python's OrderedDict, provides the same behavior with less code.",
    pitfall:
      "Forgetting that a read changes recency, or evicting the list node while leaving its key in the map.",
    sources: [
      {
        label: "LeetCode problem: LRU Cache",
        url: "https://leetcode.com/problems/lru-cache/",
      },
      {
        label: "MIT 6.006: hashing and expected bounds",
        url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec4/",
      },
    ],
  },
  {
    id: "recall-graph-representation",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Store a sparse graph as adjacency lists.",
    prompt:
      "A graph has V vertices and E edges. Compare adjacency lists with an adjacency matrix for space, listing a vertex's neighbors, and testing one edge. Which fits a sparse graph of ten million accounts?",
    explanation:
      "Adjacency lists store each vertex's neighbors, Θ(V + E) space in total. Listing a vertex's neighbors takes time proportional to its degree. Testing one edge scans a list unless neighbors are kept in a hash set, which makes the test O(1) expected. A matrix uses Θ(V²) space, tests an edge in O(1), and needs O(V) to list neighbors however few there are. For ten million vertices a matrix has 10¹⁴ cells, so use lists. Traversals follow the same split: BFS and DFS take O(V + E) on lists and O(V²) on a matrix. For a directed graph store outgoing edges, and keep a second map of incoming edges if you need to walk backward.",
    rubric: [
      "Give space and both operation costs for each representation.",
      "Choose lists for the sparse graph with the size argument.",
      "State the traversal cost and handle direction.",
    ],
    alternatives:
      "A matrix or bitset suits small or dense graphs and constant-time edge tests. A plain edge list is enough for algorithms that sort or scan all edges.",
    pitfall:
      "Quoting O(V + E) for a traversal while storing the graph as a matrix.",
    sources: [
      {
        label: "MIT 6.006: graph representations and breadth-first search",
        url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec9/",
      },
    ],
  },
  {
    id: "recall-bit-tricks",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Four bit operations cover most questions.",
    prompt:
      "Using bitwise operations, how do you test bit k, clear the lowest set bit, check whether a positive integer is a power of two, and find the one value that appears once when every other value appears twice?",
    explanation:
      "Test bit k with (x >> k) & 1. x & (x − 1) clears the lowest set bit, because subtracting one turns that bit off and every lower bit on. A positive x is a power of two exactly when it has one set bit, so check x > 0 and x & (x − 1) equal to 0. Repeating the clearing step counts set bits in as many steps as there are set bits. For the single value, XOR everything together: a XOR a is 0, a XOR 0 is a, and order does not matter, so the pairs cancel and the single value remains. That takes O(n) time and O(1) extra space.",
    rubric: [
      "Give the shift-and-mask test and the x & (x − 1) identity.",
      "Explain the power-of-two check, including the zero case.",
      "Justify the XOR answer by cancellation.",
    ],
    alternatives:
      "A hash set also finds the single value in O(n) time but uses O(n) space. Most languages have a built-in population count.",
    pitfall:
      "Forgetting that zero passes x & (x − 1) == 0, or shifting a negative number without knowing whether the language's right shift keeps the sign.",
    sources: [
      {
        label: "LeetCode problem: Single Number",
        url: "https://leetcode.com/problems/single-number/",
      },
      {
        label: "LeetCode problem: Number of 1 Bits",
        url: "https://leetcode.com/problems/number-of-1-bits/",
      },
    ],
  },
  {
    id: "recall-test-cases",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Test your own code before the interviewer does.",
    prompt:
      "You have just written a function that returns the k most frequent words in a list. Before saying you are done, which kinds of test do you walk through aloud?",
    explanation:
      "Start by tracing one small normal input through the code line by line, rather than asserting that it works. Then cover boundaries: an empty list, one word, k equal to 0, k equal to the number of distinct words, and k larger than that. Check ties, and say what order you return them in. Cover error conditions such as a missing list or negative k, and state the behavior you chose. Consider stress: a very large list, all words identical, and all words distinct, and what each does to time and memory. Consider untrusted input: extremely long strings, and whether case or Unicode variants count as the same word. Fix what you find and say what changed.",
    rubric: [
      "Trace a normal case through the actual code.",
      "List boundary, tie, and error cases with the chosen behavior.",
      "Raise stress and untrusted-input cases.",
    ],
    alternatives:
      "When time is short, name the categories and trace only the riskiest case, usually a boundary on k or the empty input.",
    pitfall:
      "Declaring the code finished after the happy path, or noticing an edge case without saying how the function handles it.",
    sources: [
      {
        label: "Microsoft Careers: technical interviewing tips",
        url: "https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing.html",
      },
    ],
  },
];
