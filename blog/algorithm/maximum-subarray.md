---
title: 最大子序和
date: 2020-03-10
icon: format-list-group-add
category: 
    - Algorithm
tag: 
    - Algorithm
    - 动态规划
---

**题目：[53. 最大子序和](https://leetcode-cn.com/problems/maximum-subarray/)**

给你一个整数数组 nums ，请你找出一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。

子数组是数组中的一个连续部分。

示例 1：

> 输入：nums = [-2,1,-3,4,-1,2,1,-5,4]
> 输出：6
> 解释：连续子数组 [4,-1,2,1] 的和最大，为 6 。

示例 2：

> 输入：nums = [1]
> 输出：1

示例 3：

> 输入：nums = [5,4,-1,7,8]
> 输出：23

提示：

* `1 <= nums.length <= 105`
* `-104 <= nums[i] <= 104`

**算法说明**

将问题演变为遍历出每个节点为结束点的所有子序列

**动画演示**

![最大子序和动画演示](/assets/images/maximum-subarray.gif)

**代码**

```ts
function maxSubArray(nums: number[]): number {
    let maxSum = nums[0];   // 初始化最大和
    let currentMax = nums[0];    // 当前子数组和

    for(let i = 1; i < nums.length; i++) {
        currentMax = Math.max(currentMax + nums[i], nums[i]);
        maxSum = Math.max(maxSum, currentMax);
    }

    return maxSum;
};
```