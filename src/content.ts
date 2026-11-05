export type Grade = "Again" | "Hard" | "Good" | "Easy";
export const grades: Grade[] = ["Again", "Hard", "Good", "Easy"];

export type Component = {
  id: string;
  name: string;
  purpose: string;
  kind: "person" | "compute" | "database" | "storage" | "network";
  x: number;
  y: number;
};
export type Connection = { from: string; to: string; label: string };
export type DiagramFrame = {
  components: Component[];
  connections: Connection[];
};
export type Question = {
  id: string;
  title: string;
  prompt: string;
  givens: string[];
  rubric: string[];
  explanation: string;
  alternatives: string;
  pitfall: string;
  sources: { label: string; url: string }[];
  questionFrame: DiagramFrame;
  answerFrame: DiagramFrame;
  children: string[];
};

const customer: Component = {
  id: "customer",
  name: "Customers",
  purpose: "Browse and place orders",
  kind: "person",
  x: 24,
  y: 100,
};
const restaurant: Component = {
  id: "restaurant",
  name: "Restaurant",
  purpose: "Accept and prepare orders",
  kind: "person",
  x: 24,
  y: 292,
};
const api: Component = {
  id: "api",
  name: "Amazon EC2",
  purpose: "Application server",
  kind: "compute",
  x: 300,
  y: 100,
};
const database: Component = {
  id: "database",
  name: "Amazon RDS",
  purpose: "PostgreSQL · orders",
  kind: "database",
  x: 576,
  y: 100,
};
const baseline: DiagramFrame = {
  components: [customer, restaurant, api, database],
  connections: [
    { from: "customer", to: "api", label: "HTTPS" },
    { from: "restaurant", to: "api", label: "View orders" },
    { from: "api", to: "database", label: "SQL" },
  ],
};

export const rootQuestionId = "delivery-small-start";
export const questions: Record<string, Question> = {
  "delivery-small-start": {
    id: rootQuestionId,
    title: "Start with ten customers.",
    prompt:
      "You’re building a DoorDash-style service for one restaurant. Customers place orders, the restaurant accepts them, and customers check their order status. What is the smallest architecture you would trust to run it?",
    givens: [
      "10 customers, around 20 orders a day",
      "One restaurant in one city",
      "Payments and courier dispatch are outside this first version",
    ],
    rubric: [
      "Keep the application simple: one deployable service can handle this workload.",
      "Persist orders and their allowed state transitions in a durable database.",
      "Define a basic request flow and measure errors, latency, and database performance.",
    ],
    explanation:
      "One application on Amazon EC2 and a small RDS PostgreSQL database are a reasonable starting point. The server validates the order and price, commits it, and returns an order ID. A restaurant dashboard can poll for new orders; customers can poll for status. Keep state in the database so a process restart does not lose an accepted order. The workload gives us no reason to split the application into microservices.",
    alternatives:
      "A managed application platform or a small serverless API with a suitable database can work too. Judge the operational effort, durability, and expected workload, rather than whether the product names match this reference.",
    pitfall:
      "Keeping accepted orders only in application memory, or adding distributed infrastructure before identifying a need.",
    sources: [
      {
        label: "Amazon EC2 overview",
        url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html",
      },
      {
        label: "RDS for PostgreSQL",
        url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html",
      },
    ],
    questionFrame: { components: [customer, restaurant], connections: [] },
    answerFrame: baseline,
    children: [
      "delivery-lunch-rush",
      "delivery-menu-photos",
      "delivery-checkout-retry",
    ],
  },
  "delivery-lunch-rush": {
    id: "delivery-lunch-rush",
    title: "The lunch rush arrives.",
    prompt:
      "Continue from the reference design. A promotion brings 1,000 orders a minute. API CPU is saturated, while database measurements show spare capacity. How would you scale the application, and what state must stop living inside a single instance?",
    givens: [
      "API CPU is the measured bottleneck in this exercise",
      "The database still has capacity",
      "An order is acknowledged only after it is committed",
    ],
    rubric: [
      "Put multiple stateless application instances behind a load balancer.",
      "Keep durable order state in PostgreSQL and move any instance-local sessions to shared storage or signed tokens.",
      "Use health checks, bounded database connection pools, and load measurements before increasing capacity further.",
    ],
    explanation:
      "An Application Load Balancer can route requests across an EC2 Auto Scaling group. Each instance must be able to serve the next request without depending on a previous request reaching that same machine. Keep orders in RDS and size the total connection budget across instances. Scale against observed load and latency, then measure again: adding application servers can move the bottleneck to the database.",
    alternatives:
      "A container service or managed application platform can supply the same capabilities. If later measurements identify a slow database query, improve that query or access pattern rather than continuing to add application instances.",
    pitfall:
      "Using sticky sessions as the only plan for durability, or letting every new instance open an unbounded number of database connections.",
    sources: [
      {
        label: "Application Load Balancers",
        url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html",
      },
      {
        label: "EC2 Auto Scaling",
        url: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html",
      },
    ],
    questionFrame: baseline,
    answerFrame: {
      components: [
        ...baseline.components.map((component) =>
          component.id === "api"
            ? { ...component, purpose: "Stateless API instances" }
            : component,
        ),
        {
          id: "balancer",
          name: "AWS ALB",
          purpose: "Healthy-instance routing",
          kind: "network",
          x: 300,
          y: 292,
        },
      ],
      connections: [
        { from: "customer", to: "balancer", label: "HTTPS" },
        { from: "restaurant", to: "balancer", label: "View orders" },
        { from: "balancer", to: "api", label: "Route" },
        { from: "api", to: "database", label: "Pooled SQL" },
      ],
    },
    children: [],
  },
  "delivery-menu-photos": {
    id: "delivery-menu-photos",
    title: "The menu needs photos.",
    prompt:
      "Continue from the reference design. Restaurants can now upload menu photos. How would you store and serve the files without making your application server carry every upload or putting image bytes in the orders database?",
    givens: [
      "Uploaded photos must survive an EC2 replacement",
      "Only authorized restaurants can upload",
      "An uploaded file is not public until the application approves it",
    ],
    rubric: [
      "Store image objects in durable object storage and retain their keys and ownership metadata in the database.",
      "Authorize the restaurant before issuing a short-lived, scoped upload URL.",
      "Validate uploads before publication and control how approved images are read.",
    ],
    explanation:
      "Use Amazon S3 for the image objects. After checking restaurant ownership, the API can issue a short-lived presigned upload URL for an application-chosen staging key. The browser uploads directly to S3. Keep the bucket private. Validate the object, then copy it to a separate serving key that the upload URL cannot overwrite, or pin the approved object version. Record that approved key or version in the database. Serve approved images through controlled reads or a CDN with a restricted origin.",
    alternatives:
      "Another object-storage service can serve the same role. For larger delivery traffic, CloudFront is a possible next step; object storage and a CDN solve different parts of the problem.",
    pitfall:
      "Treating a successful upload as approval, trusting only a browser-supplied file type, or giving the restaurant unrestricted bucket credentials.",
    sources: [
      {
        label: "Amazon S3 overview",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
      },
      {
        label: "Uploading with presigned URLs",
        url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html",
      },
    ],
    questionFrame: baseline,
    answerFrame: {
      components: [
        ...baseline.components.map((component) =>
          component.id === "database"
            ? { ...component, purpose: "Orders + object metadata" }
            : component,
        ),
        {
          id: "photos",
          name: "Amazon S3",
          purpose: "Private menu-photo objects",
          kind: "storage",
          x: 576,
          y: 292,
        },
      ],
      connections: [
        ...baseline.connections.map((connection) =>
          connection.from === "restaurant"
            ? { ...connection, label: "Get upload URL" }
            : connection,
        ),
        { from: "api", to: "photos", label: "Validate + publish" },
        { from: "restaurant", to: "photos", label: "Signed upload" },
      ],
    },
    children: [],
  },
  "delivery-checkout-retry": {
    id: "delivery-checkout-retry",
    title: "One tap. Two orders.",
    prompt:
      "Continue from the reference design. PostgreSQL commits an order, but the response never reaches the customer. The browser retries. How do you prevent a second order while still letting the customer recover the first result?",
    givens: [
      "A timeout does not tell the client whether the write committed",
      "The same customer may also place a separate, intentional order",
      "Requests can reach different application instances",
    ],
    rubric: [
      "Give one logical checkout a client-generated idempotency key that is reused on retries.",
      "Enforce uniqueness for the customer and key in the database, atomically with the order write.",
      "Return the original result for a matching retry and reject reuse with different order parameters.",
    ],
    explanation:
      "Persist a customer-scoped idempotency key alongside the order, with a unique database constraint. The key and order must commit together. If a retry conflicts on that key, read and return the existing order after checking that the payload matches. A genuinely new checkout uses a new key. This makes duplicate requests safe without depending on which EC2 instance handles them.",
    alternatives:
      "An idempotency-record table can also work, provided its claim, order write, and result are coordinated transactionally. Document retention and in-progress behavior; payment-provider idempotency would need its own coordination if payments were added.",
    pitfall:
      "Disabling the submit button, checking a process-local map, or performing an existence check and insert without a database-enforced uniqueness boundary.",
    sources: [
      {
        label: "PostgreSQL unique constraints",
        url: "https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS",
      },
      {
        label: "Making retries safe with idempotent APIs",
        url: "https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/",
      },
    ],
    questionFrame: baseline,
    answerFrame: {
      components: baseline.components.map((component) =>
        component.id === "database"
          ? { ...component, purpose: "Orders + unique request keys" }
          : component,
      ),
      connections: baseline.connections.map((connection) =>
        connection.from === "customer"
          ? { ...connection, label: "Same checkout key" }
          : connection.to === "database"
            ? { ...connection, label: "Atomic unique insert" }
            : connection,
      ),
    },
    children: [],
  },
};
