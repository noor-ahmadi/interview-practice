# Time O(n * sum), extra space O(sum).
from typing import List


class Solution:
    def canPartition(self, nums: List[int]) -> bool:
        total = sum(nums)
        if total % 2:
            return False
        target = total // 2
        reachable = [True] + [False] * target  # reachable[s]: some subset sums to s
        for x in nums:
            for s in range(target, x - 1, -1):  # downward, so each number is used once
                reachable[s] = reachable[s] or reachable[s - x]
        return reachable[target]
