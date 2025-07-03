---
title: 滑动窗口
date: 2020-03-10
icon: window-closed-variant
category: 
    - Algorithm
tag: 
    - Algorithm
    - 滑动窗口
---

**题目：[3. 无重复字符的最长子串](https://leetcode-cn.com/problems/longest-substring-without-repeating-characters/)**

给定一个字符串 s ，请你找出其中不含有重复字符的最长子串的长度。

示例 1:

> 输入: s = "abcabcbb"
> 输出: 3 
> 解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。

示例 2:

> 输入: s = "bbbbb"
> 输出: 1
> 解释: 因为无重复字符的最长子串是 "b"，所以其长度为 1。

示例 3:

> 输入: s = "pwwkew"
> 输出: 3
> 解释: 因为无重复字符的最长子串是 "wke"，所以其长度为 3。
     请注意，你的答案必须是 子串 的长度，"pwke" 是一个子序列，不是子串。

提示：
* `0 <= s.length <= 5 * 104`
* `s 由英文字母、数字、符号和空格组成`

**算法说明**

* 窗口向右推移，依次比较当前字符 s[i] 与之前的子串是否重复  
* 如果重复，则将左侧的窗口移动到与其重复字符的后面一格，去除前面的重复项

**动画演示**

![滑动窗口动画演示](/assets/images/sliding-window.gif)

**代码**

```ts
/**
* @param {string} s
* @return {number}
*/
function lengthOfLongestSubstring(s: string): number {
    const set = new Set<string>();
    let left = 0;
    let maxLength = 0;

    for (let right = 0; right < s.length; right++) {
        while (set.has(s[right])) {
            set.delete(s[left]);
            left++;
        }
        set.add(s[right]);
        maxLength = Math.max(maxLength, right - left + 1);
    }

    return maxLength;
};
```