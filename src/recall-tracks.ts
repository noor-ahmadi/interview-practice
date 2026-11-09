import { recallCards } from "./cards.ts";
import type { RecallCard } from "./cards.ts";

const byId = new Map(recallCards.map((card) => [card.id, card]));

function track(topic: RecallCard["topic"], name: string, slugs: string[]) {
  return {
    topic,
    name,
    cards: slugs.map((slug) => byId.get(`recall-${slug}`)!),
  };
}

export const recallTracks = [
  track("System design", "Storage and consistency", [
    "object-storage",
    "index-prefix",
    "replica-freshness",
    "write-skew",
    "cap-partition",
    "quorum-overlap",
    "multipart-publish",
  ]),
  track("System design", "Caching and delivery", [
    "cache-aside",
    "cache-stampede",
    "negative-cache",
    "ttl-freshness",
    "cdn-origin",
    "ranking-snapshot",
  ]),
  track("System design", "Queues and failures", [
    "idempotent-order",
    "queue-redelivery",
    "transactional-outbox",
    "backpressure",
    "retry-jitter",
    "timeout-budget",
    "circuit-breaker",
    "event-order",
  ]),
  track("System design", "Capacity and observability", [
    "hot-shard",
    "consistent-hash",
    "token-bucket",
    "tail-latency",
    "littles-law",
    "observability-signals",
    "fanout-budget",
  ]),
  track("System design", "Security and recovery", [
    "signed-url-revoke",
    "rpo-rto",
    "writer-fencing",
    "coordinated-recovery",
  ]),
  track("System design", "APIs and client state", [
    "optimistic-version",
    "socket-resume",
    "keyset-page",
    "snapshot-watermark",
  ]),
  track("Algorithms", "Arrays and hashing", [
    "prefix-sum",
    "amortized-array",
    "hash-complexity",
    "counting-sort",
    "ring-buffer",
  ]),
  track("Algorithms", "Windows and lists", [
    "sliding-window",
    "two-pointers",
    "cycle-pointers",
    "list-reversal",
    "monotonic-stack",
  ]),
  track("Algorithms", "Search, sorting, and heaps", [
    "binary-search",
    "merge-intervals",
    "heap-top-k",
    "quickselect",
    "binary-answer",
    "heap-merge",
    "stream-median",
  ]),
  track("Algorithms", "Graphs and connectivity", [
    "bfs-shortest",
    "dijkstra",
    "topological-sort",
    "disjoint-set",
    "iterative-dfs",
    "bellman-ford",
    "state-bfs",
  ]),
  track("Algorithms", "Trees and backtracking", [
    "backtrack-restore",
    "trie-prefix",
    "tree-postorder",
    "bst-bounds",
    "tree-lca",
    "tree-path-sum",
  ]),
  track("Algorithms", "Dynamic programming and greedy", [
    "greedy-exchange",
    "dp-state",
    "knapsack-direction",
    "lis-tails",
    "bitmask-state",
    "edit-distance",
  ]),
];
