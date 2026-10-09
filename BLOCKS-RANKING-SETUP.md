# 俄罗斯方块排行榜

当前公共 Supabase 配置为空时，排行榜显示“本机排行”，不同浏览器不共享。每次完成比赛记录真人成绩：生存时间（从游戏引擎取值，暂停不计时）、得分、消行数、日期与昵称。AI 不上榜；本地双人分别记录两位玩家。比赛胜负仍按最后存活者决定。

排行榜按生存时间降序、得分降序、消行数降序、完成日期升序排序。对战方式、游戏难度、初始障碍行和 AI 难度组成独立分组，防止不同起点混排。每个昵称每组保留最佳记录，默认20条，可展开100条。昵称不代表可靠身份。

## 配置在线排行榜

1. 使用数字华容道相同的 `number-config.js`，填写 Supabase URL、publishable/anon 公共密钥；启用匿名登录。不需要注册或密码。
2. 在 SQL Editor 执行 `blocks-ranking-supabase.sql`，只新增 `bt_sessions` / `bt_scores` 及本模式 RPC。不会改数字华容道的表。
3. 安装或使用 Supabase CLI，在本项目根目录部署 `supabase functions deploy blocks-submit`。函数需验证登录 JWT；不要关闭验证。新 publishable-key 项目需按当前 Supabase 网关文档配置 JWT 校验兼容性，函数内部仍始终执行 getUser 校验。
4. 服务端环境使用 Supabase 自动提供的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，管理员密钥只存在服务端环境，禁止写进前端。发布新增文件和修改后的俄罗斯方块页面至 GitHub Pages。
5. 两个不同设备完成比赛后核对同设置排行；检查直接写表和以普通客户端调用 `bt_accept_result` 均被拒绝。上线前必须在真实 Supabase 项目复查权限和跨设备流程。

在线开始时由服务端生成七袋随机种子并绑定合法设置、昵称、匿名会话。前端只上传逐帧时间步和真人的有效操作，不上传自定得分或名次。Edge Function 验证 JWT 和会话归属，使用同版本引擎回放玩家和 AI 的全部动作，必须到达正常终局，且模拟经过时间不能超过服务器经过时间（允许1.5秒容差）。服务端从回放自行计算得分、消行数与生存时间；普通客户端无成绩表增删改权限。

每匿名 UID 最多3次开局/分钟、20次/小时；日志上限250000条 / 5MB，比赛模拟时间上限4小时。超出限制或提交失败会明确显示“未提交”，不会伪造在线名次。匿名身份可重新创建，合法回放不能排除机器人操作，不具备绝对防作弊能力。可进一步部署 CAPTCHA/IP 网关限流与异常审计。超长比赛或高 AI 难度的回放可能触及免费 Edge Function CPU 限额，真实项目需监测并按需改为后台任务验证。

`supabase/functions/blocks-submit/blocks-core-verifier.js` 是当前 `blocks-core.js` 的字节一致快照。未来若修改游戏引擎，必须更新此快照并重新部署验证器；不能让网页与服务器版本不同。

官方部署认证参考：https://supabase.com/docs/guides/functions/auth-headers
