# Time O(n), extra space O(min(n, alphabet)).
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last = {}  # character -> index of its latest occurrence
        start = best = 0
        for i, ch in enumerate(s):
            if last.get(ch, -1) >= start:
                start = last[ch] + 1  # jump past the earlier copy
            last[ch] = i
            best = max(best, i - start + 1)
        return best
