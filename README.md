# Learning Atlas · GitHub Pages 发布包

深度学习、机器人基础、大模型与机器人学习的中文知识站。
本包包含现有 26 篇知识讲解、43 张论文原图、52 张机制图、交互页面，以及 GitHub Pages 自动发布配置。

## 第一次发布

### 1. 创建仓库

登录 https://github.com/new ，仓库名称填 `你的GitHub用户名.github.io`，用户名使用小写。例如用户名是 `xiaolin`，仓库名就是 `xiaolin.github.io`。

选择 Public，勾选 Add README，点击 Create repository。免费账号用公开仓库发布 GitHub Pages。一个账号只能有一个同名个人站点仓库；如果这个仓库已经存在，先确认里面是否有正在使用的网站。

### 2. 启用 GitHub Pages

进入仓库 Settings → Pages → Build and deployment，把 Source 设为 GitHub Actions。此时还没有网站文件，稍后上传后会开始发布。

### 3. 上传本包

Windows 或 macOS 可安装 GitHub Desktop：https://desktop.github.com/ 。登录 GitHub 后，选择 File → Clone repository，选中刚建的仓库并下载到电脑。

解压本包，把 `learning-atlas` 文件夹内的全部文件复制进刚下载的仓库文件夹，替换初始化的 README。复制后，仓库根目录应直接包含 `content/`、`dist/`、`scripts/`、`README.md` 和 `.github/workflows/pages.yml`。请打开系统的隐藏文件显示选项，确保 `.github` 文件夹一起复制；macOS Finder 可按 Command + Shift + .，Windows 文件资源管理器可在“查看”中显示隐藏的项目。

回到 GitHub Desktop，在 Summary 填 `Publish Learning Atlas`，点击 Commit to main，然后点击 Push origin。网站文件要解压后上传；GitHub Pages 读取的是这些文件。

### 4. 查看发布结果

打开 GitHub 仓库的 Actions 页面，找到 Publish Learning Atlas。任务依次运行 build 和 deploy，全部显示绿色勾后，在 Settings → Pages → Visit site 打开网站。

网址为 `https://你的GitHub用户名.github.io/`。GitHub 文档说明，推送后的发布可能需要最多约 10 分钟。若任务失败，点击红色任务查看失败步骤；若尚未启用 Pages，完成步骤 2 后，在 Actions 中选择该工作流并点击 Run workflow。

首次检查：首页、Agent 基础文章、机器人论文筛选、论文图片放大，以及手机上的阅读效果。

### 5. 添加朋友

仓库 Settings → Collaborators → Add people，输入朋友的 GitHub 用户名并邀请。朋友接受邀请后即可参与修改。

推荐日常使用“新建分支 → 修改 → Pull Request → 合并到 main”的方式。Pull Request 会运行构建和内容检查，合并后自动发布正式网站。当前配置的 PR 输出是检查结果；查看改动可用 GitHub 的 Files changed，网页效果可在本地预览。

## 修改哪一个文件

| 内容 | 编辑位置 |
| --- | --- |
| 知识讲解、论文精读、正文公式、读图说明 | `content/guides.json` 中对应文章的 `knowledge` |
| 基础课程、逐讲文章与公式/配图索引 | `content/courses.json`、`content/course-articles.json`（导读）；完整正文和索引在 `dist/course-articles/cs336/`，图片在 `dist/assets/courses/cs336/` |
| 新增前沿条目 | `content/frontier.json` |
| 机器人论文入口与分类 | `content/robot-papers.json` |
| 论文原图索引、出处 | `content/paper-figures.json` |
| 机制图索引 | `content/diagrams.json` |
| 论文图片与机制图文件 | `dist/assets/papers/`、`dist/assets/diagrams/` |
| 原始资料索引 | `dist/resources.json` |
| 页面布局、交互和样式 | `dist/` 内的 HTML、JS、CSS |

在 GitHub 网页打开对应文件，点击铅笔按钮即可编辑。文章用 `id` 区分，例如 `llm-agent-foundations` 是 Agent 基础篇。`knowledge.essentials` 保存核心解释，`knowledge.readings` 保存论文精读；`knowledge.figures` 和 `knowledge.diagrams` 保存正文实际使用的图注和图片关联。修改图索引时，同时更新正文中相应的关联与说明。

公式的 `latex` 保存 LaTeX 源码，`plain` 保存可朗读的含义。构建时自动生成 `mathml` 和 `mathmlSource`，再同步浏览器数据。保留 JSON 的引号、逗号与括号。发布后的公式生成结果由 Actions 构建并上传，无需回写到 GitHub 源文件。

首页部分旧前沿条目保存在 `dist/app.js` 的 `news` 定义中；新增内容统一写入 `content/frontier.json`。

## CS336 完整笔记迁移

课程页保留源笔记完整正文，而不是重新概括。章节、列表、代码、脚注与表格转为语义 HTML；公式为静态 MathML；知识框、重点框和警示框使用站内样式。仅迁移正文引用的图像，课件图页转为 WebP，不发布讲义 PDF、视频或 TeX 源文件。

更新源笔记后，在网站仓库根目录运行（`CS336/` 默认为同级目录）：

```sh
python3 -m pip install -r requirements-migration.txt
python3 scripts/migrate-course-notes.py --source ../CS336
python3 scripts/check-course-articles.py --source ../CS336
node scripts/build-site.mjs
```

图表转换需要系统工具 `pdftoppm`（Poppler）与 `convert`（ImageMagick）。可用 `--lecture 16` 只更新一讲；`--output` 只接受以 `course-articles/cs336` 结尾的站点目录，图片会放到对应 `assets/courses/cs336`。源 `CS336` 文件不会被修改。

`dist/course-articles/cs336/index.json` 记录每讲目录、完整搜索文本和源内容覆盖统计。带 `--source` 的审计检查源正文片段与代码保留，以及标题、图片、重点框、表格和脚注数量。普通发布只检查提交的 HTML/索引/WebP，不依赖同级仓库、TeX 编译器、pylatexenc 或图像转换工具。

## 自动发布做了什么

`.github/workflows/pages.yml` 在 main 收到修改时自动执行：安装公式渲染器 → 生成公式 → 同步文章与资料 → 检查内容和资源 → 把 `dist/` 发布到 GitHub Pages。

Pull Request 执行同样的构建检查；发布步骤仅在 main 上执行。网页内容、公式、图片与交互全部由静态文件提供，读者访问时无需运行 Python。

## 本地预览（需要时使用）

安装 Node.js 24 和 Python 3.12 后，在仓库根目录依次运行：

```sh
python3 -m pip install -r requirements-authoring.txt
node scripts/build-site.mjs
python3 -m http.server 8000 --directory dist
```

浏览器打开 http://localhost:8000 。Windows 可将命令中的 `python3` 换为 `python`。结束预览按 Ctrl+C。

`scripts/check-site.mjs` 是日常发布检查，数量会随文章与图片变化。`verify.mjs` 保留本次完整内容版本的交互回归检查，可运行 `node verify.mjs`；其中部分断言对应本次具体文章和数量，新增或重写文章时需同步调整这些断言。

## 以后绑定阿里云域名

先在 GitHub Pages 的默认网址确认发布成功。之后在 Settings → Pages → Custom domain 中添加完整域名，再在阿里云 DNS 中配置 GitHub 要求的记录。绑定自定义域名后仍使用本包的 GitHub Actions 发布流程。

## 官方操作说明

- 创建网站：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- 选择发布来源：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- GitHub Actions 发布：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Desktop 克隆：https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop
- 邀请协作者：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository
- 配置自定义域名：https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
