# GitHub上传与网站部署

本说明适用于把拾光客服作为独立项目放到自己的GitHub。代码仓库和可操作网站是两个不同地址：先上传源码，再根据需要启用Pages。此次交付尚未创建任何远程仓库，以下地址格式只是示例，实际以GitHub返回为准。

## 先确认项目能运行

安装Node.js 22.13及以上版本，然后在项目目录执行 `npm start`。打开 `http://127.0.0.1:3188`，体验一次退货。项目没有第三方依赖，无需先运行npm install。

压缩包解压后，源码根目录应该直接包含 `README.md`、`package.json`、`index.html`、`web`、`core`、`server`、`.github` 等内容。不要把外层压缩包或整个“面试”文件夹上传。

## 方式一 使用GitHub Desktop

1. 在GitHub Desktop中选择 **File → New repository**，创建名为 `shiguang-agent-desk` 的本地仓库。
2. 将本项目源码复制到该仓库根目录。复制时保留隐藏的 `.github`、`.gitignore` 和 `.env.example`；不要覆盖GitHub Desktop创建的 `.git` 文件夹。
3. 在Changes中检查文件。应有页面、核心代码、测试和文档；不应有 `.env`、`data/workspace.db`、运行日志或其他个人资料。
4. 输入提交说明，例如 `Initial Shiguang Agent Desk project`，提交到main。
5. 点击 **Publish repository**。如果希望使用免费公开Pages演示，选择公开仓库；依据自己账户计划和意愿决定可见性。
6. 发布成功后点击 **View on GitHub**，复制该仓库的实际链接。

## 方式二 使用Git命令

先在GitHub网页创建一个空仓库，不添加README、许可证或.gitignore，避免与本地已有文件冲突。然后在项目根目录执行以下命令，把示例用户名换成自己的用户名。

```bash
git init -b main
git add .
git commit -m "Initial Shiguang Agent Desk project"
git remote add origin https://github.com/你的用户名/shiguang-agent-desk.git
git push -u origin main
```

GitHub登录认证请使用自己的GitHub客户端或Git凭据管理器，不要把个人访问令牌写进README、远程URL或聊天记录。如果目录已经是独立仓库，保留已有历史和正确的remote，不重复初始化或覆盖。

## 得到能操作的网站链接

源码内已包含 `.github/workflows/pages.yml`。GitHub官方流程要求启用Pages的GitHub Actions来源；工作流会测试、打包并上传静态产物。

1. 打开仓库 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 打开 **Actions → Deploy demo to GitHub Pages**。
4. 若首次推送发生在启用Pages之前，可点击 **Run workflow** 手动重跑。后续推送到main会自动执行。
5. 等待build和deploy都成功。在部署结果或Pages设置中复制 **Visit site** 的真实地址。

通常地址形如 `https://你的用户名.github.io/shiguang-agent-desk/`，但仓库名、账号和自定义域名会影响实际地址，请以部署结果为准。代码和静态资源都使用相对路径，支持仓库子目录。

发布后亲自检查：能打开聊天页；能逐次输入“我要退货”“SG10002”“杯子漏水”；确认后订单中心出现申请；知识库可以打开原文；评测中心可以实际运行。

## Pages演示与模型服务的区别

GitHub Pages只承载静态文件，因此本项目的Pages版本在浏览器本地运行同一套规则引擎，并把演示记录保存在当前浏览器。不同访问者互相隔离，但同一浏览器下同源页面共享演示数据。它不会向GitHub发送模型密钥，也不会调用真实支付系统。

要接真实模型，运行Node服务端并在服务端环境配置密钥。服务端完整源码已包含在仓库；Pages产物只发布 `dist/` 中的网站文件。不要尝试通过公开JS文件“隐藏”API Key。

## 常见问题

- **仓库有代码，但没有网页**：尚未启用Pages，或工作流未部署成功。进入Settings和Actions检查。
- **Actions提示Pages未启用**：先把Source切到GitHub Actions，再手动重跑工作流。
- **没有自动运行**：确认默认分支为main，工作流文件路径是 `.github/workflows/pages.yml`，而不是多套了一层文件夹。
- **页面404**：以Pages显示的链接为准，等首次部署成功再访问；检查仓库名和路径。
- **直接双击index.html不能使用**：ES模块需要HTTP服务，本地用 `npm start` 或静态预览命令。
- **浏览器显示旧页面**：刷新或无痕窗口查看，并确认最新提交的部署成功。
- **本地端口被占用**：在 `.env` 修改PORT，例如3190，重启后打开对应端口。

参考：[GitHub Pages自定义工作流官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
