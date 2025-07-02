import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
    {
      text: "React",
      icon: "mdi:react",
      prefix: "react/",
      link: "react/",
      children: [{
        text: "React Scheduler",
        link: "react-scheduler.html"
      }],
    }, {
      text: "算法",
      icon: "mdi:calculator-variant-outline",
      prefix: "algorithm/",
      link: "algorithm/"
    },
    "intro"
  ],
});
