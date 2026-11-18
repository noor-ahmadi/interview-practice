# Time O(m * n), extra space O(n) with two rows.
class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        m, n = len(word1), len(word2)
        prev = list(range(n + 1))  # converting "" into each prefix of word2
        for i in range(1, m + 1):
            curr = [i] + [0] * n  # converting word1[:i] into ""
            for j in range(1, n + 1):
                if word1[i - 1] == word2[j - 1]:
                    curr[j] = prev[j - 1]  # a match costs nothing
                else:
                    curr[j] = 1 + min(
                        prev[j],  # delete
                        curr[j - 1],  # insert
                        prev[j - 1],  # substitute
                    )
            prev = curr
        return prev[n]
