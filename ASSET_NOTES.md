# 角色插画生成记录

## 工具与输入

- 生成日期：2026-11-13。
- 使用方式：Codex 内置 `image_gen.imagegen` 工具；未使用 CLI、API 密钥或 Python 图像编辑。
- 共同参数：`transparent_background: true`。
- 每张图单独发起生成调用，使用 `referenced_image_paths` 指向用户指定角色设定图的本地副本；生成前已查看该参考图。
- 参考图来源： [Q 版大肥鱼设定图](https://treapgogo.github.io/deepseek-whale-girl/assets/dafeiyu-chibi-character-sheet.png)。原图仅保留为工作用参考，不放进部署资源。
- 工具生成后，将最终 PNG 从工具默认输出位置复制到本项目 `assets/` 目录，保留原始透明通道；没有事后裁剪或改画。

生成结果分别用作待机、专注和休息状态。三张均是单一完整全身角色，已经检查主体、服装一致性、透明背景，以及头发、鲸尾与鞋子的完整展示。每张尺寸为 1145 × 1374，具有 32 位 ARGB 透明通道，画布左上角 alpha 值为 0。

## 三次调用的完整提示词

三次调用均使用下列共同提示词，末尾紧接对应的 `Pose:` 行。共同部分和对应姿态行合起来就是该次调用完整的 `prompt` 字符串。

### 共同部分（原文）

```text
Use case: identity-preserve. Asset type: transparent PNG mascot for a Chinese pomodoro web app. Reference image is the exact character design sheet. Preserve the design of the FRONT character at the top-left of the sheet: a wholesome round three-head-tall chibi whale girl, enormous bright blue eyes, round rosy face, long fluffy navy-to-cyan wavy hair and curved ahoge, navy whale-fin ears with white ruffles, white lace maid headband with blue bows, deep-blue and white fully clothed frilly maid dress, gem bow at collar, small blue whale emblem on white apron, tiny gold bow and stitch accents, white frilled ankle socks, navy Mary Jane shoes, thick rounded blue whale tail. Match her face, linework, colors and all outfit details closely. Render ONE front-facing full-body character centered on a portrait canvas with roomy transparent margin; the head, hair, hands, feet and whale tail must all fit entirely in frame. Clean polished anime illustration with crisp dark blue outlines. Truly transparent background, no white matte, no checkerboard drawn in, no scene, no card, no text, no watermark, no other views or detail panels.
```

### 待机：`assets/whale-idle.png`

```text
Pose: Exactly her welcoming standing front pose from the reference sheet, gentle open smile, arms slightly open at waist height.
```

工具原始输出文件名：`exec-3e3f86f7-22fc-4754-8b2d-2df0769c2e34.png`。

### 专注：`assets/whale-focus.png`

```text
Pose: Same character standing upright, holding an open small navy book with both hands at chest height, looking down at the pages with a calm focused expression. Keep her full face recognizable and legs/feet fully visible.
```

工具原始输出文件名：`exec-c937b804-0ec9-4806-95db-e819685f6f8f.png`。

### 休息：`assets/whale-rest.png`

```text
Pose: Same character standing upright gently hugging a small pale blue cushion with both hands, eyes softly closed and a peaceful sleepy smile. Keep legs, feet, hair and tail fully visible.
```

工具原始输出文件名：`exec-04f135c0-87a2-4c6a-be1c-d2a7dafad3f4.png`。

## 来源与许可

参考图与角色来源、以及上游许可范围的核对结果见 [ATTRIBUTION.md](./ATTRIBUTION.md)。这些是非官方角色衍生插画，本记录不将上游代码的 MIT 许可延伸到参考图或角色形象。
