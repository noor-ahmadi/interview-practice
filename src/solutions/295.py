# addNum O(log n), findMedian O(1), extra space O(n).
import heapq


class MedianFinder:
    def __init__(self):
        self.low = []  # max-heap of the smaller half, stored negated
        self.high = []  # min-heap of the larger half

    def addNum(self, num: int) -> None:
        heapq.heappush(self.low, -num)
        heapq.heappush(self.high, -heapq.heappop(self.low))  # keep every low <= every high
        if len(self.high) > len(self.low):
            heapq.heappush(self.low, -heapq.heappop(self.high))  # low holds the extra one

    def findMedian(self) -> float:
        if len(self.low) > len(self.high):
            return float(-self.low[0])
        return (-self.low[0] + self.high[0]) / 2
