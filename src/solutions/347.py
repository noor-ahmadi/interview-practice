# Time O(n), extra space O(n), using buckets indexed by frequency.
from collections import Counter
from typing import List


class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        counts = Counter(nums)
        buckets = [[] for _ in range(len(nums) + 1)]
        for value, freq in counts.items():
            buckets[freq].append(value)
        result = []
        for freq in range(len(nums), 0, -1):
            for value in buckets[freq]:
                result.append(value)
                if len(result) == k:
                    return result
        return result
