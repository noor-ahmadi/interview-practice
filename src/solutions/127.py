# Time O(n * L^2) for n words of length L, extra space O(n * L^2).
from collections import defaultdict, deque
from typing import List


class Solution:
    def ladderLength(self, beginWord: str, endWord: str, wordList: List[str]) -> int:
        words = set(wordList)
        if endWord not in words:
            return 0
        buckets = defaultdict(list)  # pattern such as "h*t" -> words matching it
        for word in words | {beginWord}:
            for i in range(len(word)):
                buckets[word[:i] + "*" + word[i + 1:]].append(word)
        seen = {beginWord}
        queue = deque([(beginWord, 1)])
        while queue:
            word, steps = queue.popleft()
            if word == endWord:
                return steps
            for i in range(len(word)):
                # pop, so each pattern bucket is expanded only once
                for nxt in buckets.pop(word[:i] + "*" + word[i + 1:], []):
                    if nxt not in seen:
                        seen.add(nxt)
                        queue.append((nxt, steps + 1))
        return 0
