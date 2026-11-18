# Time O(1) for a fixed 9 x 9 board, extra space O(1).
from typing import List


class Solution:
    def isValidSudoku(self, board: List[List[str]]) -> bool:
        seen = set()
        for r in range(9):
            for c in range(9):
                digit = board[r][c]
                if digit == ".":
                    continue
                keys = ((r, "row", digit), (c, "col", digit), (r // 3, c // 3, digit))
                if any(key in seen for key in keys):
                    return False
                seen.update(keys)
        return True
