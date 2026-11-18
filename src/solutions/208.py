# Each operation O(L) for a word of length L; space grows with the characters stored.
class Trie:
    END = "$"  # terminal marker; inputs are lowercase letters

    def __init__(self):
        self.root = {}

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node[self.END] = True

    def _walk(self, text: str):
        node = self.root
        for ch in text:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def search(self, word: str) -> bool:
        node = self._walk(word)
        return node is not None and self.END in node  # a prefix alone is not a word

    def startsWith(self, prefix: str) -> bool:
        return self._walk(prefix) is not None
