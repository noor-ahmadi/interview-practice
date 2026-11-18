# Time O(n), extra space O(1).
from typing import List


class Solution:
    def rob(self, nums: List[int]) -> int:
        take = skip = 0  # best totals if the previous house was robbed / skipped
        for amount in nums:
            take, skip = skip + amount, max(take, skip)
        return max(take, skip)
