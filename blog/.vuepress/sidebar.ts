import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
     {
      text: "算法",
      icon: "calculator-variant-outline",
      prefix: "algorithm/",
      link: "algorithm/",
      children: [
        {
          text: "leetcode 练习题单",
          icon: "file-code-outline",
          link: "leetcode.html"
      },{
        text: "滑动窗口",
        icon: "window-closed-variant",
        link: "sliding-window.html"
      },{
        text: "双指针",
        icon: "shuffle-variant",
        link: "double-pointer.html"
      },{
        text: '动态规划',
        icon: "family-tree",
        children: [{
          text: "最大子序和",
          icon: "format-list-group-add",
          link: "maximum-subarray.html"
        }]
      }]
    },
    {
      text: "React",
      icon: "react",
      prefix: "react/",
      link: "react/",
      children: [
        {
          text: "React 源码解析（一） —— Virtual DOM",
          icon: "lightbulb-on-outline",
          link: "react-virtual-dom.html"
        },{
          text: "React Redux 使用小记",
          icon: "lead-pencil",
          link: "react-redux.html"
        },{
        text: "React Scheduler",
        link: "react-scheduler.html"
      }],
    },
    "intro"
  ],
});
