# 练声应用迁移计划

---

## 阶段 0：先定原则

> **先记住一句话：**
>
> **先迁"结构"，再迁"音频"，最后迁"后台能力"。**

### 别一上来就做：

- Capacitor
- Android
- iOS
- 后台音频
- 锁屏播放
- 原生采样调度

> ⚠️ **全开会死。**

---

## 执行版总览

### 推荐执行顺序

1. 阶段 1：先把结构拆干净
2. 阶段 2：先在 H5 跑通抽象
3. 阶段 3：把 H5 装进 Capacitor 壳
4. 阶段 4：验证 Android 原生单音链路
5. 阶段 5：把自动练习改成 sequence 下发
6. 阶段 6：做 iOS 对齐实现
7. 阶段 7：最后再碰后台 / 锁屏

### 阶段 1：可迁移结构

**必须做：**

- 定义稳定的 `PlayerAdapter / PlaybackSequence / PlaybackEvent / PlaybackError`
- 抽出纯函数 `sequence planner`，并补最小单测
- 明确 `prepare / subscribe / stop / releaseAll / dispose` 的语义边界
- 明确手动试音与自动播放的冲突策略，不留隐性行为

**可延后：**

- `useExercisePlayback` 的彻底瘦身
- `TonePlayerAdapter / useManagedPlayer` 的正式实现
- 更优雅的文件命名和目录收敛

**不要碰：**

- Capacitor
- Android / iOS
- 后台音频
- 原生播放实现
- 浏览器侧 adapter 执行链路改造

### 阶段 2：H5 跑通抽象

**必须做：**

- 实现 `TonePlayerAdapter`
- 用 H5 跑通 `planner -> player.playSequence() -> UI 回调`
- 确认自动练习和手动试音都已经走统一抽象
- 明确“阶段 2 的执行权仍在 H5 adapter”
- 把 `useExercisePlayback` 从 Tone 直接依赖里抽出来

**可延后：**

- 性能优化
- 更复杂的错误分类

**不要碰：**

- Capacitor 插件
- 原生采样器
- 原生 sequence 调度

### 阶段 3：Capacitor 壳接入

**必须做：**

- 初始化 Capacitor
- 添加 Android 平台
- 跑通 `build -> sync -> open android`
- 验证页面、Canvas、触摸、资源路径、PWA 行为
- 摸清 Web 音频在 WebView 中的真实表现

**可延后：**

- 对 Capacitor 环境做专门优化
- PWA 差异化策略

**不要碰：**

- 原生音频插件实现
- NativePlayerAdapter
- 后台 / 锁屏

### 阶段 4：Android 原生单音验证

**必须做：**

- 先做最小插件：`prepareSamples / playNote / stopAll`
- 先走调试入口，不要直接接正式业务流程
- 验证最小 Native -> JS 回传通道
- 明确原生采样策略：全采样还是部分采样 + 变调
- 搞清楚资源怎么进 Android 原生工程

**可延后：**

- 更完整的播放事件体系
- 资源自动同步和工程化

**不要碰：**

- `playSequence()`
- 自动练习完整切到原生
- 后台播放
- 锁屏控制

### 阶段 5：自动练习 sequence 下发

**必须做：**

- 把自动练习彻底改成前端生成 `PlaybackSequence`
- 原生新增 `playSequence()` 并掌握调度执行权
- 原生回传 `stepStart / stopped / sequenceComplete / error`
- 停止逻辑改成原生停止 sequence
- 明确手动试音和自动播放冲突策略

**可延后：**

- 更高精度调度优化
- 更复杂的恢复与同步机制

**不要碰：**

- iOS sequence 实现
- 锁屏 / 后台策略
- 媒体通知和系统会话控制

### 一句话判断当前做到哪

- 如果还在统一协议、抽 planner、补单测，你在阶段 1
- 如果浏览器里已经通过 adapter 跑通完整功能，你在阶段 2
- 如果 Android 壳已经起来但还是 Web 音频，你在阶段 3
- 如果 Android 原生已经能播单音，你在阶段 4
- 如果自动练习已经变成“前端下发 sequence，原生执行 sequence”，你在阶段 5

---

## 阶段 1：先把现有项目改成"可迁移结构"

### 目标

先把协议和 planner 钉死，让后续 H5 / Native 都基于同一套数据模型推进。

### 重点改造文件

| 文件 | 说明 |
|------|------|
| `src/audio/playerAdapter.ts` | 播放协议与共享类型 |
| `src/audio/exerciseSequencePlanner.ts` | 纯数据 planner |
| `src/hooks/useExercisePlayback.ts` | 当前播放流程参考与后续接线点 |

### 三层架构

```
┌─────────────────────────────────────────────────────────┐
│                    sequence planner                      │
├─────────────────────────────────────────────────────────┤
│  负责：练习配置、起始音、音域边界、上下行折返             │
│  位置：src/utils/voiceTrainerPlaybackUtils.ts           │
│        或 src/audio/exerciseSequencePlanner.ts           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    player adapter                        │
├─────────────────────────────────────────────────────────┤
│  定义统一播放器接口：                                     │
│  - prepare()                                            │
│  - startNote() / stopNote()                             │
│  - playSequence()                                       │
│  - stop()                                               │
│  - releaseAll() / dispose()                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      ui hook                             │
├─────────────────────────────────────────────────────────┤
│  src/hooks/useExercisePlayback.ts                        │
│  只管：状态、用户交互、调 adapter                         │
└─────────────────────────────────────────────────────────┘
```

---

## 实施计划

### 1. 定义统一播放协议

新增播放器抽象文件：

```
src/audio/playerAdapter.ts
```

**最小接口设计：**

```typescript
type PlaybackError = {
  code: string;
  message: string;
  recoverable: boolean;
};

type PlaybackEvent =
  | { type: 'noteStart'; note: string; stepIndex: number; roundIndex?: number }
  | { type: 'sequenceComplete' }
  | { type: 'stopped' }
  | { type: 'error'; error: PlaybackError };

type PlaybackSequenceStep = {
  note: string;
  durationMs: number;
  noteDurationMs: number;
  stepIndex: number;
  roundIndex: number;
};

type PlaybackSequence = {
  steps: PlaybackSequenceStep[];
  bpm: number;
  startNote: string;
  playMode: PlayMode;
};

interface PlayerAdapter {
  prepare(): Promise<void>;
  isReady(): boolean;
  startNote(note: string): void;      // 钢琴键盘手动按下
  stopNote(note: string): void;       // 钢琴键盘抬起
  playSequence(sequence: PlaybackSequence): void;
  stop(): void;
  releaseAll(): void;
  dispose(): void;
  subscribe(listener: (event: PlaybackEvent) => void): () => void;
}
```

> 💡 **说明：**
> - `startNote/stopNote` → 用于钢琴键盘手动按下和抬起
> - `playSequence` → 用于自动练习
> - `stop/releaseAll/dispose` → 分别用于停止当前流程、兜底清残音、释放底层资源
> - `subscribe` → 用于把底层播放器的播放进度、停止、完成、错误回推给 UI

**接口语义现在就要写死：**

- `prepare()` 必须幂等；已 ready 时应立即 resolve，失败时 reject，并允许后续重试
- `subscribe()` 默认允许多个 listener；订阅所有权归 `useExercisePlayback`，必须在 effect cleanup 中取消订阅
- `releaseAll()` 只负责把当前发声停干净，不等于释放实例
- `dispose()` 只负责销毁底层资源，不负责承担上层状态收尾
- 自动播放期间如果又触发 `startNote()`，默认采用策略 A：手动试音优先，先打断当前 sequence，再处理手动输入
- `playSequence()` 内部如何调度由 adapter 自己负责；hook 不能再偷偷保留逐音循环作为兜底后门

**为什么事件机制必须前置定义：**

- 当前 `useExercisePlayback` 里是靠 `setAutoCurrentNote(...)` 直接驱动 UI 高亮
- 一旦改成 `player.playSequence(sequence)`，如果没有正式事件协议，UI 就不知道当前播到哪一步
- 这个能力不能等到阶段 4/5 再临时加，否则前面定义的 adapter 边界会返工

---

### 2. 抽离练习序列生成逻辑

**从 `useExercisePlayback` 中抽出的内容：**

- 起始音解析
- 练习可播放范围校验
- 上下行折返起点计算
- 逐步 `note + duration` 生成

**新建 planner 文件：**

```
src/audio/exerciseSequencePlanner.ts
```

**Planner 输入：**

| 参数 | 类型 |
|------|------|
| exercise | Exercise |
| startNote | string |
| playMode | PlayMode |
| bpm | number |
| lowerBoundNote | string |
| upperBoundNote | string |

**Planner 输出：**

```typescript
PlaybackSequence
```

> 🎯 **意义：** 不管底层是 Tone.js 还是 Capacitor 原生插件，前端业务层只认序列数据，不认具体播放器。

**这里要补一条硬约束：**

- 阶段 1 到阶段 5 全部共用同一个 `PlaybackSequence` 定义
- 不允许阶段 1 先落一个临时协议，阶段 5 再改字段名或补字段
- 如果后面觉得字段不够，先改共享类型，再回头同步所有阶段说明，不允许文档漂移

---

### 3. 阶段 1 不急着瘦身 useExercisePlayback

这一阶段不要急着删当前 hook 里的播放循环。
更稳的边界是：

- 先把 planner 和共享协议抽出来
- 如需低风险接线，最多只把序列生成逻辑替换成 planner
- 当前 H5 播放执行链路可以暂时维持现状
- 真正删除双层循环、`wait()`、Tone 风格调用，放到阶段 2 再做

原因很直接：

- 阶段 1 的目标是先拿到稳定协议和 planner
- 阶段 2 的目标才是把浏览器执行权切到 `TonePlayerAdapter`
- 如果阶段 1 就一边改 hook、一边删旧播放循环，阶段边界会直接糊掉

---

### 4. 为阶段 2 预留实现落位点

现阶段先明确未来的落位，而不是在阶段 1 就强行把浏览器主链路改完：

- `src/audio/tonePlayerAdapter.ts`
- `src/hooks/useManagedPlayer.ts`

阶段 1 可以接受的动作是：

- 先把文件结构和命名方案定下来
- 先把共享类型和 planner 抽干净
- 为阶段 2 的 adapter/hook 改造留出稳定接入点

阶段 1 不要求：

- `TonePlayerAdapter` 已经执行 sequence
- `useManagedPlayer()` 已经取代当前 `useManagedSampler()`
- `App` 注入链路已经完成替换

---

### 4.5 阶段 1 推荐落刀顺序

为了减少返工，阶段 1 建议严格按下面这个顺序动手：

1. 先新建 `src/audio/playerAdapter.ts`
2. 再抽 `src/audio/exerciseSequencePlanner.ts`
3. 再把 `PlaybackSequence` 的最终字段定死并补单测
4. 再把 `prepare / subscribe / stop / releaseAll / dispose` 的语义写清楚
5. 最多只做 hook 的最小低风险接线，不删现有执行链

原因：

- 先定协议和 planner，后面 H5 / Native 才不会各写各的
- 可以避免一边改 hook，一边临时发明类型和事件
- 也更容易在阶段 1 结束时保持一个稳定、可继续推进的中间状态

---

### 5. App 注入改造放到阶段 2

当前：

```typescript
useManagedSampler()
  -> useExercisePlayback(sampler)
```

阶段 1 不要求切到：

```typescript
useManagedPlayer()
  -> useExercisePlayback(player)
```

真正的注入替换放到阶段 2，一次把浏览器链路跑通，不要分两阶段半改半留。

---

### 6. 补充最小单测

**重点覆盖场景：**

| 场景 | 说明 |
|------|------|
| 起始音非法 | 超出有效音域 |
| 超出可播放范围 | 上限/下限边界 |
| once 模式 | 单次循环 |
| up 模式折返 | 上行到顶折返 |
| down 模式折返 | 下行到底折返 |
| 不同 bpm 下 duration 计算 | 速度影响时值 |

---

## 验证标准

### ✅ 协议与数据层面

1. **共享协议已经稳定**
   - `PlayerAdapter` 的生命周期语义、事件语义、清理语义已经写清楚
   - `PlaybackSequence` 已经采用最终版字段，不再存在阶段 1 / 阶段 5 两套定义
   - 后续 H5 / Native 都必须复用这份共享协议

2. **planner 已经能独立产出纯数据**
   - 给定 `exercise + startNote + playMode + bpm + lowerBoundNote + upperBoundNote`
   - 可以独立得到一份 `PlaybackSequence`
   - 不依赖 Tone.js、AudioContext、React 组件生命周期

3. **最小单测已经覆盖关键 planner 场景**
   - 起始音非法
   - 超出可播放范围
   - `once / up / down` 三种模式
   - 不同 bpm 下 duration 计算

### ✅ 阶段边界层面

4. **阶段 1 完成后不要求浏览器 adapter 链路已经跑通**
   - 当前 H5 功能可以保持现状
   - 但后续阶段 2 要接的协议和 planner 已经就位
   - 不会出现“阶段 1 做到一半功能断档”的中间态

5. **阶段 1 完成后不引入 Capacitor 依赖**
   - 项目依然是普通 React + Vite + Tone.js Web 应用
   - 但结构已经具备迁移条件

6. **可以清楚回答"下一步 H5 跑通时改哪里"**

   做完后应该能明确说出：
   ```
   共享协议不动
   sequence planner 不动
   阶段 2 只需要实现 TonePlayerAdapter / useManagedPlayer / hook 接线
   ```

   如果还做不到这一点，说明阶段 1 其实没拆干净。

---

## 阶段 2：保留 H5，先把播放器抽象跑通

### 目标

让现在项目还能继续在浏览器里跑，但结构已经为原生做准备。

### 要做的是：

- ✅ 保留当前 Tone.js 版本作为 TonePlayerAdapter
- ✅ 让 useExercisePlayback 依赖 PlayerAdapter 接口，而不是直接依赖 MySampler

### 结果：

```
浏览器功能不变
代码已经准备好随时替换底层播放器
```

> 🎯 **这是迁移里最值钱的一步。**

### 这一阶段到底在做什么

阶段 1 解决的是“结构能不能拆开”。
阶段 2 解决的是“拆开的结构能不能在浏览器里真正跑通”。

说白了，这一阶段不是再谈抽象，而是要把下面这条链路真的跑起来：

```typescript
UI
  -> useExercisePlayback
  -> sequence planner
  -> PlayerAdapter
  -> TonePlayerAdapter
  -> Tone.Sampler
```

如果这条链路没有在 H5 环境下先跑顺，后面接 Capacitor 只会把问题扩大。

---

### 实施计划

### 1. 先把阶段 1 的抽象真正落到浏览器运行链路里

这一阶段默认前置条件是：

- `PlayerAdapter` 已定义
- `PlaybackSequence` 已定义
- `sequence planner` 已能产出纯数据序列
- `prepare / subscribe / stop / releaseAll / dispose` 的语义已写清楚

如果这几个前置条件没满足，就别自欺欺人说进入阶段 2。

**这一阶段要再补一条绝对原则：**

```text
阶段 2 的 sequence 虽然也是前端生成，但“执行权”仍在 H5 侧的 TonePlayerAdapter
```

也就是说：

- 前端 planner 负责生成 sequence
- `useExercisePlayback` 负责下发 sequence
- `TonePlayerAdapter` 负责在浏览器 / Web Audio 环境里执行 sequence

这和阶段 5 的本质区别不是“有没有 sequence”，而是“谁真正掌握节拍调度和执行权”。

---

### 2. 实现浏览器专用的 TonePlayerAdapter

新增或明确落位：

```text
src/audio/tonePlayerAdapter.ts
```

它的职责必须非常纯粹：

- 持有 `Tone.Sampler`
- 负责 `prepare()` 时机
- 负责 `AudioContext` 启动
- 负责把 `PlaybackSequence` 翻译成 Tone 可执行的播放动作
- 负责 `startNote()` / `stopNote()` / `stop()` / `releaseAll()`
- 负责在播放过程中向上层回报当前音符或播放结束
- 负责 sequence 执行期间的取消、错误回传和并发控制

它**不应该**负责：

- 练习合法性判断
- 起始音计算
- 音域边界校验
- 上下行折返规划
- UI 状态切换

> 💡 **原则：** TonePlayerAdapter 是执行器，不是业务脑子。

**`TonePlayerAdapter.playSequence()` 内部调度必须提前设计：**

- 必须自带可取消机制，例如内部 `runId`、`AbortController` 或等价状态位
- 每个 step 开始前发出 `noteStart`
- 全部 step 正常完成后发出 `sequenceComplete`
- 被 `stop()` 打断后发出 `stopped`
- 执行异常时发出 `error`
- `roundIndex / stepIndex` 由 planner 提供，adapter 只负责执行和回报，不负责推断业务模式
- 折返方向的 UI 同步仍归 hook 维护，adapter 不负责替你改 `playMode`
- 自动 sequence 播放中如果用户手动 `startNote()`，按策略 A 先打断 sequence，再响应手动输入

---

### 3. 明确运行时回调与订阅生命周期

这一步很容易被漏掉，但不做就是假抽象。

因为当前 UI 还需要：

- 自动播放时高亮当前音
- 结束后清理高亮状态
- 停止后同步清空状态

所以 `PlayerAdapter` 最好补上事件或回调机制，例如：

```typescript
type PlaybackEvent =
  | { type: 'noteStart'; note: string; stepIndex: number }
  | { type: 'sequenceComplete' }
  | { type: 'stopped' }
  | { type: 'error'; error: PlaybackError };
```

然后由 `useExercisePlayback` 订阅这些事件，更新：

- `autoCurrentNote`
- `activeExerciseId`
- `exerciseStartNote`
- `playbackError`

否则你会发现 hook 虽然“不直接调 Tone”，但仍然得自己手搓播放循环才能知道当前播到哪一步，那就白拆了。

**订阅所有权现在就要明确：**

- `useExercisePlayback` 负责订阅和取消订阅
- `useManagedPlayer` 只负责创建、准备和销毁 adapter 实例
- adapter `dispose()` 时要允许已有 listener 被安全清理，不要制造内存泄漏或悬空回调

---

### 4. 把 useManagedSampler 演进成 useManagedPlayer

建议把：

```text
src/hooks/useManagedSampler.ts
```

演进为：

```text
src/hooks/useManagedPlayer.ts
```

这个 hook 的职责应该是：

- 创建并持有 `TonePlayerAdapter`
- 管理 `prepare()` 生命周期
- 对外暴露统一的 `PlayerAdapter`
- 暴露 `isReady` 或等价状态给 UI
- 在组件卸载时调用 `stop()` / `releaseAll()` / `dispose()`

它不应该再把 Tone 的方法名原样透出去。

这里还要补一条：

- `prepare()` 失败后，`useManagedPlayer` 不能把实例做成一次性报废品
- 失败原因要能透给 UI
- 后续重试要有明确入口，不要把失败状态永久卡死在第一次初始化

换句话说，阶段 2 完成后，页面层看到的应该是“播放器能力”，而不是“采样器能力”。

---

### 5. 改造 App 注入路径，验证浏览器主流程

`src/App.tsx` 需要从：

```typescript
useManagedSampler()
  -> useExercisePlayback(sampler)
```

切到：

```typescript
useManagedPlayer()
  -> useExercisePlayback(player)
```

这里的关键不是改一行 import，而是确认整条浏览器主流程都还能工作：

1. 页面加载后播放器开始准备
2. 准备完成后 UI 可交互
3. 用户选练习，进入待命
4. 用户点起始音，planner 生成序列
5. `useExercisePlayback` 调用 `player.playSequence(sequence)`
6. `TonePlayerAdapter` 执行序列并通过事件回推当前音符
7. UI 跟随高亮
8. 播完后自动收尾

---

### 6. 把“自动练习”和“手动试音”都走统一入口

这是阶段 2 最重要的自检点之一。

浏览器里必须确认两条能力都已经收口到 adapter：

**自动练习路径：**

```typescript
planner -> playSequence()
```

**手动试音路径：**

```typescript
noteDown -> startNote()
noteUp -> stopNote()
```

如果手动试音还偷偷直接调 `sampler.triggerAttack()`，
那说明这一步根本没做完。

---

### 7. 明确这一阶段先不做的事

阶段 2 不要掺进这些东西：

- Capacitor 初始化
- Android / iOS 平台接入
- 原生插件桥接
- 后台音频
- 锁屏播放
- 原生侧序列调度
- 采样资源格式迁移

谁在阶段 2 就开始碰这些，谁就是在把问题重新搅浑。

---

### 8. 补足 H5 专项验证，而不是只看“能响”

这一阶段不是验证“浏览器里出声了”就结束。
至少要逐项确认下面这些浏览器侧行为：

- 首次用户手势后 `AudioContext` 能正常启动
- 采样资源加载完成前，UI 不会误进入可播放状态
- 自动播放期间当前音高亮能跟上实际播放
- 结束播放后高亮能清掉
- 点击停止后不会残留长音
- 连续切换练习不会产生并发播放
- 快速重复点击起始音不会把播放状态搞乱
- 手动试音与自动播放切换时不会互相污染状态

---

### 验收标准

### ✅ 浏览器功能必须完整保住

1. **H5 页面行为和阶段 1 前保持一致**
   - 练习选择正常
   - 待命状态正常
   - 起始音选择正常
   - 自动播放正常
   - 手动试音正常
   - 停止播放正常
   - 音域设置正常
   - 当前音高亮正常

2. **浏览器里不只是“能响”，而是整条播放链路闭环**
   - `planner` 能产出序列
   - `useExercisePlayback` 能把序列交给 `PlayerAdapter`
   - `TonePlayerAdapter` 能执行序列
   - 执行过程中的播放事件能驱动 UI 状态更新

### ✅ 架构边界必须清晰

3. **useExercisePlayback 不再关心 Tone 细节**
   - 不 import `Tone`
   - 不 import `MySampler`
   - 不直接调用 `triggerAttackRelease()`、`triggerAttack()`、`triggerRelease()`

4. **TonePlayerAdapter 不再承担业务规划职责**
   - 不计算起始音是否合法
   - 不判断音域边界
   - 不生成上下行折返序列
   - 不决定当前练习该怎么排 step

5. **页面层不再直接拿到 Sampler**
   - `App.tsx` 注入的是 `player`
   - 不是 `sampler`

6. **自动练习和手动试音共用同一套抽象**
   - 自动练习走 `playSequence()`
   - 手动试音走 `startNote()` / `stopNote()`
   - 停止走 `stop()` / `releaseAll()`

### ✅ 后续迁移可持续

7. **如果明天新增 NativePlayerAdapter，业务层不需要再拆一次**
   - `sequence planner` 不动
   - `useExercisePlayback` 只做极小改动或不改
   - UI 组件不改

8. **阶段 2 完成时，项目依然是纯 H5 项目**
   - 没有引入 Capacitor 平台依赖
   - 没有开始写原生插件
   - 没有把问题提前推到 Android / iOS 去“碰运气验证”

> 🎯 **一句话判断阶段 2 是否完成：**
>
> 浏览器里已经完全通过 `PlayerAdapter -> TonePlayerAdapter` 跑通全部功能，
> 这时底层播放器已经可替换，但产品行为没有回退。

---

## 阶段 3：接入 Capacitor 壳

### 目标

先把现有 web app 变成一个能跑在手机上的壳

### 在 Ubuntu 上先做：

1. 安装 Capacitor
2. 初始化 Capacitor
3. 添加 Android 平台
4. 验证现有 React 项目能跑进 Capacitor WebView

> ⚠️ **这一阶段先别碰原生插件。**

### 先确认：

- [ ] 页面能正常显示
- [ ] Canvas 键盘正常
- [ ] 交互正常
- [ ] 构建链不炸

### 这一阶段到底在做什么

阶段 2 解决的是：

```typescript
H5 浏览器里，抽象后的播放器链路已经跑通
```

阶段 3 解决的是：

```typescript
这套 H5 应用能不能被完整装进 Capacitor WebView 壳里正常运行
```

注意，这一步的目标不是“音频原生化”，而是“容器接入成功”。
也就是说，这一阶段要回答的问题只有一个：

> 现在这套 React + Vite + MUI + Canvas + Tone.js 页面，放进 Capacitor Android 壳里之后，会不会立刻炸掉？

如果这个问题都还没回答，就别往原生插件上冲。

---

### 实施计划

### 1. 明确阶段 3 的前置条件

进入阶段 3 之前，至少要满足：

- 阶段 2 已完成
- 浏览器 H5 版本功能稳定
- `PlayerAdapter -> TonePlayerAdapter` 链路已经跑通
- 当前构建产物可稳定通过 `npm run build`

如果连纯 H5 构建都还不稳定，接 Capacitor 只会把排错成本放大。

---

### 2. 引入 Capacitor 依赖，但先不碰原生音频

这一阶段需要做的是 Capacitor 容器初始化，而不是插件开发。
建议新增的依赖和基础能力包括：

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`

初始化目标是生成这些基础文件或目录：

- `capacitor.config.ts` 或 `capacitor.config.json`
- `android/`

这一步的重点不是“有文件就算完”，而是要把 Web 构建目录和 Capacitor 约定对上。

当前项目的构建脚本是：

```bash
npm run build
```

当前 Vite 默认输出目录预期是：

```text
dist/
```

所以 Capacitor 配置里的 `webDir` 必须与实际构建产物一致。

这一阶段还要把几个关键配置项提前定死：

- `appId`
- `appName`
- `webDir`

尤其是 `appId`，不要等后面 Android 工程已经跑起来了再改包名。

**环境前置条件也要写明：**

- 本机 Android SDK 已安装
- `ANDROID_HOME` 或等价环境变量可用
- JDK / Gradle 版本满足当前 Capacitor 版本要求
- Android Studio 可以正常打开并编译空壳工程

---

### 3. 建立固定的 H5 -> Capacitor 同步流程

阶段 3 不要靠手工乱点，应该形成固定命令链。
最小流程建议明确成：

```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

如果 `android` 平台已经添加过，后续主流程应当变成：

```bash
npm run build
npx cap sync android
npx cap open android
```

必要时可以在 `package.json` 里补脚本别名，但这一步的重点不是脚本花活，而是让团队知道：

- Web 代码改完先 build
- build 完再 sync
- sync 完再进 Android Studio 验证

否则你后面一定会遇到“改了代码但壳里还是旧页面”的低级混乱。

---

### 4. 先验证“页面能活着显示”，不要一开始盯着音频问题

Capacitor 壳接入后，第一轮验证顺序必须是：

1. 应用能启动
2. 首页能显示
3. MUI 样式正常
4. Canvas 键盘能渲染
5. 触摸/点击交互正常
6. 路由或静态资源路径没有炸

这一轮先不要求自动播放完美，只确认：

- WebView 能把页面完整载起来
- UI 布局和绘制没有因为容器环境改变而挂掉

因为如果连基础页面都显示不完整，谈音频就是在扯淡。

---

### 5. 重点排查 WebView 特有风险点

阶段 3 真正容易翻车的，不是“Capacitor 能不能装上”，而是这些 WebView 侧兼容问题：

- 静态资源路径是否正确
- `dist/` 产物是否被正确复制进原生工程
- Vite 构建后的资源引用是否能被 WebView 找到
- `import.meta.glob` 生成的音频资源 URL 是否能在 WebView 中被 Tone 正常加载
- Canvas 在 Android WebView 中是否尺寸正常、像素比正常
- 触摸事件在 WebView 中是否和浏览器表现一致
- 字体、图标、MUI 样式是否有缺失
- 首次用户手势后 Tone.js 在 WebView 中是否还能启动音频上下文

这一步先记录现象，不急着做原生音频方案。
当前目标只是分辨：

```text
问题是“容器接入问题”
还是“音频能力问题”
```

---

### 6. 把 PWA 相关行为列为专项观察项

当前项目启用了：

```text
vite-plugin-pwa
```

这个点在纯浏览器里很正常，但进 Capacitor WebView 后需要重点盯住：

- Service Worker 是否会导致资源缓存与壳内页面不同步
- 更新后是否出现“代码已 sync 但页面仍是旧版本”的假象
- PWA 注册逻辑是否会对 WebView 启动产生副作用

这一阶段先不要急着删 PWA。
正确做法是先验证它是否真的造成问题，再决定后续是否要对 Capacitor 环境单独降级或关闭。

---

### 7. 针对音频，只做“现状摸底”，不做原生化改造

阶段 3 对音频的要求非常克制，只需要回答：

- Tone.js 在 WebView 中能不能初始化
- 采样资源能不能正常加载
- 手动按键能不能发出声音
- 自动练习能不能基本跑起来
- 如果失败，是卡在用户手势、资源加载、AudioContext、还是 WebView 限制

这里**不做**：

- NativePlayerAdapter
- Android 原生采样器
- 原生序列调度
- 后台播放方案
- 锁屏恢复

一句话：

> 阶段 3 只确认“Web 音频放进壳里现状如何”，不是要把 Web 音频问题在这一阶段彻底治好。

---

### 8. 在 Android Studio 中形成最小验证闭环

Ubuntu 上这一阶段的实际落地环境应该是：

- 本地 `npm run build`
- `npx cap sync android`
- Android Studio 打开 `android/`
- 模拟器或真机运行

建议按这个顺序做最小闭环记录：

1. 首次成功启动壳应用
2. 确认首页 UI 正常
3. 确认钢琴 Canvas 正常
4. 确认点击和拖动正常
5. 确认手动试音行为
6. 确认自动练习行为
7. 记录失败现象与日志

这一步的价值不是“把所有问题修完”，而是把容器问题和业务问题彻底分层。

---

### 9. 阶段 3 先不做的事

这一步明确不做：

- iOS 平台接入
- Android 原生音频插件
- Capacitor 自定义插件开发
- 后台播放
- 锁屏控制
- 媒体会话控制
- 原生采样资源管理
- Web 音频到原生音频的切换

谁在阶段 3 把这些一起开工，谁就是在把阶段边界重新搞烂。

---

### 验收标准

### ✅ 容器接入必须成功

1. **项目可以被 Capacitor 正常包装为 Android 壳**
   - Capacitor 初始化完成
   - Android 平台添加完成
   - `npm run build` 后可成功 `npx cap sync android`
   - Android Studio 可以打开并运行工程

2. **Web 构建产物能被壳正确加载**
   - 壳应用启动后能看到首页
   - 页面不是空白页
   - 静态资源没有大面积 404 或丢失

### ✅ UI 与交互必须基本正常

3. **核心界面在 WebView 内表现正常**
   - MUI 样式正常
   - 页面布局未明显错乱
   - Canvas 键盘可见且绘制正常
   - 预览条与主键盘尺寸正常

4. **核心交互在 WebView 内可用**
   - 点击练习选择正常
   - 点击模式切换正常
   - 键盘点击正常
   - 键盘拖动与视窗移动正常
   - 触摸交互没有明显退化

### ✅ 音频现状必须被确认，但不要求原生化

5. **Web 音频在壳内的表现有明确结论**
   - Tone.js 是否能启动有明确结论
   - 手动试音是否可用有明确结论
   - 自动练习是否可用有明确结论
   - 若不可用，失败位置有明确记录

6. **阶段 3 不会把问题偷渡到原生插件阶段**
   - 没有开始写 Android 原生音频插件
   - 没有开始实现 NativePlayerAdapter
   - 没有开始做后台播放或锁屏方案

### ✅ 后续阶段可自然衔接

7. **阶段 3 结束后，已经能明确阶段 4 的输入**
   - 如果 Web 音频在壳内足够稳定，阶段 4 仍按“最小原生插件验证”推进
   - 如果 Web 音频在壳内明显不稳定，阶段 4 就更有必要且问题边界更清晰

8. **可以清楚回答“当前问题属于哪一层”**
   - 是 Vite 构建问题
   - 是 Capacitor 容器接入问题
   - 是 Android WebView 兼容问题
   - 还是 Tone.js / Web Audio 本身的问题

> 🎯 **一句话判断阶段 3 是否完成：**
>
> 现有 H5 应用已经被完整装进 Capacitor Android 壳中并成功跑起来，
> 页面与交互基本正常，Web 音频现状也已摸清，但还没有提前卷入任何原生音频实现。
---

## 阶段 4：最小 Android 原生音频插件

### 目标

不要一开始做完整播放序列，只做最小验证

### 第一版插件只需要这几个方法：

```typescript
prepareSamples(): Promise<void>;
playNote(note: string, durationMs?: number): void;
stopAll(): void;
```

### 前端最小测试：

做一个临时按钮验证：

- [ ] 点一个音能不能响
- [ ] 连续点几个音会不会稳定
- [ ] 切后台会怎么样

### 这一步主要验证：

- ✅ Capacitor 插件通信
- ✅ 原生采样加载
- ✅ 原生单音播放

### 这一阶段到底在做什么

阶段 3 解决的是：

```typescript
现有 H5 应用已经能装进 Capacitor Android 壳里跑起来
```

阶段 4 解决的是：

```typescript
Android 原生侧到底能不能稳定地“收到前端指令 -> 加载采样 -> 播出一个音”
```

注意，这一步依然不是“完整迁移音频系统”。
它只是要回答一个更具体的问题：

> 如果我不再完全依赖 WebView 里的 Tone.js，而是开始让 Android 原生播声音，最小链路能不能先打通？

这个问题如果不先用最小插件验证，后面直接做整套序列调度，只会死得更快。

---

### 实施计划

### 1. 明确阶段 4 的前置条件

进入阶段 4 之前，至少要满足：

- 阶段 3 已完成
- Capacitor Android 壳可以正常启动
- 页面、Canvas、交互在 WebView 中基本正常
- 当前 H5 版本音频现状已经摸清

如果壳都还没跑稳，就不要把问题甩给原生插件。

---

### 2. 插件目标只保留“最小可验证能力”

第一版 Android 原生音频插件只做三件事：

- `prepareSamples()`
- `playNote(note, durationMs?)`
- `stopAll()`

其中 `playNote(note, durationMs?)` 的阶段 4 语义要先写清楚：

- 传入 `durationMs` 时，按显式时长播放
- 不传 `durationMs` 时，按插件内部默认短音时长播放
- 阶段 4 不追求“按下持续发声直到单独 noteOff”，那是后续统一手动试音语义时再谈的事

这里要明确砍掉的内容：

- 不做 `playSequence()`
- 不做节拍调度
- 不做完整的当前播放位置回调体系
- 不做后台播放
- 不做锁屏控制
- 不做复杂状态同步

> 💡 **原则：** 先证明“原生单音能播”，再谈“原生自动练习怎么播”。

**但这里要补一条例外：**

阶段 4 虽然不做完整 sequence 进度回调，
但建议至少验证一次最小 Native -> JS 回传通道，例如：

- `prepareDone`
- `noteStarted`
- `noteStopped`
- `nativeError`

原因很简单：

- 阶段 4 如果只验证 JS -> Native 单向调用
- 到阶段 5 才第一次验证 Native -> JS 回传
- 那播放事件同步、UI 高亮、错误回传这些风险会被整体后移

所以阶段 4 不需要做完整回调系统，
但至少要证明“原生能把事件回给前端”。

---

### 3. 先定插件工程结构与线程边界，再做能力验证

阶段 4 推荐先走 **Capacitor local plugin**，不要一开始拆成独立 npm 包。

原因：

- 本阶段目标是最小验证，不是插件分发
- local plugin 更适合快速改 native 代码、反复调试和定位问题
- 等阶段 5 稳定后，再考虑是否有必要独立封装

音频线程边界也要提前写清楚：

- 插件入口可以由 Capacitor 主线程接收调用
- 真正的音频加载与播放不能假设长期占用主线程
- 如果实现依赖额外工作线程、音频引擎线程或回调线程，阶段 4 就要记录清楚
- 不要求一开始做复杂线程系统，但至少要避免“单次点音都把 UI 卡住”的低级事故

---

### 4. 原生插件先做“能力验证”，不要立刻替换主业务播放器

这一阶段最容易犯的错，就是刚写完插件就急着把主流程全部切过去。
这是不清醒的。

阶段 4 更合理的接入方式是：

- 先新增 Android 原生插件
- 先暴露最小 JS 调用封装
- 前端先做临时测试入口或调试按钮
- 先验证原生单音链路
- 暂时不要把 `useExercisePlayback` 的完整自动练习主流程切到原生

也就是说，这一阶段优先做：

```typescript
Debug Button -> Native Plugin -> playNote()
```

而不是立刻做：

```typescript
useExercisePlayback -> NativePlayerAdapter -> 整套自动练习
```

因为后者已经是阶段 5 的事情了，别乱越级。

---

### 5. 明确 Android 原生侧要验证的链路

阶段 4 的最小链路应该拆成 4 段：

1. 前端调用 Capacitor 插件方法
2. Android 原生插件收到参数
3. 原生侧完成采样资源准备
4. 原生侧把指定音符播出来，并可被 `stopAll()` 中断

只有这 4 段全通，才算原生音频最小验证成功。

当前阶段不要求：

- 多轮练习
- 自动上行/下行
- planner 下发完整 sequence
- 与现有练习状态机完全打通

---

### 6. 原生播放实现选型只看“短采样、低延迟、实现成本”

阶段 4 不要一上来追求“终极架构”，选型标准应该非常现实：

- 能快速加载短音频采样
- 能稳定触发单音播放
- 延迟足够低
- 能简单停止全部播放
- Android 侧实现复杂度可控

也就是说，这一步优先考虑的是“验证价值”，不是“架构完美”。

如果选型本身已经复杂到要先解决一堆线程、精确时钟、后台会话问题，
那你就是把阶段 5、阶段 7 的难题偷渡进来了。

**这里还必须提前确认一个关键技术点：**

```text
Android 原生侧打算怎么获得类似 Tone.Sampler 的“中间音高能力”？
```

当前 H5 侧的 Tone.Sampler 默认帮你处理了采样映射和变调问题。
但原生侧未必天然具备这一点。

当前 H5 侧已有一个很关键的现实约束：

- 采样文件数量约 61 个
- 资源体积约 2MB

所以阶段 4 的方案决策不能只靠感觉，至少要把当前资源规模带进判断。

所以阶段 4 至少要先做一个方向决策：

- 方案 A：接近 88 键全采样，原生只负责直接播放对应资源
- 方案 B：只保留部分采样点，原生侧自己做变调 / 重采样

这不是后期优化问题，而是会直接影响：

- 原生播放器技术选型
- 资源数量
- 音质预期
- 实现复杂度
- 阶段 4 能否快速落地

这一阶段不一定要把长期方案一次性定死，
但必须至少确认“最小验证版本走哪条路”。

---

### 7. 先解决采样资源怎么进 Android 原生

这一阶段一个非常实际的问题是：

```text
前端 H5 用的钢琴采样，Android 原生插件怎么拿到？
```

阶段 4 的重点不是一次性设计完长期资源体系，而是先打通最小路径：

- 明确原生插件使用哪一批最小采样资源
- 明确这些资源放在 Android 原生工程的哪个目录
- 明确音名到资源文件的映射关系
- 明确 `prepareSamples()` 成功和失败的判定

这一步先追求“可用”，不要急着做：

- 资源自动同步脚本大一统
- 全量采样压缩优化
- Android / iOS 共用资源流水线

先让它能播，再谈资源工程化。

---

### 8. 前端先加最小调试入口，不要直接污染正式交互

阶段 4 建议在前端加一个临时验证入口，例如：

- 调试按钮
- 开发用测试面板
- 简单原生音频测试页

这个入口只做几件事：

- 调 `prepareSamples()`
- 点一个固定音
- 点几个不同音
- 手动触发 `stopAll()`

这样做的好处是：

- 能把“插件问题”和“业务逻辑问题”分开
- 出问题时更容易定位是桥接、资源还是原生播放
- 不会把正式练习流程搅乱

谁一上来就直接把主键盘事件绑到原生插件上，谁就是在给自己制造排错地狱。

---

### 9. 记录失败维度，不要只记“没声音”

阶段 4 验证时，最没用的结论就是：

```text
没声音
```

你至少要把失败分成下面几类：

- 插件方法是否成功被调用
- 参数是否正确传到原生
- `prepareSamples()` 是否成功
- 资源是否成功找到并加载
- `playNote()` 是否真正触发
- 多次连续触发是否稳定
- `stopAll()` 是否能打断当前发声
- 前后台切换时行为是否变化

这样后面进入阶段 5 时，才知道问题卡在桥接、资源、播放内核，还是生命周期。

---

### 10. 给阶段 5 留好边界，不提前实现序列系统

阶段 4 和阶段 5 的边界必须非常硬：

**阶段 4 只验证：**

- 单音播放
- 插件通信
- 采样准备
- 停止控制

**阶段 5 才开始：**

- `playSequence()`
- sequence 数据下发
- 原生节奏调度
- 当前播放位置回调
- 自动练习状态同步

`PlaybackSequence` 这份共享协议可以提前在前端文档与类型层定死，
但阶段 4 不要提前实现原生 `playSequence()`、正式业务接线和完整状态同步。

---

### 11. 阶段 4 先不做的事

这一阶段明确不做：

- iOS 原生插件
- NativePlayerAdapter 全量替换
- 自动练习切到原生
- 原生完整播放序列实现与正式业务接线
- 原生节拍器 / 调度器
- 锁屏播放
- 后台恢复
- 媒体通知栏控制

阶段 4 的任务只有一句话：

> 用最小 Android 原生插件证明“原生采样单音播放这条路可行”。

---

### 验收标准

### ✅ 插件基础能力必须跑通

1. **Capacitor Android 插件已成功建立最小调用链**
   - 前端可以成功调用原生插件方法
   - 原生插件可以正常接收参数
   - 调用失败时前端能拿到明确错误

2. **`prepareSamples()` 有明确结果**
   - 成功时可以确认原生采样已准备完成
   - 失败时可以定位到资源缺失、路径错误或初始化失败

3. **`playNote()` 可以稳定播出单音**
   - 至少一个固定音可以正常播放
   - 多个不同音可以分别播放
   - 连续多次点击不会明显失稳或崩溃

4. **`stopAll()` 可以有效中断发声**
   - 正在播放时可被停止
   - 停止后不会明显残留长音

### ✅ 验证结果必须可用于下一阶段决策

5. **已经能清楚判断原生单音方案是否可行**
   - 插件通信可行或不可行
   - 原生采样加载可行或不可行
   - 原生单音播放可行或不可行

6. **如果失败，失败位置有明确归因**
   - 是 JS -> Native 桥接问题
   - 是 Android 资源加载问题
   - 是原生播放实现问题
   - 还是生命周期问题

### ✅ 阶段边界必须守住

7. **阶段 4 完成时，还没有提前做成“半套阶段 5”**
   - 没有实现 `playSequence()`
   - 没有把自动练习完整切到原生
   - 没有开始做原生节奏调度
   - 没有开始做播放进度回调体系

8. **主业务流程没有被草率替换**
   - 正式练习主流程仍可继续使用现有 H5 播放链路
   - 原生插件先通过临时测试入口或最小调试入口验证

### ✅ 后续扩展条件已具备

9. **阶段 5 的输入已经明确**
   - 已确认插件 API 形态可继续扩展
   - 已确认采样资源进入原生侧的路径
   - 已确认单音播放能力能作为 sequence 播放的基础

> 🎯 **一句话判断阶段 4 是否完成：**
>
> Android 原生插件已经能通过 Capacitor 成功收到前端指令、准备采样并稳定播出单音，
> 但还没有急着把完整自动练习和序列调度一起塞进去。

---

## 阶段 5：把"自动练习"改成序列下发

### 当前状态

- 已完成主链路迁移：自动练习已经改成“前端生成 `PlaybackSequence`，Android 原生执行 sequence”
- 正式练习在 Android 环境下已经通过 `NativePlayerAdapter -> Capacitor NativeAudio -> NativeAudioEngine` 执行
- `once / up / down` 三种模式已可用
- `stopSequence()` 已接入正式停止链路
- 手动试音与自动练习已按“策略 A：手动试音优先，直接打断当前自动 sequence”工作

### 已知限制

- Android 原生 sequence 当前使用 `Handler.postDelayed()` 调度，阶段 5 接受可感知但可接受的时序误差
- Native -> JS 的事件回传存在 bridge 开销，UI 高亮目前以“主观可用”为准，`< 50ms` 目标尚未做正式量化验收
- 当前 native sample fallback 的稳定可用音域为 `C1 - C8`
- `A0 / A#0 / B0` 超出当前 `SoundPool` 变调下限，不在本阶段支持范围内
- 前端 sequence 中的 `durationMs / noteDurationMs` 允许保留小数；Android 插件当前按整数毫秒解析，存在可接受的取整误差

### 目标

让前端不再自己逐音 `wait + trigger`，而是把一整条练习序列交给原生

### 前端生成的数据结构：

```typescript
type PlaybackSequenceStep = {
  note: string;
  durationMs: number;
  noteDurationMs: number;
  stepIndex: number;
  roundIndex: number;
};

type PlaybackSequence = {
  steps: PlaybackSequenceStep[];
  bpm: number;
  startNote: string;
  playMode: PlayMode;
};
```

### 交给原生插件：

```typescript
playSequence(sequence);
```

### 原生负责：

- 逐步播放
- 调度节奏
- 停止
- 回调当前播放位置给前端

> 🎯 **这里是整个迁移的真正转折点。**

### 这一阶段到底在做什么

阶段 4 解决的是：

```typescript
Android 原生已经可以收到指令并稳定播出单音
```

阶段 5 解决的是：

```typescript
自动练习的整条播放流程，不再由前端逐音调度，而是改成“前端产出 sequence -> 原生整体执行”
```

这一步才是迁移的真正分水岭。
因为从这里开始，前端不再负责“每一个音什么时候响”，前端只负责：

- 生成练习序列
- 发给原生
- 接收原生回传的播放进度
- 更新 UI 状态

也就是说，前端从“调度者”变成“编排者”，原生从“单音执行器”升级成“序列执行器”。

---

### 实施计划

### 1. 明确阶段 5 的前置条件

进入阶段 5 之前，至少要满足：

- 阶段 4 已完成
- Android 原生插件单音播放稳定
- `prepareSamples()` / `playNote()` / `stopAll()` 已可用
- sequence planner 已能在前端稳定产出纯数据序列
- `useExercisePlayback` 已经通过 `PlayerAdapter` 工作，而不是直接依赖 Tone

如果这些都没准备好，就别急着做 `playSequence()`。

---

### 2. 前端先把 sequence 数据模型钉死

阶段 5 的第一步不是写原生代码，而是把前端下发给原生的数据结构定清楚。
这一层必须足够稳定，因为后面 Android、iOS、UI 状态同步都会依赖它。

阶段 5 不是再发明一版新协议，而是沿用阶段 1 已经定死的共享定义。
如果这里还想改字段名，说明前面协议没有定稳。

建议以共享类型为准：

```typescript
type PlaybackSequenceStep = {
  note: string;
  durationMs: number;
  noteDurationMs: number;
  stepIndex: number;
  roundIndex: number;
};

type PlaybackSequence = {
  steps: PlaybackSequenceStep[];
  bpm: number;
  startNote: string;
  playMode: PlayMode;
};
```

其中：

- `durationMs`
  表示这一步总步长
- `noteDurationMs`
  表示实际发声音长，方便原生和 H5 对齐尾音处理
- `stepIndex`
  方便原生回调当前进度时前端准确定位
- `roundIndex`
  方便自动上行/下行折返时 UI 做更清晰的状态管理

这一步的目标是让 sequence 成为跨平台协议，而不是临时对象。

---

### 3. 把前端 planner 彻底收口成“只负责生成 sequence”

阶段 5 前端最核心的职责就是 planner。
它必须完整负责：

- 起始音解析
- 音域边界校验
- 自动上行 / 自动下行折返规划
- 每一步 note 计算
- 每一步 duration 计算
- 输出最终 `PlaybackSequence`

但它不再负责：

- `wait()`
- 逐音触发播放
- 逐步 sleep
- 播放停止时机控制

一句话：

> 前端 planner 只管“排谱子”，不管“演奏节拍”。

---

### 4. Android 原生插件新增 `playSequence()`

阶段 5 才开始给原生插件增加：

```typescript
playSequence(sequence)
```

它在原生侧要承担的新职责是：

- 接收完整 sequence
- 按顺序调度每个 step
- 在正确时机播放每个 note
- 支持停止中断
- 回调当前播放位置
- 在结束时回调 sequence 完成

这意味着原生插件从阶段 4 的“单音播放器”升级成“序列调度器”。

但这里要注意：

- 不要让前端继续 `wait + playNote()` 假装 sequence 播放
- 也不要把原生只做成循环调用单音的薄壳，节拍控制仍然留在前端

如果节拍控制还在前端，这一步就根本没迁成功。

---

### 5. 给插件设计最小播放事件回传协议

阶段 5 不只是“下发”，还必须“回传”。
否则 UI 根本不知道当前播到哪一步。

建议原生至少向前端回传这些事件：

```typescript
type NativePlaybackEvent =
  | { type: 'stepStart'; stepIndex: number; note: string; roundIndex: number }
  | { type: 'sequenceComplete' }
  | { type: 'stopped' }
  | { type: 'error'; message: string };
```

前端 `useExercisePlayback` 需要用这些事件来维护：

- `autoCurrentNote`
- `activeExerciseId`
- `exerciseStartNote`
- `playbackError`
- 停止和完成时的 UI 收尾

如果没有这层回传协议，UI 高亮和真实播放一定会逐渐漂。

**阶段 5 的绝对原则：**

```text
阶段 5 的 sequence 仍然由前端 planner 生成，但“执行权”已经切到 NativePlayerAdapter / Android 原生插件
```

也就是说，阶段 5 和阶段 2 的根本区别是：

- 阶段 2：H5 adapter 执行 sequence
- 阶段 5：Native adapter / 原生插件执行 sequence

不是 sequence 换了，而是 sequence 的调度宿主换了。

---

### 6. 改造 NativePlayerAdapter，而不是把 useExercisePlayback 重新写脏

阶段 5 的正确接入点应该是：

- 在 `NativePlayerAdapter` 内部封装 `playSequence()`
- 在 adapter 内部收发原生插件事件
- 对外继续暴露统一的 `PlayerAdapter`

而不是让 `useExercisePlayback` 开始直接调用 Capacitor 插件 API。

原则上这一阶段应该形成这样的链路：

```typescript
useExercisePlayback
  -> buildExerciseSequence()
  -> player.playSequence(sequence)
  -> NativePlayerAdapter
  -> Capacitor Plugin
  -> Android 原生序列执行
```

这样后面 iOS 才有机会复用同一层业务逻辑。

---

### 7. 把停止逻辑从“前端取消循环”升级成“原生停止序列”

当前 H5 逻辑里，停止播放本质上还是前端：

- 改 `runId`
- 终止后续循环
- `releaseAll()`

阶段 5 之后，自动练习的停止必须变成：

- 前端调用 `player.stop()`
- adapter 转发给原生 `stopSequence()` 或等价停止能力
- 原生终止后续调度
- 原生回传 `stopped`
- 前端再清理 UI 状态

否则表面上是“下发 sequence”，本质上还是前端在管理播放生命周期，还是没迁干净。

---

### 8. 手动试音和自动序列继续分层共存

阶段 5 只迁“自动练习”，不要求把所有交互都立刻统一成原生。

建议边界保持清楚：

- 手动试音仍然走 `startNote()` / `stopNote()`
- 自动练习改为 `playSequence()`

也就是说，这一阶段是：

```typescript
manual preview -> 单音接口
auto exercise -> 序列接口
```

不要为了“看起来统一”就把手动试音也强行绑进 sequence。
那样复杂度只会上涨，不会更优雅。

**但必须补一条冲突处理规则：**

当自动练习 sequence 正在原生侧播放时，如果用户又手动按下钢琴键，
系统必须有明确的一致性策略，不能到实现时再拍脑袋。

至少要在 TODO 里预先选定一种：

- 策略 A：手动试音优先，直接打断当前自动 sequence
- 策略 B：自动播放期间禁用手动试音输入
- 策略 C：允许手动试音与自动播放混音并发

从当前练声产品和实现复杂度看，优先建议：

```text
策略 A：手动试音优先，直接打断当前自动 sequence
```

原因：

- 用户主动输入优先级最高，更符合交互直觉
- 最容易保证 UI 状态和播放状态一致
- 最不容易把原生播放状态机搞脏

如果后面要改成别的策略，也应该在这一阶段明确记录，而不是留成隐性行为。

---

### 9. 先保证 Android 端序列稳定，再谈细节精度优化

阶段 5 的第一目标是：

- sequence 能完整播完
- step 顺序正确
- 停止能生效
- UI 跟得上

不是一上来就追求：

- 毫秒级极限精准调度
- 完美无缝衔接
- 多线程复杂时钟系统
- 后台连续播放

如果一开始就追求这些，你就是把阶段 7 的事情提前了。

**但已知限制要提前记录，不要装看不见：**

- 如果原生调度先用 `Handler.postDelayed()`、普通定时器或等价方案，阶段 5 允许存在可感知但可接受的时序误差
- Native -> JS 的 bridge 回传天然存在序列化与线程切换开销，UI 高亮不一定与真实发声完全零误差对齐
- 阶段 5 的目标是“足够稳定可用”，不是“现在就做到录音棚级时钟精度”

---

### 10. 阶段 5 先不做的事

这一阶段明确不做：

- iOS sequence 实现
- 锁屏/后台播放
- 媒体会话控制
- 完整跨平台同步恢复
- 长时间后台任务管理
- 阶段 7 的系统级音频策略

阶段 5 的唯一目标只有一句话：

> 让自动练习真正变成“前端生成 sequence，原生负责执行 sequence”。

---

### 验收标准

### ✅ 前端职责已经收口

1. **前端已经不再逐音调度自动练习**
   - `useExercisePlayback` 不再对自动练习做逐步 `wait()`
   - 不再逐音调用单音播放接口来模拟 sequence
   - 自动练习只负责生成 sequence 并调用 `playSequence()`

2. **前端可以稳定生成完整 `PlaybackSequence`**
   - `once` 模式正确
   - `up` 模式正确
   - `down` 模式正确
   - 音域边界正确
   - 起始音不合法时能正确报错

### ✅ 原生序列执行必须成立

3. **Android 原生插件可以接收并执行完整 sequence**
   - sequence 可以成功传入原生
   - step 顺序正确
   - duration 逻辑正确
   - 整段练习可以播完

4. **停止能力已经迁移到原生序列层**
   - 播放过程中可以停止
   - 停止后不会继续偷偷往后播
   - 停止后 UI 状态能正确复位

### ✅ UI 与播放进度必须对齐

5. **原生回传的播放事件可以驱动 UI**
   - 当前音高亮能在可接受延迟内跟上实际播放，目标是 < 50ms
   - 播放完成后高亮清除
   - 停止后状态清除
   - 出错时能显示明确信息

6. **自动练习主流程已经真正切到 sequence 通道**
   - 不是前端假调度
   - 不是原生单音接口的简单循环包装
   - 而是原生持有完整 sequence 执行权

### ✅ 阶段边界仍然清晰

7. **手动试音仍可正常工作**
   - 手动按键不因自动练习迁移而退化
   - 手动试音和自动 sequence 不互相污染状态

8. **阶段 5 完成时，还没有提前卷入后台/锁屏能力**
   - 没有开始做锁屏播放
   - 没有开始做后台恢复
   - 没有开始做媒体通知或系统音频会话控制

### ✅ 后续阶段可继续扩展

9. **阶段 6 的 iOS 输入已经明确**
   - sequence 协议已稳定
   - 播放事件协议已稳定
   - Android 方案已能为 iOS 提供实现参考

> 🎯 **一句话判断阶段 5 是否完成：**
>
> 自动练习已经真正从“前端逐音播放”迁移成“前端下发 sequence、原生执行 sequence、原生回传进度”，
> 同时 UI 状态还能和实际播放保持一致。

---

## 阶段 6：iOS 插件

> ⚠️ **这一步回家用 Mac 做。**

### 在 Mac 上：

```bash
npx cap add ios
open ios/App/App.xcworkspace
```

### 先跑真机

先实现和 Android 同级别的最小插件：

- `prepareSamples()`
- `playNote()`
- `stopAll()`
- 再到 `playSequence()`

> ⚠️ **这里先不要碰锁屏继续，先保证：**
> - 前台稳定
> - iPhone 真机采样可播
> - 序列播放正常

---

## 阶段 7：后台/锁屏

> ⚠️ **这是最后阶段，不是前置阶段。**

### 到这一步才做：

| 平台 | 配置项 |
|------|--------|
| iOS | AVAudioSession 后台音频配置 |
| Android | 后台播放策略 |

### 实现清单：

- [ ] 锁屏继续播放
- [ ] 切后台恢复
- [ ] 页面回前台状态同步

> 💡 **原则：先能播，再能稳，最后再能后台。**
