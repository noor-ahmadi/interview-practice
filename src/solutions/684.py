# Time O(n * alpha(n)), extra space O(n). Union-find.
from typing import List


class Solution:
    def findRedundantConnection(self, edges: List[List[int]]) -> List[int]:
        parent = list(range(len(edges) + 1))
        size = [1] * (len(edges) + 1)

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]  # path halving
                x = parent[x]
            return x

        for a, b in edges:
            ra, rb = find(a), find(b)
            if ra == rb:
                return [a, b]  # already connected, so this edge closes the cycle
            if size[ra] < size[rb]:
                ra, rb = rb, ra
            parent[rb] = ra  # attach the smaller tree under the larger
            size[ra] += size[rb]
        return []
