var React = require('react')
var _ = require('lodash')
var Immutable = require('immutable')

console.debug = function(){
  // console.log.apply(console, arguments)
}

var Everscroll = React.createClass({

  propTypes: {
    rowIndex: React.PropTypes.array.isRequired,
    idKey: React.PropTypes.string,
    renderRowHandler: React.PropTypes.func,
    reverse: React.PropTypes.bool,
    renderCount: React.PropTypes.number,
    onEndReached: React.PropTypes.func,
    onTopCursorChange: React.PropTypes.func,
    onBottomCursorChange: React.PropTypes.func,
    topCap: React.PropTypes.object,
    bottomCap: React.PropTypes.object,
    seekFrontThreshold: React.PropTypes.number
  },

  getDefaultProps: function() {
    return {
      idKey: 'ID',
      renderRowHandler: function(ID){
        return React.DOM.div({className:'row'}, ID)
      },
      reverse: false,
      renderCount: 30,
      throttle: 100,
      loadBuffer: 30,
      onEndReached: function () {},
      seekFrontThreshold: 20
    }
  },

  getInitialState: function() {
    console.debug('EVERSCROLL - getInitialState')
    return this.initialState()
  },

  componentWillReceiveProps: function(nextProps){
    console.debug('EVERSCROLL - componentWillReceiveProps', nextProps)
    var oldRowIndex = this.props.rowIndex
    var newRowIndex = nextProps.rowIndex

    // reset scroll and render if we go from now rows to rows
    if(oldRowIndex && oldRowIndex.length === 0 && newRowIndex && newRowIndex.length > 0){
      console.debug('EVERSCROLL - CWRP - FILL - empty to non-empty index')
      this.setState(this.initialState())
      this._initScroll = true
    }

    // detect prepend and adjust listOffset if necessary
    else if (oldRowIndex[0] !== newRowIndex[0]) {
      console.debug('EVERSCROLL - CWRP - PREPEND')
      var prependedMessageCount =
            Immutable
              .List(newRowIndex)
              .takeUntil(function (ref) {
                return oldRowIndex[0] === ref
              })
              .count()

      //@TODO discuss, how best to seek front, and how to set threshold
      var containerEl = this.refs.root.getDOMNode()
      if( this.props.seekFrontThreshold !== -1 && ((!this.props.reverse && containerEl.scrollTop < this.props.seekFrontThreshold) || (this.props.reverse && containerEl.scrollTop + containerEl.offsetHeight > containerEl.scrollHeight-this.props.seekFrontThreshold)) ){
        this._seekFront = true
      }
      this._scrollAfterUpdate = true

      //@TODO should detect if old message root is not in new row index and handle...
      this.setState({
        listOffset: this.state.listOffset + (this._seekFront ? 0 : prependedMessageCount),
        cursorRef: this.state.cursorRef + prependedMessageCount,
      })

      this._prependOffset = prependedMessageCount
    }

    else if (oldRowIndex[oldRowIndex.length - 1] !== newRowIndex[newRowIndex.length - 1]) {
      console.debug('EVERSCROLL - CWRP - APPEND')
      this.setState({listOffset: this.state.listOffset + 1})
    }

    if (this.props.renderCount >= newRowIndex.length) {
      process.nextTick(this.props.onEndReached)

    }
  },

  initialState: function (){
    //@TODO generalize this with the seek method
    if(this.props.initialSeekIndex){
      var self = this
      this._seek = {index: this.props.initialSeekIndex, pixelOffset: this.props.initialSeekPixelOffset || 0}
      process.nextTick(function(){
        self.handleScroll()
      })
    }

    var initialOffset = this.props.initialSeekIndex ? Math.max(this.props.initialSeekIndex-this.props.renderCount/2, 0) : 0
    return {
      listOffset: initialOffset,
      keyStart: 0,
      frontHeight: 0,
      backHeight: 0,
      cursorRef: 0
    }
  },

  shouldComponentUpdate: function(nextProps, nextState){
    console.debug('EVERSCROLL - shouldComponentUpdate')
    //@TODO: implement to prevent uncessary renders on prop changes
    return true
  },

  componentDidMount: function() {
    console.debug('EVERSCROLL - componentDidMount')
    this.handleScroll = _.throttle(this.handleScroll, this.props.throttle)
    this.calcAndTriggerCursors = _.throttle(this.calcAndTriggerCursors, 1000)
    this.initScrollTop()
  },

  componentWillUpdate: function(nextProps, nextState){
    console.debug('EVERSCROLL - componentWillUpdate & nextState.topCursorRef', nextState.topCursorRef, nextState)
    if (nextState.cursorRef){
      var containerEl = this.getDOMNode()
      var refOffset = this._prependOffset || 0
      this._prependOffset = 0;
      console.debug('CWU - cursorRef & refOffset', nextState.cursorRef, refOffset)
      this.targetCursorOffset = this.refs[nextState.cursorRef - refOffset].getDOMNode().offsetTop - containerEl.scrollTop
      console.debug('CWU - targetCursorOffset', this.targetCursorOffset)
    }
  },

  componentDidUpdate: function(prevProps, prevState){
    console.debug('EVERSCROLL - componentDidUpdate')

    var containerEl = this.getDOMNode()

    if (this.state.cursorRef){
      var currentCursorOffset = this.refs[this.state.cursorRef].getDOMNode().offsetTop - containerEl.scrollTop
      var adjustment = currentCursorOffset - this.targetCursorOffset
      console.debug('CDU - cursorRef', this.state.cursorRef)
      console.debug('CDU - currentCursorOffset', currentCursorOffset)
      console.debug('CDU - scrollTop adjustment', adjustment)
      containerEl.scrollTop += adjustment
    }

    if (this._initScroll) {
      this.initScrollTop()
      this._initScroll = false
    }

    //@TODO possible only call when requested instead of every update
    if(this._scrollAfterUpdate){
      this.handleScroll()
      this._scrollAfterUpdate = false
    }

    if(this._seekFront){
      containerEl.scrollTop = this.props.reverse ? containerEl.scrollHeight - containerEl.offsetHeight : 0
      this._seekFront = false
    }

    if(this._seek){
      var pixelOffset = this._seek.pixelOffset
      var seekIndex = this._seek.index
      if(this.refs[seekIndex]){
        var seekEl = this.refs[seekIndex].getDOMNode()
        if(containerEl){
          containerEl.scrollTop = seekEl.offsetTop - containerEl.offsetTop + (this.props.reverse ? pixelOffset + seekEl.offsetHeight - containerEl.offsetHeight : - pixelOffset)
          this._seek = undefined
        }
      }
    }

    // this.setCursors()
  },

  initScrollTop: function () {
    var containerEl = this.refs.root.getDOMNode()
    if (this.props.reverse) {
      containerEl.scrollTop = containerEl.scrollHeight - containerEl.clientHeight
    } else {
      containerEl.scrollTop = 0
    }
  },

  handleScroll: function(){
    console.debug('handleScroll')
    this.calcAndTriggerCursors()
    console.debug('this.props.rowIndex.length', this.props.rowIndex.length)

    if (this.props.rowIndex.length < this.props.renderCount) return;

    var reverse = this.props.reverse

    var cursorRef = this.calcCursorRef()
    var renderRange = this.getRefRenderRange()
    var refRange = this.getRefRange()

    var rowsAbove = Math.abs(renderRange.first() - cursorRef)
    var rowsBelow = Math.abs(cursorRef - renderRange.last())

    var direction = rowsAbove >= rowsBelow ? 1 : -1;
    direction = reverse ? direction * -1 : direction;
    var offsetAdj = Math.floor(Math.abs(rowsAbove - rowsBelow) / 2) * direction

    var minOffset = 0
    var maxOffset = this.props.rowIndex.length - this.props.renderCount

    var adjustedOffset = Math.min(Math.max(this.state.listOffset + offsetAdj, minOffset), maxOffset);
    var adjustedKeyStart = (this.state.keyStart + this.state.listOffset - adjustedOffset) % this.props.renderCount

    if (adjustedOffset === maxOffset && this.state.listOffset !== adjustedOffset) {
      process.nextTick(this.props.onEndReached)
    }

    var averageHeight = this.refs.renderRows.getDOMNode().scrollHeight / renderRange.count()
    console.debug('averageHeight', averageHeight)

    var shift = adjustedOffset - this.state.listOffset
    var backSpacerHeight = (this.props.rowIndex.length - refRange.last() - 1 - shift) * averageHeight
    var frontSpacerHeight = (refRange.first() + shift) * averageHeight

    var topSpacerHeight = this.props.reverse ? backSpacerHeight : frontSpacerHeight
    var bottomSpacerHeight = this.props.reverse ? frontSpacerHeight : backSpacerHeight

    console.debug('handleScroll state ', {
      cursorRef: cursorRef,
      listOffset: adjustedOffset,
      keyStart: adjustedKeyStart,
    })

    this.setState({
        cursorRef: cursorRef,
        listOffset: adjustedOffset,
        keyStart: adjustedKeyStart,
        frontHeight: frontSpacerHeight,
        backHeight: backSpacerHeight,
      })
  },

  setCursors: function() {
    console.debug('setCursor')

    var cursorRef = this.calcCursorRef()

    if (this.state.cursorRef === cursorRef) {
      console.debug('cursors are the same, no state update')
      return
    }

    console.debug('new cursor', {
      cursorRef: cursorRef,
    })

    this.setState({
      cursorRef: cursorRef,
    })
  },


  /**
   * Calculates the top and bottom custors, and calls onChange callback props if present
   * Exists purely for the efficient calculation and triggering on onChange props, and
   * does not have any internal side effects.
   */
  calcAndTriggerCursors: function() {
    //If no listeners, return immediately
    if(!this.props.onTopCursorChange && !this.props.onBottomCursorChange ){ return }

    var containerEl = this.refs.root.getDOMNode()

    var topThreshold = containerEl.scrollTop
    var topCursor = null
    var bottomThreshold = containerEl.scrollTop + containerEl.offsetHeight
    var bottomCursor = null

    var self = this
    var firstClear = null
    var clearTopThreshold = function(ref){
      var node = self.refs[ref].getDOMNode()
      return node.offsetTop > topThreshold
    }
    var clearBottomThreshold = function(ref){
      if(firstClear === null){ firstClear = ref }
      var node = self.refs[ref].getDOMNode()
      // console.log('check bot', node.offsetTop + node.offsetHeight, bottomThreshold)
      return (node.offsetTop + node.offsetHeight) > bottomThreshold
    }

    var refRange = this.getRefRenderRange()
    var visibleRange =
          refRange
            .skipUntil(clearTopThreshold)
            .takeUntil(clearBottomThreshold)
            // .filter(function(ref){return self.refs[ref]})

    var topCursorRef = visibleRange.first() || firstClear
    var bottomCursorRef = visibleRange.last() || firstClear + 1

    if(this.props.onTopCursorChange){ this.props.onTopCursorChange(this.props.rowIndex[topCursorRef], topCursorRef) }
    if(this.props.onBottomCursorChange){ this.props.onBottomCursorChange(this.props.rowIndex[bottomCursorRef], bottomCursorRef) }
  },

  calcCursorRef: function() {
    //get container
    var containerEl = this.refs.root.getDOMNode()
    var threshold = containerEl.scrollTop + containerEl.clientHeight / 2

    var self = this
    var clearThreshold = function(ref){
      var node = self.refs[ref].getDOMNode()
      //If reverse subtract offsetheight (so threshold relative to bottom of node instead of top)
      return node.offsetTop > threshold - (self.props.reverse ? node.offsetHeight : 0)
    }

    var refRange = this.getRefRenderRange()

    var cursorRef =
          refRange
            .filter(function(ref){return self.refs[ref]})
            .takeUntil(clearThreshold)
            .last()
            ||
          refRange.first()

    return cursorRef
  },

  getRefRange: function () {
    var rangeStart = this.state.listOffset
    var rangeEnd = rangeStart + Math.min(this.props.renderCount, this.props.rowIndex.length)

    return Immutable.Range(rangeStart, rangeEnd)
  },

  getRefRenderRange: function() {
    var refRange = this.getRefRange()
    return this.props.reverse ? refRange.reverse() : refRange
  },

  getKeyList: function() {
    var keyStart = this.state.keyStart

    var basicRange = Immutable.Range(0, this.props.renderCount)

    return basicRange.slice(keyStart).toList().concat(basicRange.slice(0, keyStart).toList())
  },

  renderRow: function(ID, index){
    return this.props.renderRowHandler(ID, index)
  },

  seek: function(index, pixelOffset){
    var self = this
    this.setState({listOffset: index, cursorRef: null})
    this._seek = {index: index, pixelOffset: pixelOffset || 0}
    process.nextTick(function(){
      self.handleScroll()
    })
  },

  render: function() {
    var rev = this.props.reverse && true

    var refRange = this.getRefRange()

    var rows = this.props.rowIndex.slice(refRange.first(), refRange.last() + 1)
    var refs = this.getRefRenderRange().toArray()
    var keys = this.getKeyList().map(function(val){return "everrow-" + val}).toArray()

    var topSpacerHeight = rev ? this.state.backHeight : this.state.frontHeight;
    var bottomSpacerHeight = rev ? this.state.frontHeight : this.state.backHeight;

    if (rev) {
      rows.reverse()
    }

    console.debug('EVERSCROLL - render', this.state.listOffset, refRange.first())

    var self = this
    var renderRows = rows.map(function(ID, index){
      return (
        React.DOM.div({style:{overflow: "hidden"}, key:keys[index], ref:refs[index]},
          self.renderRow(ID, refs[index])
        )
      )
    })

    return (
      React.DOM.div({ref:"root", style: this.props.style, className: this.props.className, key: this.props.key, onScroll: this.handleScroll},
        React.DOM.div({ref:"topCap"},
          (this.props.reverse ? this.props.backCap : this.props.frontCap)),
        React.DOM.div({ref:"topSpacer", style: {height: topSpacerHeight} }),
        React.DOM.div({key:"renderRows", ref:"renderRows"},
          renderRows
        ),
        React.DOM.div({ref:"bottomSpacer", style:{height: bottomSpacerHeight} }),
        React.DOM.div({ref:"bottomCap"},
          (!this.props.reverse ? this.props.backCap : this.props.frontCap))
      )
    )
  }
})

module.exports = Everscroll
