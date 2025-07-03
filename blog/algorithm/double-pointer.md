---
title: 双指针
date: 2020-03-10
icon: shuffle-variant
category: 
    - Algorithm
tag: 
    - Algorithm
    - 双指针
---

**题目：[26. 删除有序数组中的重复项](https://leetcode.cn/problems/remove-duplicates-from-sorted-array/description/)**

给你一个**非严格递增**排列的数组nums，请你**原地删除**重复出现的元素，使每个元素只出现一次，返回删除后数组的新长度。元素的相对顺序应该保持 一致。然后返回nums中唯一元素的个数。

考虑 nums 的唯一元素的数量为k，你需要做以下事情确保你的题解可以被通过：
* 更改数组 nums ，使 nums 的前 k 个元素包含唯一元素，并按照它们最初在 nums 中出现的顺序排列。nums 的其余元素与 nums 的大小不重要。
* 返回 k 。

**判题标准:**

系统会用下面的代码来测试你的题解:

> int[] nums = [...]; // 输入数组
> int[] expectedNums = [...]; // 长度正确的期望答案
>
> int k = removeDuplicates(nums); // 调用
>   
> assert k == expectedNums.length;
> for (int i = 0; i < k; i++) {
>     assert nums[i] == expectedNums[i];
> }

如果所有断言都通过，那么您的题解将被 通过。

**动画演示**

![双指针动画演示](/assets/images/double-pointer.gif)

**代码**

```ts
function removeDuplicates(nums: number[]): number {
    if (nums.length === 0 || nums.length === 1) {
        return nums.length;
    }

    let slow = 0;
    for (let fast = 1; fast < nums.length; fast++) {
        if (nums[fast] !== nums[slow]) {
            slow++;
            nums[slow] = nums[fast];
        }
    }

    return slow + 1;
};
```