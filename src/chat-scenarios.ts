import type { Question } from "./content.ts";
import {
  actors,
  application,
  cache,
  evolve,
  photos,
  sources as s,
} from "./scenario-authoring.ts";

const direct = evolve(application, {
  customer: { name: "Sender", purpose: "Send a direct message" },
  restaurant: { name: "Recipient", purpose: "Read a conversation" },
  api: { purpose: "Direct-message API" },
  database: { purpose: "Messages + memberships" },
});
const live = evolve(
  direct,
  { api: { purpose: "API + live connections" } },
  [],
  direct.connections.map((e) =>
    e.to === "api" ? { ...e, label: "WebSocket" } : e,
  ),
);
const catchup = evolve(live, {
  api: { purpose: "Live + cursor catch-up" },
  database: { purpose: "Durable conversation log" },
});
const gaps = evolve(catchup, {
  api: { purpose: "Server-issued cursors" },
  database: { purpose: "Messages + retention floor" },
});
const dedup = evolve(catchup, {
  database: { purpose: "Unique send IDs + results" },
});
const slow = evolve(live, { api: { purpose: "Bounded socket buffers" } });
const history = evolve(direct, {
  database: { purpose: "Indexed message history" },
});
const historyBound = evolve(history, {
  api: { purpose: "Bounded history pages" },
});
const membership = evolve(history, {
  api: { purpose: "Authorize every page" },
  database: { purpose: "Messages + member checks" },
});

const team = evolve(application, {
  customer: { name: "Members", purpose: "Read and send messages" },
  restaurant: { name: "Team admins", purpose: "Manage channel access" },
  api: { purpose: "Team-channel API" },
  database: { purpose: "Channels + messages" },
});
const fanout = evolve(
  team,
  { api: { purpose: "WebSocket API replicas" } },
  [
    {
      id: "balancer",
      name: "AWS ALB",
      purpose: "Healthy socket routing",
      kind: "network",
      service: "alb",
      x: 300,
      y: 292,
    },
    { ...cache, purpose: "Pub/Sub notification hints" },
  ],
  [
    { from: "customer", to: "balancer", label: "WebSocket" },
    {
      from: "restaurant",
      to: "api",
      label: "Manage access",
      labelAt: { x: 268, y: 260 },
    },
    { from: "balancer", to: "api", label: "Route connections" },
    { from: "api", to: "database", label: "Commit messages" },
    { from: "api", to: "cache", label: "Publish / subscribe" },
  ],
);
const missed = evolve(fanout, {
  database: { purpose: "Log + catch-up cursors" },
  cache: { purpose: "Hints; replay from RDS" },
});
const retention = evolve(missed, {
  database: { purpose: "Log + retention floor" },
  api: { purpose: "Explicit resync responses" },
});
const reconnects = evolve(missed, {
  api: { purpose: "Admit bounded catch-up" },
});
const presence = evolve(fanout, {
  cache: { purpose: "Hints + expiring presence" },
});
const attachments = evolve(
  team,
  { database: { purpose: "Messages + approved keys" } },
  [photos],
  [
    ...team.connections,
    {
      from: "customer",
      to: "photos",
      label: "Scoped staging upload",
      via: [
        { x: 0, y: 144 },
        { x: 0, y: 440 },
        { x: 682, y: 440 },
      ],
      labelAt: { x: 350, y: 426 },
    },
    { from: "api", to: "photos", label: "Validate + approve" },
  ],
);
const revoked = evolve(
  attachments,
  { api: { purpose: "Authorized file proxy" } },
  [],
  attachments.connections.map((e) =>
    e.from === "api" && e.to === "photos"
      ? { ...e, label: "Read approved bytes" }
      : e,
  ),
);
const orphaned = evolve(attachments, {
  database: { purpose: "Upload states + references" },
  photos: { purpose: "Staging + approved bytes" },
});

export const chatVariants = [
  {
    id: "chat-direct",
    family: "chat",
    root: "chat-small-start",
    name: "Direct messages",
    description:
      "A hypothetical chat service for ten coworkers. Start with durable messages and reason through changing delivery requirements.",
  },
  {
    id: "chat-channels",
    family: "chat",
    root: "chat-team-start",
    name: "Team channels",
    description:
      "A hypothetical team chat with shared channels. Reason about live delivery, membership, and private attachments.",
  },
] as const;

export const chatQuestions: Record<string, Question> = {
  "chat-small-start": {
    id: "chat-small-start",
    title: "Ten coworkers want to chat.",
    difficulty: "Foundation",
    prompt:
      "Design direct messages for ten coworkers. A sender posts text and a recipient opens the conversation to read it. What is the smallest architecture that keeps an acknowledged message after an application restart?",
    givens: [
      "Around 200 messages a day",
      "Polling is acceptable initially",
      "Only conversation members may read or send",
    ],
    rubric: [
      "Persist messages and membership in a durable store.",
      "Acknowledge only after commit and authorize each operation.",
      "Choose stable message identities and a server-defined conversation order.",
    ],
    explanation:
      "An EC2 API and RDS PostgreSQL are enough to start. Store conversations, memberships, stable message IDs, and message contents. Check membership on reads and writes, and acknowledge a send only after commit. Assign a per-conversation position while locking its conversation row, committing the position and message together; this gives a clear local order without promising a global order. Initially the recipient can poll for later positions. Measure latency and database load, and protect the deployment with backups and an availability plan.",
    alternatives:
      "A managed application runtime can replace EC2. A transactional document store can work with an explicit conversation-order and access-control strategy.",
    pitfall:
      "Keeping acknowledged messages only in a process, or trusting a conversation ID as permission to read it.",
    sources: [s.transactions, s.locks, s.auth],
    questionFrame: actors(direct),
    answerFrame: direct,
    children: ["chat-live", "chat-history"],
    focus: {
      question: ["customer", "restaurant"],
      answer: ["customer", "restaurant", "api", "database"],
      label: "Direct messages",
    },
  },
  "chat-live": {
    id: "chat-live",
    title: "Messages should appear immediately.",
    difficulty: "Foundation",
    prompt:
      "Continue from the direct-message design. Recipients now need messages to appear while a conversation is open, without frequent polling. How would you add live delivery while keeping durable acceptance separate from notification?",
    givens: [
      "One application instance still handles the measured load",
      "A connection may close at any time",
      "The database remains the durable message store",
    ],
    rubric: [
      "Use a persistent connection such as WebSocket for live notifications.",
      "Commit before acknowledging or advertising a durable message.",
      "Authenticate connections and authorize conversation subscriptions.",
    ],
    explanation:
      "Let the EC2 API own authenticated WebSocket connections and subscribe them only to authorized conversations. Commit each message and its conversation position to PostgreSQL before acknowledging acceptance or notifying recipients. A socket delivery is a transport event, not proof of durable storage or human reading. Bound buffers, timeouts, and connection lifetime. Keep an HTTP history endpoint because connectivity is temporary and the database, rather than socket memory, owns the conversation.",
    alternatives:
      "Server-sent events plus HTTP sends fit one-way server updates. Long polling is a reasonable simpler option when measured scale and latency permit it.",
    pitfall:
      "Acknowledging a send before commit, or treating a successful socket write as a read receipt.",
    sources: [s.sockets, s.transactions, s.auth],
    questionFrame: direct,
    answerFrame: live,
    children: ["chat-reconnect", "chat-slow-reader"],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["customer", "api", "database"],
      label: "Live message delivery",
    },
  },
  "chat-reconnect": {
    id: "chat-reconnect",
    title: "A phone reconnects after a tunnel.",
    difficulty: "Intermediate",
    prompt:
      "Continue from live direct messages. A recipient loses connectivity for a minute while several messages commit. How would reconnecting recover missing messages without losing messages that arrive during catch-up?",
    givens: [
      "Messages have durable per-conversation positions",
      "The device remembers its last applied cursor",
      "Live notifications and history responses can overlap",
    ],
    rubric: [
      "Read durable messages after the last applied cursor in bounded pages.",
      "Define a race-safe handoff between catch-up and live delivery.",
      "Deduplicate by stable message identity and advance the cursor only after applying data.",
    ],
    explanation:
      "Authenticate again and fetch messages after the saved position. One handoff is to subscribe and buffer bounded live hints first, capture a durable high-water mark, then page history through that mark. Merge buffered hints by message ID and resume fetching later positions; periodic reconciliation handles missed hints. Persist the applied cursor only with the locally applied messages. Replaying overlap is safe when IDs are stable. A buffer overflow or lost connection should trigger another durable catch-up, not silent message loss.",
    alternatives:
      "A server-side resumable stream can provide the boundary. Polling the durable log alone is simpler if it meets the latency target.",
    pitfall:
      "Fetching history once and subscribing afterward, leaving a gap in which committed messages are never delivered.",
    sources: [s.sockets, s.pagination, s.transactions],
    questionFrame: live,
    answerFrame: catchup,
    children: ["chat-gap", "chat-duplicate-send"],
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database"],
      label: "Reconnect catch-up",
    },
  },
  "chat-gap": {
    id: "chat-gap",
    title: "The next position no longer exists.",
    difficulty: "Intermediate",
    prompt:
      "Continue from cursor catch-up. A client has applied position 101. Position 102 was legitimately deleted, but 103 exists. The client waits forever for 102. How should the cursor protocol handle gaps and retention?",
    givens: [
      "Positions order messages; they do not promise every integer still exists",
      "Deleted message contents must not be returned",
      "Some old cursors eventually fall outside retention",
    ],
    rubric: [
      "Scan by ordered positions rather than waiting for consecutive integers.",
      "Return a server-defined continuation and distinguish an empty page from a retention gap.",
      "Require explicit resynchronization when a cursor is no longer recoverable.",
    ],
    explanation:
      "Query the ordered log for positions greater than the cursor, so 103 can follow 101 without waiting for 102. A server-issued continuation may also advance through a scanned range containing deleted records. Define that range against a durable high-water mark so a late commit cannot appear behind the cursor; the transactional conversation ordering is the boundary. Retain deletion markers when clients need to remove previously applied messages. If the cursor predates the retention floor, return an explicit resync response with a current authorized snapshot rather than claiming no messages were missed.",
    alternatives:
      "A durable log offset can supply continuation semantics. Its compaction and retention rules still need an explicit client recovery contract.",
    pitfall:
      "Assuming sequence arithmetic proves a message is missing, or silently treating an expired cursor as up to date.",
    sources: [s.pagination, s.transactions],
    questionFrame: catchup,
    answerFrame: gaps,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database"],
      label: "Cursor semantics",
    },
  },
  "chat-duplicate-send": {
    id: "chat-duplicate-send",
    title: "The send succeeded. Its acknowledgment vanished.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the reconnect design. A sender retries after losing the acknowledgment of a committed message. How would the service recognize the same send across reconnects and different API instances?",
    givens: [
      "The sender can persist one ID for the logical send",
      "A retry may reach another process",
      "Reusing an ID with different text must be rejected",
    ],
    rubric: [
      "Reuse a stable sender-scoped send ID.",
      "Atomically enforce uniqueness and store the committed result.",
      "Return the original result on an identical retry and reject mismatched payloads.",
    ],
    explanation:
      "Persist a client send ID before sending and reuse it until the outcome is known. In PostgreSQL, uniquely constrain its authenticated sender and conversation scope. Commit that identity, a payload digest or comparable immutable payload, the message, and its position together. An identical retry returns the existing message and position; a different payload under the same ID conflicts. Socket acknowledgments can then be lost or repeated without another durable message. This does not claim that every network delivery occurs once; recipients still merge stable message IDs.",
    alternatives:
      "A client-generated permanent message ID can be the uniqueness key. A durable command processor can provide the same boundary at larger scale.",
    pitfall:
      "Keeping deduplication in an API process or generating a new send ID every time the socket reconnects.",
    sources: [s.constraints, s.transactions],
    questionFrame: catchup,
    answerFrame: dedup,
    children: [],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["customer", "api", "database"],
      label: "Retry-safe sends",
    },
  },
  "chat-slow-reader": {
    id: "chat-slow-reader",
    title: "One recipient stops reading.",
    difficulty: "Intermediate",
    prompt:
      "Continue from live direct messages. One connection accepts data extremely slowly and its server buffer keeps growing. How would you prevent that client from exhausting the application process?",
    givens: [
      "Durable messages already live in PostgreSQL",
      "Other conversations must remain responsive",
      "A disconnected client can fetch history later",
    ],
    rubric: [
      "Bound per-connection buffers and write deadlines.",
      "Disconnect or degrade slow consumers without blocking unrelated clients.",
      "Recover from durable history rather than retaining unbounded socket memory.",
    ],
    explanation:
      "Set per-connection limits on queued bytes, message count, and write time. If a client cannot keep up, stop adding to its buffer and close it with an explicit reconnect policy. Keep work isolated so one slow write cannot block the event loop or a shared broadcast path. Reconnect reads durable history from an applied cursor. Drop or coalesce expendable hints such as typing indicators, but do not silently discard durable message history. Observe slow-consumer disconnects and aggregate memory, not just connection counts.",
    alternatives:
      "Advertised flow-control credits or a pull-based delivery protocol can let a client request bounded batches.",
    pitfall:
      "Growing a per-socket list forever, or making one broadcast wait for every recipient before serving anyone else.",
    sources: [s.sockets, s.overload],
    questionFrame: live,
    answerFrame: slow,
    children: [],
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database"],
      label: "Slow-client isolation",
    },
  },
  "chat-history": {
    id: "chat-history",
    title: "A conversation has years of history.",
    difficulty: "Foundation",
    prompt:
      "Continue from the initial polling design. A conversation grows to a million messages. How would you fetch its previous 50 messages without reading and discarding an ever-growing offset?",
    givens: [
      "Messages have a unique ordered position within their conversation",
      "Only one small page is needed at a time",
      "Access checks still apply to every page",
    ],
    rubric: [
      "Use a stable keyset cursor scoped to the conversation.",
      "Index the conversation and position access path.",
      "Bound page size and authorize the requested conversation.",
    ],
    explanation:
      "Use a cursor such as the oldest returned position and request positions below it, ordered descending, with LIMIT 50. An index beginning with conversation_id and then position supports the filter and ordering. Return an opaque or validated continuation bound to the conversation and direction; possession of a cursor never grants access. A stable unique position avoids ambiguous ties. Keyset pagination supports sequential browsing efficiently, but it does not directly jump to an arbitrary page number.",
    alternatives:
      "A composite timestamp and stable message ID can define the order when a single position is unavailable. A search index serves different query needs.",
    pitfall:
      "Using a nonunique timestamp alone, or expecting OFFSET 900000 to avoid scanning the skipped rows.",
    sources: [s.pagination, s.indexes, s.auth],
    questionFrame: direct,
    answerFrame: history,
    children: ["chat-history-insert", "chat-membership"],
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database"],
      label: "History pagination",
    },
  },
  "chat-history-insert": {
    id: "chat-history-insert",
    title: "New messages arrive between history pages.",
    difficulty: "Intermediate",
    prompt:
      "Continue from indexed history. A client scrolls backward while new messages arrive at the newest end. How do you keep its older-page traversal stable, and what consistency does that actually promise?",
    givens: [
      "Message ordering positions are immutable",
      "New messages get later committed positions",
      "Existing messages may be deleted according to policy",
    ],
    rubric: [
      "Continue strictly below the oldest returned ordering key.",
      "Use a high-water mark if a fixed traversal window is required.",
      "Distinguish stable ordering from a snapshot of changing contents.",
    ],
    explanation:
      "For older pages, continue with position less than the last page's oldest position; newly inserted higher positions do not shift that boundary. Keep the ordering key immutable. If the product needs a fixed initial window, carry an authorized high-water mark along with the cursor. Deletions can shorten later pages, and edits can change returned content: keyset pagination alone does not freeze a database snapshot. A true historical snapshot needs versioned data or a bounded snapshot strategy, not just an encoded cursor.",
    alternatives:
      "Refresh the newest end separately while keeping backward traversal bounded. A short-lived database snapshot can provide stronger consistency with operational costs.",
    pitfall:
      "Calling an opaque cursor a snapshot guarantee, or returning the boundary row again by using the wrong comparison.",
    sources: [s.pagination, s.isolation],
    questionFrame: history,
    answerFrame: historyBound,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database"],
      label: "Stable history boundaries",
    },
  },
  "chat-membership": {
    id: "chat-membership",
    title: "A former member asks for another page.",
    difficulty: "Intermediate",
    prompt:
      "Continue from indexed history. A user was removed from a conversation after loading its first page but still has the old cursor. How would you stop that cursor from authorizing another history read?",
    givens: [
      "Membership changes are committed in PostgreSQL",
      "A cursor can be copied or replayed",
      "Already downloaded text cannot be recalled",
    ],
    rubric: [
      "Authorize current membership on every history request.",
      "Bind pagination to its resource and reject unauthorized access independently of cursor validity.",
      "Define revocation timing and avoid promises about already delivered data.",
    ],
    explanation:
      "Treat the cursor only as a position. Authenticate the caller and include a current membership check in the authorized history query or an equivalent transaction boundary. A revoked user cannot get another page merely by replaying a valid cursor. Define access at that database decision point; a response already authorized and in flight may arrive after revocation. Stronger coordination can serialize reads with revocation but cannot erase text already delivered. Avoid long-lived cached permission grants when immediate revocation is required.",
    alternatives:
      "Short permission leases can deliberately bound revocation delay if that matches the product contract. Resource-level database policies can enforce ownership checks centrally.",
    pitfall:
      "Signing the cursor and assuming its signature also proves the caller still belongs to the conversation.",
    sources: [s.auth, s.isolation],
    questionFrame: history,
    answerFrame: membership,
    children: [],
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database"],
      label: "History authorization",
    },
  },
  "chat-team-start": {
    id: "chat-team-start",
    title: "A team shares ten channels.",
    difficulty: "Foundation",
    prompt:
      "Design text channels for a team with 5,000 registered members. Measurements show around 100 active readers and ten sends per second at the peak. Where would you start, and which facts determine whether to distribute the service?",
    givens: [
      "Channel membership controls reads and sends",
      "Polling is acceptable for the first release",
      "A committed message must survive an API replacement",
    ],
    rubric: [
      "Persist channel membership and durable messages.",
      "Use measured workload rather than registered-user count to choose capacity.",
      "Define acknowledgment, ordering, and access boundaries.",
    ],
    explanation:
      "Start with an EC2 API and indexed RDS PostgreSQL records for channels, memberships, and messages. Acknowledge after durable commit and define an immutable channel ordering position, serialized with the message transaction. Authorize reads and sends against membership. Measure polling traffic, connection counts, database latency, and resource limits under representative load. Registered users alone do not establish a need for sharding. Backups and application availability still need explicit decisions even at a modest request rate.",
    alternatives:
      "Managed compute and a suitable transactional datastore can fill the same roles. Long polling may improve freshness before a persistent-connection deployment is justified.",
    pitfall:
      "Multiplying infrastructure based only on a member count, or omitting channel access checks because the team is internal.",
    sources: [s.transactions, s.auth],
    questionFrame: actors(team),
    answerFrame: team,
    children: ["chat-fanout", "chat-attachments"],
    focus: {
      question: ["customer", "restaurant"],
      answer: ["customer", "restaurant", "api", "database"],
      label: "Team channels",
    },
  },
  "chat-fanout": {
    id: "chat-fanout",
    title: "Members connect to different servers.",
    difficulty: "Intermediate",
    prompt:
      "Continue from team channels. The service now needs 30,000 live connections; load tests support about 10,000 healthy connections per API instance at the target workload. How would a committed message reach members connected to other instances?",
    givens: [
      "A channel can have connections on several instances",
      "Durable messages remain in PostgreSQL",
      "Membership must still govern subscriptions",
    ],
    rubric: [
      "Distribute authenticated persistent connections with measured headroom.",
      "Share notification hints across instances and fan out to local authorized sockets.",
      "Keep notification transport distinct from the durable message log.",
    ],
    explanation:
      "An Application Load Balancer can route WebSocket connections to EC2 replicas. Provision beyond the bare three-instance capacity if a failure must be tolerated. Each replica tracks its own authorized sockets and subscribes to channel hints through ElastiCache running Valkey Pub/Sub. Publish only committed message identities. Replicas deliver hints to their local members, while PostgreSQL remains the durable log. Pub/Sub is at-most-once and does not retain disconnected subscribers' messages. A work queue that gives each message to one consumer is not automatically a broadcast mechanism.",
    alternatives:
      "A durable broker with an appropriate subscription model or a managed connection gateway can replace Pub/Sub and EC2 connection management.",
    pitfall:
      "Keeping one process-local connection map and assuming it includes sockets on other instances, or planning no capacity for a failed replica.",
    sources: [
      s.pubsub,
      s.sockets,
      {
        label: "ALB WebSocket support",
        url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html",
      },
    ],
    questionFrame: team,
    answerFrame: fanout,
    children: ["chat-pubsub-loss", "chat-presence"],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["balancer", "api", "database", "cache"],
      label: "Cross-instance delivery",
    },
  },
  "chat-pubsub-loss": {
    id: "chat-pubsub-loss",
    title: "A notification never reached its subscribers.",
    difficulty: "Intermediate",
    prompt:
      "Continue from channel Pub/Sub. A message commits, but a publisher crashes before sending its hint or a subscriber disconnects briefly. How can clients converge on the committed channel history?",
    givens: [
      "Pub/Sub does not replay lost hints",
      "The durable channel log has ordered positions",
      "A client remembers its applied position",
    ],
    rubric: [
      "Use durable catch-up rather than relying on transient hints.",
      "Reconcile on reconnect and periodically or after suspected gaps.",
      "Deduplicate overlap and define a bounded live/catch-up handoff.",
    ],
    explanation:
      "Treat hints as a reason to fetch, not the only record of a message. Clients resume from their applied channel cursor against PostgreSQL, reconcile after reconnect, and periodically check a durable high-water mark. Subscribe and buffer bounded hints before catching up through a chosen mark, then merge later positions by stable identity. A transactional outbox can improve reliable hint publication but does not make transient subscribers durable. Recovery must still tolerate a lost hint, overlap, and a new disconnect during catch-up.",
    alternatives:
      "A replayable subscription log can provide durable delivery positions directly. A polling fallback may be sufficient for a relaxed convergence target.",
    pitfall:
      "Interpreting an empty Pub/Sub buffer as proof that the client has every committed message.",
    sources: [s.pubsub, s.outbox, s.pagination],
    questionFrame: fanout,
    answerFrame: missed,
    children: ["chat-retention-gap", "chat-reconnect-storm"],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Recoverable notifications",
    },
  },
  "chat-retention-gap": {
    id: "chat-retention-gap",
    title: "A laptop returns after history retention.",
    difficulty: "Intermediate",
    prompt:
      "Continue from channel catch-up. A laptop returns after 60 days, while the service retains only 30 days of message history. What should the resume API say when the saved cursor is older than recoverable history?",
    givens: [
      "Expired history cannot be reconstructed from Pub/Sub",
      "The service tracks a retention floor",
      "Current channel membership must be checked",
    ],
    rubric: [
      "Detect that the cursor predates recoverable history.",
      "Return an explicit resync or truncation contract.",
      "Build a current authorized snapshot without claiming complete historical delivery.",
    ],
    explanation:
      "Compare the requested cursor with the channel's retention floor. Return an explicit cursor-expired response and a bounded current snapshot or latest retained page with a new continuation. The client should show that older history is unavailable and reconcile its local view according to the product's deletion policy. Recheck membership before returning anything. If the product promises recovery beyond 30 days, retain an authorized archive or extend retention; a different cursor encoding cannot recreate deleted records.",
    alternatives:
      "A separate archive can support older reads with different latency and cost. Deliberate local-only history is possible if privacy and deletion policies allow it.",
    pitfall:
      "Returning an empty successful page and advancing the cursor as if no history had been lost.",
    sources: [s.pagination, s.auth],
    questionFrame: missed,
    answerFrame: retention,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database"],
      label: "Expired resume cursors",
    },
  },
  "chat-reconnect-storm": {
    id: "chat-reconnect-storm",
    title: "Everyone reconnects after a brief outage.",
    difficulty: "Intermediate",
    prompt:
      "Continue from channel catch-up. After an outage, tens of thousands of clients immediately request history. How would you recover without turning the durable database into the next outage?",
    givens: [
      "The database has a measured safe read budget",
      "A client may belong to many channels",
      "Recovery may take time, but accepted history must remain correct",
    ],
    rubric: [
      "Bound server-side catch-up admission, page sizes, and concurrency.",
      "Add client jitter and explicit retry guidance.",
      "Prioritize useful progress and monitor lag without discarding durable history.",
    ],
    explanation:
      "Limit concurrent catch-up reads and per-account work, cap page sizes, and reserve capacity for ordinary sends. Reject excess work with retry guidance; clients use bounded exponential backoff and jitter rather than synchronized loops. Resume from persisted cursors so retries do not restart whole histories. Stagger channel subscriptions and avoid one request per historical message. Monitor oldest recovery lag and database saturation. Scaling connection servers does not remove the database's catch-up budget, and client backoff alone cannot enforce it against every caller.",
    alternatives:
      "A durable read tier or precomputed authorized history pages can add capacity for eligible reads. Add them against measurements and a stated freshness model.",
    pitfall:
      "Retrying every failed reconnect immediately, or opening unbounded database connections from each new API replica.",
    sources: [s.overload, s.retries],
    questionFrame: missed,
    answerFrame: reconnects,
    children: [],
    focus: {
      question: ["balancer", "api", "database"],
      answer: ["balancer", "api", "database"],
      label: "Recovery admission",
    },
  },
  "chat-presence": {
    id: "chat-presence",
    title: "Online indicators survive a crashed server.",
    difficulty: "Intermediate",
    prompt:
      "Continue from channel fanout. A connection server crashes before publishing its users' offline events, leaving them online forever. How would you represent useful presence without treating disconnect events as reliable truth?",
    givens: [
      "Presence may be approximate for a short stated window",
      "One account can have several devices",
      "Durable message history must not depend on presence",
    ],
    rubric: [
      "Use expiring per-connection or per-device presence leases.",
      "Aggregate multiple devices and tolerate missed disconnects.",
      "State the freshness limit and keep presence separate from durable message state.",
    ],
    explanation:
      "Store short-lived presence records in ElastiCache keyed by connection or device and refresh them with heartbeats. A crash stops refreshes, so leases eventually expire even without an offline event. Aggregate active leases per account rather than letting one device's disconnect mark every device offline. Include connection generations so delayed cleanup cannot delete a newer session. Explain that partitions, suspension, and heartbeat intervals make presence approximate; it must never decide whether a committed message exists or whether a user is authorized.",
    alternatives:
      "A dedicated presence service can manage leases at larger scale. At small scale, a database heartbeat table with bounded cleanup can be sufficient.",
    pitfall:
      "Storing a permanent online boolean cleared only by a graceful disconnect.",
    sources: [s.cache, s.sockets],
    questionFrame: fanout,
    answerFrame: presence,
    children: [],
    focus: {
      question: ["customer", "api", "cache"],
      answer: ["customer", "api", "cache"],
      label: "Expiring presence",
    },
  },
  "chat-attachments": {
    id: "chat-attachments",
    title: "A channel message includes a file.",
    difficulty: "Foundation",
    prompt:
      "Continue from the initial team-channel API. Members can now attach files to messages. How would you store bytes and expose only approved attachments to authorized channel members?",
    givens: [
      "Uploads can be large compared with message text",
      "Unvalidated objects must stay private",
      "Channel membership governs attachment reads",
    ],
    rubric: [
      "Store file bytes in private object storage and metadata in the database.",
      "Authorize scoped uploads and validate exact captured bytes before approval.",
      "Authorize attachment reads separately from knowing an object key.",
    ],
    explanation:
      "Keep bytes in S3 and message ownership, channel association, and approved object identifiers in PostgreSQL. After authorizing membership, issue a short-lived upload capability for a chosen private staging key. Capture an immutable copy or pin a version before validating it, and approve only those exact bytes. An approved attachment read checks current channel membership before issuing a bounded download capability or proxying bytes. A successful upload is neither approval nor permission for other users to read it.",
    alternatives:
      "Proxy small uploads through the application when that simplifies validation. A managed file service can supply the storage and scanning boundary.",
    pitfall:
      "Making the bucket public because message IDs are difficult to guess, or validating a key that can still be overwritten afterward.",
    sources: [s.uploads, s.s3, s.auth],
    questionFrame: team,
    answerFrame: attachments,
    children: ["chat-attachment-revoke", "chat-upload-orphan"],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["customer", "api", "database", "photos"],
      label: "Private file attachments",
    },
  },
  "chat-attachment-revoke": {
    id: "chat-attachment-revoke",
    title: "A removed member kept a download URL.",
    difficulty: "Intermediate",
    prompt:
      "Continue from approved attachments. A removed member still holds a presigned S3 download URL. The product now requires membership checks on every new download request. How must the delivery policy change?",
    givens: [
      "A presigned URL is a reusable bearer capability until its effective expiry",
      "Previously downloaded bytes cannot be recalled",
      "Requests already authorized and in flight have a separate boundary",
    ],
    rubric: [
      "Explain why database revocation does not automatically revoke an issued URL.",
      "Use a delivery layer that checks current authorization for each new request.",
      "Define expiry, caching, and already-delivered-data limitations.",
    ],
    explanation:
      "A presigned URL does not consult the application's membership table on every use. Move downloads to an authorized proxy or equivalent layer that checks membership at each request's decision point. During cutover, invalidate old direct-read capabilities through the applicable S3 policy or signing-credential boundary; stopping new URL issuance alone leaves old URLs usable. Restrict origin reads to the new delivery path and use private/no-store responses where required. Short-lived URLs offer bounded delay, not immediate membership checks. No policy can recall bytes already delivered.",
    alternatives:
      "Accept a documented short capability lifetime if the product can tolerate delayed revocation. An edge authorization layer can reduce proxy bandwidth with an appropriate revocation protocol.",
    pitfall:
      "Deleting a membership row and claiming that every already issued S3 URL immediately stops working.",
    sources: [s.uploads, s.auth, s.httpCache],
    questionFrame: attachments,
    answerFrame: revoked,
    children: [],
    focus: {
      question: ["customer", "api", "photos"],
      answer: ["customer", "api", "photos"],
      label: "Download authorization",
    },
  },
  "chat-upload-orphan": {
    id: "chat-upload-orphan",
    title: "An upload finished but its message never appeared.",
    difficulty: "Intermediate",
    prompt:
      "Continue from approved attachments. A browser uploads a file and closes before creating its message. How would you clean up abandoned objects without deleting files that another valid request is publishing?",
    givens: [
      "S3 and PostgreSQL do not share one transaction",
      "Retries and cleanup can overlap",
      "Published attachments must remain referenced and private",
    ],
    rubric: [
      "Track durable upload states and stable object identities.",
      "Coordinate publication and cleanup with conditional state transitions.",
      "Use a safe staging-retention policy and recover from partially completed cleanup.",
    ],
    explanation:
      "Create an upload record with an owner, channel, expiry, and staged object identity. Publication checks authorization and conditionally moves the record to a published state while linking the approved immutable object to a message in one database transaction. Cleanup first claims only expired unpublished uploads with a mutually exclusive state transition, then deletes their exact unreferenced staged objects idempotently. Retry partial cleanup. A staging-only S3 lifecycle policy can be a safety net, but it must not expire published bytes or race promotion by assuming every old object is abandoned.",
    alternatives:
      "Keep staging and serving objects in separate prefixes or buckets with different lifecycle rules. A durable job queue can drive cleanup retries.",
    pitfall:
      "Deleting all objects older than a timestamp without checking whether they are published or currently being committed.",
    sources: [s.transactions, s.s3, s.uploads],
    questionFrame: attachments,
    answerFrame: orphaned,
    children: [],
    focus: {
      question: ["api", "database", "photos"],
      answer: ["api", "database", "photos"],
      label: "Upload lifecycle",
    },
  },
};
