# 案例数据扩展计划

## 目标

在不复制页面逻辑、不破坏现有 `demo-local-001` 的前提下，把单 Demo 工作区扩展为可切换的案例目录，为 Dashboard、Brief、品牌、脚本、分镜和初剪提供完整演示数据。

## 推荐时机

案例数据放在 Wave 2.5 视觉纠偏之后、Gate 3 最终验收之前接入。

原因：

- 当前 UI 正在从单项目详情纠偏为案例 / 项目工作台。
- 先冻结案例卡片、表格和项目切换的视觉容器，再扩展 Store，可减少 UI 与数据同时改造造成的冲突。

## 建议结构

保留现有 `DemoWorkspace` 作为“单个完整案例”，新增目录层：

```ts
interface CaseCatalogItem {
  id: string;
  title: string;
  category: 'local_store' | 'founder_ip' | 'ecommerce';
  summary: string;
  cover: string;
  tags: string[];
  workspace: DemoWorkspace;
}

interface CaseCatalog {
  activeCaseId: string;
  cases: CaseCatalogItem[];
}
```

不在业务页面创建私有 Mock；目录、迁移和 Store 切换由 C0 / C1 统一实现。

## 每个案例需要的资料

1. 案例名称、分类、封面和一句话简介
2. 商家 / 品牌资料、负责人、平台、比例、时长和 CTA
3. 事实库 C1—C8 或同等数量的可引用事实
4. A/B/C 三个脚本版本
5. 6—8 个分镜
6. 图片、视频、音频素材缩略图和匹配状态
7. 初剪时间线、字幕、BGM、花字和 QA 状态

## 首批案例建议

与原始 UI 分类保持一致，首批准备 3—5 个：

- 本地探店
- 老板 / 创始人 IP
- 电商商品素材

具体品牌、图片和文案由用户提供或确认后录入，C0 不擅自把真实品牌资料写入仓库。

## Store 与持久化

- 当前 `videoagent:mvp:v1` 继续兼容读取。
- 新目录建议使用 `videoagent:mvp:v2`。
- 首次读取 v1 时，将其迁移为 `demo-local-001` 案例。
- “重置 Demo”改为只重置当前案例。
- Dashboard 切换案例后，所有业务页面从同一个 active workspace 读取。

## 页面影响

| 页面 | 案例能力 |
|---|---|
| Dashboard | 案例 / 项目列表、分类、封面、进度、负责人 |
| Brief | 从案例复制或新建，保存到当前案例 |
| Brand | 展示当前案例品牌资料与事实 |
| Script | 展示当前案例 A/B/C |
| Storyboard | 展示当前案例分镜与素材匹配 |
| Rough Cut | 展示当前案例时间线与 QA |

## 验收

- 切换案例后六个页面的数据 ID 始终一致。
- 修改一个案例不会污染其他案例。
- 刷新后 activeCaseId 与各案例修改均保留。
- v1 数据可迁移，旧用户不会丢失当前 Demo。
- 至少覆盖两个案例的完整 E2E 切换与持久化。

