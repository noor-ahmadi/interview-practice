# get and put O(1) time, extra space O(capacity).
class Node:
    def __init__(self, key: int = 0, value: int = 0):
        self.key, self.value = key, value
        self.prev = self.next = None


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.nodes = {}  # key -> node
        self.head, self.tail = Node(), Node()  # sentinels; head.next is most recent
        self.head.next, self.tail.prev = self.tail, self.head

    def _remove(self, node: Node) -> None:
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_front(self, node: Node) -> None:
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        node = self.nodes.get(key)
        if node is None:
            return -1
        self._remove(node)  # a read also makes the key most recent
        self._add_front(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        if key in self.nodes:
            self._remove(self.nodes[key])
        node = Node(key, value)
        self.nodes[key] = node
        self._add_front(node)
        if len(self.nodes) > self.capacity:
            oldest = self.tail.prev
            self._remove(oldest)
            del self.nodes[oldest.key]
