# Time O(n log k), extra space O(k). Quickselect gives expected O(n).
import heapq
from typing import List


class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        heap = []  # min-heap of the k largest values seen so far
        for x in nums:
            heapq.heappush(heap, x)
            if len(heap) > k:
                heapq.heappop(heap)
        return heap[0]
