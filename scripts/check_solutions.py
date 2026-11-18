"""Run every reference solution in src/solutions against known cases.

Usage: python3 scripts/check_solutions.py
"""

import itertools
import random
import sys
from collections import deque
from pathlib import Path
from typing import List, Optional

ROOT = Path(__file__).resolve().parent.parent / "src" / "solutions"


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def build_list(values):
    dummy = tail = ListNode()
    for v in values:
        tail.next = tail = ListNode(v)
    return dummy.next


def list_values(node):
    out = []
    while node:
        out.append(node.val)
        node = node.next
    return out


def build_tree(values):
    """Level-order values with None for missing children, as LeetCode shows them."""
    if not values or values[0] is None:
        return None
    nodes = [None if v is None else TreeNode(v) for v in values]
    children = deque(nodes[1:])
    for node in nodes:
        if node is None:
            continue
        if children:
            node.left = children.popleft()
        if children:
            node.right = children.popleft()
    return nodes[0]


def find(root, val):
    stack = [root]
    while stack:
        node = stack.pop()
        if node:
            if node.val == val:
                return node
            stack += [node.left, node.right]
    return None


def load(problem_id):
    source = (ROOT / f"{problem_id}.py").read_text(encoding="utf-8")
    namespace = {"ListNode": ListNode, "TreeNode": TreeNode, "List": List, "Optional": Optional}
    exec(compile(source, f"{problem_id}.py", "exec"), namespace)
    return namespace


def solution(problem_id):
    return load(problem_id)["Solution"]()


def run_ops(cls, ops, args):
    obj = cls(*args[0])
    return [None] + [getattr(obj, op)(*a) for op, a in zip(ops[1:], args[1:])]


def sorted_groups(groups):
    return sorted(sorted(g) for g in groups)


checks = {}


def check(problem_id):
    def register(fn):
        checks[problem_id] = fn
        return fn

    return register


@check(1)
def _():
    s = solution(1)
    assert sorted(s.twoSum([2, 7, 11, 15], 9)) == [0, 1]
    assert sorted(s.twoSum([3, 2, 4], 6)) == [1, 2]
    assert sorted(s.twoSum([3, 3], 6)) == [0, 1]


@check(49)
def _():
    s = solution(49)
    got = s.groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"])
    assert sorted_groups(got) == sorted_groups([["bat"], ["nat", "tan"], ["ate", "eat", "tea"]])
    assert sorted_groups(s.groupAnagrams([""])) == [[""]]
    assert sorted_groups(s.groupAnagrams(["a"])) == [["a"]]


@check(238)
def _():
    s = solution(238)
    assert s.productExceptSelf([1, 2, 3, 4]) == [24, 12, 8, 6]
    assert s.productExceptSelf([-1, 1, 0, -3, 3]) == [0, 0, 9, 0, 0]
    assert s.productExceptSelf([0, 0]) == [0, 0]


@check(560)
def _():
    s = solution(560)
    assert s.subarraySum([1, 1, 1], 2) == 2
    assert s.subarraySum([1, 2, 3], 3) == 2
    assert s.subarraySum([1, -1, 1], 0) == 2
    rng = random.Random(1)
    for _ in range(200):
        nums = [rng.randint(-3, 3) for _ in range(rng.randint(1, 9))]
        k = rng.randint(-4, 4)
        brute = sum(1 for i in range(len(nums)) for j in range(i, len(nums)) if sum(nums[i:j + 1]) == k)
        assert s.subarraySum(nums, k) == brute


@check(128)
def _():
    s = solution(128)
    assert s.longestConsecutive([100, 4, 200, 1, 3, 2]) == 4
    assert s.longestConsecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]) == 9
    assert s.longestConsecutive([]) == 0
    assert s.longestConsecutive([1, 2, 0, 1]) == 3


@check(36)
def _():
    s = solution(36)
    board = [
        ["5", "3", ".", ".", "7", ".", ".", ".", "."],
        ["6", ".", ".", "1", "9", "5", ".", ".", "."],
        [".", "9", "8", ".", ".", ".", ".", "6", "."],
        ["8", ".", ".", ".", "6", ".", ".", ".", "3"],
        ["4", ".", ".", "8", ".", "3", ".", ".", "1"],
        ["7", ".", ".", ".", "2", ".", ".", ".", "6"],
        [".", "6", ".", ".", ".", ".", "2", "8", "."],
        [".", ".", ".", "4", "1", "9", ".", ".", "5"],
        [".", ".", ".", ".", "8", ".", ".", "7", "9"],
    ]
    assert s.isValidSudoku(board) is True
    bad = [row[:] for row in board]
    bad[0][0] = "8"  # repeats 8 in column 0 and in the top-left box
    assert s.isValidSudoku(bad) is False
    box = [row[:] for row in board]
    box[1][1] = "9"  # repeats 9 only inside the top-left box
    assert s.isValidSudoku(box) is False


@check(15)
def _():
    s = solution(15)
    assert sorted(s.threeSum([-1, 0, 1, 2, -1, -4])) == [[-1, -1, 2], [-1, 0, 1]]
    assert s.threeSum([0, 1, 1]) == []
    assert s.threeSum([0, 0, 0, 0]) == [[0, 0, 0]]
    rng = random.Random(2)
    for _ in range(200):
        nums = [rng.randint(-4, 4) for _ in range(rng.randint(3, 10))]
        brute = sorted({tuple(sorted(c)) for c in itertools.combinations(nums, 3) if sum(c) == 0})
        got = s.threeSum(nums[:])
        assert len(got) == len(brute) and sorted(tuple(t) for t in got) == brute


@check(3)
def _():
    s = solution(3)
    assert s.lengthOfLongestSubstring("abcabcbb") == 3
    assert s.lengthOfLongestSubstring("bbbbb") == 1
    assert s.lengthOfLongestSubstring("pwwkew") == 3
    assert s.lengthOfLongestSubstring("") == 0
    assert s.lengthOfLongestSubstring("abba") == 2


@check(76)
def _():
    s = solution(76)
    assert s.minWindow("ADOBECODEBANC", "ABC") == "BANC"
    assert s.minWindow("a", "a") == "a"
    assert s.minWindow("a", "aa") == ""
    assert s.minWindow("aa", "aa") == "aa"


@check(1004)
def _():
    s = solution(1004)
    assert s.longestOnes([1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0], 2) == 6
    assert s.longestOnes([0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1], 3) == 10
    assert s.longestOnes([0, 0, 0], 0) == 0


@check(206)
def _():
    s = solution(206)
    assert list_values(s.reverseList(build_list([1, 2, 3, 4, 5]))) == [5, 4, 3, 2, 1]
    assert list_values(s.reverseList(build_list([1]))) == [1]
    assert s.reverseList(None) is None


@check(142)
def _():
    s = solution(142)
    for values, pos in (([3, 2, 0, -4], 1), ([1, 2], 0), ([1], -1), ([1, 2, 3], 2)):
        head = build_list(values)
        nodes, node = [], head
        while node:
            nodes.append(node)
            node = node.next
        if pos >= 0:
            nodes[-1].next = nodes[pos]
        expected = nodes[pos] if pos >= 0 else None
        assert s.detectCycle(head) is expected


@check(33)
def _():
    s = solution(33)
    assert s.search([4, 5, 6, 7, 0, 1, 2], 0) == 4
    assert s.search([4, 5, 6, 7, 0, 1, 2], 3) == -1
    assert s.search([1], 0) == -1
    for n in range(1, 8):
        base = list(range(n))
        for r in range(n):
            nums = base[r:] + base[:r]
            for target in range(-1, n + 1):
                assert s.search(nums, target) == (nums.index(target) if target in nums else -1)


@check(875)
def _():
    s = solution(875)
    assert s.minEatingSpeed([3, 6, 7, 11], 8) == 4
    assert s.minEatingSpeed([30, 11, 23, 4, 20], 5) == 30
    assert s.minEatingSpeed([30, 11, 23, 4, 20], 6) == 23


@check(56)
def _():
    s = solution(56)
    assert s.merge([[1, 3], [2, 6], [8, 10], [15, 18]]) == [[1, 6], [8, 10], [15, 18]]
    assert s.merge([[1, 4], [4, 5]]) == [[1, 5]]
    assert s.merge([[1, 4], [0, 4]]) == [[0, 4]]
    assert s.merge([[1, 4], [2, 3]]) == [[1, 4]]


@check(215)
def _():
    s = solution(215)
    assert s.findKthLargest([3, 2, 1, 5, 6, 4], 2) == 5
    assert s.findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4) == 4
    assert s.findKthLargest([1], 1) == 1


@check(347)
def _():
    s = solution(347)
    assert sorted(s.topKFrequent([1, 1, 1, 2, 2, 3], 2)) == [1, 2]
    assert s.topKFrequent([1], 1) == [1]
    assert sorted(s.topKFrequent([4, 4, 5, 5, 5, 6], 2)) == [4, 5]


@check(23)
def _():
    s = solution(23)
    lists = [build_list([1, 4, 5]), build_list([1, 3, 4]), build_list([2, 6])]
    assert list_values(s.mergeKLists(lists)) == [1, 1, 2, 3, 4, 4, 5, 6]
    assert s.mergeKLists([]) is None
    assert s.mergeKLists([None]) is None


@check(739)
def _():
    s = solution(739)
    assert s.dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73]) == [1, 1, 4, 2, 1, 1, 0, 0]
    assert s.dailyTemperatures([30, 40, 50, 60]) == [1, 1, 1, 0]
    assert s.dailyTemperatures([30, 30, 31]) == [2, 1, 0]


@check(155)
def _():
    cls = load(155)["MinStack"]
    got = run_ops(
        cls,
        ["MinStack", "push", "push", "push", "getMin", "pop", "top", "getMin"],
        [[], [-2], [0], [-3], [], [], [], []],
    )
    assert got == [None, None, None, None, -3, None, 0, -2]


@check(146)
def _():
    cls = load(146)["LRUCache"]
    got = run_ops(
        cls,
        ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
        [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
    )
    assert got == [None, None, None, 1, None, -1, None, -1, 3, 4]
    got = run_ops(cls, ["LRUCache", "put", "put", "put", "get"], [[1], [1, 1], [1, 2], [2, 3], [1]])
    assert got == [None, None, None, None, -1]


@check(622)
def _():
    cls = load(622)["MyCircularQueue"]
    ops = ["MyCircularQueue", "enQueue", "enQueue", "enQueue", "enQueue", "Rear", "isFull",
           "deQueue", "enQueue", "Rear", "Front"]
    args = [[3], [1], [2], [3], [4], [], [], [], [4], [], []]
    assert run_ops(cls, ops, args) == [None, True, True, True, False, 3, True, True, True, 4, 2]
    q = cls(1)
    assert q.Front() == -1 and q.Rear() == -1 and q.deQueue() is False
    assert q.enQueue(7) and q.isFull() and q.Rear() == 7 and q.deQueue() and q.isEmpty()


@check(208)
def _():
    cls = load(208)["Trie"]
    got = run_ops(
        cls,
        ["Trie", "insert", "search", "search", "startsWith", "insert", "search"],
        [[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]],
    )
    assert got == [None, None, True, False, True, None, True]


@check(295)
def _():
    cls = load(295)["MedianFinder"]
    got = run_ops(
        cls,
        ["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"],
        [[], [1], [2], [], [3], []],
    )
    assert got == [None, None, None, 1.5, None, 2.0]
    rng = random.Random(3)
    finder, seen = cls(), []
    for _ in range(300):
        x = rng.randint(-50, 50)
        finder.addNum(x)
        seen.append(x)
        ordered, n = sorted(seen), len(seen)
        expected = ordered[n // 2] if n % 2 else (ordered[n // 2 - 1] + ordered[n // 2]) / 2
        assert finder.findMedian() == expected


@check(200)
def _():
    s = solution(200)
    grid = [list(r) for r in ["11110", "11010", "11000", "00000"]]
    assert s.numIslands(grid) == 1
    grid = [list(r) for r in ["11000", "11000", "00100", "00011"]]
    assert s.numIslands(grid) == 3
    assert s.numIslands([["0"]]) == 0


@check(207)
def _():
    s = solution(207)
    assert s.canFinish(2, [[1, 0]]) is True
    assert s.canFinish(2, [[1, 0], [0, 1]]) is False
    assert s.canFinish(3, []) is True
    assert s.canFinish(4, [[1, 0], [2, 1], [3, 2], [1, 3]]) is False


@check(743)
def _():
    s = solution(743)
    assert s.networkDelayTime([[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2) == 2
    assert s.networkDelayTime([[1, 2, 1]], 2, 1) == 1
    assert s.networkDelayTime([[1, 2, 1]], 2, 2) == -1
    assert s.networkDelayTime([[1, 2, 5], [1, 3, 1], [3, 2, 1]], 3, 1) == 2


@check(127)
def _():
    s = solution(127)
    assert s.ladderLength("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]) == 5
    assert s.ladderLength("hit", "cog", ["hot", "dot", "dog", "lot", "log"]) == 0
    assert s.ladderLength("a", "c", ["a", "b", "c"]) == 2


@check(684)
def _():
    s = solution(684)
    assert s.findRedundantConnection([[1, 2], [1, 3], [2, 3]]) == [2, 3]
    assert s.findRedundantConnection([[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]) == [1, 4]


@check(1293)
def _():
    s = solution(1293)
    grid = [[0, 0, 0], [1, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 0]]
    assert s.shortestPath(grid, 1) == 6
    assert s.shortestPath([[0, 1, 1], [1, 1, 1], [1, 0, 0]], 1) == -1
    assert s.shortestPath([[0]], 0) == 0
    assert s.shortestPath([[0, 1], [0, 0]], 0) == 2


@check(98)
def _():
    s = solution(98)
    assert s.isValidBST(build_tree([2, 1, 3])) is True
    assert s.isValidBST(build_tree([5, 1, 4, None, None, 3, 6])) is False
    assert s.isValidBST(build_tree([5, 4, 6, None, None, 3, 7])) is False  # 3 breaks an ancestor bound
    assert s.isValidBST(build_tree([2, 2, 2])) is False
    assert s.isValidBST(build_tree([-(2 ** 31), None, 2 ** 31 - 1])) is True


@check(102)
def _():
    s = solution(102)
    assert s.levelOrder(build_tree([3, 9, 20, None, None, 15, 7])) == [[3], [9, 20], [15, 7]]
    assert s.levelOrder(build_tree([1])) == [[1]]
    assert s.levelOrder(None) == []


@check(236)
def _():
    s = solution(236)
    root = build_tree([3, 5, 1, 6, 2, 0, 8, None, None, 7, 4])
    assert s.lowestCommonAncestor(root, find(root, 5), find(root, 1)).val == 3
    assert s.lowestCommonAncestor(root, find(root, 5), find(root, 4)).val == 5
    root = build_tree([1, 2])
    assert s.lowestCommonAncestor(root, find(root, 1), find(root, 2)).val == 1


@check(124)
def _():
    s = solution(124)
    assert s.maxPathSum(build_tree([1, 2, 3])) == 6
    assert s.maxPathSum(build_tree([-10, 9, 20, None, None, 15, 7])) == 42
    assert s.maxPathSum(build_tree([-3])) == -3
    assert s.maxPathSum(build_tree([-2, -1])) == -1


@check(78)
def _():
    s = solution(78)
    got = s.subsets([1, 2, 3])
    assert len(got) == 8 and sorted(map(sorted, got)) == sorted(
        sorted(c) for r in range(4) for c in itertools.combinations([1, 2, 3], r)
    )
    assert sorted(s.subsets([0])) == [[], [0]]


@check(79)
def _():
    s = solution(79)
    board = [["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]]
    assert s.exist([r[:] for r in board], "ABCCED") is True
    assert s.exist([r[:] for r in board], "SEE") is True
    assert s.exist([r[:] for r in board], "ABCB") is False
    assert s.exist([["a"]], "a") is True


@check(198)
def _():
    s = solution(198)
    assert s.rob([1, 2, 3, 1]) == 4
    assert s.rob([2, 7, 9, 3, 1]) == 12
    assert s.rob([2, 1, 1, 2]) == 4
    assert s.rob([5]) == 5


@check(322)
def _():
    s = solution(322)
    assert s.coinChange([1, 2, 5], 11) == 3
    assert s.coinChange([2], 3) == -1
    assert s.coinChange([1], 0) == 0
    assert s.coinChange([186, 419, 83, 408], 6249) == 20


@check(300)
def _():
    s = solution(300)
    assert s.lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18]) == 4
    assert s.lengthOfLIS([0, 1, 0, 3, 2, 3]) == 4
    assert s.lengthOfLIS([7, 7, 7, 7]) == 1


@check(72)
def _():
    s = solution(72)
    assert s.minDistance("horse", "ros") == 3
    assert s.minDistance("intention", "execution") == 5
    assert s.minDistance("", "abc") == 3
    assert s.minDistance("abc", "") == 3


@check(416)
def _():
    s = solution(416)
    assert s.canPartition([1, 5, 11, 5]) is True
    assert s.canPartition([1, 2, 3, 5]) is False
    assert s.canPartition([1, 1]) is True
    assert s.canPartition([2]) is False


@check(55)
def _():
    s = solution(55)
    assert s.canJump([2, 3, 1, 1, 4]) is True
    assert s.canJump([3, 2, 1, 0, 4]) is False
    assert s.canJump([0]) is True


def main():
    files = {int(p.stem) for p in ROOT.glob("*.py")}
    missing = files ^ set(checks)
    if missing:
        sys.exit(f"Solutions and checks differ: {sorted(missing)}")
    failures = 0
    for problem_id in sorted(checks):
        try:
            checks[problem_id]()
        except Exception as error:  # report every failure, not just the first
            failures += 1
            print(f"FAIL {problem_id}: {type(error).__name__} {error}")
    print(f"{len(checks) - failures} of {len(checks)} solutions passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
