#!/usr/bin/env node
/**
 * Build the MapX scenario handbook as two print-ready PDFs (Simplified Chinese
 * and English) from the scenario pages under en|zh/concepts/scenarios/.
 *
 * Pipeline: MDX -> block model -> print HTML -> Chromium (Playwright) -> PDF.
 * The table of contents is filled in with real page numbers by rendering the
 * book twice and reading the first pass back with pdftotext.
 *
 * Usage:
 *   node scripts/build-scenarios-handbook.mjs
 *
 * Environment overrides:
 *   MAPX_REPO   path to the product repo that provides @playwright/test
 *   PLAYWRIGHT_PACKAGE  module id or absolute path of playwright/@playwright/test
 */

import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(SCRIPT_DIR, "..");
const TMP_DIR = path.join(DOCS_ROOT, "tmp", "pdfs");
const OUT_DIR = path.join(DOCS_ROOT, "output", "pdf");
const EDITION = "2026-10";

const SCENARIOS = [
  {
    key: "development-suitability-baseline",
    num: 1,
    accent: "#006BCB",
    image: "images/scenarios/development-suitability-baseline.jpg",
    zh: {
      title: "开发适宜性基础评价",
      city: "内罗毕",
      lede: "在内罗毕识别生态、地形与洪涝硬约束，对剩余空间做建设适宜性分级与承载规模估算，最后提出开发边界与分级管控建议。",
      methods: "硬约束筛选 · 加权叠加 · 承载规模估算",
      deliverables: "适宜性分级、约束图层、承载规模表、图表与报告",
    },
    en: {
      title: "Development Suitability Baseline",
      city: "Nairobi",
      lede: "Screen ecological, terrain and flood constraints, grade the remaining land, estimate carrying capacity and propose a development boundary with tiered controls.",
      methods: "Hard-constraint screening · weighted overlay · capacity estimate",
      deliverables: "Suitability classes, constraint layers, capacity tables, charts and a report",
    },
  },
  {
    key: "carrying-capacity-assessment",
    num: 2,
    accent: "#0F766E",
    image: "images/scenarios/carrying-capacity-assessment.jpg",
    zh: {
      title: "资源环境承载能力评价",
      city: "雅加达",
      lede: "评估地形、湿度、洪涝与降水如何限制雅加达的发展，给出承载能力分级，并找出容量低、压力高的超载区域与治理对策。",
      methods: "模糊隶属度 · 短板合成 · 承压四象限",
      deliverables: "承载能力分级、超载格网、限制因子表、图表与报告",
    },
    en: {
      title: "Carrying Capacity Assessment",
      city: "Jakarta",
      lede: "Assess how terrain, wetness, flood depth and rainfall constrain Jakarta's growth, grade carrying capacity, and flag the districts where pressure is highest.",
      methods: "Fuzzy membership · limiting-factor composite · pressure quadrants",
      deliverables: "Capacity classes, overload cells, constraint tables, charts and a report",
    },
  },
  {
    key: "15min-life-circle-coverage",
    num: 3,
    accent: "#4F46E5",
    image: "images/scenarios/15min-life-circle-coverage.jpg",
    zh: {
      title: "15 分钟生活圈覆盖",
      city: "雅加达",
      lede: "审计雅加达中心城区谁能在 800 米步行范围内到达学校、诊所与公园，排出缺口最大的街区，并给出可达性评分。",
      methods: "步行服务区 · 缺口人口 · 2SFCA 可达性",
      deliverables: "三类缺口图层、街区综合表、榜单与热力图、报告",
    },
    en: {
      title: "15-minute Life Circle Coverage",
      city: "Jakarta",
      lede: "Audit who can reach a school, a clinic and a park within an 800 m walk in central Jakarta, rank the neighbourhoods with the biggest shortfall, and score accessibility.",
      methods: "Walking service areas · shortfall population · 2SFCA",
      deliverables: "Three shortfall layers, a neighbourhood table, boards and a heatmap, a report",
    },
  },
  {
    key: "public-facility-siting",
    num: 4,
    accent: "#B45309",
    image: "images/scenarios/public-facility-siting.jpg",
    zh: {
      title: "公共服务设施选址",
      city: "达累斯萨拉姆",
      lede: "诊断达累斯萨拉姆学校与诊所的覆盖缺口，测算未被服务人口，比选候选位置并给出最大覆盖模型推荐的选址方案。",
      methods: "覆盖诊断 · 候选筛选 · MCLP 与 k-中值对照",
      deliverables: "缺口榜单、候选格网、推荐点位、边际覆盖曲线与报告",
    },
    en: {
      title: "Public Facility Siting",
      city: "Dar es Salaam",
      lede: "Diagnose school and clinic coverage, measure the unserved demand, then compare candidate sites and recommend where to build with a maximum-coverage model.",
      methods: "Coverage diagnosis · candidate screening · MCLP vs k-median",
      deliverables: "Shortfall boards, candidate cells, recommended sites, a marginal curve and a report",
    },
  },
  {
    key: "urban-growth-monitor",
    num: 5,
    accent: "#BE185D",
    image: "images/scenarios/urban-growth-monitor.jpg",
    zh: {
      title: "城市增长与建成区扩张",
      city: "河内",
      lede: "分期还原河内建成区扩张过程，区分填充、边缘与飞地式增长，并结合人口与夜间灯光判断增长管理的重点。",
      methods: "分期扩张指标 · 景观扩张指数 · 重心与标准差椭圆",
      deliverables: "扩张形态图层、分期指标表、四象限格网、图表与报告",
    },
    en: {
      title: "Urban Growth Monitor",
      city: "Hanoi",
      lede: "Reconstruct Hanoi's built-up expansion phase by phase, measure how much is infill versus outward growth, and connect growth to population and night lights.",
      methods: "Phased expansion metrics · landscape expansion index · centre and ellipse",
      deliverables: "Expansion-form layers, phase tables, quadrant grid, charts and a report",
    },
  },
  {
    key: "landuse-conflict-screening",
    num: 6,
    accent: "#15803D",
    image: "images/scenarios/landuse-conflict-screening.jpg",
    zh: {
      title: "用地冲突与生态约束核查",
      city: "基加利",
      lede: "识别基加利建设与生态空间、陡坡、河道岸线及保护地之间的冲突，分级排序并给出整改与避让建议。",
      methods: "冲突识别 · 分级排序 · 整改建议",
      deliverables: "四类冲突图层、最差斑块榜单、暴露人口格网与报告",
    },
    en: {
      title: "Land-use Conflict Screening",
      city: "Kigali",
      lede: "Find where Kigali's development presses on ecological space, steep slopes and riverbanks, grade the conflicts, and turn them into remediation priorities.",
      methods: "Conflict screening · grading and prioritisation · remediation guidance",
      deliverables: "Four conflict layers, a worst-patch board, an exposure grid and a report",
    },
  },
];

const UI = {
  zh: {
    lang: "zh-CN",
    pdfTitle: "MapX 场景手册",
    coverKicker: "MapX 内置场景 · 城乡规划",
    coverTitle: "场景手册",
    coverSub: "六大城乡规划场景：研究设计、数据与方法",
    coverMetaLeft: "第一版 · 2026 年 10 月",
    coverMetaRight: "MapX · AI 驱动的空间分析平台",
    footerLeft: "MapX 场景手册 · 六大城乡规划场景",
    tocTitle: "目录",
    tocPageLabel: "页码",
    forewordLabel: "前言",
    appendixLabel: "附录",
    chapterWord: "第",
    chapterUnit: "章",
    scenarioWord: "场景",
    glanceTitle: "本章速览",
    glanceArea: "研究区",
    glanceLayers: "入口图层",
    glanceMethods: "主要方法",
    glanceDeliverables: "核心交付",
    layersUnit: "层",
    noteLabel: "说明",
    stepWord: "步骤",
    backTitle: "从数据到决策",
    backSub: "MapX 把空间数据、确定性分析与 AI 协作放进同一个工作区。",
    backUrl: "app.mapxagent.com",
    backSupport: "支持 · support@mapxagent.com",
    colophonTitle: "关于本手册",
    colophonMeta: [
      ["版本", "第一版 · 2026 年 10 月"],
      ["收录", "MapX 内置的六个城乡规划场景"],
      ["内容来源", "MapX 文档站的场景页面与产品内置数据目录"],
      ["数据来源", "各场景入口图层，逐层带来源、许可与署名"],
      ["配套文档", "场景、内置数据、分析、计划模式、图表、报告"],
      ["支持", "support@mapxagent.com"],
    ],
  },
  en: {
    lang: "en",
    pdfTitle: "MapX Scenario Handbook",
    coverKicker: "MapX built-in scenarios · urban and rural planning",
    coverTitle: "Scenario Handbook",
    coverSub: "Six planning scenarios: study design, data and methods",
    coverMetaLeft: "First edition · October 2026",
    coverMetaRight: "MapX · AI-powered spatial analysis",
    footerLeft: "MapX Scenario Handbook · Six planning scenarios",
    tocTitle: "Contents",
    tocPageLabel: "Page",
    forewordLabel: "Foreword",
    appendixLabel: "Appendix",
    chapterWord: "Chapter",
    chapterUnit: "",
    scenarioWord: "Scenario",
    glanceTitle: "At a glance",
    glanceArea: "Study area",
    glanceLayers: "Entry layers",
    glanceMethods: "Key methods",
    glanceDeliverables: "Deliverables",
    layersUnit: "layers",
    noteLabel: "Note",
    stepWord: "Step",
    backTitle: "From data to decisions",
    backSub: "MapX brings spatial data, deterministic analysis and AI collaboration into one workspace.",
    backUrl: "app.mapxagent.com",
    backSupport: "Support · support@mapxagent.com",
    colophonTitle: "About this handbook",
    colophonMeta: [
      ["Edition", "First edition · October 2026"],
      ["Scope", "The six built-in urban and rural planning scenarios in MapX"],
      ["Content", "Scenario pages from the MapX documentation and the built-in data catalog"],
      ["Data", "Each scenario's entry layers, with source, licence and attribution per layer"],
      ["Related docs", "Scenarios, built-in datasets, analysis, plan mode, charts, reports"],
      ["Support", "support@mapxagent.com"],
    ],
  },
};

const LAYER_COUNTS = {
  "development-suitability-baseline": 8,
  "carrying-capacity-assessment": 6,
  "15min-life-circle-coverage": 7,
  "public-facility-siting": 7,
  "urban-growth-monitor": 7,
  "landuse-conflict-screening": 8,
};

/* ------------------------------------------------------------------ */
/* MDX parsing                                                         */
/* ------------------------------------------------------------------ */

function stripFrontmatter(source) {
  return source.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function parseBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  const isBlockStart = (line) =>
    /^##\s/.test(line) ||
    /^###\s/.test(line) ||
    line.startsWith("|") ||
    /^-\s/.test(line) ||
    line.startsWith("<Note>") ||
    line.startsWith("<Steps>") ||
    line.startsWith("![");

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (/^###\s/.test(line)) {
      blocks.push({ type: "heading", level: 3, text: line.replace(/^###\s+/, "") });
      i += 1;
      continue;
    }

    if (/^##\s/.test(line)) {
      blocks.push({ type: "heading", level: 2, text: line.replace(/^##\s+/, "") });
      i += 1;
      continue;
    }

    if (line.startsWith("<Note>")) {
      const buffer = [];
      let current = line;
      while (true) {
        buffer.push(current);
        if (current.includes("</Note>")) break;
        if (i + 1 >= lines.length) break;
        i += 1;
        current = lines[i];
      }
      const text = buffer
        .join(" ")
        .replace(/^<Note>/, "")
        .replace(/<\/Note>[\s\S]*$/, "")
        .trim();
      blocks.push({ type: "note", text });
      i += 1;
      continue;
    }

    if (line.startsWith("<Steps>")) {
      const buffer = [];
      while (i < lines.length && !lines[i].includes("</Steps>")) {
        buffer.push(lines[i]);
        i += 1;
      }
      buffer.push(lines[i] ?? "");
      const inner = buffer.join("\n");
      const steps = [...inner.matchAll(/<Step title="([^"]*)">([\s\S]*?)<\/Step>/g)].map(
        (match) => ({
          title: match[1],
          body: match[2].split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" "),
        }),
      );
      blocks.push({ type: "steps", steps });
      i += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const rows = tableLines
        .map((row) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
        .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
      if (rows.length > 1) {
        blocks.push({ type: "table", head: rows[0], rows: rows.slice(1) });
      }
      continue;
    }

    if (/^-\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (line.startsWith("![")) {
      const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (match) {
        blocks.push({ type: "image", alt: match[1], src: match[2] });
      }
      i += 1;
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || isBlockStart(next)) break;
      paragraph.push(next);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/* ------------------------------------------------------------------ */
/* Inline markdown                                                     */
/* ------------------------------------------------------------------ */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(text) {
  const codeSpans = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  out = escapeHtml(out);

  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) {
      return `<a href="${href}">${label}</a>`;
    }
    return `<span class="xref">${label}</span>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => `<code>${escapeHtml(codeSpans[index])}</code>`);
  return out;
}

/* ------------------------------------------------------------------ */
/* HTML rendering                                                      */
/* ------------------------------------------------------------------ */

const imageCache = new Map();

async function imageDataUri(relativePath) {
  if (!imageCache.has(relativePath)) {
    const buffer = await readFile(path.join(DOCS_ROOT, relativePath));
    const ext = path.extname(relativePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    imageCache.set(relativePath, `data:${mime};base64,${buffer.toString("base64")}`);
  }
  return imageCache.get(relativePath);
}

function renderTable(block) {
  const head = block.head.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
  const rows = block.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderList(block, className = "") {
  const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
  return `<ul class="${className}">${items}</ul>`;
}

function renderSteps(block, ui) {
  const steps = block.steps
    .map(
      (step, index) => `
    <li>
      <div class="step-head"><span class="step-num">${index + 1}</span><span class="step-title">${renderInline(step.title)}</span></div>
      <p class="step-body">${renderInline(step.body)}</p>
    </li>`,
    )
    .join("");
  return `<ol class="steps">${steps}</ol>`;
}

function sectionKey(text) {
  const value = text.toLowerCase();
  if (value.startsWith("platform capabilities") || text.startsWith("平台能力")) return "capabilities";
  if (value.startsWith("run it") || text.startsWith("运行场景")) return "run";
  if (value.startsWith("example output") || text.startsWith("示例产出")) return "example";
  if (value.startsWith("read the results") || text.startsWith("读结果")) return "caveats";
  if (value.startsWith("related") || text.startsWith("相关")) return "related";
  if (value.startsWith("what the scenario ships") || text.startsWith("场景包含什么")) return "ships";
  if (value.startsWith("how the study works") || text.startsWith("研究怎么做")) return "method";
  return "generic";
}

/* ------------------------------------------------------------------ */
/* Book parts                                                          */
/* ------------------------------------------------------------------ */

const FOREWORD = {
  zh: `#FOREWORD#

一个场景把「动手之前该有的东西」打包在一起：研究区、该区域的现成数据、映射到平台算子的方法，以及进去就能问的建议提问。打开一个场景，空项目立刻变成能回答真实规划问题的项目。

## 本手册收录什么

本手册收录 MapX 内置的六个城乡规划场景。每个场景一章，结构一致：它回答的规划问题、自带的数据、研究怎么做、用到的平台能力、运行场景的步骤、一次示例运行的产出。

| 场景 | 研究区 | 图层 | 回答什么 |
|---|---|---|---|
| 开发适宜性基础评价 | 内罗毕 | 8 | 在生态、坡度与洪涝硬约束之后，哪些地方可以建设 |
| 资源环境承载能力评价 | 雅加达 | 6 | 在水资源、气候与洪涝约束下还能承载多少开发 |
| 15 分钟生活圈覆盖 | 雅加达 | 7 | 步行范围内谁被学校、医疗与绿地覆盖，谁没有被覆盖 |
| 公共服务设施选址 | 达累斯萨拉姆 | 7 | 缺口在哪里，哪些候选位置能补上 |
| 城市增长与建成区扩张 | 河内 | 7 | 建成区扩张有多快、往哪个方向、是否集约 |
| 用地冲突与生态约束核查 | 基加利 | 8 | 建设与生态空间、陡坡、河道岸线在哪里冲突 |

## 怎么读这本手册

- 关心「哪里能建、能承载多少」：从第 1 章（内罗毕）和第 2 章（雅加达）读起，第 6 章（基加利）是同一套约束逻辑用在建成空间上。
- 关心公共服务覆盖与设施选址：按第 3 章（生活圈）到第 4 章（选址）的顺序读，前者找缺口，后者给方案。
- 关心城市扩张与增长管理：直接读第 5 章（河内）。
- 每个章节都可以独立阅读；章末「相关」列出可以继续查看的文档主题。

## 关于书中的数字

书中出现的面积、占比、排名与点位数量，来自一次示例运行（默认参数、随包数据版本），用于展示交付物的形态与合理量级，不代表你运行后的固定结果。研究窗口、参数选择与数据版本都会改变数值；每章「示例产出」小节的说明框都会再次提示这一点。

## 数据与许可

六个场景的入口图层全部来自 MapX 内置数据目录，逐层带来源、许可与署名。场景是分析辅助，输出为图层、图表与报告，不替代法定规划成果。`,
  en: `#FOREWORD#

A scenario bundles everything a piece of spatial analysis needs before you type anything: a study area, the prepared datasets for it, a method that maps onto the platform's analysis tools, and suggested questions that work with that data. Opening one turns an empty project into a project that is ready to answer a real planning question.

## What this handbook covers

This handbook collects the six built-in urban and rural planning scenarios in MapX. Each scenario has one chapter, and every chapter follows the same structure: the planning question, the data it ships, how the study works, the platform capabilities it uses, how to run it, and what one example run produced.

| Scenario | Study area | Layers | What it answers |
|---|---|---|---|
| Development Suitability Baseline | Nairobi | 8 | Which land is buildable once ecology, slope and flood constraints are applied |
| Carrying Capacity Assessment | Jakarta | 6 | How much development the water, climate and flood-hazard constraints allow |
| 15-minute Life Circle Coverage | Jakarta | 7 | Who is covered by schools, clinics and green space within walking distance, and who is not |
| Public Facility Siting | Dar es Salaam | 7 | Where coverage gaps are, and which candidate sites close them |
| Urban Growth Monitor | Hanoi | 7 | How fast, in which direction, and how compactly the built-up area is expanding |
| Land-use Conflict Screening | Kigali | 8 | Where development collides with ecological space, steep slopes and riverbanks |

## How to read it

- For "where can the city build, and how much can it hold": start with chapters 1 (Nairobi) and 2 (Jakarta); chapter 6 (Kigali) applies the same constraint logic to built-up land.
- For public service coverage and facility siting: read chapter 3 (life circle) before chapter 4 (siting) — the first finds the gaps, the second proposes sites.
- For urban expansion and growth management: go straight to chapter 5 (Hanoi).
- Every chapter stands on its own; the Related list at the end of each chapter names the documentation topics to continue with.

## About the numbers

The areas, shares, rankings and site counts in this handbook come from one example run with the default settings on the shipped data. They show the shape and plausible magnitude of the deliverables, not what your run will return. Your study window, parameter choices and data version will change the values; each chapter's Example output box repeats this caveat.

## Data and licences

Every entry layer in the six scenarios comes from the MapX built-in data catalog, with source, licence and attribution attached per layer. Scenarios are analysis aids: they deliver layers, charts and reports, and they do not replace statutory planning documents.`,
};

const APPENDIX = {
  zh: `#APPENDIX#

## 附录 A：场景速览

| 场景 | 研究区 | 图层 | 主要方法 | 核心交付 |
|---|---|---|---|---|
| 1 开发适宜性基础评价 | 内罗毕 | 8 | 硬约束筛选、加权叠加、承载规模估算 | 适宜性分级、开发管控分区、图表与报告 |
| 2 资源环境承载能力评价 | 雅加达 | 6 | 模糊隶属度、短板合成、承压四象限 | 承载能力分级、超载格网、图表与报告 |
| 3 15 分钟生活圈覆盖 | 雅加达 | 7 | 步行服务区、缺口人口、2SFCA | 三类缺口图层、街区综合表、榜单与热力图 |
| 4 公共服务设施选址 | 达累斯萨拉姆 | 7 | 覆盖诊断、候选筛选、MCLP 与 k-中值对照 | 推荐点位、边际覆盖曲线、均衡核查表 |
| 5 城市增长与建成区扩张 | 河内 | 7 | 分期扩张指标、景观扩张指数、重心与椭圆 | 扩张形态图层、分期指标表、四象限格网 |
| 6 用地冲突与生态约束核查 | 基加利 | 8 | 冲突识别、分级排序、整改建议 | 四类冲突图层、最差斑块榜单、暴露人口格网 |

## 附录 B：怎么开始

- 在 MapX 顶部菜单打开**场景**目录，选择你要研究的场景卡片。
- 点**打开场景**：整包图层按默认样式导入当前项目，不需要上传或配置。
- 用场景自带的**建议提问**启动分析；也可以先改再发。
- 在**计划模式**里回答澄清问题、审阅计划书，然后批准执行。
- 运行完成后，把结果导出为[报告]、[图表]或分享地图；继续在对话里追问以调整范围与阈值。

## 附录 C：数据与许可

场景由内置数据目录组装而成，每层都有来源、许可与署名。地表覆盖、人口、建成区、保护地与路网等产品各有自己的更新周期与分辨率，跨源分析时要注明年份与尺度；场景输出是分析成果，不替代法定规划。`,
  en: `#APPENDIX#

## Appendix A: Scenarios at a glance

| Scenario | Study area | Layers | Key methods | Deliverables |
|---|---|---|---|---|
| 1 Development Suitability Baseline | Nairobi | 8 | Hard-constraint screening, weighted overlay, capacity estimate | Suitability classes, development control tiers, charts and a report |
| 2 Carrying Capacity Assessment | Jakarta | 6 | Fuzzy membership, limiting-factor composite, pressure quadrants | Capacity classes, overload cells, charts and a report |
| 3 15-minute Life Circle Coverage | Jakarta | 7 | Walking service areas, shortfall population, 2SFCA | Three shortfall layers, a neighbourhood table, boards and a heatmap |
| 4 Public Facility Siting | Dar es Salaam | 7 | Coverage diagnosis, candidate screening, MCLP vs k-median | Recommended sites, a marginal coverage curve, a ward balance table |
| 5 Urban Growth Monitor | Hanoi | 7 | Phased expansion metrics, landscape expansion index, centre and ellipse | Expansion-form layers, phase tables, a quadrant grid |
| 6 Land-use Conflict Screening | Kigali | 8 | Conflict screening, grading, remediation guidance | Four conflict layers, a worst-patch board, an exposure grid |

## Appendix B: Get started

- Open the **Scenarios** catalog from the MapX top menu and pick the scenario you need.
- Choose **Open scenario**: the whole layer bundle imports into the current project with default styles, no upload or configuration required.
- Start the analysis with the scenario's **suggested question**, or edit it first.
- In **plan mode**, answer the clarifications, review the plan document and approve it.
- When the run finishes, export a report, work with the charts or share the map; keep asking follow-up questions to adjust the scope and thresholds.

## Appendix C: Data and licences

Scenarios are assembled from the built-in data catalog, and every layer carries its source, licence and attribution. Land cover, population, built-up area, protected areas and road networks each have their own vintage and resolution; state the year and scale whenever you combine them. Scenario output is analysis, not a statutory planning document.`,
};

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

function buildCss(ui) {
  const footerContent =
    ui.lang === "zh-CN"
      ? `"${ui.footerLeft} · 第 " counter(page) " 页 / 共 " counter(pages) " 页"`
      : `"${ui.footerLeft} · Page " counter(page) " of " counter(pages)`;
  return `
@page {
  size: 210mm 297mm;
  margin: 18mm 17mm 15mm;
  @bottom-center {
    content: ${footerContent};
    background: #0b3f73; color: #ffffff;
    font-family: "Helvetica Neue", "Hiragino Sans GB", "PingFang SC", sans-serif;
    font-size: 7.5pt; width: 100%; padding: 0 17mm; text-align: center; vertical-align: middle;
  }
}
@page :first {
  margin: 0;
  @bottom-center { content: none; background: none; }
}
@page backpage {
  margin: 0;
  @bottom-center { content: none; background: none; }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  color: #0f172a;
  font-family: "Helvetica Neue", "Hiragino Sans GB", "PingFang SC", "STHeiti", sans-serif;
  font-size: 10.5pt;
  line-height: 1.75;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body.lang-en { font-family: "Charter", "Georgia", "Times New Roman", serif; }
body.lang-en h1, body.lang-en h2, body.lang-en h3, body.lang-en .kicker,
body.lang-en .glance, body.lang-en table, body.lang-en .callout, body.lang-en .steps,
body.lang-en .cover, body.lang-en .backcover { font-family: "Helvetica Neue", "Avenir Next", sans-serif; }

p { margin: 0 0 3.2mm; orphans: 2; widows: 2; }
strong { font-weight: 700; color: #0b1220; }
code {
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 0.88em;
  background: #f1f5f9;
  border-radius: 2px;
  padding: 0.5mm 1.2mm;
}
a { color: #006bcb; text-decoration: none; }
.xref { color: #0f172a; font-weight: 600; }

.sheet { padding: 0 0 3mm; }
.page-break { break-after: page; }
.page-start { break-before: page; }

/* Cover ---------------------------------------------------------- */
.cover {
  height: 297mm;
  padding: 26mm 20mm 20mm;
  background: linear-gradient(158deg, #071426 0%, #0b1f36 52%, #0b2f52 100%);
  color: #ffffff;
  break-after: page;
  position: relative;
  overflow: hidden;
}
.cover::after {
  content: "";
  position: absolute;
  right: -40mm; top: -40mm; width: 150mm; height: 150mm;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,107,203,0.55) 0%, rgba(0,107,203,0) 68%);
}
.cover-top { display: flex; align-items: center; gap: 4mm; margin-bottom: 26mm; }
.cover-logo { height: 9mm; }
.cover-kicker {
  font-size: 9.5pt; letter-spacing: 0.16em;
  color: #7db8f2; margin-bottom: 5mm;
}
.cover-title { font-size: 44pt; line-height: 1.06; margin: 0 0 5mm; font-weight: 700; letter-spacing: 0.01em; }
.cover-sub { font-size: 13pt; color: #cfe3f8; margin: 0 0 14mm; max-width: 130mm; line-height: 1.6; }
.cover-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.cover-thumb {
  border: 0.4mm solid rgba(255,255,255,0.16);
  border-radius: 2mm;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
}
.cover-thumb img { width: 100%; height: 30mm; object-fit: cover; display: block; opacity: 0.92; }
.cover-thumb figcaption {
  font-size: 6.6pt; color: #dbeafe; padding: 1.5mm 1.8mm 1.9mm; line-height: 1.35;
}
.cover-meta {
  position: absolute; left: 18mm; right: 18mm; bottom: 12mm;
  display: flex; justify-content: space-between;
  font-size: 9pt; color: #9fc4ea;
  border-top: 0.3mm solid rgba(255,255,255,0.18);
  padding-top: 4mm;
}

/* Colophon / TOC -------------------------------------------------- */
.colophon h1, .toc h1 { font-size: 22pt; margin: 0 0 6mm; color: #0b1f36; }
.colophon .lead { font-size: 11pt; color: #334155; }
.colophon .meta-table { width: 100%; border-collapse: collapse; margin-top: 8mm; font-size: 9.5pt; }
.colophon .meta-table td { padding: 3mm 0; border-bottom: 0.25mm solid #e2e8f0; vertical-align: top; }
.colophon .meta-table td:first-child { width: 30mm; color: #64748b; }
.colophon .licence {
  margin-top: 10mm; padding: 5mm 6mm; background: #f8fafc;
  border-left: 1.2mm solid #006bcb; font-size: 9.5pt; color: #334155;
}
.toc-entry {
  display: flex; align-items: baseline; gap: 3mm;
  padding: 3.4mm 0; border-bottom: 0.25mm solid #eef2f7;
}
.toc-num { width: 10mm; font-weight: 700; color: #006bcb; font-size: 10pt; }
.toc-title { font-weight: 600; font-size: 11pt; }
.toc-city { color: #64748b; font-size: 9.5pt; }
.toc-dots { flex: 1; border-bottom: 0.4mm dotted #cbd5e1; transform: translateY(-1mm); }
.toc-page { font-variant-numeric: tabular-nums; color: #334155; font-size: 10pt; }

/* Sections -------------------------------------------------------- */
h1.section, h2.section {
  font-size: 15pt; line-height: 1.35; margin: 8mm 0 4mm;
  color: #0b1f36; break-after: avoid; position: relative; padding-left: 5mm;
}
h1.section .sec-mark, h2.section .sec-mark {
  position: absolute; left: 0; top: 1.2mm; bottom: 1.2mm; width: 1.6mm;
  background: var(--accent, #006bcb); border-radius: 1mm;
}
h3.sub { font-size: 11.5pt; margin: 6mm 0 2.5mm; color: #0b1f36; break-after: avoid; }
.chapter-body > p:first-of-type { font-size: 11pt; color: #1e293b; }

/* Tables ---------------------------------------------------------- */
table.data {
  width: 100%; border-collapse: collapse; margin: 2mm 0 5mm;
  font-size: 8.8pt; line-height: 1.5; break-inside: avoid;
}
table.data thead { display: table-header-group; }
table.data th {
  text-align: left; font-weight: 600; color: #0b1f36;
  background: #f1f5f9; border-top: 0.4mm solid #cbd5e1; border-bottom: 0.4mm solid #cbd5e1;
  padding: 2.2mm 2.6mm;
}
table.data td {
  padding: 2.2mm 2.6mm; border-bottom: 0.22mm solid #e8eef5; vertical-align: top;
}
table.data tbody tr:nth-child(even) { background: #fafcfe; }
table.data tr { break-inside: avoid; }
table.data code { font-size: 0.86em; background: #eef2f7; }
.appendix { padding-top: 16mm; }
.appendix h2.section { margin-top: 6mm; }
.appendix table.data { font-size: 8.3pt; }
.appendix li { margin-bottom: 1.2mm; }

/* Lists ----------------------------------------------------------- */
ul { margin: 1.5mm 0 4.5mm; padding-left: 5.5mm; }
li { margin-bottom: 1.8mm; break-inside: avoid; }
ul.cap-list { list-style: none; padding-left: 0; }
ul.cap-list li {
  padding: 2.6mm 3mm 2.6mm 8mm; position: relative;
  border-bottom: 0.22mm solid #eef2f7;
}
ul.cap-list li::before {
  content: ""; position: absolute; left: 1.6mm; top: 4.4mm;
  width: 2.6mm; height: 2.6mm; border-radius: 0.6mm; background: var(--accent, #006bcb);
}
ul.caveat-list { list-style: none; padding-left: 0; }
ul.caveat-list li {
  padding: 2.8mm 3mm 2.8mm 8mm; position: relative; background: #fffaf2;
  border-bottom: 0.22mm solid #f4e3c8;
}
ul.caveat-list li::before {
  content: ""; position: absolute; left: 2mm; top: 4.6mm;
  width: 0; height: 0;
  border-left: 1.8mm solid transparent; border-right: 1.8mm solid transparent;
  border-bottom: 3.2mm solid #d97706;
}
ul.related-list { font-size: 9.5pt; }

/* Callouts -------------------------------------------------------- */
.callout {
  margin: 3mm 0 5mm; padding: 4mm 5mm; background: #eef6ff;
  border-left: 1.2mm solid #006bcb; border-radius: 0 1.4mm 1.4mm 0;
  break-inside: avoid;
}
.callout-label {
  display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: 0.08em;
  color: #006bcb; text-transform: uppercase; margin-bottom: 1.2mm;
}
.callout p { margin: 0; font-size: 9.5pt; color: #1e3a5f; }

/* Steps ----------------------------------------------------------- */
ol.steps { list-style: none; margin: 2mm 0 5mm; padding: 0; }
ol.steps li {
  position: relative; padding: 0 0 4.5mm 12mm; margin: 0;
  break-inside: avoid;
}
ol.steps li:not(:last-child)::before {
  content: ""; position: absolute; left: 3.7mm; top: 8.5mm; bottom: 0;
  width: 0.3mm; background: #dbe6f2;
}
.step-head { display: flex; align-items: baseline; gap: 2.5mm; }
.step-num {
  position: absolute; left: 0; top: 0;
  width: 8mm; height: 8mm; border-radius: 50%;
  background: var(--accent, #006bcb); color: #fff;
  font-size: 9pt; font-weight: 700; text-align: center; line-height: 8mm;
}
.step-title { font-weight: 700; color: #0b1f36; }
.step-body { margin: 1.2mm 0 0; color: #334155; font-size: 9.8pt; }

/* Chapter opener -------------------------------------------------- */
.chapter { break-before: page; }
.chapter-opener { break-after: page; }
.kicker {
  font-size: 9pt; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--accent, #006bcb); font-weight: 700; margin: 0 0 4mm;
}
.chapter-opener h1 {
  font-size: 28pt; line-height: 1.16; margin: 0 0 3mm; color: #0b1f36;
}
.chapter-opener h1 .h1city { color: var(--accent, #006bcb); }
.lede { font-size: 11.5pt; color: #334155; margin-bottom: 6mm; }
figure.hero { margin: 0 0 6mm; break-inside: avoid; }
figure.hero img { width: 100%; border-radius: 1.6mm; display: block; }
figure.hero figcaption { font-size: 8pt; color: #64748b; margin-top: 1.6mm; }
figure.inline-figure { margin: 2mm 0 5mm; break-inside: avoid; }
figure.inline-figure img {
  width: 100%; display: block; border-radius: 1.6mm;
  border: 0.25mm solid #e2e8f0;
}
figure.inline-figure figcaption {
  font-size: 8pt; color: #64748b; margin-top: 1.6mm; line-height: 1.5;
}
.glance { border: 0.3mm solid #e2e8f0; border-radius: 1.6mm; overflow: hidden; break-inside: avoid; }
.glance-title {
  background: #f8fafc; padding: 2.4mm 4mm; font-size: 8.5pt; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase; color: #475569;
  border-bottom: 0.3mm solid #e2e8f0;
}
.glance-grid { display: grid; grid-template-columns: 1fr 1fr; }
.glance-item { padding: 3.2mm 4mm; border-bottom: 0.22mm solid #eef2f7; }
.glance-item:nth-child(odd) { border-right: 0.22mm solid #eef2f7; }
.glance-label { font-size: 8pt; color: #64748b; letter-spacing: 0.06em; text-transform: uppercase; }
.glance-value { font-size: 10pt; font-weight: 600; color: #0b1f36; margin-top: 0.8mm; line-height: 1.5; }

/* Example box ----------------------------------------------------- */
.example-box {
  border: 0.3mm solid #bfdbfe; background: #f8fbff; border-radius: 1.6mm;
  padding: 4mm 4.5mm 1mm; margin: 2mm 0 5mm;
}
.example-box .callout { background: #eef6ff; }

/* Back cover ------------------------------------------------------ */
.backcover {
  page: backpage; break-before: page; height: 297mm; padding: 28mm 20mm;
  background: linear-gradient(158deg, #071426 0%, #0b1f36 55%, #0b2f52 100%);
  color: #ffffff; display: flex; flex-direction: column; justify-content: space-between;
}
.backcover img { height: 10mm; width: auto; align-self: flex-start; }
.backcover .back-title { font-size: 26pt; font-weight: 700; margin-bottom: 4mm; }
.backcover .back-sub { font-size: 12pt; color: #cfe3f8; max-width: 120mm; }
.backcover .back-foot { font-size: 10pt; color: #9fc4ea; border-top: 0.3mm solid rgba(255,255,255,0.18); padding-top: 4mm; }
`;
}

/* ------------------------------------------------------------------ */
/* Page builders                                                       */
/* ------------------------------------------------------------------ */

function renderColophon(lang) {
  const ui = UI[lang];
  const rows = ui.colophonMeta
    .map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`)
    .join("");
  const lead =
    lang === "zh"
      ? "这本手册把 MapX 内置的六个城乡规划场景整理成可独立阅读的章节：每章给出研究设计、数据构成、方法与平台能力、运行步骤，以及一次示例运行的产出。"
      : "This handbook turns the six built-in urban and rural planning scenarios in MapX into self-contained chapters: study design, data, methods and platform capabilities, how to run the scenario, and what one example run produced.";
  const licence =
    lang === "zh"
      ? "本书内容与截图来自 MapX 文档站与产品内置场景；地图图层版权与署名见各场景入口数据集。示例数字仅用于说明交付物形态。"
      : "Content and screenshots come from the MapX documentation and the built-in scenarios; map layer credits and licences are attached to each entry dataset. Example figures illustrate the shape of the deliverables only.";
  return `
  <section class="sheet colophon page-break">
    <h1>${ui.colophonTitle}</h1>
    <p class="lead">${lead}</p>
    <table class="meta-table">${rows}</table>
    <div class="licence">${licence}</div>
  </section>`;
}

function renderToc(lang, pageMap) {
  const ui = UI[lang];
  const page = (key) => (pageMap && pageMap[key] ? String(pageMap[key]) : "—");
  const rows = [
    `<div class="toc-entry"><span class="toc-num"></span><span class="toc-title">${ui.forewordLabel}</span><span class="toc-city"></span><span class="toc-dots"></span><span class="toc-page">${page("foreword")}</span></div>`,
    ...SCENARIOS.map(
      (scenario) => `<div class="toc-entry"><span class="toc-num">${String(scenario.num).padStart(2, "0")}</span><span class="toc-title">${scenario[lang].title}</span><span class="toc-city">${scenario[lang].city}</span><span class="toc-dots"></span><span class="toc-page">${page(`ch${scenario.num}`)}</span></div>`,
    ),
    `<div class="toc-entry"><span class="toc-num"></span><span class="toc-title">${ui.appendixLabel}</span><span class="toc-city"></span><span class="toc-dots"></span><span class="toc-page">${page("appendix")}</span></div>`,
  ];
  return `
  <section class="sheet toc page-break">
    <h1>${ui.tocTitle}</h1>
    ${rows.join("")}
  </section>`;
}

async function renderChapter(scenario, lang) {
  const ui = UI[lang];
  const source = await readFile(
    path.join(DOCS_ROOT, lang, "concepts", "scenarios", `${scenario.key}.mdx`),
    "utf8",
  );
  const blocks = parseBlocks(stripFrontmatter(source));
  for (const block of blocks) {
    if (block.type === "image") {
      block.src = await imageDataUri(block.src.replace(/^\//, ""));
    }
  }
  const imageBlock = blocks.find((block) => block.type === "image");
  const hero = imageBlock ? imageBlock.src : "";
  const rendered = renderBlocksWithExample(blocks.filter((b) => b !== imageBlock), ui);

  return `
  <section class="chapter" style="--accent:${scenario.accent}">
    <div class="sheet chapter-opener">
      <div class="kicker">${lang === "zh" ? `${ui.scenarioWord} ${String(scenario.num).padStart(2, "0")} · ` : ""}SCENARIO ${String(scenario.num).padStart(2, "0")}</div>
      <h1>${scenario[lang].title}&nbsp;<span class="h1city">${scenario[lang].city}</span></h1>
      <p class="lede">${renderInline(scenario[lang].lede)}</p>
      <figure class="hero"><img src="${hero}" alt=""><figcaption>${renderInline(imageBlock ? imageBlock.alt : "")}</figcaption></figure>
      <div class="glance">
        <div class="glance-title">${ui.glanceTitle}</div>
        <div class="glance-grid">
          <div class="glance-item"><div class="glance-label">${ui.glanceArea}</div><div class="glance-value">${scenario[lang].city}</div></div>
          <div class="glance-item"><div class="glance-label">${ui.glanceLayers}</div><div class="glance-value">${LAYER_COUNTS[scenario.key]} ${ui.layersUnit}</div></div>
          <div class="glance-item"><div class="glance-label">${ui.glanceMethods}</div><div class="glance-value">${scenario[lang].methods}</div></div>
          <div class="glance-item"><div class="glance-label">${ui.glanceDeliverables}</div><div class="glance-value">${scenario[lang].deliverables}</div></div>
        </div>
      </div>
    </div>
    <div class="sheet chapter-body">${rendered}</div>
  </section>`;
}

function renderBlocksWithExample(blocks, ui) {
  const output = [];
  let section = "generic";
  let exampleOpen = false;
  let skipRest = false;

  const closeExample = () => {
    if (exampleOpen) {
      output.push("</div>");
      exampleOpen = false;
    }
  };

  for (const block of blocks) {
    if (skipRest) continue;

    if (block.type === "heading" && block.level === 2) {
      closeExample();
      section = sectionKey(block.text);
      if (section === "related") {
        skipRest = true;
        continue;
      }
      output.push(`<h2 class="section" data-section="${section}"><span class="sec-mark"></span>${renderInline(block.text)}</h2>`);
      if (section === "example") {
        output.push('<div class="example-box">');
        exampleOpen = true;
      }
      continue;
    }

    if (block.type === "heading" && block.level === 3) {
      output.push(`<h3 class="sub">${renderInline(block.text)}</h3>`);
      continue;
    }

    if (block.type === "paragraph") {
      output.push(`<p>${renderInline(block.text)}</p>`);
      continue;
    }

    if (block.type === "list") {
      const className =
        section === "capabilities"
          ? "cap-list"
          : section === "caveats"
            ? "caveat-list"
            : section === "related"
              ? "related-list"
              : "";
      output.push(renderList(block, className));
      continue;
    }

    if (block.type === "table") {
      output.push(renderTable(block));
      continue;
    }

    if (block.type === "note") {
      output.push(`<aside class="callout"><span class="callout-label">${ui.noteLabel}</span><p>${renderInline(block.text)}</p></aside>`);
      continue;
    }

    if (block.type === "steps") {
      output.push(renderSteps(block, ui));
      continue;
    }

    if (block.type === "image") {
      output.push(`<figure class="inline-figure"><img src="${block.src}" alt=""><figcaption>${renderInline(block.alt)}</figcaption></figure>`);
    }
  }

  closeExample();
  return output.join("\n");
}

function buildBook(lang, pageMap) {
  const ui = UI[lang];
  const foreword = FOREWORD[lang].replace("#FOREWORD#", "").trim();
  const appendix = APPENDIX[lang].replace("#APPENDIX#", "").trim();
  const chapters = SCENARIOS.map((scenario) => renderChapterPromise(scenario, lang));
  return Promise.all(chapters).then((chapterHtml) => {
    const forewordHtml = renderBlocksWithExample(parseBlocks(foreword), ui);
    const appendixHtml = renderBlocksWithExample(parseBlocks(appendix), ui);
    return `<!doctype html>
<html lang="${ui.lang}">
<head>
<meta charset="utf-8">
<title>${ui.pdfTitle}</title>
<style>${buildCss(ui)}</style>
</head>
<body class="lang-${lang}">
${renderCoverSync(lang)}
${renderColophon(lang)}
${renderToc(lang, pageMap)}
<section class="sheet foreword page-break" style="--accent:#006BCB">
  <div class="kicker">FOREWORD</div>
  <h1 class="section"><span class="sec-mark"></span>${ui.forewordLabel}</h1>
  ${forewordHtml}
</section>
${chapterHtml.join("\n")}
<section class="sheet appendix page-start" style="--accent:#006BCB">
  <h1 class="kicker">APPENDIX A</h1>
  ${appendixHtml}
</section>
${renderBackCoverSync(lang)}
</body>
</html>`;
  });
}

function renderChapterPromise(scenario, lang) {
  return renderChapter(scenario, lang);
}

/* Synchronous cover/back-cover use preloaded data URIs. */
let LOGO_DARK = "";
function renderCoverSync(lang) {
  const ui = UI[lang];
  const thumbs = SCENARIOS.map((scenario) => {
    const image = imageCache.get(scenario.image) ?? "";
    return `<figure class="cover-thumb"><img src="${image}" alt=""><figcaption>${scenario.num}. ${scenario[lang].title}</figcaption></figure>`;
  }).join("");
  return `
  <section class="cover">
    <div class="cover-top"><img class="cover-logo" src="${LOGO_DARK}" alt="MapX"><span></span></div>
    <div class="cover-kicker">${ui.coverKicker}</div>
    <h1 class="cover-title">${ui.coverTitle}</h1>
    <p class="cover-sub">${ui.coverSub}</p>
    <div class="cover-grid">${thumbs}</div>
    <div class="cover-meta"><span>${ui.coverMetaLeft}</span><span>${ui.coverMetaRight}</span></div>
  </section>`;
}

function renderBackCoverSync(lang) {
  const ui = UI[lang];
  return `
  <section class="backcover">
    <img src="${LOGO_DARK}" alt="MapX">
    <div>
      <div class="back-title">${ui.backTitle}</div>
      <p class="back-sub">${ui.backSub}</p>
    </div>
    <div class="back-foot"><div>${ui.backUrl}</div><div>${ui.backSupport}</div></div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [];
  if (process.env.PLAYWRIGHT_PACKAGE) candidates.push(process.env.PLAYWRIGHT_PACKAGE);
  const repoCandidates = [
    process.env.MAPX_REPO,
    "/Users/xuxiang/Mirror/work/mapx",
    path.resolve(DOCS_ROOT, "..", "mapx"),
  ].filter(Boolean);
  for (const repo of repoCandidates) {
    const repoRequire = createRequire(path.join(repo, "package.json"));
    try {
      return repoRequire("@playwright/test");
    } catch {
      try {
        return repoRequire("playwright");
      } catch {
        /* keep looking */
      }
    }
  }
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright not found. Set MAPX_REPO or PLAYWRIGHT_PACKAGE.");
  }
}

async function renderPdf(html, outPath, lang) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 180000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    // Chromium's PDF outline drops the space at every soft wrap inside a
    // heading, so keep chapter titles on one line and shrink them to fit.
    const overflowingTitles = await page.evaluate(() => {
      // The screen viewport is wider than the 210mm page, so measure the
      // natural text width against the @page content box (210mm - 2 x 17mm).
      const pageContentWidthPx = (176 / 25.4) * 96;
      const minSizePx = (21 * 96) / 72;
      const range = document.createRange();
      const overflows = [];
      for (const heading of document.querySelectorAll(".chapter-opener h1")) {
        heading.style.whiteSpace = "nowrap";
        let sizePx = Number.parseFloat(getComputedStyle(heading).fontSize);
        const textWidth = () => {
          range.selectNodeContents(heading);
          return range.getBoundingClientRect().width;
        };
        while (textWidth() > pageContentWidthPx - 1 && sizePx > minSizePx) {
          sizePx = Math.max(minSizePx, sizePx - 0.5);
          heading.style.fontSize = `${sizePx}px`;
        }
        if (textWidth() > pageContentWidthPx - 1) overflows.push(heading.textContent.trim());
      }
      return overflows;
    });
    for (const title of overflowingTitles) {
      console.warn(`warning: chapter title still overflows the page width (${lang}): ${title}`);
    }
    await page.pdf({
      path: outPath,
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      preferCSSPageSize: true,
      tagged: true,
      outline: true,
    });
  } finally {
    await browser.close();
  }
}

async function extractPageMap(pdfPath, lang) {
  const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const pages = stdout.split("\f").map((page) => page.replace(/\s+/g, ""));
  const find = (marker, fromPage = 0) => {
    for (let index = fromPage; index < pages.length; index += 1) {
      if (pages[index].includes(marker)) return index + 1;
    }
    return null;
  };
  const map = {
    foreword: find("FOREWORD"),
    appendix: find("APPENDIXA"),
  };
  for (const scenario of SCENARIOS) {
    map[`ch${scenario.num}`] = find(`SCENARIO${String(scenario.num).padStart(2, "0")}`);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  LOGO_DARK = await imageDataUri("logo-dark.png");
  for (const scenario of SCENARIOS) await imageDataUri(scenario.image);

  const results = [];
  for (const lang of ["zh", "en"]) {
    const html1 = await buildBook(lang, null);
    const pass1 = path.join(TMP_DIR, `handbook-${lang}-pass1.pdf`);
    await renderPdf(html1, pass1, lang);
    let pageMap = await extractPageMap(pass1, lang);
    let finalPdf = path.join(OUT_DIR, `mapx-scenarios-handbook-${lang}.pdf`);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const html = await buildBook(lang, pageMap);
      await renderPdf(html, finalPdf, lang);
      const verification = await extractPageMap(finalPdf, lang);
      const stable = Object.keys(pageMap).every((key) => pageMap[key] === verification[key]);
      if (stable) break;
      pageMap = verification;
    }

    const { stdout } = await execFileAsync("pdfinfo", [finalPdf]);
    const pages = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
    results.push({ lang, finalPdf, pageMap, pages });
  }

  for (const result of results) {
    console.log(`${result.lang}: ${result.finalPdf} (${result.pages} pages)`);
    console.log(`  toc: ${JSON.stringify(result.pageMap)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
