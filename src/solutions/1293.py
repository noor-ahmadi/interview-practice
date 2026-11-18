# Time O(rows * cols * k), extra space O(rows * cols * k).
from collections import deque
from typing import List


class Solution:
    def shortestPath(self, grid: List[List[int]], k: int) -> int:
        rows, cols = len(grid), len(grid[0])
        if k >= rows + cols - 2:
            return rows + cols - 2  # enough breaks for a direct Manhattan path
        seen = {(0, 0, k)}  # state: row, column, breaks left
        queue = deque([(0, 0, k, 0)])
        while queue:
            r, c, left, steps = queue.popleft()
            if r == rows - 1 and c == cols - 1:
                return steps
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < rows and 0 <= nc < cols:
                    remaining = left - grid[nr][nc]
                    if remaining >= 0 and (nr, nc, remaining) not in seen:
                        seen.add((nr, nc, remaining))
                        queue.append((nr, nc, remaining, steps + 1))
        return -1
