# Time O(n), extra space O(1). ListNode is defined by LeetCode.
from typing import Optional


class Solution:
    def detectCycle(self, head: Optional[ListNode]) -> Optional[ListNode]:
        slow = fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if slow is fast:
                slow = head  # both are now the same distance from the entry
                while slow is not fast:
                    slow = slow.next
                    fast = fast.next
                return slow
        return None
