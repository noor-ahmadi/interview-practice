# Time O(n), extra space O(h). TreeNode is defined by LeetCode.
from typing import Optional


class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        stack = [(root, float("-inf"), float("inf"))]  # node and its allowed open interval
        while stack:
            node, low, high = stack.pop()
            if not node:
                continue
            if not low < node.val < high:
                return False
            stack.append((node.left, low, node.val))  # left subtree tightens the upper bound
            stack.append((node.right, node.val, high))  # right subtree tightens the lower bound
        return True
