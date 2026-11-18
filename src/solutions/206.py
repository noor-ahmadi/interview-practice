# Time O(n), extra space O(1). ListNode is defined by LeetCode.
from typing import Optional


class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev, curr = None, head  # prev: reversed prefix, curr: untouched suffix
        while curr:
            nxt = curr.next  # save the suffix before relinking
            curr.next = prev
            prev, curr = curr, nxt
        return prev
