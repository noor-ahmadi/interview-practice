# Time O(len(s) + len(t)), extra space O(alphabet).
from collections import Counter


class Solution:
    def minWindow(self, s: str, t: str) -> str:
        need = Counter(t)
        missing = len(t)  # characters of t not yet covered by the window
        left = 0
        best_start, best_len = 0, float("inf")
        for right, ch in enumerate(s):
            if need[ch] > 0:
                missing -= 1
            need[ch] -= 1
            while missing == 0:  # the window is valid, so shrink it from the left
                if right - left + 1 < best_len:
                    best_start, best_len = left, right - left + 1
                need[s[left]] += 1
                if need[s[left]] > 0:
                    missing += 1
                left += 1
        return "" if best_len == float("inf") else s[best_start:best_start + best_len]
