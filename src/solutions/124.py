# Time O(n), extra space O(h) for recursion. TreeNode is defined by LeetCode.
from typing import Optional


class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        best = float("-inf")  # handles trees whose values are all negative

        def gain(node: Optional[TreeNode]) -> int:
            nonlocal best
            if not node:
                return 0
            left = max(gain(node.left), 0)  # drop a branch that only lowers the sum
            right = max(gain(node.right), 0)
            best = max(best, node.val + left + right)  # the path that bends at this node
            return node.val + max(left, right)  # only one branch can continue upward

        gain(root)
        return best
