type CodingProblem = {
  id: number;
  title: string;
  url: string;
  checkpoint: string;
};

function problem(
  id: number,
  title: string,
  slug: string,
  checkpoint: string,
): CodingProblem {
  return {
    id,
    title,
    url: `https://leetcode.com/problems/${slug}/`,
    checkpoint,
  };
}

export const codingTracks = [
  {
    name: "Arrays and hashing",
    problems: [
      problem(
        1,
        "Two Sum",
        "two-sum",
        "Explain when you store each index so a value cannot pair with itself. Test duplicate values.",
      ),
      problem(
        49,
        "Group Anagrams",
        "group-anagrams",
        "Define a canonical key. Compare sorting with counting under a fixed alphabet and include the cost of building each key.",
      ),
      problem(
        238,
        "Product of Array Except Self",
        "product-of-array-except-self",
        "State what each prefix and suffix product excludes. Test one zero, two zeros, and negative values.",
      ),
      problem(
        560,
        "Subarray Sum Equals K",
        "subarray-sum-equals-k",
        "Count earlier prefix positions rather than distinct sums. Explain the initial zero prefix and try an input with negative numbers.",
      ),
      problem(
        128,
        "Longest Consecutive Sequence",
        "longest-consecutive-sequence",
        "Start scanning only at the beginning of each run. Explain why the inner loops take expected linear time in total.",
      ),
      problem(
        36,
        "Valid Sudoku",
        "valid-sudoku",
        "Check three independent uniqueness rules. Explain the box index and test a duplicate found only within a box.",
      ),
    ],
  },
  {
    name: "Windows, pointers, and lists",
    problems: [
      problem(
        15,
        "3Sum",
        "3sum",
        "Justify which pointer moves after each comparison and where you skip duplicates. Test all zeros and inputs with no valid triple.",
      ),
      problem(
        3,
        "Longest Substring Without Repeating Characters",
        "longest-substring-without-repeating-characters",
        "Explain why the left boundary never moves backward. Trace a repeat whose earlier occurrence is already outside the window.",
      ),
      problem(
        76,
        "Minimum Window Substring",
        "minimum-window-substring",
        "Track required multiplicities, then shrink only while the window satisfies all of them. Test a repeated required character.",
      ),
      problem(
        1004,
        "Max Consecutive Ones III",
        "max-consecutive-ones-iii",
        "Name the window budget and explain why each endpoint advances at most n times. Try a zero budget and an all-zero array.",
      ),
      problem(
        206,
        "Reverse Linked List",
        "reverse-linked-list",
        "Describe the reversed prefix and untouched suffix before each step. Test empty and singleton lists.",
      ),
      problem(
        142,
        "Linked List Cycle II",
        "linked-list-cycle-ii",
        "Separate detecting a cycle from finding its entry. Explain the distances modulo the cycle length.",
      ),
    ],
  },
  {
    name: "Search, heaps, and intervals",
    problems: [
      problem(
        33,
        "Search in Rotated Sorted Array",
        "search-in-rotated-sorted-array",
        "At each step identify the sorted half and justify when the target can be excluded from it. Test rotations at either end.",
      ),
      problem(
        875,
        "Koko Eating Bananas",
        "koko-eating-bananas",
        "Prove feasibility is monotone as speed rises. Count time with integer ceiling and justify your search bounds.",
      ),
      problem(
        56,
        "Merge Intervals",
        "merge-intervals",
        "Explain why only the last merged interval can overlap the next start. State how touching endpoints are handled.",
      ),
      problem(
        215,
        "Kth Largest Element in an Array",
        "kth-largest-element-in-an-array",
        "Count duplicates as separate positions. Compare a size-k heap with quickselect and give the latter’s worst case.",
      ),
      problem(
        347,
        "Top K Frequent Elements",
        "top-k-frequent-elements",
        "Separate counting from ranking. Explain the size of the heap or buckets in terms of distinct values.",
      ),
      problem(
        23,
        "Merge k Sorted Lists",
        "merge-k-sorted-lists",
        "Maintain one candidate per nonempty list. State the complexity in total nodes and number of lists, and test empty lists.",
      ),
    ],
  },
  {
    name: "Stacks and data structures",
    problems: [
      problem(
        739,
        "Daily Temperatures",
        "daily-temperatures",
        "Define the invariant for unresolved indices. Show why equal temperatures do not settle a wait and why each index leaves once.",
      ),
      problem(
        155,
        "Min Stack",
        "min-stack",
        "Record enough information to restore the previous minimum. Test popping one of several equal minima.",
      ),
      problem(
        146,
        "LRU Cache",
        "lru-cache",
        "State which operations refresh recency and how the map and list stay in sync. Trace an update to an existing key at capacity.",
      ),
      problem(
        622,
        "Design Circular Queue",
        "design-circular-queue",
        "Explain how you distinguish full from empty, then trace both indices through a wraparound and a failed enqueue.",
      ),
      problem(
        208,
        "Implement Trie (Prefix Tree)",
        "implement-trie-prefix-tree",
        "Separate path existence from the end-of-word flag. Explain time by input length and memory by stored prefix nodes.",
      ),
      problem(
        295,
        "Find Median from Data Stream",
        "find-median-from-data-stream",
        "Prove the two half-ordering and size invariants. Test duplicates, even counts, and overflow in an integer implementation.",
      ),
    ],
  },
  {
    name: "Graphs and connectivity",
    problems: [
      problem(
        200,
        "Number of Islands",
        "number-of-islands",
        "Explain what marks a cell visited and when. State the neighbor rule and give the worst-case worklist size.",
      ),
      problem(
        207,
        "Course Schedule",
        "course-schedule",
        "Define edge direction and indegree. Explain why some vertices remain unprocessed if a cycle prevents completion.",
      ),
      problem(
        743,
        "Network Delay Time",
        "network-delay-time",
        "Explain why nonnegative weights allow a settled distance, what to do with stale heap entries, and how unreachable nodes affect the answer.",
      ),
      problem(
        127,
        "Word Ladder",
        "word-ladder",
        "Define adjacency without comparing every word pair. Count the start in the sequence length and handle an unreachable end.",
      ),
      problem(
        684,
        "Redundant Connection",
        "redundant-connection",
        "Explain why joining vertices already in the same component closes a cycle. Give the disjoint-set invariant.",
      ),
      problem(
        1293,
        "Shortest Path in a Grid with Obstacles Elimination",
        "shortest-path-in-a-grid-with-obstacles-elimination",
        "Explain why position alone is insufficient state. If pruning by remaining budget, justify the order that makes a prior state dominate.",
      ),
    ],
  },
  {
    name: "Trees and backtracking",
    problems: [
      problem(
        98,
        "Validate Binary Search Tree",
        "validate-binary-search-tree",
        "Use ancestor bounds rather than immediate children. Test a deep descendant violating a bound and a duplicate key.",
      ),
      problem(
        102,
        "Binary Tree Level Order Traversal",
        "binary-tree-level-order-traversal",
        "Fix the size of the current layer before enqueueing children. Explain queue memory in terms of the widest level.",
      ),
      problem(
        236,
        "Lowest Common Ancestor of a Binary Tree",
        "lowest-common-ancestor-of-a-binary-tree",
        "Give the meaning of the recursive return value. Trace the case where one requested node is an ancestor of the other.",
      ),
      problem(
        124,
        "Binary Tree Maximum Path Sum",
        "binary-tree-maximum-path-sum",
        "Separate the one-branch value returned upward from the path considered at the node. Test an all-negative tree.",
      ),
      problem(
        78,
        "Subsets",
        "subsets",
        "Make one include/exclude decision per element. Distinguish the number of subsets from the total cost of copying their contents.",
      ),
      problem(
        79,
        "Word Search",
        "word-search",
        "Restore visited state when returning from a branch. Explain why using one cell twice in the same path is invalid.",
      ),
    ],
  },
  {
    name: "Dynamic programming and greedy",
    problems: [
      problem(
        198,
        "House Robber",
        "house-robber",
        "Define the optimum over a prefix and separate taking from skipping the last house. Explain which previous states suffice.",
      ),
      problem(
        322,
        "Coin Change",
        "coin-change",
        "Use an unreachable sentinel, then justify repeated use of a denomination. Test amount zero and an unreachable positive amount.",
      ),
      problem(
        300,
        "Longest Increasing Subsequence",
        "longest-increasing-subsequence",
        "State the meaning of the smallest tail per length. Explain why the tails array need not be an actual subsequence and how duplicates behave.",
      ),
      problem(
        72,
        "Edit Distance",
        "edit-distance",
        "Describe both prefix indices and the three choices for an unequal last character. Initialize the empty-prefix cases.",
      ),
      problem(
        416,
        "Partition Equal Subset Sum",
        "partition-equal-subset-sum",
        "Reduce to reaching half the sum. Justify descending updates for one-use elements and explain why the bound is pseudopolynomial.",
      ),
      problem(
        55,
        "Jump Game",
        "jump-game",
        "State what the farthest reachable index means before visiting the next position. Test an intervening zero that cannot be crossed.",
      ),
    ],
  },
];

export const codingProblemIds = new Set(
  codingTracks.flatMap((track) => track.problems.map(({ id }) => id)),
);
