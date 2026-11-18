# Time O(n log n), extra space O(n).
from bisect import bisect_left
from typing import List


class Solution:
    def lengthOfLIS(self, nums: List[int]) -> int:
        tails = []  # tails[i]: smallest end of an increasing subsequence of length i + 1
        for x in nums:
            i = bisect_left(tails, x)  # first tail >= x keeps the sequence strictly increasing
            if i == len(tails):
                tails.append(x)
            else:
                tails[i] = x
        return len(tails)
