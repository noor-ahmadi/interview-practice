# Time O(E log E), extra space O(V + E). Dijkstra with a lazy heap.
import heapq
from collections import defaultdict
from typing import List


class Solution:
    def networkDelayTime(self, times: List[List[int]], n: int, k: int) -> int:
        graph = defaultdict(list)
        for u, v, w in times:
            graph[u].append((v, w))
        dist = {}  # settled shortest times
        heap = [(0, k)]
        while heap:
            time, node = heapq.heappop(heap)
            if node in dist:
                continue  # a shorter time already settled this node
            dist[node] = time
            for nxt, w in graph[node]:
                if nxt not in dist:
                    heapq.heappush(heap, (time + w, nxt))
        return max(dist.values()) if len(dist) == n else -1
