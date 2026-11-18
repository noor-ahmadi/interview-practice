# Time O(n), extra space O(n).
from collections import defaultdict
from typing import List


class Solution:
    def subarraySum(self, nums: List[int], k: int) -> int:
        count = defaultdict(int)
        count[0] = 1  # the empty prefix
        total = answer = 0
        for x in nums:
            total += x
            answer += count[total - k]  # query before inserting the current sum
            count[total] += 1
        return answer
