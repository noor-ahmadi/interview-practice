# Time O(n log n), extra space O(n) for the output.
from typing import List


class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        intervals.sort(key=lambda interval: interval[0])
        merged = []
        for start, end in intervals:
            if merged and start <= merged[-1][1]:  # overlaps the last merged interval
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        return merged
