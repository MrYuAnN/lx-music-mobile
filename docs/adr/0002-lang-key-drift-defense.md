# ADR-0002: lang 键集对拍防线与 A6 勘误（编译期缺键拦截的适用域）

日期: 2026-11-05
状态: 已拍板（架构审查 A6 缩水批，grilling 两轮 + 三席方案审查定稿 v3）
关联: scripts/check-lang.mjs（防线实现）；.review-bundle/2026-11-05-lang-plan/context.md（审查包与拍板记录）；ADR-0001（单源化方法论的姊妹实践）

## 背景

架构审查报告（2026-11-04）A6 断言「lang 三语言 union 键集：英文缺键编译期不报错，运行时静默漏中文」。**删键实验勘误**：临时删除 en-us.json 的 `add_to` 键跑全仓 tsc，4 个调用方全部 TS2345——`keyof (A|B|C)` 取交集语义使缺键被编译期拦截，A6 原断言不成立（报告作者被该反直觉机制误导）。

**勘误适用域限定（三席审查 I-D，勿一刀切）**：编译期拦截只覆盖两种形态——

1. 字面量调用 `t('key')`；
2. 封闭 union 变量的模板字面量 `` t(`source_real_${s}`) ``（s: 字面量 union → 模板字面量类型仍受 keyof 检查）。

**cast 形态绕过编译期，原断言在 cast 形态下依然真实**（运行时 `?? fallbackLocale` 静默回中文）：现存五处 `` t(`source_short_${source}` as keyof Message) `` / `` t(`source_real_...` as never) ``——QualityTag.tsx:92、Mylist/MusicList/index.tsx:135、SonglistDetail/Header.tsx:53（后两处无 `|| source` 兜底，风险最高）、PlaylistGridCard.tsx:87、Home/Vertical/HomeSections.tsx:481（这两处带兜底）。此类真洞超出本防线能力，登记为已知残留，不扩查。

## 决策

1. **两防线分工**（防误判冗余而删）：编译期拦「**有调用方**的键缺译」（任何语言的缺键使调用点 TS2345）；`scripts/check-lang.mjs` 拦编译期结构性封不住的剩余真洞——「**无调用方**的键缺译」、强孤儿、值质量。
2. **四查**：①三语互拍（zh_cn 基准，缺/多双向）②强孤儿（ts-morph AST 提取字符串字面量 ∩ 键集）③en_us 值 CJK 残留 ④三语空串值（fallback 用 `??` 不兜底空串，直显空白=用户可见）。
3. **触发=test 动线串联**：`npm test` = check-lang && jest（I-A 拍板；独立 `check:lang` 入口保留）。`test` 行原为 A5 批刚落的 `jest`，本批在其前串联（两批衔接点）。本仓无生效 CI（build-test.yml 的 `pull_request→dev` 在 origin 动线从不触发，死配置实证），npm 钩子是唯一自动位。未来若修 CI，把 `npm test` 纳入即可整体收编。
4. **动态键三清单**（首跑调平 2026-11-05）：
   - `DYNAMIC_PREFIXES` 窄前缀白名单：**前缀取最窄**（I-C 拍板）；`setting_`/`songlist_` 两个宽头为调用点实存且无法收窄（`setting_${id}`/`songlist_${tid}`），如实登记但**族内成员全部降「弱孤儿」warn 档**——每跑必列清单保可见性，不静默放行。
   - `EXEMPT_KEYS` 键级枚举：宽模板+窄域形态（`download_${三元四词}`）。
   - `KNOWN_DEAD_KEYS` 死键放行清单：39 个上游 lx-music 遗留死键（登记时点 2026-11-05；全键名零命中+词根不在全仓模板 heads；实际调用键名不同证据例：download_paused 非 download_pause、exit_app_tip 非 exit_app）。物理删除三语键留后续清理批拍板，本批只登记放行。
   - 三清单均有防腐自检：前缀无对应模板 head / 尾词无字面量证据 / 死键复活（重新出现字面量命中）即 FAIL 引导清理。
5. **维护责任**：新增动态键模式必须登记对应清单（最窄原则）；新增语言时 loadDicts 基准列表同步扩、互拍查纳入新语言。提取范围=src 下 `*.ts/*.tsx`（当前 src 组件全 TS 无碍；未来新增 `.js/.jsx` 组件调 t() 会整族误判孤儿，届时同步扩 glob）。
6. **提取器=ts-morph AST**（I-B 拍板）：devDeps 已有、精准区分注释/字符串（注释残留键可检出=孤儿检测目标场景）、业界主流（i18next-parser 即 AST/词法级）。

## 理由

- **工具弃选论证**：i18next-parser 面向 i18next runtime+lexer 配置，对本仓 `resolveJsonModule` 直接 import + keyof union 交集结构适配成本高且引新依赖；自写 ~300 行零新增依赖（ts-morph 已在 devDeps）精确贴合。
- **精度边界（宁漏报不误杀）**：AST 仍非数据流分析——映射表/函数返回字面量的间接引用在实现处命中算使用（GROUP_LABEL_KEYS、qualityTier switch return）；「零孤儿输出≠真零」；提取器过宽→静默全绿是已知失效模式（Dify check-i18n 实例），`--self-test` 注入自检为持续防线而非一次性验证。
- **业界对标**（2026-11-05 实时核实）：CI 一致性脚本+提取对拍双查是 i18n 工程公认高价值实践（better-i18n、Lingual、SimpleLocalize、Dify #23068 反例）；本项目编译期键安全已天然强于 i18next 类型增强主流（resources type augmentation）。
- **zh_tw 简体字残留检查本批不做**：需引 OpenCC 系转换依赖，违反无新依赖约束；登记为后续扩展项（简繁漂移是同类第三形态，用户可见）。

## 回滚

`git revert` scripts/check-lang.mjs + package.json 两处；本 ADR 改状态为已废弃，不删文件。
