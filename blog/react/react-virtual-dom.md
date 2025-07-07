---
title: React 源码解析（一） —— Virtual DOM
date: 2020-05-06
icon: lightbulb-on-outline
category:
  - React
tag:
  - React 源码解析
---

> ### 什么是虚拟 DOM
> 
> 虚拟的 `DOM`，仅存在于内存中，不会实际渲染到页面上。
>
> 例如 `document.createElement("div")`，这就是我们之前常见的虚拟 `DOM`，它并不会对页面产生任何影响
> 
> `var vdom = document.createElement("div");`
> 
> 但当我们通过 `append`、`html` 等 `API` 进行操作后，虚拟 `DOM` 就能挂到真正的 `DOM` 节点上，然后在页面上渲染出来
> 
> `document.body.append(vdom);`

本节我们仅解析 `React` 是怎么把代码转换成虚拟 `DOM`，渲染 `render` 的步骤，放到下节再细讲。

### React 下的虚拟 DOM

`React` 通过 `React.createElement`，创建`js` 对象 (即 虚拟 `DOM`)

```
// JSX 最后也会被 babel 转为 React.createElement
const element = (
  <h1 className="greeting">
    Hello, world!
  </h1>
);

// 使用 React.createElement 创建
const element = React.createElement(
  'h1',
  {className: 'greeting'},
  'Hello, world!'
);
```

两者最后都会被 `React` 转换成 `js` 对象

```js
// 简化过的结构
const element = {
    type: 'h1',
    props: {
        className: 'greeting',
        children: 'Hello, world!'
    }
};
```


![](https://user-gold-cdn.xitu.io/2020/4/25/171b19044d75aa5a?w=598&h=467&f=png&s=25816)

### 源码分析

为了更好的理解，已将源码简化（版本为 16.13.1）

#### export createElement

实际导出 `createElementWithValidation` 函数

```js
// 对外暴露 createElement 方法
// 实际输出 createElementWithValidation 这个函数
var createElement$1 =  createElementWithValidation ;
exports.createElement = createElement$1;
```

#### createElementWithValidation

校验入参是否合法，并通过 `function createElement` 创建对象的 `js` 对象 

```js
/**
* 入参解释：
* type: html 元素、React 自定义组件等
* props: 属性，例如 className 对应元素的 class，该参数可选
* children: 子节点
*/
function createElementWithValidation(type, props, children) {
    // 校验入参 type
    var validType = isValidElementType(type);
    if(!validType) throw Error;
    
    // 将传入的参数转换成 js 对象
    var element = createElement.apply(this, arguments); 
    
    if (element == null) {
        return element;
    } 

    // 校验子集
    if (validType) {
        for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], type);
        }
    }
    
    // 校验
    if (type === REACT_FRAGMENT_TYPE) {
        validateFragmentProps(element);
    } else {
        validatePropTypes(element);
    }

    return element;
}   
```

#### createElement

* 处理第二个入参

将 `ref`、 `key`、 `__self`、 `__source` 提取出来，分别赋值给 `ref`、 `key`、 `self`、 `source` 这 4 个参数

其余参数则添加到 `props` 对象上

例如 `React.createElement("div", {className: 'greeting'}, 'Hello, world!')`，则 `props.className = 'greeting'`

* 处理子节点

将子节点赋值给 `props.children`

比如上例， `props.children = 'Hello, world!'`

如果存在多个子节点，则将他们转成数组后再赋值， `props.children = [children1, children2, ...]`

* 处理 `defaultProps`

如果定义过 `defaultProps` 的属性值不存在，则将 `defaultProps` 对应的属性值添加到 `props` 对象上

* 将 `ref`、 `key` 定义到 `props` 上

`ref`、 `key` 通过 `object.defineProperty` 添加到 `props` 对象上，并定义了 `get` 属性，如果读取 `props.ref`、`props.key` 就会报错

* `function ReactElement` 

整合上述属性，返回 `js` 对象

```js
function createElement(type, config, children) {
    var propName;

    var props = {};
    var key = null;
    var ref = null;
    var self = null;
    var source = null;

    // 处理入参 config
    if (config != null) {
    
        // 将 config 中的 ref、key、__self、__source, 分别赋值给对应的变量
        if (ref 存在 && ref 合法) {
            ref = config.ref;
        }
        if (key 存在 && key 合法) {
            key = '' + config.key;
        }
        self = config.__self === undefined ? null : config.__self;
        source = config.__source === undefined ? null : config.__source;

        // 除上述 4 个变量外，config 中的其他值都赋值给 props
        // RESERVED_PROPS = {
        //     key: true,
        //     ref: true,
        //     __self: true,
        //     __source: true
        // }
        for (propName in config) {
            if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
            }
        }
    } 

    // 处理子节点
    var childrenLength = arguments.length - 2;

    if (childrenLength === 1) {
        // 只有一个子节点的，直接赋值
        props.children = children;
    } else if (childrenLength > 1) {
        // 多个子节点的话，则
        var childArray = Array(childrenLength);
        
        for (var i = 0; i < childrenLength; i++) {
            childArray[i] = arguments[i + 2];
        }

        {
            // 冻结子节点，无法对子节点进行修改
            if (Object.freeze) {
                Object.freeze(childArray);
            }
        }

        props.children = childArray;
    }

    // 处理默认的 props 的属性值
    if (type && type.defaultProps) {
        var defaultProps = type.defaultProps;

        for (propName in defaultProps) {
            // 如果 defaultProps 对应的值不存在，则直接使用默认值
            if (props[propName] === undefined) {
                props[propName] = defaultProps[propName];
            }
        }
    }

    {   
        // 如果存在 ref、key，则将他们也定义到 props上
        if (key || ref) {
            var displayName = typeof type === 'function' ? type.displayName || type.name || 'Unknown' : type;

            if (key) {
                Object.defineProperty(props, 'key', {
                    get: warnAboutAccessingKey,   // 定义了个方法，如果读取，就会报错
                    configurable: true
                });
            }

            if (ref) {
                Object.defineProperty(props, 'ref', {
                    get: warnAboutAccessingRef, // 定义了个方法，如果读取，就会报错
                    configurable: true
                });
            }
        }
    }

    return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
}
```

#### `ReactElement`

返回 `js` 对象结构如下

```js
{
    $$typeof: REACT_ELEMENT_TYPE, // 用于表示是 React 元素
    type: type,
    key: key,
    ref: ref,
    props: props,
    _owner: owner // 创建该元素的组件，默认为 null,
    _store: {
        validated: false
    }
    _self: self,
    _source: source
}
```

除了之前已经解析过的 `ref`、 `key`、 `self`、 `source`、 `props`，还新增了 `$$typeof`、 `_owner` 、`_store` 属性

```js
var ReactElement = function (type, key, ref, self, source, owner, props) {
    var element = {
        // 表示是 React 元素
        $$typeof: REACT_ELEMENT_TYPE,  
        // 余下为内置属性
        type: type,
        key: key,
        ref: ref,
        props: props,
        // 创建该元素的组件
        _owner: owner
    };

    { 
        element._store = {};

        Object.defineProperty(element._store, 'validated', {
            configurable: false,
            enumerable: false,
            writable: true,
            value: false
        }); 
        
        // self和source是仅用于开发环境
        Object.defineProperty(element, '_self', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: self
        });
        Object.defineProperty(element, '_source', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: source
        });

        if (Object.freeze) {  // 冻结 props，不允许其被修改
            Object.freeze(element.props);
            Object.freeze(element);
        }
    }

    return element;
};
```

参考文献：
* [React 官网](https://zh-hans.reactjs.org/)
* [The difference between Virtual DOM and DOM](https://reactkungfu.com/2015/10/the-difference-between-virtual-dom-and-dom/)
* [React虚拟DOM和DIFF算法](https://github.com/Wscats/react-tutorial/issues/13)