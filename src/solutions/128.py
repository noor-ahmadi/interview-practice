# Time O(n), extra space O(n).
from typing import List


class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        values = set(nums)
        best = 0
        for x in values:
            if x - 1 not in values:  # only count from the start of a run
                end = x
                while end + 1 in values:
                    end += 1
                best = max(best, end - x + 1)
        return best
