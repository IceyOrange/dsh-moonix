# Moonix

在 DeepSeek 对话中检索录音记录、阅读摘要和逐字稿、查询「我的待办」。只读访问，不创建、修改或删除 Moonix 内容。

## DeepSeek 内置 Harness 0.2.2-rc.5

0.1.0-alpha.2 默认使用访问令牌认证，不依赖新版原生 OAuth 账户接口。

请从 Moonix App 复制访问令牌，让当前客户端通过安全凭据能力保存为用户级 MOONIX_TOKEN。不要写进项目，不回显。缺少令牌时连接可能显示 waiting-credentials。

配置和令牌保存不代表验证成功。应继续确认认证被接受、MCP 初始化和工具发现成功，再执行一次最小只读用户信息查询。这不是 OAuth 授权成功。

## 新版 Harness

仅在运行时提供原生 MCP 账户服务时，可以选用 dsh-moonix/oauth 入口，再从「插件 → Moonix」发起浏览器授权；用户本人完成手机号、验证码和最终确认。

此版本仍为 alpha；真实 DeepSeek 连接验证待完成。
