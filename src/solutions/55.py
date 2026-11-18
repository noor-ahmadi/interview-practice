# Time O(n), extra space O(1).
from typing import List


class Solution:
    def canJump(self, nums: List[int]) -> bool:
        farthest = 0  # farthest index reachable so far
        for i, jump in enumerate(nums):
            if i > farthest:
                return False  # this index can never be reached
            farthest = max(farthest, i + jump)
        return True
