# Every operation O(1) time, extra space O(n).
class MinStack:
    def __init__(self):
        self.stack = []  # (value, minimum of this entry and everything below it)

    def push(self, val: int) -> None:
        current = min(val, self.stack[-1][1]) if self.stack else val
        self.stack.append((val, current))

    def pop(self) -> None:
        self.stack.pop()

    def top(self) -> int:
        return self.stack[-1][0]

    def getMin(self) -> int:
        return self.stack[-1][1]
