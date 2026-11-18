# Time O(amount * len(coins)), extra space O(amount).
from typing import List


class Solution:
    def coinChange(self, coins: List[int], amount: int) -> int:
        impossible = amount + 1  # more coins than any real answer can use
        fewest = [0] + [impossible] * amount  # fewest[a]: coins needed to make a
        for a in range(1, amount + 1):
            for coin in coins:
                if coin <= a:
                    fewest[a] = min(fewest[a], fewest[a - coin] + 1)
        return fewest[amount] if fewest[amount] <= amount else -1
