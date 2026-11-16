# 素材来源与使用说明

## 角色视觉参考

- 资源库： [鲸鱼娘开源资产库](https://treapgogo.github.io/deepseek-whale-girl/)。
- 仓库与维护账号： [TreapGoGo/deepseek-whale-girl](https://github.com/TreapGoGo/deepseek-whale-girl)。
- 用户指定的参考对象：首页第一组“Q 版大肥鱼”。
- 对应参考图： [Q 版角色三视图与细节](https://treapgogo.github.io/deepseek-whale-girl/assets/dafeiyu-chibi-character-sheet.png)。
- 上游归档位置：`characters/dafeiyu/reference-sheets/dafeiyu-chibi-character-sheet.png`；网站使用副本位于 `site/assets/dafeiyu-chibi-character-sheet.png`。
- 来源与许可核对日期：2026-11-13。

该资源库由社区维护，并说明鲸鱼娘是社区二创形象，不代表 DeepSeek 官方。项目中保留了蓝色渐变长发、鳍状耳朵、鲸尾、蓝白蕾丝女仆裙和鲸鱼围裙等用户指定的视觉特征。[上游项目说明](https://github.com/TreapGoGo/deepseek-whale-girl#readme)、[项目 FAQ](https://treapgogo.github.io/deepseek-whale-girl/project.html)

## 许可范围核对结果

上游 README 将网站源代码、说明文字与提示词、角色图和社区投稿分开处理：代码采用 MIT；原创说明文字和提示词采用 CC BY-SA 4.0；角色图及外部素材按其各自来源授权说明处理，不包含在网站代码的 MIT 许可内。[上游许可说明](https://github.com/TreapGoGo/deepseek-whale-girl#代码内容与素材许可)

核对该仓库的 README、FAQ、完整文件树与参考图所在目录后，未找到这张首页 Q 版角色图单独的作者署名或图片许可文件。因此，本项目记录资源库来源，不将维护账号推定为图片原作者，也不把上游网站代码的 MIT 许可延伸到原角色图。

原始参考图只用于工作阶段的视觉参照，不作为本项目公开部署所需资源分发。本项目没有复制上游网站的 HTML、CSS、JavaScript 或整段生成提示词。

## 本项目使用的角色插画

| 文件 | 内容 | 制作方式 |
|---|---|---|
| `assets/whale-idle.png` | 正面站立、微笑陪伴 | 内置 ImageGen，根据上述参考图制作 |
| `assets/whale-focus.png` | 同一角色双手捧书 | 内置 ImageGen，根据上述参考图制作 |
| `assets/whale-rest.png` | 同一角色闭眼抱浅蓝色抱枕 | 内置 ImageGen，根据上述参考图制作 |

三张图于 2026-11-13 生成，为透明背景 PNG。完整实际提示词与生成参数见 [ASSET_NOTES.md](./ASSET_NOTES.md)。这些插画是依据指定社区角色设计制作的 AI 衍生图，并非 DeepSeek 官方素材；生成方式本身不构成对原图或角色权利的额外授权。

本说明用于标明来源和已核实的许可范围，不宣称参考图、角色形象或本项目插画具有已确认的通用商用许可。图片相关权利不随网页代码一并授予。

## 其他素材

- `assets/favicon.svg` 为本项目以代码绘制的简化鲸鱼站点图标。
- 界面图标由项目内联 SVG 绘制，提示音由浏览器实时合成；没有引入第三方字体、图标包或音乐文件。
- 本项目与深度求索公司或 DeepSeek 官方没有隶属或背书关系。

## v1.2.0 原创界面图形

鲸形计时器、印章、航线与鲸鱼装饰图形为本站 SVG/CSS 绘制，未复制其他二创网站图片。参考网站和具体范围见 [DESIGN_REFERENCES.md](./DESIGN_REFERENCES.md)。梁文锋卡片文字为原创同人配文，非真人引语。

用户于 2026-11-16 提供照片 `fan-note-photo.jpg`，要求用于梁文锋与大肥鱼互动主题。照片原样保存，仅通过网页布局裁切展示；人物身份按用户提供的主题标注，未独立核验。拼贴配文为本站创作，非照片人物引语。点击卡片仅触发本地小鲸回应，不请求 AI、不更改计时或任务。
