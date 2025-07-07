---
title: React Redux 使用小记
date: 2020-05-06
icon: "lead-pencil"
category:
  - React
tag:
  - React Redux
---

> React Redux 将组件分为了 UI 组件和容器组件
>
> UI 组件只负责 UI 显示，没有状态（即不使用 this.state 这个变量），数据都由 this.props 提供，也不参与 Redux 任何 API
>
> 容器组件负责管理数据和业务逻辑，不负责 UI 的呈现，带有内部状态，使用 Redux 的 API

通过一个计数器的小例子，来理解 `React Redux`

### 先定义一个 `UI` 组件

在组件中，我们需要一个 `this.props` 传过来的 `value`、`data`、`onIncreaseClick` 这三个值，这个需要容器组件来提供

```jsx
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.onIncreaseClick = this.props.onIncreaseClick;
  }

  onIncreaseClickFunc = () => {
    this.onIncreaseClick('increase')
  }

  render() {
    const { value, data } = this.props;
    return (
      <div>
        <div>{value}</div>
        <div>{data}</div>
        <button onClick={this.onIncreaseClickFunc}>Increase</button>
      </div>
    )
  }
}
```

### 容器组件

`React Redux` 提供 `connect` 方法，将 `UI` 组件生成容器组件

* `connect`

将 `UI` 组件 `Counter` 通过 `connect` 方法，生成容器组件 `Test1`

`connect` 接受这两个参数 `mapStateToProps`、 `mapDispatchToProps`

```js
const Test1 = connect(
  mapStateToProps,
  mapDispatchToProps
)(Counter)
```

* `mapStateToProps`

这个函数将接受容器组件中的状态，并返回给 `UI` 组件其所需要的同名对象

它会订阅 `Redux` 中的 `store`，当 `store` 中的数据发生变化时，`state` 也会发生改变，进而触发 `UI` 组件的重新渲染；如果不需要触发 `UI` 更新，则将该参数设置为 `null` 或者 `undefined` 即可

同时，该函数 `mapStateToProps(state, ownProps)` 的第二个参数，其值为显示组件外部传入的 `props`

```js
function mapStateToProps(state, ownProps) {
  return {
    value: state.counter ? state.counter : 0,
    data: state.data ? state.data : ownProps.data,
  }
}
```

* `mapDispatchToProps`

建立 `UI` 组件与 `store.dispatch` 方法的映射关系，即定义哪些用户操作应该当做 `Action`

```js
// 创建 Action 函数，返回对应的 Action 对象
function increaseAction(data) {
  return ({
    type: 'increase',
    data: 'increase'
  })
}

// UI 组件中对应的 dispath 方法
function mapDispatchToProps(dispatch) {
  return {
    onIncreaseClick: (data) => dispatch(increaseAction(data))
  }
}
```

### 让容器组件拿到 state 对象

`React Redux` 提供 `<Provicer>` 组件，可以让容器组件拿到 `state`

`Test1`、 `Test2` 所有的子组件默认都可以拿到 `state`了

```jsx
<Provider store={store}>
    <Test1 />
    <Test2 />
</Provider>
```


### 完整例子 

```jsx
import React, { Fragment } from 'react';
import { createStore } from "redux";
import { connect } from 'react-redux';
import { Provider } from "react-redux";

//  UI 组件
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.onIncreaseClick = this.props.onIncreaseClick;
  }

  onIncreaseClickFunc = () => {
    this.onIncreaseClick('increase')
  }

  render() {
    const { value, data } = this.props;
    return (
      <Fragment>
        <div>{value}</div>
        <div>{data}</div>
        <button onClick={this.onIncreaseClickFunc}>Increase</button>
      </Fragment>
    )
  }
}

// 这个函数将接受容器组件中的状态，并返回给 `UI` 组件其所需要的同名对象
function mapStateToProps(state, ownProps) {
  return {
    value: state.counter ? state.counter : 0,
    data: state.data ? state.data : ownProps.data,  // ownProps，由组件外部传入的 props 决定
  }
}

//  生成 Action
function increaseAction(data) {
  return ({
    type: 'increase',
    data: 'increase'
  })
}

// 建立 UI 组件与 store.dispatch 方法的映射关系
function mapDispatchToProps(dispatch) {
  return {
    onIncreaseClick: (data) => dispatch(increaseAction(data))
  }
}

// 通过 connect 方法，将 UI 组件 Counter 生成容器组件 Test1
const Test1 = connect(
  mapStateToProps,
  mapDispatchToProps
)(Counter)

// 如果 connect 第一个参数传 null / undefined，则 store 的变化，不会引起 UI 组件的重新渲染
const Test2 = connect(
  null,
  mapDispatchToProps
)(Counter)

// 创建 Reducer 函数，并设置 state 默认值
function reducer(state = {counter: 0, data: ''}, action) {
  const { counter } = state;
  const { type, data } = action;
  switch(type) {
    case 'increase':
      return {    
          counter: counter + 1,
          data: data
      };
    default:
      return state;
  }
}

// 生成 store
let store = createStore(reducer);

function App() {
  return (
    <Provider store={store}>
      <p>store 变化会引起 UI 界面的重新渲染</p>
      <Test1 data={'什么'} />
      <p>mapStateToProps 为 null, store 变化不会引起 UI 界面的重新渲染</p>
      <Test2 data={'什么'} />
    </Provider>
  )
}

ReactDOM.render(
    <App />,
    document.getElementById('root')
);
```


![](https://user-gold-cdn.xitu.io/2020/5/6/171e8b76b58c99ea?w=605&h=447&f=gif&s=121491)

### 参考链接
* [React Redux](https://react-redux.js.org/)
* [Redux 入门教程（三）：React-Redux 的用法](https://www.ruanyifeng.com/blog/2016/09/redux_tutorial_part_three_react-redux.html)