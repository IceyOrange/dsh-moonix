# Moonix for DeepSeek Harness

在 DeepSeek Harness 中检索 Moonix 录音、阅读摘要和逐字稿、查询「我的待办」。只读访问，不创建、修改或删除 Moonix 业务数据。

**当前版本：0.1.0-alpha.1。** 已实现插件及账户入口；本地契约测试与打包检查不能代替真实 Harness OAuth 联调。npm 和市场收录状态以对应平台为准。

## 安装

需要提供 `mcpManager`、`mcpAccounts`、`systemPrompt` 和 `credentials` 的 Harness Web / Desktop 环境。本插件按官方仓库 `0.2.3-alpha.2` 的连接器接口实现，声明兼容范围 `>=0.2.3-alpha.2 <0.3.0`；尚未完成实际版本兼容验证。只有基础 profile 的环境不具备完整账户界面。

拿到本包的 tarball 后，使用 Harness 官方命令安装：

```sh
dsh plugin --profile web add ./dsh-moonix-0.1.0-alpha.1.tgz
dsh --profile web --dump-config
dsh --profile web
```

仓库公开后也可从 GitHub 安装（安装前确认仓库已有文件）：

```sh
dsh plugin --profile web add github:IceyOrange/dsh-moonix
```

生产使用建议将 GitHub 安装锁定到已验证的 commit。本包使用纯 ESM，无构建脚本或运行时 npm 依赖。

## 登录与授权

1. 打开「插件 → Moonix」，确认插件启用，点击「连接 Moonix」。
2. Harness 负责元数据发现、动态客户端注册、PKCE、state、回调、令牌交换、保存和刷新。
3. 在 `https://api.moonix.cn` 授权页面亲自完成手机号、验证码和最终确认。请求 scope 为 `mcp`；以页面实际权限为准。不要将验证码、授权码或回调 URL 发给 Agent。
4. 返回插件页确认账户已连接，并确认 Moonix 工具被发现。可让 Agent 先执行用户信息查询验证，避免读取私人记录正文。

如果没有自动打开授权页，点击账户区域提供的授权页按钮。静态包无法预先生成有效 OAuth 链接，必须由运行中的 Harness 创建。首次未授权显示等待授权是正常状态；仅安装成功不能视为连接成功。

若已有名为 `moonix` 的配置，管理器会报告冲突；本插件不会覆盖它。相同地址时由用户决定保留哪一条，不同地址时先确认，避免误连。

## 用法

- 帮我找上周提到产品发布的录音。
- 总结我指定的会议记录。
- 查询 Moonix 中未完成的待办。

模型应使用实际发现的工具，按用户所在时区计算相对日期，只读取完成任务必需的数据。

## 访问令牌备用模式

仅当原生 OAuth 明确不可用时使用；这不是 OAuth 授权。先通过当前 Harness 的凭据服务安全设置 `MOONIX_TOKEN`，或让运行 Harness 的进程继承该环境变量。不要把真实令牌写入本仓库。

在目标 profile 的用户覆盖层，将本插件行改为以下内容；不要同时加载两种模式：

```yaml
- id: moonix
  name: dsh-moonix/token
```

该入口向官方管理器传递 `Authorization: Bearer ${credential:MOONIX_TOKEN}` 模板。管理器负责解析凭据与失败诊断脱敏。Token 模式不注册 OAuth 账户按钮；从管理器检查实际连接和工具发现结果。

如果收到 401/403，检查凭据是否存在、是否过期及请求是否实际携带 Bearer Header。报告中仅写 `Authorization: Bearer ****`。不因配置中存在模板就声称认证成功。

## 卸载

```sh
dsh plugin --profile web remove dsh-moonix
```

注册随插件生命周期撤销，连接及工具由官方管理器清理。OAuth 模式可先在账户区域退出登录。卸载不等于撤销服务端授权，不删除 Moonix 记录。

## 开发与检查

```sh
npm test
npm pack --dry-run
npm pack
```

测试覆盖 OAuth/Token 隔离、账户注册与撤销、名称冲突、保留无关服务及无账户 UI 的行为。这些使用管理器接口替身，不验证真实网络、Cordis 作用域或 OAuth 回调。

## 发布

发布包名暂定 `dsh-moonix`；npm 名称是否可用尚待在线确认。代码采用 MIT，范围仅为本连接器代码。原品牌元信息附件尚未收到，图标和发布者描述尚待确认。

- GitHub：公开完整源码，并添加 `dsh-plugin` topic。
- npm：确认包名可用、目标账号和联调通过后，执行 `npm publish --tag alpha --access public`。
- 市场：Cordis 社区市场的说明要求提供 npm 包名及仓库链接，通过验证与审核后才会展示；topic 发现、npm 发布和市场收录是不同状态。

仓库当前不包含自动发布流程；发布前应运行本地测试和打包检查。

## English

Moonix connector for DeepSeek Harness. Search recordings, read summaries and transcripts, and view your tasks. Access is read-only. Native OAuth is exposed on Plugins → Moonix using the official MCP manager and account services. An explicit token-only subpath is available as a fallback. This alpha requires real Harness OAuth validation before a stable release.

## References

- [Official MCP connector example](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/connector/linear/src/index.ts)
- [Official MCP account API](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-account/README.md)
- [Official MCP manager](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-manager/README.md)
- [Official packaging](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- [Moonix installation documentation](https://docs.moonix.cn/mcp/install_moonix_mcp_cn.md)
- [Community publishing tutorial](https://github.com/deepseek-ai/deepseek-harness/discussions/961)

Moonix endpoint and OAuth metadata were supplied by the publisher on 2026-11-24. This environment could not independently fetch live metadata due to DNS restrictions. Before authorization, verify issuer, endpoint domain and scope; stop if they differ from the publisher's specification.
