import type { RecallCard } from "./cards.ts";
import { sources } from "./scenario-authoring.ts";

const mit = {
  label: "MIT 6.006 lecture notes",
  url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
};
const recovery = {
  label: "AWS disaster recovery strategies",
  url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_disaster_recovery.html",
};

export const advancedCards: RecallCard[] = [
  {
    id: "recall-fanout-budget",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Estimate the cost of fan-out",
    prompt:
      "A feed processes 80 posts per second. The average post has 250 eligible readers and one author has two million. Estimate the normal timeline write load and explain when to pull on read.",
    explanation:
      "At the stated mean, the feed generates about 20,000 recipient writes per second before retries. A single two-million-follower post can dominate the queue, so inspect the distribution and the maximum backlog age rather than sizing only to the mean. A hybrid pushes ordinary posts and merges heavy authors’ recent posts on read under the same total order.",
    rubric: [
      "Calculate the recipient writes per second.",
      "Identify the long-tail burst and relevant backlog signal.",
      "Explain where a hybrid moves cost.",
    ],
    alternatives:
      "Shard large follower ranges and reserve worker capacity when read-time merging cannot meet latency requirements.",
    pitfall:
      "Multiplying by the average describes aggregate work over that window. It does not bound any individual publication.",
    sources: [sources.overload, sources.indexes],
  },
  {
    id: "recall-heap-merge",
    topic: "Algorithms",
    difficulty: "Intermediate",
    title: "Merge sorted streams with a heap",
    prompt:
      "You can inspect one current element from each of k sorted streams. How do you emit all n elements in sorted order, and what state do you keep?",
    explanation:
      "Put the head of each nonempty stream in a min-heap tagged with its source. The heap minimum is the global minimum because all unseen items in each stream follow that stream’s head. Pop it, emit it, and add the next item from that source if any. Heap construction is O(k), the merge costs O(n log k) for k ≥ 2, and the heap uses O(k) space.",
    rubric: [
      "Explain why one candidate per stream suffices.",
      "Replace an emitted head with the next item from its own stream.",
      "Give complexity in total elements and stream count.",
    ],
    alternatives:
      "Pairwise merging in a balanced merge tree also takes O(n log k) work and can be a better fit for in-memory runs.",
    pitfall:
      "Enqueueing every element defeats bounded memory. Equal keys may need a deterministic tie-breaker when stability is required.",
    sources: [mit],
  },
  {
    id: "recall-snapshot-watermark",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Join a snapshot and a change stream",
    prompt:
      "A client downloads an initial snapshot in pages while writes continue. What position must it resume from, and what happens if its cursor expires?",
    explanation:
      "Each page must describe one consistent generation paired with a source watermark W. Retain the ordered changes after W for the supported handoff period. Once the client has installed the snapshot, apply changes strictly after W and commit each local cursor with its updates. If required log records are gone, require a fresh snapshot and preserve local pending edits separately.",
    rubric: [
      "Pin every snapshot page to the same generation.",
      "Identify the first change and the retention requirement.",
      "Handle an expired cursor explicitly.",
    ],
    alternatives:
      "Use a storage-native consistent snapshot and change-stream resume token when their handoff contract is documented.",
    pitfall:
      "Paging live state and then taking a new resume position can omit an update made between pages.",
    sources: [sources.isolation, sources.transactions],
  },
  {
    id: "recall-state-bfs",
    topic: "Algorithms",
    difficulty: "Intermediate",
    title: "Choose the complete BFS state",
    prompt:
      "A grid path may break at most k walls. Why can marking only a cell visited discard a valid shortest path? Define a correct BFS state and bound its cost.",
    explanation:
      "Reaching the same cell with different remaining wall breaks can permit different next moves. Search (row, column, remaining) in increasing distance and mark that full state on enqueue. With R × C cells and k + 1 budget values, the state space and worst-case work are O(RC(k + 1)) when each state has a constant number of moves. The first goal reached is shortest in the expanded graph.",
    rubric: [
      "Name the resource as part of the state.",
      "Explain the BFS distance ordering in the expanded graph.",
      "Give a time and space bound.",
    ],
    alternatives:
      "Prune states if an equal or earlier arrival at the same cell has at least as much remaining budget. Preserve that distance condition.",
    pitfall:
      "A faster path to a cell may have already spent the resource needed to reach the goal.",
    sources: [mit],
  },
  {
    id: "recall-multipart-publish",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Verify a multipart upload before publication",
    prompt:
      "A client uploaded every part of a video to S3. What must happen before you mark that file version readable, and what do you clean up after a crash?",
    explanation:
      "Complete the upload using its upload ID and the intended ordered parts. Verify the assembled object’s key, size, and supported checksum against the authorized upload. Commit the metadata pointer only once the immutable version is usable. Abort expired incomplete uploads and separately reclaim completed staged objects only when publication can no longer reference them.",
    rubric: [
      "Separate part upload from object completion.",
      "Verify the exact immutable version before updating metadata.",
      "Distinguish cleanup of incomplete parts from abandoned completed objects.",
    ],
    alternatives:
      "For small files a single object PUT with an integrity checksum can simplify the state machine.",
    pitfall:
      "Treating the part list as a readable object, or assuming that every multipart ETag is a full-object MD5.",
    sources: [
      {
        label: "Amazon S3 multipart uploads",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html",
      },
      {
        label: "Amazon S3 upload checksums",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html",
      },
    ],
  },
  {
    id: "recall-stream-median",
    topic: "Algorithms",
    difficulty: "Intermediate",
    title: "Maintain a running median",
    prompt:
      "Numbers arrive one at a time. Describe two heap invariants that let you return the median without sorting the full stream after every insert.",
    explanation:
      "Maintain a max-heap for the lower half and a min-heap for the upper half. Every lower value is at most every upper value, and the lower heap has either the same size or one more item. Insert in the proper half and move one top across if necessary to restore sizes. Read the lower top for an odd count and average the two tops for an even count. Insertion is O(log n), lookup O(1), and storage O(n).",
    rubric: [
      "State the value and size invariants.",
      "Describe rebalancing after insertion.",
      "Handle even counts, duplicates, and overflow.",
    ],
    alternatives:
      "An order-statistics tree can support deletions as well as inserts. A bounded small value domain may make counting simpler.",
    pitfall:
      "Keeping sizes equal is insufficient if the halves can interleave. Integer addition before averaging can overflow.",
    sources: [mit],
  },
  {
    id: "recall-writer-fencing",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Fence an old lease holder",
    prompt:
      "A worker pauses past its lease expiry and resumes after a successor has started writing. Where must the system reject the older worker’s write?",
    explanation:
      "Issue a monotonically increasing fencing token from the authoritative ownership service. The protected store must enforce the current epoch or reject tokens older than a token it has accepted. Arrange the authority handoff so the new epoch is installed before new work is acknowledged. Rechecking a lease in the worker leaves another pause window before the write.",
    rubric: [
      "Describe how a delayed holder can still execute after expiry.",
      "Use a monotone token enforced at the side effect.",
      "Explain when a store that cannot fence requires a different ownership design.",
    ],
    alternatives:
      "Perform the critical mutation within the same authoritative transaction that checks current ownership when both resources share a store.",
    pitfall:
      "A process-local timeout alone does not prevent a delayed network request or a paused process from applying a stale write.",
    sources: [sources.locks, recovery],
  },
  {
    id: "recall-edit-distance",
    topic: "Algorithms",
    difficulty: "Intermediate",
    title: "Build the edit distance recurrence",
    prompt:
      "For unit-cost insertions, deletions, and substitutions, define a dynamic program for converting one string to another. What do the boundaries mean?",
    explanation:
      "Let d[i][j] be the minimum cost to convert the first i source characters to the first j target characters. Empty-prefix costs are d[i][0] = i and d[0][j] = j. Otherwise take the minimum of deleting, inserting, and matching or substituting, using d[i−1][j], d[i][j−1], and d[i−1][j−1] with their costs. The table takes O(mn) time. Two rows suffice when only the distance is needed.",
    rubric: [
      "Define both prefix indices and initialize empty prefixes.",
      "Give all three transitions with their costs.",
      "Distinguish computing distance from recovering an edit sequence.",
    ],
    alternatives:
      "Use memoized recursion over prefix lengths with the same state and boundary cases.",
    pitfall:
      "Forgetting empty prefixes or treating a match as a unit-cost substitution changes the optimum.",
    sources: [mit],
  },
  {
    id: "recall-coordinated-recovery",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Measure recovery across two stores",
    prompt:
      "A manifest database is two minutes behind in a backup region. The file bucket copies asynchronously. What evidence do you need to claim a five-minute recovery point objective for the application?",
    explanation:
      "Find the newest manifest point whose referenced object versions are all available and verified in the recovery region. Measure the age of that complete point against the agreed loss window. Include every store needed to serve the recovered view and validate by restoring a sample or controlled workload. A recovery drill also measures time to service separately from data loss.",
    rubric: [
      "Name a recoverable point that includes metadata and bytes.",
      "Check specific object versions or durable copy receipts.",
      "Separate measured loss from restore time.",
    ],
    alternatives:
      "Coordinate backups and maintain a durable readiness marker advanced only after all stores cross it.",
    pitfall:
      "A database lag metric alone says nothing about which referenced bytes made it to the other region.",
    sources: [
      recovery,
      {
        label: "Amazon S3 replication status",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-status.html",
      },
    ],
  },
  {
    id: "recall-ring-buffer",
    topic: "Algorithms",
    difficulty: "Foundation",
    title: "Tell a full ring buffer from an empty one",
    prompt:
      "Design a fixed-capacity circular queue with O(1) enqueue and dequeue. What do the indices and size mean, and which cases test the invariant?",
    explanation:
      "For positive capacity C, keep head as the index of the oldest item and size as the live count. Enqueue at (head + size) mod C when size < C. Dequeue at head when size > 0, advance head modulo C, and decrement size. Size distinguishes full from empty even when a derived tail equals head. Check wraparound after both operations, capacity one, and failed operations leaving state unchanged.",
    rubric: [
      "Define head, size, and the computed insertion slot.",
      "Handle empty and full without overwriting a live value.",
      "Trace wraparound and a capacity-one queue.",
    ],
    alternatives:
      "Reserve one unused slot so head equals tail only when empty. Account for the lost slot when specifying capacity.",
    pitfall:
      "Comparing head and tail alone is ambiguous when all physical slots can be occupied.",
    sources: [mit],
  },
  {
    id: "recall-ranking-snapshot",
    topic: "System design",
    difficulty: "Intermediate",
    title: "Page through a changing ranking",
    prompt:
      "Post scores change every minute, but a reader wants stable page boundaries while scrolling. What goes into the cursor, and how can you still remove a post immediately?",
    explanation:
      "Pin a ranking generation and a last position with a unique tie-breaker to the cursor. Retain that generation for the cursor lifetime and make refresh start a fresh generation. When reading ranked IDs, check current visibility before fetching or returning bodies. Filtering can shorten a page. Advance through examined IDs within a bounded scan so a removed item does not repeat.",
    rubric: [
      "Separate ranking generation from the seek position.",
      "Describe generation retention and expiry.",
      "Keep current visibility authoritative when serving content.",
    ],
    alternatives:
      "Stop using a generation and restart pagination if a large policy change makes keeping the old ordering impractical.",
    pitfall:
      "A cursor built from a previous score and applied to today's scores does not stabilize the ordering.",
    sources: [sources.pagination, sources.auth],
  },
  {
    id: "recall-tree-path-sum",
    topic: "Algorithms",
    difficulty: "Intermediate",
    title: "Separate a tree path from its contribution",
    prompt:
      "In a binary tree with signed values, a path may begin and end anywhere. What does a postorder function return when finding the maximum nonempty path sum?",
    explanation:
      "Return the best downward path starting at the current node, so a parent can attach at most one branch. At each node, separately consider a complete path using the node and both positive child contributions. Maintain the best of those complete paths, initialized to negative infinity so all-negative inputs still select a node. Each node is visited once and the traversal stack is O(height).",
    rubric: [
      "Define the one-branch value returned upward.",
      "Score a path through both children independently.",
      "Handle a tree with all negative values and state the cost.",
    ],
    alternatives:
      "Use an explicit postorder stack when recursion depth can exceed the language’s call stack.",
    pitfall:
      "Returning both branches to a parent would create a branching subgraph rather than a path.",
    sources: [mit],
  },
];
