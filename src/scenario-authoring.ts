import type { Component, Connection, DiagramFrame } from "./content.ts";

// Authored coordinates are shared by the new families; changes never reserve future nodes.
export const application: DiagramFrame = {
  components: [
    {
      id: "customer",
      name: "Clients",
      purpose: "Use the service",
      kind: "person",
      x: 24,
      y: 100,
    },
    {
      id: "restaurant",
      name: "Operators",
      purpose: "Manage the service",
      kind: "person",
      x: 24,
      y: 292,
    },
    {
      id: "api",
      name: "Amazon EC2",
      purpose: "Application API",
      kind: "compute",
      service: "ec2",
      x: 300,
      y: 100,
    },
    {
      id: "database",
      name: "Amazon RDS",
      purpose: "PostgreSQL records",
      kind: "database",
      service: "rds",
      x: 576,
      y: 100,
    },
  ],
  connections: [
    { from: "customer", to: "api", label: "HTTPS" },
    { from: "restaurant", to: "api", label: "Authorized requests" },
    { from: "api", to: "database", label: "SQL" },
  ],
};
export const cache: Component = {
  id: "cache",
  name: "AWS ElastiCache",
  purpose: "Disposable read views",
  kind: "database",
  service: "elasticache",
  x: 576,
  y: 292,
};
export const photos: Component = {
  id: "photos",
  name: "Amazon S3",
  purpose: "Private object bytes",
  kind: "storage",
  service: "s3",
  x: 576,
  y: 292,
};
export const queue: Component = {
  id: "queue",
  name: "Amazon SQS",
  purpose: "Durable event delivery",
  kind: "compute",
  service: "sqs",
  x: 852,
  y: 292,
};
export const worker: Component = {
  id: "worker",
  name: "Amazon EC2",
  purpose: "Event processing",
  kind: "compute",
  service: "ec2",
  x: 852,
  y: 484,
};

export function evolve(
  frame: DiagramFrame,
  changes: Record<string, Partial<Component>>,
  added: Component[] = [],
  connections: Connection[] = frame.connections,
): DiagramFrame {
  return {
    components: [
      ...frame.components.map((c) =>
        changes[c.id] ? { ...c, ...changes[c.id] } : c,
      ),
      ...added,
    ],
    connections,
  };
}
export function actors(frame: DiagramFrame): DiagramFrame {
  return {
    components: frame.components.filter((c) => c.kind === "person"),
    connections: [],
  };
}

export const sources = {
  transactions: {
    label: "PostgreSQL transactions",
    url: "https://www.postgresql.org/docs/current/tutorial-transactions.html",
  },
  locks: {
    label: "PostgreSQL row locks",
    url: "https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS",
  },
  constraints: {
    label: "PostgreSQL constraints",
    url: "https://www.postgresql.org/docs/current/ddl-constraints.html",
  },
  pagination: {
    label: "PostgreSQL ordered pagination",
    url: "https://www.postgresql.org/docs/current/queries-limit.html",
  },
  indexes: {
    label: "PostgreSQL multicolumn indexes",
    url: "https://www.postgresql.org/docs/current/indexes-multicolumn.html",
  },
  isolation: {
    label: "PostgreSQL transaction isolation",
    url: "https://www.postgresql.org/docs/current/transaction-iso.html",
  },
  time: {
    label: "PostgreSQL current time",
    url: "https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT",
  },
  auth: {
    label: "OWASP authorization guidance",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
  },
  sockets: {
    label: "WebSocket protocol",
    url: "https://www.rfc-editor.org/rfc/rfc6455.html",
  },
  pubsub: {
    label: "Valkey Pub/Sub delivery semantics",
    url: "https://valkey.io/topics/pubsub/",
  },
  cache: {
    label: "ElastiCache caching strategies",
    url: "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html",
  },
  uploads: {
    label: "S3 presigned URL behavior",
    url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html",
  },
  s3: {
    label: "Amazon S3 overview",
    url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
  },
  queue: {
    label: "SQS at-least-once delivery",
    url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html",
  },
  outbox: {
    label: "Transactional outbox pattern",
    url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html",
  },
  overload: {
    label: "AWS load shedding",
    url: "https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/",
  },
  retries: {
    label: "AWS timeouts and retry jitter",
    url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
  },
  http: {
    label: "HTTP redirect semantics",
    url: "https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx",
  },
  httpCache: {
    label: "HTTP cache control",
    url: "https://www.rfc-editor.org/rfc/rfc9111.html#name-no-store",
  },
  random: {
    label: "Web Crypto random values",
    url: "https://www.w3.org/TR/WebCryptoAPI/#Crypto-method-getRandomValues",
  },
};
