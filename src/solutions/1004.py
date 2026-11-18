# Time O(n), extra space O(1).
from typing import List


class Solution:
    def longestOnes(self, nums: List[int], k: int) -> int:
        left = zeros = best = 0
        for right, x in enumerate(nums):
            if x == 0:
                zeros += 1
            while zeros > k:  # too many flips: shrink until valid again
                if nums[left] == 0:
                    zeros -= 1
                left += 1
            best = max(best, right - left + 1)
        return best
