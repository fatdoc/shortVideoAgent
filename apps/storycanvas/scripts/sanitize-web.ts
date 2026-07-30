import fs from "node:fs";
import path from "node:path";

const webEntry = path.resolve(process.cwd(), "data", "web", "index.html");
let html = fs.readFileSync(webEntry, "utf8");
let changes = 0;

function replaceExact(label: string, source: string, target = ""): void {
  if (!html.includes(source)) return;
  const occurrences = html.split(source).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label} 匹配数量异常：${occurrences}`);
  }
  html = html.replace(source, target);
  changes += 1;
}

function removeBetween(label: string, startMarker: string, endMarker: string): void {
  const start = html.indexOf(startMarker);
  if (start < 0) return;
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label} 未找到结束标记`);
  html = html.slice(0, start) + html.slice(end);
  changes += 1;
}

removeBetween(
  "关于页代码仓库区块",
  'de("div",Ioo,[de("span",null,Te(x.$t("settings.about.codeRepository")),1),',
  'de("div",Yoo,[de("span",null,Te(x.$t("settings.about.license")),1),',
);

replaceExact(
  "关于页许可证外链",
  'style:{cursor:"pointer"},onClick:L[2]||(L[2]=W=>v("https://github.com/HBAI-Ltd/Toonflow-app?tab=Apache-2.0-1-ov-file"))',
  'style:{cursor:"default"}',
);

replaceExact(
  "关于页第三方更新源",
  'g=ue([{value:"toonflow",label:"ToonFlow",iconType:"image",iconSrc:Too,iconClass:"toonflow",iconBg:"#ececec",disabled:!1},{value:"github",label:t("settings.about.github"),iconType:"component",iconName:"github",iconClass:"github",disabled:!0},{value:"atomgit",label:"AtomGit",iconType:"image",iconSrc:Loo,iconClass:"atomgit",iconBg:"#f9f9fb",disabled:!0},{value:"gitee",label:t("settings.about.gitee"),iconType:"component",iconName:"code",iconClass:"gitee",disabled:!0}]),k=ue(!1)',
  'g=ue([{value:"toonflow",label:"ToonFlow",iconType:"image",iconSrc:Too,iconClass:"toonflow",iconBg:"#ececec",disabled:!1}]),k=ue(!1)',
);
replaceExact(
  "更新源名称映射",
  'function b(x){return{toonflow:"ToonFlow",github:"GitHub",atomgit:"AtomGit",gitee:"Gitee"}[x]}',
  'function b(x){return{toonflow:"ToonFlow"}[x]}',
);

replaceExact(
  "首次引导仓库跳转",
  'async function A(){r.value?await fetch("toonflow://openurlwithbrowser?url=https://github.com/HBAI-Ltd/Toonflow-app"):window.open("https://github.com/HBAI-Ltd/Toonflow-app")}',
);
removeBetween(
  "首次引导推广区块",
  ',de("div",wWo,[',
  '])):Pt("",!0)]),de("div",LWo,[',
);

replaceExact(
  "侧栏仓库跳转",
  'async function f(){r.value?await fetch("toonflow://openurlwithbrowser?url=https://github.com/HBAI-Ltd/Toonflow-app"):window.open("https://github.com/HBAI-Ltd/Toonflow-app")}',
);
replaceExact(
  "侧栏仓库按钮",
  'c(O,{content:p.$t("workbench.menu.jumpGithub"),placement:"right",destroyOnClose:"",showArrow:!1},{default:ke(()=>[de("div",{class:"item c",onClick:f},[c(x,{class:"icon"})])]),_:1},8,["content"])',
);
replaceExact(
  "侧栏仓库图标",
  ',x=un("i-github-one")',
);

replaceExact(
  "Agent 推荐横幅跳转",
  'async function z(){t.value?await fetch("toonflow://openurlwithbrowser?url=https://platform.deepseek.com"):window.open("https://platform.deepseek.com","_blank")}',
);
removeBetween(
  "Agent 推荐横幅",
  'de("div",Wro,[',
  'de("div",Zro,[',
);

for (const forbidden of [
  "https://github.com/HBAI-Ltd/Toonflow-app",
  "https://work.weixin.qq.com/u/vc36adcc89845edcbe",
  "https://platform.deepseek.com",
  "Star on GitHub",
]) {
  if (html.includes(forbidden)) {
    throw new Error(`前端仍包含推广入口：${forbidden}`);
  }
}

if (changes > 0) {
  fs.writeFileSync(webEntry, html);
}

console.log(`前端去推广处理完成：${changes} 处变更。`);
