# Time O(n * 2^n), extra space O(n) beyond the output.
from typing import List


class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        result, current = [], []

        def backtrack(start: int) -> None:
            result.append(current[:])  # copy, because current keeps changing
            for i in range(start, len(nums)):
                current.append(nums[i])  # choose
                backtrack(i + 1)  # explore
                current.pop()  # undo, so the next sibling starts from the same state

        backtrack(0)
        return result
