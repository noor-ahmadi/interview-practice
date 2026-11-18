# Time O(n log m) for the largest pile m, extra space O(1).
from typing import List


class Solution:
    def minEatingSpeed(self, piles: List[int], h: int) -> int:
        lo, hi = 1, max(piles)  # eating max(piles) per hour always finishes
        while lo < hi:
            speed = (lo + hi) // 2
            hours = sum((p + speed - 1) // speed for p in piles)  # ceiling division
            if hours <= h:
                hi = speed  # feasible, so try slower
            else:
                lo = speed + 1
        return lo
