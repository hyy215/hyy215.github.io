---
title: Scheduler
date: 2025-07-11
icon: alpha-s-box-outline
category:
  - React
tag:
  - React Scheduler
---

> React Scheduler 的核心目标是**实现任务的优先级调度和时间切片**，让 React 能够在主线程空闲时分批处理任务，避免长时间阻塞页面，提高响应性和流畅度。这是 React 并发特性的基础。

本文基于 scheduler\@0.26.0 版本进行源码解读，围绕以下几点进行展开：

*   优先级调度
*   时间切片

## 任务

在 `React Scheduler` 中， **“任务”（Task）**是一个被调度系统追踪、管理和延迟执行的**最小单位的工作**，它代表着一个未来需要执行的函数，这些函数会在 `React` 渲染、状态更新等过程中作为调度单元被系统统一管理，比如：

*   `React` 的一次更新
*   一段延迟渲染逻辑
*   一个被 `startTransition()` 包裹的更新

### 任务结构

任务类型定义如下：

*  id：标识符（自增数值）
*  callback：要执行的回调函数
*  priorityLevel：任务的优先级
*  startTime：任务可执行的最早时间
*  expirationTime：任务的过期时间（优先级越高，值越小）
*  sortIndex：用于堆排序的字段

### 任务存储：最小堆

`Scheduler` 使用[**最小堆（Min Heap）**](https://github.com/facebook/react/pull/16245)存储任务，任何节点的任务都比其子节点优先级更高。

![最小堆](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/10af70cd09b1437e85c6a26c9f8b4939~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgWVlZWVk3Nzg4Mw==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzI4MDU5ODQyOTA4NDg5MyJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1753009997&x-orig-sign=aiFkizlC1iP2SPAt03wf1JPGCe8%3D)

任务被存储在两个堆中：

* `taskQueue`：存储实际执行的任务，调度时从中取出执行
* `timerQueue`：存储延时任务，到期后转移至 `taskQueue`

```js title='Scheduler.js' :line-numbers=79
var taskQueue: Array<Task> = [];
var timerQueue: Array<Task> = [];
```

堆操作方法如下：

| 方法     | 操作说明     | 时间复杂度      | 
| ------  | ------      | ----------    | 
| `push` | 插入任务，插入后上浮（`sift up`）调整位置  | `O(log n)` | 
| `peek` | 获取堆顶任务（优先级最高的任务） | `O(1)`     | 
| `pop`  | 移除堆顶任务，下沉（`sift down`）调整结构   | `O(log n)` | 

任务排序逻辑如下：

在插入、移除时，根据任务中的 `sortIndex`、`id` 对堆重新进行排序，确保堆顶位置的任务是最紧急的

```js title='SchedulerMinHeap.js' :line-numbers=91
function compare(a: Node, b: Node) {
  // Compare sort index first, then task id.
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
```

### 当前时间获取

`Scheduler` 通过 `getCurrentTime` 获取当前时间，用于调度优先级与切片时间判断

* 在支持 `performanece api` 的环境中，调用 [performance.now](https://developer.mozilla.org/zh-CN/docs/Web/API/Performance/now) ，它返回的是当前的时间戳的值（自创建上下文以来经过的时间）
* 否则，回退至 [Date.now](https://developer.mozilla.org/zh-TW/docs/Web/JavaScript/Reference/Global_Objects/Date/now)，通过记录初始时间并动态计算差值实现与 `performance.now()` 类似的效果

```js
const hasPerformanceNow =
  // $FlowFixMe[method-unbinding]
  typeof performance === 'object' && typeof performance.now === 'function';
  
 if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();   // [!code highlight]
} else {
  const localDate = Date;
  const initialTime = localDate.now();
  getCurrentTime = () => localDate.now() - initialTime;   // [!code highlight]
}
```

### 优先级机制

`Scheduler` 定义了如下优先级等级：

```js
export const NoPriority = 0;
export const ImmediatePriority = 1;
export const UserBlockingPriority = 2;
export const NormalPriority = 3;
export const LowPriority = 4;
export const IdlePriority = 5;
```

#### 优先级转换为时间

* 首先在函数入口，会传入 `priorityLevel`、[delay](https://github.com/facebook/react/pull/15911) 这两个参数

```js
function unstable_scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback,
  options?: {delay: number},
): Task {
```

* 调用 `getCurrentTime` 获取当前时间

```js
var currentTime = getCurrentTime();
```

* 根据 `delay`，重新计算任务的最早开始执行时间 `startTime`

```js
var startTime;
if (typeof options === 'object' && options !== null) {
    var delay = options.delay;   // [!code highlight]
    if (typeof delay === 'number' && delay > 0) {
      startTime = currentTime + delay;   // [!code highlight]
    } else {
      startTime = currentTime;   // [!code highlight]
    }
} else {
    startTime = currentTime;   // [!code highlight]
}
```

* 根据任务的优先级，确定任务的超时时间 `expirationTime`
    * 确认该优先级的超时时间 `timeout`（优先级越高，超时时间越短），例如紧急任务（`ImmediatePriority`) 对应的超时时间是 -1，相当于任务一进来就已经超期了
    * 在 `startTime` 的基础上加上 `timeout`，就是任务的超时时间

```js
var timeout;
switch (priorityLevel) {
  case ImmediatePriority:
    // Times out immediately
    timeout = -1;  // [!code highlight]
    break;
  case UserBlockingPriority:
    // Eventually times out
    timeout = userBlockingPriorityTimeout;   // 250  // [!code highlight]
    break;
  case IdlePriority:
    // Never times out
    timeout = maxSigned31BitInt;   // 1073741823  // [!code highlight]
    break;
  case LowPriority:
    // Eventually times out
    timeout = lowPriorityTimeout;   // 10000  // [!code highlight]
    break;
  case NormalPriority:
  default:
    // Eventually times out
    timeout = normalPriorityTimeout;   //  5000  // [!code highlight]
    break;
}

var expirationTime = startTime + timeout;   // [!code highlight]
```

#### 优先级排序

在了解堆的时候，介绍到堆排序与这两个数值相关 `id` 和 `sortIndex`
  * `id` 是一个自增变量，跟任务的先后顺序有关
  * `sortIndex` 则与是否是延时有关
      * 延时任务：`sortIndex = startTime`，进入 `timerQueue`
      * 非延时任务，`sortIndex = expirationTime`，进入 `taskQueue`

```js
var newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
};

if (startTime > currentTime) {
  // This is a delayed task.
  newTask.sortIndex = startTime;    // [!code highlight]
  push(timerQueue, newTask);   // [!code highlight]
  // ...
} else {
  newTask.sortIndex = expirationTime;   // [!code highlight]
  push(taskQueue, newTask);   // [!code highlight]
  // ...
}
```

## 时间切片（`Time Slicing`）

为防止任务长时间执行导致页面卡顿，`Scheduler` 引入时间切片的概念：限定每轮任务执行时间为约 `5ms`，超过后主动让出线程。

### 宏任务调度机制

`Scheduler` 根据运行环境选择不同的宏任务调度接口

接口 | 使用环境 | 优点 | 缺点
--- | --- | --- | ---
`setImmediate` |  `Node.js` 和 `IE` | 运行环境支持时的首选：[原因说明](https://github.com/facebook/react/issues/20756) | 仅部分环境可用 |
`MessageChannel` | 现代浏览器 | [消除 `setTimeout` 嵌套延迟](https://github.com/facebook/react/pull/16214#issuecomment-572473925) | 需浏览器环境支持 `MessageChannel`，在某些非浏览器环境中不可用 
`setTimeout` | 最低优先级回退方案 | 兼容性最好 | 存在嵌套宏任务触发延时增加问题： [嵌套超过 5 层将被强制设为 4ms 最小超时](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/setTimeout#%E5%BB%B6%E6%97%B6%E6%AF%94%E6%8C%87%E5%AE%9A%E5%80%BC%E6%9B%B4%E9%95%BF%E7%9A%84%E5%8E%9F%E5%9B%A0)；[调度性能不稳定](https://github.com/facebook/react/pull/20834#issuecomment-781451023)


```js
const localSetImmediate =
  typeof setImmediate !== 'undefined' ? setImmediate : null; // IE and Node.js + jsdom
  
let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === 'function') {
  schedulePerformWorkUntilDeadline = () => {  // [!code highlight]
    localSetImmediate(performWorkUntilDeadline);   // [!code highlight]
  };  // [!code highlight]
} else if (typeof MessageChannel !== 'undefined') {
  const channel = new MessageChannel();    // [!code highlight]
  const port = channel.port2;  // [!code highlight]
  channel.port1.onmessage = performWorkUntilDeadline;  // [!code highlight]
  schedulePerformWorkUntilDeadline = () => {    // [!code highlight]
    port.postMessage(null);    // [!code highlight]
  };   // [!code highlight]
} else {
  schedulePerformWorkUntilDeadline = () => {   // [!code highlight]
    localSetTimeout(performWorkUntilDeadline, 0);   // [!code highlight]
  };   // [!code highlight]
}
```

### 时间片检测

执行任务前，通过 `shouldYieldToHost()` 判断是否超时（当前时间是否超过`起始时间 + 5ms`）

```js
function shouldYieldToHost(): boolean {
  // ...
  
  const timeElapsed = getCurrentTime() - startTime;   // startTime 开始执行宏任务的时间
  if (timeElapsed < frameInterval) {   // frameYieldMs 默认就是 5ms   // [!code highlight]
    return false;
  }
  
  return true;
}
```

## 调度流程详解

### `advanceTimers`

将 `timerQueue` 中到期任务转移至 `taskQueue`，这个函数在接下来调度过程中会使用到

```js
function advanceTimers(currentTime: number) {
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
    } else {
      return;
    }
    timer = peek(timerQueue);
  }
}
```

### 执行调度

新增任务后通过 `requestHostCallback()` 触发调度

#### `requestHostCallback` 宏任务触发

当新增任务后，`Scheduler` 会尝试发起一次宏任务调度。核心流程如下：

* 首先将任务压入 `taskQueue`
* 接着检查是否**需要**触发新的宏任务：如果当前既没有在调度中（`isHostCallbackScheduled` 为 `false`），也没有正在执行任务（`isPerformingWork` 为 `false`），则调用 `requestHostCallback()` 开启调度循环。

```js
push(taskQueue, newTask);
// Schedule a host callback, if needed. If we're already performing work,
// wait until the next time we yield.
if (!isHostCallbackScheduled && !isPerformingWork) {
  isHostCallbackScheduled = true;
  requestHostCallback();
}
```

* `requestHostCallback()` 实现
    * 该函数的作用是调度一次宏任务，确保 `performWorkUntilDeadline()` 被尽快调用。为了避免重复调度，使用了 `isMessageLoopRunning` 变量作为保护：
 
```js
function requestHostCallback() {
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}
```

> ✅ `isMessageLoopRunning`：表示调度主循环是否已经在运行中，用于防止重复注册宏任务。  
> ✅ `isHostCallbackScheduled`：表示是否已经计划调度一次任务处理，防止重复计划。  
> ✅ `isPerformingWork`：表示当前是否正在执行任务，避免重入调度逻辑。

通过这套机制，Scheduler 能够**只在必要时发起调度**，避免宏任务滥用，同时确保任务能尽快被处理。


#### `performWorkUntilDeadline` 执行宏任务

当宏任务触发时，`performWorkUntilDeadline()` 是调度的主入口。它负责在时间片内执行任务，并根据是否还有剩余任务决定是否继续调度。

##### 准备阶段

* 若启用了 `enableRequestPaint`，则清除本轮绘制标记（该机制可用于提示浏览器尽快重绘）：

```js
if (enableRequestPaint) {
    needsPaint = false;
}
```

* 判断是否有任务循环正在运行(`isMessageLoopRunning`)
    * 此处获取的 `startTime` 是**当前调度轮次的起始时间**，用于后续进行**时间切片判断**（如 `shouldYieldToHost()`）以控制任务执行时间，避免阻塞渲染
 
```js
 if (isMessageLoopRunning) {
  const currentTime = getCurrentTime();
  startTime = currentTime;
```

##### `flushWork` 执行任务主流程

* 执行任务调度主函数 `flushWork(currentTime)`，返回值表示是否还有未完成的任务
```js
hasMoreWork = flushWork(currentTime);
```

* 若还有任务待执行，则通过再次调用 `schedulePerformWorkUntilDeadline()` 注册下一轮宏任务，继续调度；
    * 否则，将 `isMessageLoopRunning` 置为 `false`，等待下次新任务触发调度

```js
if (hasMoreWork) {
  schedulePerformWorkUntilDeadline(); // 下一帧继续执行剩余任务
} else {
  isMessageLoopRunning = false; // 调度结束
}
```

#### `flushWork` 调度任务执行入口

##### 执行前准备

* 标记当前宏任务已处理：

```js
isHostCallbackScheduled = false;
```

* 若存在定时任务，取消对应的延迟回调：

```js
if (isHostTimeoutScheduled) {
    // We scheduled a timeout but it's no longer needed. Cancel it.
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
}
```

* 将 `isPerformingWork` 置为 `true`，防止调度过程中再触发新调度：
    * 在调度结束后（`finally` 中），该标志会重置为 `false`。

```js
isPerformingWork = true;
```

```js
} finally {
  // ...
  isPerformingWork = false;
  // ...
}
```

#### `workLoop` 时间片内遍历并执行任务

`flushWork` 内部通过 `workLoop(initialTime)` 执行任务队列。

##### 处理延时任务

* 首先调用 `advanceTimers`，将已到期的任务从 `timerQueue` 转入 `taskQueue`：

```js
let currentTime = initialTime;
advanceTimers(currentTime);
```

##### `taskQueue` 遍历

```js
currentTask = peek(taskQueue);
```

对于每个任务：

* 判断是否应中断执行
    * 若任务未超期，且已超过 5ms 时间片，则让出线程（归还主线程给浏览器）：

```js
// 该值还是个实验性性质的值，暂不研究
export const enableAlwaysYieldScheduler = __EXPERIMENTAL__;

if (!enableAlwaysYieldScheduler) {
  if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
    // This currentTask hasn't expired, and we've reached the deadline.
    break;
  }
}
```

* 执行任务回调，将 `timerQueue` 中到期任务转移至 `taskQueue`
    * 回调返回函数表示后续任务，将其设为当前任务的回调方法，并暂停本轮调度，等待下一次执行
    * 若返回值为 `undefined`，说明任务已完成，将其从队列中移除

```js
const continuation = callback(didUserCallbackTimeout);
if (typeof continuation === 'function') {
  currentTask.callback = continuation;
  advanceTimers(currentTime);
  return true;
} else {
  pop(taskQueue);
  advanceTimers(currentTime);
}
```

* 如果当前任务没有回调，直接移除：

```js
pop(taskQueue);
```

* 继续遍历下一个任务

```js
currentTask = peek(taskQueue);
```

##### 任务执行完成后的处理

任务遍历结束后，`workLoop` 会判断是否还有任务：
* 如果仍有任务，返回 `true`，触发下一轮调度；
* 如果没有任务，但存在未来的定时任务，则设置定时器处理：

```js
if (currentTask !== null) {
  return true;
} else {
  const firstTimer = peek(timerQueue);
  if (firstTimer !== null) {
    requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
  }
  return false;
}
```

### 延时任务的处理机制

在前文中我们看到，**延时任务**（即 `startTime > currentTime`）在任务执行过程中会被自动处理（通过 `advanceTimers()`）。但如果当前没有普通任务（即 `taskQueue` 为空），延时任务通过定时器机制调度延时任务

#### 设置延时调度

当新任务是一个延时任务时（`startTime > currentTime`），`Scheduler` 会将其放入 `timerQueue`。此时会根据以下两种情况决定是否启动或重置定时器：
* `taskQueue` 为空（说明当前没有可执行的任务）
* 当前任务是 `timerQueue` 中最早到期的任务（最高优先级）

满足上述条件时，需开启或重置定时器，确保在 `startTime` 到达时触发调度：

```js
push(timerQueue, newTask);
if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
  // 当前没有普通任务，且这是最早到期的延时任务
  if (isHostTimeoutScheduled) {
    cancelHostTimeout();  // 取消旧的定时器
  } else {
    isHostTimeoutScheduled = true;
  }
  
  requestHostTimeout(handleTimeout, startTime - currentTime);
}
```

##### 定时器实现原理

* `cancelHostTimeout`：用于取消已设置的定时器，本质是 `clearTimeout`：

```js
const localClearTimeout =
  typeof clearTimeout === 'function' ? clearTimeout : null;
  
function cancelHostTimeout() {
  // $FlowFixMe[not-a-function] nullable value
  localClearTimeout(taskTimeoutID);    // [!code highlight]
  taskTimeoutID = ((-1: any): TimeoutID);
}
```

* `requestHostTimeout`：设置一个新的定时器（使用 `setTimeout`），等待延时任务的 `startTime` 到达：
    * `ms` 即表示延时任务还需要等待的时间：`startTime - currentTime`。

```js
const localSetTimeout = typeof setTimeout === 'function' ? setTimeout : null;

function requestHostTimeout(callback, ms) {
  taskTimeoutID = localSetTimeout(() => {   // [!code highlight]
    callback(getCurrentTime());  // [!code highlight]
  }, ms);   // [!code highlight]
}
```

##### `handleTimeout` 延时任务触发

当定时器触发后，会执行 `handleTimeout(currentTime)` 回调：
* `advanceTimers`：将 `startTime <= currentTime` 的任务从 `timerQueue` 转入 `taskQueue`
* 如果此时 `taskQueue` 中存在任务，立即触发调度；
* 否则，继续等待下一个延时任务到期，再次设置定时器。

```js
function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);  // 把已到期延时任务转入 taskQueue

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      // 如果 taskQueue 中已有任务，立即调度执行
      isHostCallbackScheduled = true;
      requestHostCallback();
    } else {
      // 否则重新设置定时器等待下一个延时任务
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}
```

## 流程图

### 函数入口（`unstable_scheduleCallback` 调度入口）

![`unstable_scheduleCallback` 调度入口](/assets/images/react/scheduler_unstable_scheduleCallback_调度入口.drawio.png)

### 任务调度流程

![任务调度流程](/assets/images/react/scheduler_调度流程.drawio.png)

### 延时任务流程（定时器触发）

![延时任务流程（定时器触发）](/assets/images/react/scheduler_延时任务流程（定时器触发）.drawio.png)