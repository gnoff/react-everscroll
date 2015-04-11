# react-everscroll
Performant large lists and infinite scrolling in React.

**Large Lists** are problematic because the browser will render every dom element it is given, even if the element is hidden, consequently large lists in DOM will destroy browser performance. Everscroll solves this by rendering only a portion of your list at any given time, and recycling dom elements to render new list rows as you scroll.

**Infinite Scrolling** becomes trivial, simply add new data to the index prop. Everscroll will invoke `onEndReached` prop so you know when to query for more data.

## Dependencies
Assumes use of Babel or similar tool for ES6 to 5 transpiling and JSX compilation
Component also currently depends on Immutable and lodash though these could be removed with a little effort (pull request if interested)

## Usage
```js
function renderRow(ID){
  return <div className="row">{ID}</div>
}

<Everscroll
  rowIndex={this.state.index.toArray()} // an index of IDs to render
  renderCount={100} // how many rows to render at a time
  reverse={true} // Whether the beginning of the list be at the top of the container (false) or the bottom (true)
  onEndReached={this.loadPastMessages} // called when the end of the index is reached. Useful for infinite loading
  renderRowHandler={renderRow} // given an element of your index, return your rendered row
  backCap={<InfiniteLoadingSpinner />} // content will be placed at the end of your list
  frontCap={<LoadMoreButton />} // frontCap will be placed at the start of your list
  />
```

## Yet Another . . .
There are a number of well made react infinite list components. While we have not tried them all, most have some limitations such as requiring fixed height rows, poor performance, or not having a "reverse" mode.

Everscroll seeks to address all of these issues with a small and intuitive api.

If you have a use case that is not covered by the current API, make a feature request!
