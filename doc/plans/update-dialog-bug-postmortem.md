# 更新弹窗「1.9.1 提示更到 1.7.7」查因结论（已收口，无修复项）

> 日期：2026-10-31 查因收口 ｜ 2026-11-02 落档
> 状态：**闭环**——算法/用法/契约三层排除，根因=测试条目窗口期数据形态，场景不可复现，无代码修复项
> 现象来源：2026-10-30 stage 包走查（版本 1.9.1，启动弹「发现新版本 1.7.7」）

## 一、排除项（三层逐一实证无罪）

1. **compareVer 算法无罪**（`src/utils/index.ts`）：`~~` 取整逐段数值比较——'1.9.1' vs '1.7.7'
   段 2=9>7 返回 1（新版更大，isLatest=true 不应弹）；多位数 '10'>'9' 亦正确（~~ 截断不影响
   同段多位数值比较）。三席方案审查+实读一致判定。
2. **用法无罪**（`src/core/version.ts`）：`compareVer(versionInfo.version, newVersion.version) != -1`
   → isLatest，参数序正确（当前版本在前）。
3. **数据侧现状干净**：VPS `shiyin.db` `app_releases` 表**空**（9.9.9 测试条目撤除后无残留），
   `/latest` 404=notPublished → isLatest 短路不弹——**bug 场景当前不可复现**。

## 二、根因锁定

2026-10-30 走查「临时挂 9.9.9 测试条目」窗口期的数据形态（版本号格式或历史数据残留）；
`latest-set` 无删除命令（撤条目=SQLite 手工删行），窗口期数据已不可考古。

## 三、防复发

批2 ⑤ min_client_version 消费已带 `/^\d+(\.\d+)*$/` 纯数字门槛（空/不可解析→跳过），
同类异常形态在该链路免疫。`latest-set` 侧 `releaseVerRe` 同款校验已在（backend/store/store.go）。

## 四、关联

- `/latest` 契约形状与 notPublished 短路机制：`backend/DEPLOY.md` §5/§9
- 节流与弹窗链现状（A-5 修复后形态）：`src/core/version.ts`
- 记忆条目：update-dialog-bug（已归档备查）
