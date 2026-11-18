# Every operation O(1) time, extra space O(k).
class MyCircularQueue:
    def __init__(self, k: int):
        self.items = [0] * k
        self.head = 0  # index of the oldest item
        self.size = 0  # the live count tells full from empty

    def enQueue(self, value: int) -> bool:
        if self.isFull():
            return False
        self.items[(self.head + self.size) % len(self.items)] = value
        self.size += 1
        return True

    def deQueue(self) -> bool:
        if self.isEmpty():
            return False
        self.head = (self.head + 1) % len(self.items)
        self.size -= 1
        return True

    def Front(self) -> int:
        return -1 if self.isEmpty() else self.items[self.head]

    def Rear(self) -> int:
        if self.isEmpty():
            return -1
        return self.items[(self.head + self.size - 1) % len(self.items)]

    def isEmpty(self) -> bool:
        return self.size == 0

    def isFull(self) -> bool:
        return self.size == len(self.items)
