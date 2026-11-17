import { sources } from "./scenario-authoring.ts";

type Source = { label: string; url: string };

export const mockSections = [
  "requirements",
  "estimates",
  "api",
  "flow",
  "failures",
  "tradeoffs",
] as const;
export type MockSection = (typeof mockSections)[number];
export const mockMarks = ["covered", "partial", "missed"] as const;
export type MockMark = (typeof mockMarks)[number];
export type MockPhase = "design" | "change" | "debrief";

export type MockAttempt = {
  id: string;
  mockId: string;
  startedAt: string;
  deadline?: number;
  phase: MockPhase;
  asked: string[];
  answers: Partial<Record<MockSection | "change", string>>;
  marks: Partial<Record<MockSection, MockMark>>;
  correction: string;
  finishedAt?: string;
  savedAt?: string;
};
export type MockState = {
  current: MockAttempt | null;
  history: MockAttempt[];
};

export type Mock = {
  id: string;
  title: string;
  minutes: number;
  brief: string[];
  clarifications: { id: string; question: string; answer: string }[];
  prompts: Record<MockSection, { title: string; hint: string }>;
  change: { title: string; text: string; question: string };
  criteria: Record<
    MockSection,
    {
      covers: string[];
      reference: string;
      omission: string;
      sources: Source[];
    }
  >;
};

const idempotentApis = {
  label: "AWS: making retries safe with idempotent APIs",
  url: "https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/",
};

// A hypothetical exercise. The reference is one valid design, not a company's architecture.
export const deliveryMock: Mock = {
  id: "delivery-mock-2026-11-17",
  title: "Food delivery: orders and tracking",
  minutes: 40,
  brief: [
    "Design the backend for a food delivery app in one metro area. Customers browse restaurant menus, pay, and track each order until it arrives. Restaurants accept and prepare orders. Couriers are assigned to orders and share their location while delivering.",
    "Start with requirements, then a design you can defend. Partway through, you’ll get one change to the requirements.",
  ],
  clarifications: [
    {
      id: "scale",
      question: "How many orders, and when?",
      answer:
        "About 50,000 orders on a normal day. At the dinner peak, orders arrive at about 5 times the day’s average rate.",
    },
    {
      id: "browse",
      question: "How much browsing happens?",
      answer:
        "Assume about 20 menu views per order placed. There are around 5,000 restaurants with roughly 100 items each, and menus change a few times a day.",
    },
    {
      id: "tracking",
      question: "How fresh must tracking be?",
      answer:
        "Order status should appear within a few seconds. Couriers send their location about every 5 seconds, up to 3,000 couriers are active at peak, and a customer tracks an order for about 40 minutes.",
    },
    {
      id: "correctness",
      question: "What must never go wrong?",
      answer:
        "A customer must never be charged twice or get two orders from one checkout, and an accepted order must never be lost.",
    },
    {
      id: "payments",
      question: "Are payments in scope?",
      answer:
        "An external payment provider processes cards. You design how your service calls it and handles its results.",
    },
    {
      id: "dispatch",
      question: "How are couriers assigned?",
      answer:
        "Use a simple rule, such as the nearest available courier. Route optimization is out of scope.",
    },
    {
      id: "availability",
      question: "What availability is expected?",
      answer:
        "Ordering should keep working if one availability zone fails. A brief delay during a database failover is acceptable.",
    },
  ],
  prompts: {
    requirements: {
      title: "Requirements and assumptions",
      hint: "Users and core actions, scale, freshness, what must never go wrong, and what is out of scope.",
    },
    estimates: {
      title: "Estimates",
      hint: "Average and peak rates for orders, menu reads, status reads, and location updates.",
    },
    api: {
      title: "API and data model",
      hint: "Key requests and responses, tables or records, keys, and indexes.",
    },
    flow: {
      title: "Request flow",
      hint: "Trace a checkout from tap to confirmed order, then one status update reaching the customer.",
    },
    failures: {
      title: "Failures",
      hint: "A response lost after commit, a payment provider timeout, a worker crash, and a zone failure.",
    },
    tradeoffs: {
      title: "Trade-offs",
      hint: "What you chose, what you rejected, and why it fits this workload.",
    },
  },
  change: {
    title: "A lunch promotion",
    text: "Next month, marketing runs a 30-minute lunch promotion. Checkout attempts during that window are expected to reach about 40 times the normal dinner peak, and almost all of them go to 50 participating restaurants. Each of those kitchens can prepare about 30 orders per 10 minutes.",
    question:
      "Which parts of your design change, which stay the same, and how do you protect restaurants, customers, and the payment provider?",
  },
  criteria: {
    requirements: {
      covers: [
        "Core actions: browse menus, check out and pay, restaurant accepts, courier assigned, customer tracks status.",
        "Scale and freshness: about 50,000 orders a day with a 5× dinner peak, status within seconds, courier location every 5 seconds.",
        "Correctness: no double charge or duplicate order from one checkout, and an accepted order is never lost.",
        "Out of scope, stated: card processing and route optimization.",
      ],
      reference:
        "Write these down before designing. The correctness rule shapes checkout, and the freshness numbers decide between polling and push. When there is no one to ask, state assumptions out loud: an interviewer can correct a stated assumption, but not a hidden one.",
      omission:
        "Starting the design before naming the correctness rule, then finding late that a retry can charge twice.",
      sources: [
        {
          label: "Microsoft: technical interview expectations",
          url: "https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing.html",
        },
      ],
    },
    estimates: {
      covers: [
        "Orders: 50,000 ÷ 86,400 ≈ 0.6 per second on average, about 3 per second at a 5× peak.",
        "Location updates: 3,000 couriers every 5 seconds ≈ 600 writes per second, by far the largest write load.",
        "Tracking: about 3 orders per second × 2,400 seconds ≈ 7,000 active orders; polling every 5 seconds ≈ 1,400 status reads per second.",
        "Menus: 20 views per order ≈ 60 reads per second at peak, over a catalog small enough to cache.",
      ],
      reference:
        "The order write rate is small enough for one PostgreSQL primary, so sharding orders is not justified by these numbers. The load that matters is elsewhere: courier locations and status polling are hundreds of times the order rate, so keep the latest courier position out of the order tables and make status reads cheap. These are workload estimates from stated assumptions, not server counts; confirm capacity with a load test.",
      omission:
        "Sizing everything from the order rate and missing that location and tracking traffic are far larger.",
      sources: [
        {
          label: "Little's original queueing relation",
          url: "https://pubsonline.informs.org/doi/10.1287/opre.9.3.383",
        },
      ],
    },
    api: {
      covers: [
        "POST /orders with a client-generated idempotency key, returning the order ID and status.",
        "GET /orders/{id} checks that the caller owns the order; restaurant and courier updates allow only legal status transitions.",
        "Orders, order items, and payments with a unique (customer, idempotency key) constraint and an index for each screen’s query.",
        "The latest courier location stored apart from order history.",
      ],
      reference:
        "One option: POST /orders { restaurantId, items, idempotencyKey } returns 201 { orderId, status: \"awaiting_payment\" }. Store orders(id, customer_id, restaurant_id, status, version, total_cents, created_at) with a unique (customer_id, idempotency_key) constraint and indexes on (customer_id, created_at) and (restaurant_id, status). Recompute prices on the server from the current menu, and keep money in integer cents. A status column with a version lets the server reject stale or illegal transitions.",
      omission:
        "Trusting prices sent by the client, or letting any caller overwrite status as free text.",
      sources: [sources.constraints, sources.indexes, sources.auth],
    },
    flow: {
      covers: [
        "Checkout validates the cart against current prices, then inserts the order and idempotency key in one transaction.",
        "The payment call uses an idempotency key, and the result moves the order to placed.",
        "The restaurant hears about the order through an outbox event, not a call made after commit.",
        "Courier locations go to a latest-position store, and customers poll or subscribe for status.",
      ],
      reference:
        "Checkout writes the order as awaiting payment, calls the payment provider with the order ID as its idempotency key, then in one transaction marks the order placed and writes an outbox event. A relay publishes the event to a queue and the restaurant’s screen consumes it. Each step is acknowledged only after its commit, so a retry with the same key returns the same order. Status changes follow the same path, and the customer reads them by polling every few seconds or over a push channel.",
      omission:
        "Calling the payment provider and the database without saying which commit acknowledges the order.",
      sources: [idempotentApis, sources.outbox, sources.transactions],
    },
    failures: {
      covers: [
        "Response lost after commit: the client retries with the same key and gets the same order.",
        "Payment provider timeout: the outcome is unknown, so retry with the same key or reconcile; never charge again under a new key.",
        "Worker or relay crash: events can repeat, so consumers deduplicate by event ID.",
        "Zone or primary failure: a Multi-AZ database fails over, in-flight requests fail, and clients retry safely.",
      ],
      reference:
        "Most failures here have an unknown outcome rather than a clean error. Idempotency keys make retries safe for checkout and payment, and stable event IDs make redelivered messages harmless. With an Amazon RDS Multi-AZ deployment, a synchronous standby in another zone takes over after a primary or zone failure; requests in flight during the switch fail and must be retried, which the idempotent API allows. Losing one courier location update is acceptable because the next arrives within seconds.",
      omission:
        "Treating a timeout as a failure and retrying under a fresh key, which can charge the customer twice.",
      sources: [
        sources.retries,
        sources.queue,
        {
          label: "Amazon RDS Multi-AZ DB instance deployments",
          url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html",
        },
      ],
    },
    tradeoffs: {
      covers: [
        "Polling versus push for tracking, with the read load each implies.",
        "One PostgreSQL primary rather than sharding, justified by the order rate.",
        "For the promotion: reserve kitchen capacity in the order transaction before charging, and answer “full” or offer a later slot when none is left.",
        "Shed excess demand early, cache the hot menus, and call the payment provider only for orders that hold a slot.",
      ],
      reference:
        "Polling every 5 seconds is simple and costs about 1,400 cheap reads per second; push lowers latency but adds connection handling. The promotion moves the bottleneck from your servers to the kitchens: about 40 × 3 ≈ 120 checkout attempts per second meet a capacity of 50 restaurants × 30 orders per 10 minutes ≈ 2.5 orders per second. So reserve a preparation slot with a conditional update inside the order transaction before calling the payment provider, return a fast “full for this window” answer otherwise, and release slots when payment fails or a reservation expires. Cache the 50 hot menus, rate-limit checkout attempts, and give payment calls timeouts and bounded concurrency. Idempotent checkout, the outbox, and the order tables stay the same.",
      omission:
        "Scaling the database for the spike when kitchens can accept only a few orders per second, or charging customers and cancelling afterwards.",
      sources: [sources.overload, sources.locks, sources.cache],
    },
  },
};

export const mocks: Record<string, Mock> = {
  [deliveryMock.id]: deliveryMock,
};

export function startMock(
  mock: Mock,
  id: string,
  now: Date,
  timed: boolean,
): MockAttempt {
  return {
    id,
    mockId: mock.id,
    startedAt: now.toISOString(),
    deadline: timed ? now.getTime() + mock.minutes * 60_000 : undefined,
    phase: "design",
    asked: [],
    answers: {},
    marks: {},
    correction: "",
  };
}

const keys = new Set<string>([...mockSections, "change"]);
const isText = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function validAttempt(a: unknown, saved: boolean): a is MockAttempt {
  if (!isRecord(a)) return false;
  const mock = typeof a.mockId === "string" ? mocks[a.mockId] : undefined;
  if (
    !mock ||
    typeof a.id !== "string" ||
    a.id.length === 0 ||
    a.id.length > 64 ||
    !isText(a.startedAt, 40) ||
    !Number.isFinite(Date.parse(a.startedAt as string)) ||
    (a.deadline !== undefined && !Number.isFinite(a.deadline)) ||
    !["design", "change", "debrief"].includes(a.phase as string) ||
    !Array.isArray(a.asked) ||
    new Set(a.asked).size !== a.asked.length ||
    !a.asked.every((id) => mock.clarifications.some((c) => c.id === id)) ||
    !isRecord(a.answers) ||
    !Object.entries(a.answers).every(
      ([key, text]) => keys.has(key) && isText(text, 10000),
    ) ||
    (a.answers.change !== undefined && a.phase === "design") ||
    !isRecord(a.marks) ||
    !Object.entries(a.marks).every(
      ([key, mark]) =>
        (mockSections as readonly string[]).includes(key) &&
        (mockMarks as readonly string[]).includes(mark as string),
    ) ||
    (Object.keys(a.marks).length > 0 && a.phase !== "debrief") ||
    !isText(a.correction, 2000)
  )
    return false;
  const finished = a.finishedAt;
  if (a.phase === "debrief") {
    if (!isText(finished, 40) || !Number.isFinite(Date.parse(finished as string)))
      return false;
  } else if (finished !== undefined) return false;
  if (saved)
    return (
      a.phase === "debrief" &&
      isText(a.savedAt, 40) &&
      Number.isFinite(Date.parse(a.savedAt as string))
    );
  return a.savedAt === undefined;
}

export function validMockState(value: unknown): value is MockState {
  if (!isRecord(value)) return false;
  const { current, history } = value;
  if (current !== null && !validAttempt(current, false)) return false;
  if (
    !Array.isArray(history) ||
    history.length > 50 ||
    !history.every((attempt) => validAttempt(attempt, true))
  )
    return false;
  const ids = [
    ...history.map((a) => a.id),
    ...(current ? [(current as MockAttempt).id] : []),
  ];
  return new Set(ids).size === ids.length;
}
