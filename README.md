# Moonix for DeepSeek Harness

在 DeepSeek 对话中检索 Moonix 录音、阅读摘要和逐字稿、查询「我的待办」。只读访问，不创建、修改或删除 Moonix 业务数据。

**0.1.0-alpha.2：适配 DeepSeek 内置的 DSH 0.2.2-rc.5。默认入口改为访问令牌认证。**

## 直接在 DeepSeek 中安装

把下面的版本链接交给 DeepSeek，要求安装或更新 Moonix 插件：

https://github.com/IceyOrange/dsh-moonix/tree/v0.1.0-alpha.2

可以使用这段请求：

> 请从上面的 GitHub 链接安装 Moonix 插件 0.1.0-alpha.2，使用默认入口，不使用 allow-version。安装后检查 moonix 服务是否启用。这个兼容入口使用 Moonix App 访问令牌；请协助我把令牌保存为用户级凭据 MOONIX_TOKEN，不写入项目，不回显令牌。发现实际工具后，执行最小只读用户信息查询验证。不要仅凭安装或凭据保存就宣称连接成功。

本插件是纯 ESM bundle，无构建脚本或运行时 npm 依赖。

## 为什么默认使用访问令牌

旧版 0.2.2-rc.5 的 MCP 管理器支持远程 Streamable HTTP 和凭据引用，但没有新版的 OAuth 配置和 MCP 账户服务。alpha.1 依赖这些新接口，所以被正确拒绝。

alpha.2 的默认入口只调用旧版已有服务，不提交 oauth、toolLoading 等新版字段，不要求 mcpAccounts，不开启自建 OAuth 或额外代理。

| 入口 | 认证 | 适用环境 |
| --- | --- | --- |
| dsh-moonix（默认） | 访问令牌 | DSH 0.2.2-rc.5 及声明范围内的新版 |
| dsh-moonix/token | 与默认入口相同 | 保留已有 token 入口兼容性 |
| dsh-moonix/oauth | 原生 OAuth | 需要提供 mcpAccounts 的新版 DSH；已核对 0.2.3-alpha.2 接口 |

包声明范围为 `>=0.2.2-rc.5 <0.3.0`，Node 要求跟随最低目标版本 `>=24.9.0`。默认入口按固定版本源码检查，尚未在用户的 DeepSeek 内完成真实网络联调；范围内其他版本也未逐一运行验证。

## 设置访问令牌

在 Moonix App 中复制访问令牌，通过当前 DeepSeek 客户端的安全凭据能力保存为 `MOONIX_TOKEN`。插件本身不会收集、内置或打印用户令牌。

如果通过受信任的 Host 插件代码保存，官方凭据服务提供 `ctx.credentials.set('MOONIX_TOKEN', token)`；这是 Host API 示例，不是让用户在普通终端输入的命令。由客户端在用户提供令牌后完成保存，其他凭据保持不变。

默认入口注册以下公开配置模板：

```yaml
transport: streamable-http
url: https://api.moonix.cn/mcp
headers:
  Authorization: 'Bearer ${credential:MOONIX_TOKEN}'
```

MCP 管理器启用模板展开，令牌由用户级凭据服务解析；保存或轮换后，官方客户端按引用变更更新连接。缺少令牌时可能显示 waiting-credentials；这是等待配置，不表示已认证。

不要将令牌写进本包、用户消息摘要、日志、项目配置或仓库。报告 Header 只能显示 `Authorization: Bearer ****`。401/403 表示服务尚未接受凭据，不能报告认证成功。此模式没有浏览器 OAuth 授权按钮，也不能报告为 OAuth 授权成功。

若有同名 moonix 服务，插件会报告冲突而不会覆盖。先核对地址，再由用户决定保留哪个入口。

## 新版 Harness 的原生 OAuth（可选）

只有运行时确实提供原生 MCP 账户服务时，才能将用户覆盖层中原有 moonix 行替换为：

```yaml
- id: moonix
  name: dsh-moonix/oauth
```

两种入口不能同时加载。然后打开「插件 → Moonix → 连接 Moonix」，在 api.moonix.cn 页面亲自完成手机号、验证码和最终授权。请求 scope 为 mcp。注册、PKCE、回调、令牌保存和刷新交给 Harness；本包不拼接授权链接。旧版无账户服务时，这个入口不会激活，不应通过版本豁免强行启用。

## CLI 安装（仅供独立 Harness 用户）

```sh
dsh plugin --profile web add github:IceyOrange/dsh-moonix#v0.1.0-alpha.2
dsh --profile web --dump-config
dsh web
```

也可下载 Release 中的 tgz，通过 `dsh plugin --profile web add ./dsh-moonix-0.1.0-alpha.2.tgz` 安装。DeepSeek 内安装无需用户运行这些终端命令。

## 使用与验证

- 先确认配置启用、认证被服务接受、MCP 初始化和工具发现成功。
- 首次只调用实际发现的用户信息工具；不为验证而读取私人记录或逐字稿。
- 之后可以问：帮我找上周提到产品发布的录音；总结这条会议记录；查询未完成待办。
- 按账户时区解释相对日期。仅使用实际发现的工具，不编造名称。

## 开发与验证边界

`npm test` 运行旧版字段契约、认证隔离、冲突保护和新版 OAuth 可选入口测试；`npm pack` 生成安装包。compatibility.json 的允许字段来自固定的官方 0.2.2-rc.5 管理器 schema，而非新版 master。

这些测试使用接口替身，不代表真实 DeepSeek 安装、网络认证或完整 OAuth 回调已经通过。npm 发布和插件市场收录也是独立步骤，不因 GitHub Release 存在而自动完成。

## English

Moonix connector for DeepSeek Harness. Version 0.1.0-alpha.2 defaults to access-token authentication for the embedded DSH 0.2.2-rc.5 runtime. It uses the host credential reference MOONIX_TOKEN and omits newer OAuth and toolLoading fields. Native OAuth remains an explicit subpath for newer hosts with mcpAccounts. Access is read-only. Runtime schema compatibility has been reviewed; real DeepSeek connection verification is still pending.

## References

- [Pinned 0.2.2-rc.5 manager schema](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/mcp/mcp-manager/src/index.ts)
- [0.2.2-rc.5 credential store](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.5/packages/credentials/credentials-local/README.md)
- [Newer native OAuth connector](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.3-alpha.2/packages/connector/linear/src/index.ts)
- [Moonix installation documentation](https://docs.moonix.cn/mcp/install_moonix_mcp_cn.md)

Moonix endpoint and authentication details were provided by the publisher on 2026-11-24. Live network verification remains pending.
