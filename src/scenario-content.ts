import { questions as legacyQuestions, rootQuestionId } from "./content.ts";
import type { Component, DiagramFrame, Question } from "./content.ts";

export const legacyRevision = "2026-11-05.1";
export const scenarioRevision = "2026-11-05.2";
export type ScenarioRevision = typeof legacyRevision | typeof scenarioRevision;

export const scenarioVariants = [
  {
    id: "delivery-neighborhood",
    root: rootQuestionId,
    name: "One neighborhood restaurant",
    description:
      "A hypothetical DoorDash-style service. Start with ten customers and reason through what changes.",
  },
  {
    id: "delivery-preorders",
    root: "delivery-preorder-start",
    name: "Limited pickup portions",
    description:
      "A hypothetical restaurant preorder service. Keep limited stock correct as demand and kitchen workflows change.",
  },
] as const;

const pg = {
  label: "PostgreSQL row locks",
  url: "https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS",
};
const transactions = {
  label: "PostgreSQL transactions",
  url: "https://www.postgresql.org/docs/current/tutorial-transactions.html",
};
const cacheSource = {
  label: "AWS cache-aside strategies",
  url: "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html",
};
const queueSource = {
  label: "SQS at-least-once delivery",
  url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html",
};
const outboxSource = {
  label: "AWS transactional outbox pattern",
  url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html",
};
const s3Source = {
  label: "S3 object versioning",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html",
};
const base = legacyQuestions[rootQuestionId]!.answerFrame;
const scaled = legacyQuestions["delivery-lunch-rush"]!.answerFrame;
const photos = legacyQuestions["delivery-menu-photos"]!.answerFrame;

function update(
  frame: DiagramFrame,
  changes: Record<string, Partial<Component>>,
  added: Component[] = [],
): Component[] {
  return [
    ...frame.components.map((c) =>
      changes[c.id] ? { ...c, ...changes[c.id] } : c,
    ),
    ...added,
  ];
}
const cache: Component = {
  id: "cache",
  name: "AWS ElastiCache",
  purpose: "Disposable menu cache",
  kind: "database",
  service: "elasticache",
  x: 576,
  y: 292,
};
const queue: Component = {
  id: "queue",
  name: "Amazon SQS",
  purpose: "Durable work delivery",
  kind: "compute",
  service: "sqs",
  x: 852,
  y: 292,
};
const worker: Component = {
  id: "worker",
  name: "Amazon EC2",
  purpose: "Background worker",
  kind: "compute",
  service: "ec2",
  x: 852,
  y: 484,
};
const expiry: Component = {
  id: "expiry-worker",
  name: "Amazon EC2",
  purpose: "Reservation expiry worker",
  kind: "compute",
  service: "ec2",
  x: 576,
  y: 292,
};

const cachedMenus: DiagramFrame = {
  components: [...scaled.components, cache],
  connections: [
    ...scaled.connections,
    { from: "api", to: "cache", label: "Cache-aside menu reads" },
  ],
};
const receiptWork: DiagramFrame = {
  components: update(
    scaled,
    { database: { purpose: "Orders + outbox events" } },
    [
      {
        id: "relay",
        name: "Amazon EC2",
        purpose: "Retryable outbox relay",
        kind: "compute",
        service: "ec2",
        x: 576,
        y: 292,
      },
      { ...queue, x: 852, purpose: "Receipt events" },
      { ...worker, x: 1128, y: 292, purpose: "Idempotent receipt worker" },
    ],
  ),
  connections: [
    ...scaled.connections.map((e) =>
      e.to === "database" ? { ...e, label: "Order + event commit" } : e,
    ),
    { from: "database", to: "relay", label: "Read pending outbox" },
    {
      from: "relay",
      to: "queue",
      label: "Publish event ID",
      via: [
        { x: 682, y: 428 },
        { x: 958, y: 428 },
      ],
    },
    {
      from: "queue",
      to: "worker",
      label: "At-least-once work",
      via: [
        { x: 958, y: 484 },
        { x: 1234, y: 484 },
      ],
    },
  ],
};
const photoCdn: DiagramFrame = {
  components: [
    ...photos.components,
    {
      id: "cdn",
      name: "Amazon CloudFront",
      purpose: "Approved image delivery",
      kind: "network",
      service: "cloudfront",
      x: 852,
      y: 292,
    },
  ],
  connections: [
    ...photos.connections,
    {
      from: "customer",
      to: "cdn",
      label: "Versioned image URL",
      labelAt: { x: 300, y: 606 },
      via: [
        { x: 0, y: 144 },
        { x: 0, y: 620 },
        { x: 958, y: 620 },
      ],
    },
    {
      from: "cdn",
      to: "photos",
      label: "Signed origin fetch",
      via: [
        { x: 958, y: 440 },
        { x: 682, y: 440 },
      ],
    },
  ],
};
const photoRollback: DiagramFrame = {
  components: update(photos, {
    database: { purpose: "Approved key + revision" },
    photos: { purpose: "Immutable approved objects" },
  }),
  connections: photos.connections.map((e) =>
    e.to === "database"
      ? { ...e, label: "Compare revision + swap key" }
      : e.to === "photos" && e.from === "api"
        ? { ...e, label: "Read approved object key" }
        : e,
  ),
};
const photoJobs: DiagramFrame = {
  components: update(
    photos,
    { photos: { purpose: "Staging + approved objects" } },
    [
      { ...queue, purpose: "Upload validation jobs" },
      { ...worker, purpose: "Validate before publication" },
    ],
  ),
  connections: [
    ...photos.connections.filter(
      (e) => !(e.from === "api" && e.to === "photos"),
    ),
    {
      from: "photos",
      to: "queue",
      label: "Upload event",
      via: [
        { x: 682, y: 420 },
        { x: 958, y: 420 },
      ],
    },
    { from: "queue", to: "worker", label: "Retryable validation" },
    {
      from: "worker",
      to: "photos",
      label: "Validated object",
      via: [
        { x: 820, y: 528 },
        { x: 820, y: 336 },
      ],
      labelAt: { x: 820, y: 460 },
    },
    {
      from: "worker",
      to: "database",
      label: "Publish approved key",
      via: [
        { x: 1180, y: 528 },
        { x: 1180, y: 48 },
        { x: 682, y: 48 },
      ],
      labelAt: { x: 930, y: 36 },
    },
  ],
};

const preorderStart: DiagramFrame = {
  components: base.components
    .filter((c) => c.kind === "person")
    .map((c) => ({
      ...c,
      purpose:
        c.id === "customer"
          ? "Reserve a pickup portion"
          : "Set available portions",
    })),
  connections: [],
};
const preorders: DiagramFrame = {
  components: [
    ...preorderStart.components,
    ...base.components
      .filter((c) => c.kind !== "person")
      .map((c) => ({
        ...c,
        purpose:
          c.id === "api" ? "Preorder API" : "Orders + available portions",
      })),
  ],
  connections: [
    { from: "customer", to: "api", label: "Reserve a portion" },
    { from: "restaurant", to: "api", label: "Set pickup capacity" },
    { from: "api", to: "database", label: "Durable reservations" },
  ],
};
const atomicStock: DiagramFrame = {
  components: update(preorders, {
    database: { purpose: "Atomic stock + orders" },
  }),
  connections: preorders.connections.map((e) =>
    e.to === "database" ? { ...e, label: "Conditional stock + order" } : e,
  ),
};
const expiringHolds: DiagramFrame = {
  components: update(
    atomicStock,
    { database: { purpose: "Stock + timed hold states" } },
    [expiry],
  ),
  connections: [
    ...atomicStock.connections.map((e) =>
      e.to === "database" ? { ...e, label: "Check hold state + deadline" } : e,
    ),
    {
      from: "database",
      to: "expiry-worker",
      label: "Expire due holds atomically",
    },
  ],
};
const expiryRetry: DiagramFrame = {
  components: update(expiringHolds, {
    database: { purpose: "Conditional hold release" },
  }),
  connections: expiringHolds.connections.map((e) =>
    e.to === "expiry-worker"
      ? { ...e, label: "Release only if still held" }
      : e,
  ),
};
const expiryBacklog: DiagramFrame = {
  components: update(expiringHolds, {
    database: { purpose: "Indexed expiry batches" },
    "expiry-worker": { purpose: "Concurrent expiry workers" },
  }),
  connections: expiringHolds.connections.map((e) =>
    e.to === "expiry-worker"
      ? { ...e, label: "Locked batches; skip locked" }
      : e,
  ),
};
const priceSnapshots: DiagramFrame = {
  components: update(atomicStock, {
    database: { purpose: "Orders + accepted prices" },
  }),
  connections: atomicStock.connections.map((e) =>
    e.to === "database" ? { ...e, label: "Commit accepted quote" } : e,
  ),
};
const cachedStatus: DiagramFrame = {
  components: update(
    preorders,
    { database: { purpose: "Durable kitchen state" } },
    [{ ...cache, purpose: "Short-lived status views" }],
  ),
  connections: [
    ...preorders.connections.map((e) =>
      e.from === "restaurant" ? { ...e, label: "Commit kitchen updates" } : e,
    ),
    { from: "api", to: "cache", label: "Cache-aside status reads" },
  ],
};
const cacheOutage: DiagramFrame = {
  components: update(cachedStatus, {
    api: { purpose: "Bounded fallback reads" },
    cache: { purpose: "Unavailable; bypassed", unavailable: true },
  }),
  connections: cachedStatus.connections
    .filter((e) => e.to !== "cache")
    .map((e) =>
      e.to === "database" ? { ...e, label: "Bounded primary reads" } : e,
    ),
};
const orderedStatus: DiagramFrame = {
  components: update(cachedStatus, {
    database: { purpose: "Versioned kitchen states" },
    cache: { purpose: "Disposable versioned views" },
  }),
  connections: cachedStatus.connections.map((e) =>
    e.to === "database" ? { ...e, label: "Version + legal transition" } : e,
  ),
};

export const scenarioQuestions: Record<string, Question> = {
  ...legacyQuestions,
  [rootQuestionId]: {
    ...legacyQuestions[rootQuestionId]!,
    difficulty: "Foundation",
    focus: {
      question: ["customer", "restaurant"],
      answer: ["customer", "restaurant", "api", "database"],
      label: "Starting architecture",
    },
  },
  "delivery-lunch-rush": {
    ...legacyQuestions["delivery-lunch-rush"]!,
    difficulty: "Foundation",
    children: ["delivery-menu-cache", "delivery-receipt-queue"],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["balancer", "api", "database"],
      label: "Application traffic",
    },
  },
  "delivery-menu-photos": {
    ...legacyQuestions["delivery-menu-photos"]!,
    difficulty: "Foundation",
    children: [
      "delivery-photo-cdn",
      "delivery-photo-rollback",
      "delivery-photo-backlog",
    ],
    alternatives:
      "Another object-storage service can fill the same role. A controlled proxy upload can simplify validation for small files, at the cost of application bandwidth. Ownership checks and approval still matter.",
    explanation:
      "Use Amazon S3 for image objects. After checking restaurant ownership, the API issues a short-lived presigned upload URL for an application-chosen staging key. The browser uploads directly to a private bucket. Capture an immutable application-controlled copy or pin a specific S3 version before validation, then publish only those exact validated bytes. The upload URL must not overwrite the approved object. Record its approved key or version in PostgreSQL and use controlled reads. A successful upload alone never makes an image public.",
    focus: {
      question: ["restaurant", "api", "database"],
      answer: ["restaurant", "api", "database", "photos"],
      label: "Photo uploads",
    },
  },
  "delivery-checkout-retry": {
    ...legacyQuestions["delivery-checkout-retry"]!,
    difficulty: "Intermediate",
    focus: {
      question: ["customer", "api", "database"],
      answer: ["customer", "api", "database"],
      label: "Order creation",
    },
  },
  "delivery-menu-cache": {
    id: "delivery-menu-cache",
    title: "Everyone wants the same menu.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the scaled application design. Most requests read the same restaurant menu, and these reads now dominate database time. The restaurant changes its menu a few times a day. How would you reduce database work while making a clear promise about freshness?",
    givens: [
      "Menu reads may be up to 30 seconds stale",
      "Orders and current stock must still use authoritative database checks",
      "A cache can fail or lose every entry",
    ],
    rubric: [
      "Use cache-aside reads with bounded expiry and update/invalidation behavior.",
      "Explain stale fills, simultaneous misses, and how database fallback is bounded.",
      "Keep order validation independent of cached menu data.",
    ],
    explanation:
      "Put disposable menu entries in Amazon ElastiCache. On a miss, read RDS PostgreSQL and cache the result only until its 30-second freshness window ends, measured from the database read rather than a delayed cache fill. Discard late fills and invalidate or refresh after a committed menu change. A concurrent old reader can refill stale data; version checks can prevent that race, while the age bound limits its effect. Coalesce simultaneous misses, cap fallback database concurrency, and validate price and stock when accepting an order. Measure hit rate and database load.",
    alternatives:
      "A small local cache is simpler for one process, but instances can disagree and lose entries independently. Versioned cache keys or a write-through policy fit stricter update requirements.",
    pitfall:
      "Trusting cached availability during checkout or sending every cache miss to an unprotected database.",
    sources: [cacheSource],
    questionFrame: scaled,
    answerFrame: cachedMenus,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database", "cache"],
      label: "Menu reads",
    },
  },
  "delivery-receipt-queue": {
    id: "delivery-receipt-queue",
    title: "Receipts are slowing checkout.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the scaled application design. Sending a receipt now adds seconds to checkout and occasionally fails. Orders must remain accepted when the receipt service is slow. How would you move this work out of the request without losing committed order events?",
    givens: [
      "An accepted order must eventually produce a receipt attempt",
      "The receipt provider accepts a stable idempotency key",
      "A worker or publisher can crash at any point",
    ],
    rubric: [
      "Commit the order and an outbox event in one database transaction.",
      "Relay events to a durable queue and retry safely after ambiguous publishing results.",
      "Use event IDs for provider idempotency, and account for redelivery and poisoned work.",
    ],
    explanation:
      "Write the order and a receipt event to a transactional outbox in RDS PostgreSQL. A separate EC2 relay publishes pending events to Amazon SQS and marks progress only after a successful publish. A crash can cause another publish, so an EC2 receipt worker reuses the event ID as the provider’s idempotency key. Delete the queue message after success; tune visibility timeouts and route repeated failures to a dead-letter queue for inspection. Monitor the oldest pending event. This gives durable attempts without claiming that a queue alone makes external effects exactly once.",
    alternatives:
      "A managed change stream can relay committed events. A scheduled database worker may be enough at small scale. If the provider cannot deduplicate, document and limit possible duplicate receipts.",
    pitfall:
      "Committing the order and then publishing once from the request handler, leaving a crash window that loses the event.",
    sources: [outboxSource, queueSource],
    questionFrame: scaled,
    answerFrame: receiptWork,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["database", "relay", "queue", "worker"],
      label: "Receipt delivery",
    },
  },
  "delivery-photo-cdn": {
    id: "delivery-photo-cdn",
    title: "Photos are slow far from the restaurant.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the approved-photo design. Customers in distant regions repeatedly fetch the same public menu photos. How would you deliver approved images closer to them while preventing direct reads of private staging objects?",
    givens: [
      "Approved menu photos are public; staging objects are private",
      "A newly published photo can use a new URL",
      "Uploading and approval still follow the existing path",
    ],
    rubric: [
      "Serve approved objects through a CDN and use versioned object URLs.",
      "Restrict the S3 origin to the intended CloudFront distribution and approved objects.",
      "Distinguish origin access control from end-user authorization and cache freshness.",
    ],
    explanation:
      "Use Amazon CloudFront with an S3 origin access control that signs origin requests. Keep S3 public access blocked and scope its bucket policy to the distribution and approved-object prefix. A CloudFront behavior must not expose staging keys merely because the origin is private. Publish immutable, versioned image URLs and set cache policy deliberately; changing a database pointer does not evict an old cached URL. OAC authenticates CloudFront to S3. Private end-user images would additionally need viewer authorization such as signed URLs or cookies.",
    alternatives:
      "Another CDN with a restricted object-storage origin works. At low traffic, direct authorized S3 reads may remain simpler. Invalidation can remove cached content when a stable URL must change.",
    pitfall:
      "Making the whole bucket public, or assuming OAC decides which customers may view an object.",
    sources: [
      {
        label: "CloudFront access to private S3 origins",
        url: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html",
      },
    ],
    questionFrame: photos,
    answerFrame: photoCdn,
    children: [],
    focus: {
      question: ["customer", "api", "photos"],
      answer: ["customer", "cdn", "photos"],
      label: "Approved image reads",
    },
  },
  "delivery-photo-rollback": {
    id: "delivery-photo-rollback",
    title: "The approved photo was the wrong one.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the approved-photo design. A restaurant publishes the wrong approved image and asks to restore its previous approved photo. Two editors may act at once. How would you make the change reversible without accidentally publishing an unreviewed upload?",
    givens: [
      "Approved images already have separate serving keys or pinned versions",
      "The previous approved image must remain available",
      "An editor can submit a request based on an outdated menu revision",
    ],
    rubric: [
      "Retain immutable approved objects or versions and reference their exact identifiers.",
      "Change the published pointer transactionally with an expected revision check.",
      "Keep staging approval separate and handle stale edits explicitly.",
    ],
    explanation:
      "Store the current and previous approved object identifiers with the menu’s revision in PostgreSQL. Keep the approved bytes immutable: either unique serving keys or a specific S3 version ID. A restore changes the pointer only if the expected menu revision still matches; otherwise return the current state for the editor to resolve. Retain referenced versions according to a policy before removing unused objects. S3 versioning can preserve old bytes, but it does not decide which version passed application approval.",
    alternatives:
      "An append-only publication table gives a fuller audit trail. Separate immutable object keys work without enabling S3 versioning, provided old objects are retained.",
    pitfall:
      "Restoring the latest uploaded object instead of the last approved object, or silently overwriting another editor’s publication.",
    sources: [s3Source, transactions],
    questionFrame: photos,
    answerFrame: photoRollback,
    children: [],
    focus: {
      question: ["api", "database", "photos"],
      answer: ["api", "database", "photos"],
      label: "Photo publication",
    },
  },
  "delivery-photo-backlog": {
    id: "delivery-photo-backlog",
    title: "Image checks take longer than uploads.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the approved-photo design. Malware and image checks now take several seconds, so validation cannot stay inside a request. How would you process uploads asynchronously while ensuring only the exact validated object becomes visible?",
    givens: [
      "Upload notifications can be duplicated or arrive out of order",
      "A staging object must stay private until validation succeeds",
      "A presigned upload URL may still be reusable",
    ],
    rubric: [
      "Queue validation work durably and identify the exact staged object or version.",
      "Publish an immutable validated copy or pinned version rather than a still-writable staging key.",
      "Make processing idempotent and expose pending, rejected, and approved states.",
    ],
    explanation:
      "Send staging-prefix S3 upload events to an SQS work queue and let an EC2 worker validate the exact object version. Filter events to staging so writing an approved copy cannot trigger a loop. Without versioning, first capture the bytes into an immutable application-controlled object, then validate that captured object. Publish only that validated key or version and commit approval in PostgreSQL. Deduplicate by upload/version ID and reject stale publication revisions so reordered jobs cannot replace a newer approval. Bound retries and investigate failing jobs. Show pending status until approval.",
    alternatives:
      "A Lambda worker can process appropriately sized files within its limits. Small workloads can use a durable database work table. The immutable-object and approval boundary still applies.",
    pitfall:
      "Validating a staging key and later copying whatever happens to be at that key after the upload URL overwrote it.",
    sources: [
      queueSource,
      s3Source,
      {
        label: "S3 event notifications",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html",
      },
    ],
    questionFrame: photos,
    answerFrame: photoJobs,
    children: [],
    focus: {
      question: ["api", "database", "photos"],
      answer: ["photos", "queue", "worker", "database"],
      label: "Upload validation",
    },
  },
  "delivery-preorder-start": {
    id: "delivery-preorder-start",
    title: "One kitchen. Limited portions.",
    difficulty: "Foundation",
    prompt:
      "Design a preorder service for one restaurant. Customers reserve a portion for a pickup window, and the kitchen sets the available quantity. What is a small, reliable starting architecture that keeps accepted reservations durable?",
    givens: [
      "Around 1,000 customers visit during a lunch release",
      "Each pickup window has a fixed number of portions",
      "Payments and courier delivery are outside this exercise",
    ],
    rubric: [
      "Use a durable store for stock, pickup windows, and accepted orders.",
      "Keep reservation rules on the server and commit related changes together.",
      "Explain a simple starting deployment, capacity measurements, and its failure limits.",
    ],
    explanation:
      "Start with an EC2 application and RDS PostgreSQL. Keep stock and accepted orders in the same transactional database, validate on the server, and acknowledge a reservation only after its transaction commits. A browser’s displayed availability is advisory. Use backups and a deployment appropriate to the availability target; one application instance is still a failure point. The stated customer count alone does not justify a distributed inventory system. Measure peak request rate and database behavior before choosing more infrastructure.",
    alternatives:
      "A managed application runtime or a serverless API can provide the compute. A different transactional database can work if it supports the reservation invariants and expected workload.",
    pitfall:
      "Keeping the authoritative remaining count in a browser or process-local variable, or treating a customer count as a measured request rate.",
    sources: [
      transactions,
      {
        label: "Amazon EC2",
        url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html",
      },
    ],
    questionFrame: preorderStart,
    answerFrame: preorders,
    children: ["delivery-inventory-race", "delivery-pickup-status"],
    focus: {
      question: ["customer", "restaurant"],
      answer: ["customer", "restaurant", "api", "database"],
      label: "Preorder architecture",
    },
  },
  "delivery-inventory-race": {
    id: "delivery-inventory-race",
    title: "Two customers reserve the last portion.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the preorder design. Two requests both read one remaining portion before either writes its order. How would you enforce the stock limit when requests overlap?",
    givens: [
      "The remaining count must never become negative",
      "An accepted order and its stock change must agree",
      "A rejected or retried transaction must not leave a partial reservation",
    ],
    rubric: [
      "Use a conditional update or appropriate row lock inside the reservation transaction.",
      "Create the order and decrement stock atomically, checking the affected-row result.",
      "Handle duplicate requests and retryable transaction failures deliberately.",
    ],
    explanation:
      "Within one PostgreSQL transaction, conditionally decrement the relevant stock row only when remaining quantity is sufficient, check that a row changed, and insert the order. Roll back both changes if any step fails. A SELECT FOR UPDATE flow can instead lock the stock row before checking it. A check constraint is a useful additional boundary. Use a customer-scoped request key so a timed-out retry does not reserve twice, and use bounded retries for retryable transaction errors.",
    alternatives:
      "Serializable transactions can protect richer invariants, but serialization failures still need retry handling. Partition stock by independent pickup windows when business rules allow it.",
    pitfall:
      "Separating the availability check and decrement without concurrency control, or decrementing stock outside the order transaction.",
    sources: [pg, transactions],
    questionFrame: preorders,
    answerFrame: atomicStock,
    children: ["delivery-hold-expiry", "delivery-price-snapshot"],
    focus: {
      question: ["customer", "api", "database"],
      answer: ["api", "database"],
      label: "Stock reservation",
    },
  },
  "delivery-hold-expiry": {
    id: "delivery-hold-expiry",
    title: "A reservation can expire.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the atomic stock design. Requirements change: checkout now holds a portion for five minutes before confirmation. Unconfirmed holds must eventually return stock. How would you represent and expire them safely?",
    givens: [
      "Confirmation can race with expiry",
      "The server’s deadline is authoritative",
      "Cleanup may run late and workers may restart",
    ],
    rubric: [
      "Persist a hold state and expiry deadline with the reserved stock.",
      "Guard confirmation and expiry with transactional state/deadline checks.",
      "Use retryable cleanup while distinguishing validity from cleanup timeliness.",
    ],
    explanation:
      "Persist each hold as held, confirmed, or expired with a server-assigned deadline. Lock the hold row and recheck its state and current database time before confirming or expiring it; a transaction-start timestamp can be stale after waiting for a lock. Confirmation requires a held state before the deadline. An EC2 worker transitions due held rows to expired and returns stock in that transaction. Cleanup delays may keep stock unavailable, but must not allow late confirmation or a second release. Monitor expiry lag as well as correctness.",
    alternatives:
      "A durable scheduler or delayed queue can prompt cleanup, but the database state and deadline still decide whether an operation is valid. Opportunistic cleanup can complement a background worker.",
    pitfall:
      "Using a browser countdown as authority, or assuming a database row automatically disappears or returns stock exactly at its timestamp.",
    sources: [
      pg,
      transactions,
      {
        label: "PostgreSQL current time semantics",
        url: "https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT",
      },
    ],
    questionFrame: atomicStock,
    answerFrame: expiringHolds,
    children: ["delivery-expiry-retry", "delivery-expiry-backlog"],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database", "expiry-worker"],
      label: "Timed holds",
    },
  },
  "delivery-price-snapshot": {
    id: "delivery-price-snapshot",
    title: "The menu price changes after reservation.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the atomic reservation design. The restaurant changes a menu price after a customer’s order was accepted. Which price should the order display, and how would you prevent an outdated client quote from being silently accepted?",
    givens: [
      "Accepted orders must keep their agreed price",
      "Menu prices can change independently",
      "A new request can carry an old menu revision",
    ],
    rubric: [
      "Persist the accepted item price and quantity on the order.",
      "Validate a client quote or menu revision against server rules at acceptance.",
      "Define explicit behavior for changed prices rather than trusting client amounts.",
    ],
    explanation:
      "Store the accepted unit price, quantity, currency, and relevant price revision on the order when reserving stock. Do not reconstruct an old order’s total by joining to the current menu price. Validate client-supplied quote identifiers or expected revisions on the server. If the price changed, return the new quote for an explicit decision, or honor a still-valid server-issued quote according to the business policy. Commit that accepted snapshot with the order and stock change.",
    alternatives:
      "Versioned menu rows can retain historical pricing, while an order snapshot makes the agreement explicit. Either approach needs a clear policy for quote expiry and rounding.",
    pitfall:
      "Reading the latest menu price for an existing order, or using a client-supplied total as the authority.",
    sources: [transactions],
    questionFrame: atomicStock,
    answerFrame: priceSnapshots,
    children: [],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database"],
      label: "Accepted order price",
    },
  },
  "delivery-expiry-retry": {
    id: "delivery-expiry-retry",
    title: "The expiry worker runs the same hold twice.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the timed-hold design. The worker commits a stock release, then crashes before recording local progress. Its next run sees the same work again. How would you prevent returning that portion twice?",
    givens: [
      "A worker’s process memory is lost on restart",
      "More than one worker can attempt the same hold",
      "The hold transition and stock release share PostgreSQL",
    ],
    rubric: [
      "Allow release only from the held state after the deadline.",
      "Commit the state transition and stock increment atomically.",
      "Use the database outcome to distinguish first completion from a retry.",
    ],
    explanation:
      "Inside one transaction, claim a due hold through a lock or conditional held-to-expired update. Increment stock only if that transaction actually performed the transition, and commit both changes together. On a retry, the hold is already expired or confirmed, so the conditional transition changes no row and releases nothing. A separate process-local completed flag is unnecessary for correctness. Monitor failures and retry them with bounds rather than making the release nontransactional.",
    alternatives:
      "A unique release-ledger record per hold can enforce one release, provided the ledger insert and stock mutation are in the same transaction. An atomic state transition is simpler for this workflow.",
    pitfall:
      "Incrementing stock first and marking the hold expired in a later transaction, or unconditionally incrementing on every retry.",
    sources: [transactions, pg],
    questionFrame: expiringHolds,
    answerFrame: expiryRetry,
    children: [],
    focus: {
      question: ["database", "expiry-worker"],
      answer: ["database", "expiry-worker"],
      label: "Exactly one stock release",
    },
  },
  "delivery-expiry-backlog": {
    id: "delivery-expiry-backlog",
    title: "Expired holds are tying up stock.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the timed-hold design. A cleanup backlog leaves expired holds occupying stock for minutes. How would you increase cleanup throughput without letting workers block each other or releasing stock incorrectly?",
    givens: [
      "Stock remains reserved until its guarded release transaction commits",
      "The due-held query is becoming slow",
      "Several cleanup workers may process different holds at once",
    ],
    rubric: [
      "Index the due-held access path and process bounded batches.",
      "Coordinate workers with row locks, SKIP LOCKED, or an equivalent claim mechanism.",
      "Preserve deadline and state checks, short transactions, and monitoring of oldest due work.",
    ],
    explanation:
      "Inspect the query plan and use an index that supports finding held rows ordered by expiry, such as a partial index on expires_at for held rows. Claim small batches with SELECT FOR UPDATE SKIP LOCKED, then transition each hold and release stock transactionally. Keep batches and transactions bounded and retry failures. SKIP LOCKED is useful for queue-like work; it does not provide a general consistent inventory view. Monitor the oldest due hold and database contention. Until cleanup catches up, fail conservatively rather than inventing available portions.",
    alternatives:
      "Partition cleanup by independent pickup window or use expiring worker leases with recovery. More workers help only until database contention becomes the limit.",
    pitfall:
      "Running one giant cleanup transaction, or treating every passed timestamp as a safe extra portion without a guarded release.",
    sources: [
      {
        label: "PostgreSQL SELECT and SKIP LOCKED",
        url: "https://www.postgresql.org/docs/current/sql-select.html",
      },
      {
        label: "PostgreSQL partial indexes",
        url: "https://www.postgresql.org/docs/current/indexes-partial.html",
      },
    ],
    questionFrame: expiringHolds,
    answerFrame: expiryBacklog,
    children: [],
    focus: {
      question: ["database", "expiry-worker"],
      answer: ["database", "expiry-worker"],
      label: "Expiry work throughput",
    },
  },
  "delivery-pickup-status": {
    id: "delivery-pickup-status",
    title: "Everyone keeps checking the kitchen.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the preorder architecture. At the peak, 1,000 customers poll their pickup status every two seconds. The kitchen writes status changes only occasionally. How would you reduce database reads without losing the authoritative order state?",
    givens: [
      "A displayed pickup status may lag by up to five seconds",
      "Kitchen updates must survive cache loss",
      "Every status read still needs ownership authorization",
    ],
    rubric: [
      "Keep committed kitchen state in PostgreSQL and cache only a disposable read view.",
      "Choose bounded expiry/invalidation and protect the cache-miss path.",
      "Use an appropriate polling or push strategy and authorize each order read.",
    ],
    explanation:
      "Commit kitchen changes to RDS PostgreSQL first. Cache status views in ElastiCache with a five-second freshness window measured from the database read, discard late fills, and invalidate after committed updates. Authorize the customer before returning a view. Bound database fallback and coalesce simultaneous requests where practical. Use polling backoff and jitter, conditional responses, or push updates when their connection and recovery costs are justified. The cache is disposable: losing it must not erase a kitchen transition or expose another customer’s order.",
    alternatives:
      "For a measured workload that the database handles comfortably, indexed reads with slower polling may be sufficient. Push updates still need reconnect and resynchronization behavior.",
    pitfall:
      "Persisting kitchen status only in the cache, or using a cache key as a substitute for authorization.",
    sources: [cacheSource],
    questionFrame: preorders,
    answerFrame: cachedStatus,
    children: ["delivery-cache-outage", "delivery-status-races"],
    focus: {
      question: ["api", "database"],
      answer: ["api", "database", "cache"],
      label: "Pickup status reads",
    },
  },
  "delivery-cache-outage": {
    id: "delivery-cache-outage",
    title: "The status cache disappears at lunch.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the cached pickup-status design. ElastiCache becomes unavailable while customers are polling. The database can safely handle about 150 status reads per second, below the incoming 500. How would you degrade the service without taking down the order database?",
    givens: [
      "Cache failure must not lose kitchen updates",
      "Unbounded cache-aside fallback exceeds database capacity",
      "The current application has one API instance",
    ],
    rubric: [
      "Stop repeated slow cache attempts with bounded timeouts or a circuit breaker.",
      "Enforce server-side fallback limits and return explicit backoff when overloaded.",
      "Keep authoritative writes available and explain freshness and capacity tradeoffs.",
    ],
    explanation:
      "Detect the cache failure with short timeouts and stop hammering it while unavailable. Cap fallback read concurrency and admission below the measured database budget; reject excess status polls with a clear retry interval and client jitter. One API instance can enforce a conservative local limit here. If replicas are added, their combined budgets must remain bounded. Preserve kitchen and order transactions, and let the UI distinguish temporarily unavailable status from an empty or missing order. Recover the cache gradually to avoid another burst.",
    alternatives:
      "A small local cache can serve explicitly bounded stale status. A durable read replica can add capacity for reads that tolerate lag, but it is not an immediate substitute for an outage policy.",
    pitfall:
      "Sending every failed cache request to the primary, relying on the failed cache to enforce the only rate limit, or treating an error as ‘order not found.’",
    sources: [
      cacheSource,
      {
        label: "AWS load shedding",
        url: "https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/",
      },
    ],
    questionFrame: cachedStatus,
    answerFrame: cacheOutage,
    children: [],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Status read fallback",
    },
  },
  "delivery-status-races": {
    id: "delivery-status-races",
    title: "An old kitchen update arrives late.",
    difficulty: "Intermediate",
    prompt:
      "Continue from the cached pickup-status design. A delayed ‘preparing’ request reaches the API after the order was marked ‘ready.’ How would you prevent duplicate or out-of-order requests from moving the order backward?",
    givens: [
      "Preparing, ready, and collected have explicit allowed transitions",
      "Requests can be delayed, duplicated, or handled by different instances",
      "The cache is still only a disposable status view",
    ],
    rubric: [
      "Validate legal state transitions and compare an expected order version.",
      "Persist the transition and version change atomically.",
      "Handle stale requests explicitly and invalidate or version cached views after commit.",
    ],
    explanation:
      "Give each order a version and an explicit state machine. Update only when the expected version and current state match an allowed transition, then increment the version in the same transaction. A delayed preparing update cannot overwrite ready or collected. Return the current state on conflict so the kitchen can reconcile; a stable request ID can distinguish a duplicate successful command from a different stale command. Invalidate the read cache after commit and retain the freshness budget. The database decides the transition, not network arrival order.",
    alternatives:
      "A per-order serialized command stream can preserve an ordering boundary, but it still needs legal transitions, replay safety, and recovery. Transactional compare-and-update is sufficient at this scale.",
    pitfall:
      "Using last-arrival-wins, trusting a client timestamp, or updating the cache before the authoritative transaction commits.",
    sources: [
      transactions,
      {
        label: "PostgreSQL UPDATE",
        url: "https://www.postgresql.org/docs/current/sql-update.html",
      },
    ],
    questionFrame: cachedStatus,
    answerFrame: orderedStatus,
    children: [],
    focus: {
      question: ["api", "database", "cache"],
      answer: ["api", "database", "cache"],
      label: "Kitchen state transitions",
    },
  },
};

export function questionsForRevision(revision: ScenarioRevision) {
  return revision === legacyRevision ? legacyQuestions : scenarioQuestions;
}
