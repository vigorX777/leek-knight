# ADR-0001: 使用可测试的混合后轮控制器

## Status

Accepted

## Context

原实现同时强制后轮角速度、施加切向力、缩放车架速度并强制车架角速度。这些控制信号在坡面、腾空和落地时互相竞争，导致手感难以预测，也无法通过纯逻辑测试稳定回归。

游戏必须继续使用 Phaser Matter Physics，并保持纯前端、固定行情快照和原始行情收益结算。

## Decision

- 新增 `bikeControl.ts`，以纯函数统一输出油门、后轮轮速、后轮牵引力、制动、姿态扭矩和玩家姿态角速度目标。
- 使用随速度衰减的扭矩曲线，保留低速爬坡能力并限制高速持续加速。
- 车架不接受水平速度修正；无姿态输入时，地面辅助只施加有限扭矩且腾空时关闭。
- 长按翘头或下压键时持续追踪玩家姿态角速度目标，避免刚性轮轴约束抵消单帧扭矩。
- Matter 场景只读取输入、碰撞状态和路面角度，并应用控制器输出。
- 使用非碰撞车辆组、车轮销约束和更高的约束解算迭代提高稳定性。

## Consequences

### Positive

- 长按油门、制动、倒车和姿态变化可以独立测试。
- 左右键输入会在 HUD 中显示，并可通过车身角度数据做浏览器回归。
- 动力来源一致，参数变化更容易解释和调优。
- 玩家仍能感受到物理惯性，同时避免大坡无法启动。

### Negative

- Matter 没有原生轮轴电机，因此仍需要角速度限制与切向牵引力组合模拟后驱。
- 物理手感仍需通过代表性股票赛道做浏览器回归。

## Alternatives Considered

- 仅设置后轮角速度：高波动长坡会空转并失去爬坡余量。
- 仅向车架施加水平力：稳定但缺少后轮驱动与抓地反馈。
- 完全取消姿态辅助：真实但对首轮浏览器玩家过于苛刻。

## References

- https://brm.io/matter-js/docs/classes/Body.html
- https://github.com/liabru/matter-js/blob/master/examples/car.js
- https://docs.phaser.io/api-documentation/typedef/types-physics-matter
