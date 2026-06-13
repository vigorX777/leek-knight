# 成熟物理驾驶游戏调研

## 可复用结论

1. 网页玩家更偏好即时乐趣、短期目标和低决策摩擦。年度长赛道应持续展示下一结算点，而不是只给最终完成进度。
2. 车辆差异和手感主要来自扭矩、最高速度、抓地、悬挂、空气旋转速度、质量分布与重心，而不是单一恒定推力。
3. Matter 的力只作用于当前时间步，需要持续施加并按时间步缩放；直接速度修正适合精确控制，但不应与多个独立动力来源同时竞争。
4. Matter 官方车辆结构使用非碰撞组、独立车架和车轮，以及车轮到车架的约束。约束稳定性不足时，应提高解算迭代或降低刚度。
5. 隐藏机制需要可视反馈。抓地、腾空、油门和下一目标应直接显示，让玩家能理解失败原因并主动调整。

## 本项目采用

- 用纯函数控制器统一计算油门响应、速度相关扭矩、制动、倒车和姿态辅助。
- 后轮角速度与切向牵引力共用同一扭矩曲线，只作用于后轮；不直接修改车架水平速度。
- 地面只提供有限的姿态阻尼，腾空后完全交给玩家前后倾控制。
- 车架、车轮和骑手使用同一非碰撞组；车架质量高于车轮，并增加 Matter 约束解算迭代。
- HUD 增加抓地状态、驱动模式、油门强度和下一结算点。
- 镜头根据水平速度增加前视距离，给玩家更多坡道预判时间。

## 暂不采用

- 车辆升级与数值养成：会干扰真实股票之间的赛道比较。
- 燃油限制：与当前“市场走势挑战”的核心主题关联较弱。
- 运行时行情请求：违反离线固定快照约束。
- 自动空中回正：会削弱平衡操作的技能空间。

## 资料来源

- [Fingersoft / Defold：Hill Climb Racing Lite 网页版访谈](https://defold.com/2026/03/12/Interview-Fingersoft/)
- [Fingersoft：LEGO Hill Climb Adventures 2.0 车辆平衡说明](https://fingersoft.com/news/2025/02/24/patch-notes-lhca-v2-0/)
- [Matter.js Body API](https://brm.io/matter-js/docs/classes/Body.html)
- [Matter.js 官方车辆示例](https://github.com/liabru/matter-js/blob/master/examples/car.js)
- [Phaser Matter 约束与碰撞配置](https://docs.phaser.io/api-documentation/typedef/types-physics-matter)
