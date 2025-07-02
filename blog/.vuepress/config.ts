import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "H 的博客小站",
  description: "H 的博客小站",
  head: [
    ['link', { rel: 'icon', href: "/logo.ico"}],
  ],

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
