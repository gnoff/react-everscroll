var React = require('react');
//@TODO remove lodash (currently used for throttling)
var _ = require('lodash');
var Immutable = require('immutable');

console.debug = function(){
  // console.log.apply(console, arguments)
}

var Everscroll = React.createClass({

  /**
   * Baseline State
   * @type {Object}
   */
  _initialState: {
      listOffset: 0,
      keyStart: 0,
      frontHeight: 0,
      backHeight: 0,
  },

  /**
   * Transient State
   */
  _prependOffset: 0,
  _targetCursorOffset: 0,
  _initScroll: true,
  _scrollAfterUpdate: false,
  _seekFront: false,

  /**
   * reset container scroll to top or bottom depending on direction
   */
  _initScrollTop: function () {
    this._initScroll = false;
    var containerEl = this.refs.root.getDOMNode();
    if (this.props.reverse) {
      containerEl.scrollTop = containerEl.scrollHeight - containerEl.clientHeight;
    } else {
      containerEl.scrollTop = 0;
    }
  },

  /**
   * determine ref name for cursor (middlemost rendered element on the screen)
   * @return {String}
   */
  _calcCursorRef: function() {

    //get container
    var containerEl = this.refs.root.getDOMNode();
    var threshold = containerEl.scrollTop + containerEl.clientHeight / 2;

    var clearThreshold = (ref) => {
      var node = this.refs[ref].getDOMNode();
      //If reverse subtract offsetheight (so threshold relative to bottom of node instead of top)
      return node.offsetTop > threshold - (this.props.reverse ? node.offsetHeight : 0);
    }

    var refRange = this._getRefRenderRange();

    var cursorRef =
          refRange
            .filter(ref => this.refs[ref])
            .takeUntil(clearThreshold)
            .last()
            ||
          refRange.first();

    return cursorRef;

  },

  /**
   * determine if new cursor is needed and set if necessary
   */
  _setCursor: function() {

    var cursorRef = this._calcCursorRef();

    if (this.state.cursorRef === cursorRef) {
      return;
    }

    this.setState({
      cursorRef: cursorRef,
    });
  },

  /**
   * get renderable ref Range in incremental order
   * Front of list to Back of list
   * @return {Immutable.Seq}
   */
  _getRefRange: function () {
    var rangeStart = this.state.listOffset;
    var rangeEnd = rangeStart + Math.min(this.props.renderCount, this.props.rowIndex.length);

    return Immutable.Range(rangeStart, rangeEnd)
  },

  /**
   * get renderable ref Range in render order
   * Top of container to Bottom of container
   * @return {Immutable.Seq}
   */
  _getRefRenderRange: function() {
    var refRange = this._getRefRange();

    return this.props.reverse ? refRange.reverse() : refRange
  },

  /**
   * recycled key Range for DOM reuse
   * @return {Immutable.List}
   */
  //@TODO determine if keys provide any real performance benefit
  _getKeyList: function() {
    var keyStart = this.state.keyStart;
    var basicRange = Immutable.Range(0, this.props.renderCount);

    return basicRange.slice(keyStart).toList().concat(basicRange.slice(0, keyStart).toList())
  },

  /**
   * call renderRowHanlder for given rowIndex value (ID)
   */
  _renderRow: function(ID, index){
    return this.props.renderRowHandler(ID, index);
  },

  /**
   * determine if render range needs to shift and update state accordingly
   */
  _handleScroll: function(){

    if (this.props.rowIndex.length < this.props.renderCount) return;

    var reverse = this.props.reverse

    var cursorRef = this._calcCursorRef()
    var renderRange = this._getRefRenderRange()
    var refRange = this._getRefRange()

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

    //@TODO come up with a better way seed top and bottom spacesrs and maintain consistency during the scroll
    // consider caching rendered row heights rather than approximating
    var averageHeight = this.refs.renderRows.getDOMNode().scrollHeight / renderRange.count()

    var shift = adjustedOffset - this.state.listOffset
    var backSpacerHeight = (this.props.rowIndex.length - refRange.last() - 1 - shift) * averageHeight
    var frontSpacerHeight = (refRange.first() + shift) * averageHeight

    var [topSpacerHeight, bottomSpacerHeight] = this.props.reverse
          ? [backSpacerHeight, frontSpacerHeight]
          : [frontSpacerHeight, backSpacerHeight]

    this.setState({
        cursorRef: cursorRef,
        listOffset: adjustedOffset,
        keyStart: adjustedKeyStart,
        frontHeight: frontSpacerHeight,
        backHeight: backSpacerHeight,
      })
  },

  propTypes: {
    rowIndex: React.PropTypes.array.isRequired,
    idKey: React.PropTypes.string,
    renderRowHandler: React.PropTypes.func,
    reverse: React.PropTypes.bool,
    renderCount: React.PropTypes.number,
    onEndReached: React.PropTypes.func,
    topCap: React.PropTypes.object,
    bottomCap: React.PropTypes.object
  },

  getDefaultProps: function() {
    return {
      idKey: 'ID',
      renderRowHandler: function(ID){
        return (<div className='row'>{ID}</div>)
      },
      reverse: false,
      renderCount: 30,
      throttle: 100,
      loadBuffer: 30,
      onEndReached: function () {}
    }
  },

  getInitialState: function() {
    return this._initialState;
  },

  componentWillReceiveProps: function(nextProps){
    var oldRowIndex = this.props.rowIndex
    var newRowIndex = nextProps.rowIndex

    // reset scroll and render if we go from now rows to rows
    if(oldRowIndex && oldRowIndex.length === 0 && newRowIndex && newRowIndex.length > 0){
      this.setState(this._initialState);
      this._initScroll = true
    }

    // detect prepend and adjust listOffset if necessary
    else if (oldRowIndex[0] !== newRowIndex[0]) {
      var prependedMessageCount =
            Immutable
              .List(newRowIndex)
              .takeUntil(function (ref) {
                return oldRowIndex[0] === ref
              })
              .count()

      //@TODO discuss, how best to seek front, and how to set threshold
      var containerEl = this.refs.root.getDOMNode()
      var seekFrontThreshold = 20
      if( (!this.props.reverse && containerEl.scrollTop < seekFrontThreshold) || (this.props.reverse && containerEl.scrollTop + containerEl.offsetHeight > containerEl.scrollHeight-seekFrontThreshold) ){
        this._seekFront = true
      }

      //@TODO should detect if old message root is not in new row index and handle...
      this.setState({
        listOffset: this.state.listOffset + (this._seekFront ? 0 : prependedMessageCount),
        cursorRef: this.state.cursorRef + prependedMessageCount,
      })

      this._prependOffset = prependedMessageCount



    }

    else if (oldRowIndex[oldRowIndex.length - 1] !== newRowIndex[newRowIndex.length - 1]) {
      this.setState({listOffset: this.state.listOffset + 1})
    }

    //@TODO more elegant handling?
    //this._scrollAfterUpdate = true

    if (this.props.renderCount >= newRowIndex.length) {
      process.nextTick(this.props.onEndReached)
    }

  },

  shouldComponentUpdate: function(nextProps, nextState){
    //@TODO: implement to prevent uncessary renders on prop changes
    return true
  },

  componentDidMount: function() {
    this._handleScroll = _.throttle(this._handleScroll, this.props.throttle)
    this._initScrollTop()
  },

  componentWillUpdate: function(nextProps, nextState){
    if (nextState.cursorRef){
      var containerEl = this.getDOMNode()
      var refOffset = this._prependOffset || 0
      this._prependOffset = 0;
      console.debug('CWU - cursorRef & refOffset', nextState.cursorRef, refOffset)
      this._targetCursorOffset = this.refs[nextState.cursorRef - refOffset].getDOMNode().offsetTop - containerEl.scrollTop
      console.debug('CWU - _targetCursorOffset', this._targetCursorOffset)
    }
  },

  componentDidUpdate: function(prevProps, prevState){

    if (this.state.cursorRef){
      var containerEl = this.getDOMNode();
      var currentCursorOffset = this.refs[this.state.cursorRef].getDOMNode().offsetTop - containerEl.scrollTop
      var adjustment = currentCursorOffset - this._targetCursorOffset
      console.debug('CDU - cursorRef', this.state.cursorRef)
      console.debug('CDU - currentCursorOffset', currentCursorOffset)
      console.debug('CDU - scrollTop adjustment', adjustment)
      containerEl.scrollTop += adjustment
    }

    if (this._initScroll) {
      this._initScrollTop();
    }

    //@TODO possible only call when requested instead of every update
    if(this._scrollAfterUpdate){
      this._handleScroll()
      this._scrollAfterUpdate = false
    }

    if(this._seekFront){
      containerEl.scrollTop = this.props.reverse ? containerEl.scrollHeight - containerEl.offsetHeight : 0
      this._seekFront = false
    }

    this._setCursor()
  },

  render: function() {
    var reverse = this.props.reverse && true

    var refRange = this._getRefRange()

    var rows = this.props.rowIndex.slice(refRange.first(), refRange.last() + 1)
    var refs = this._getRefRenderRange().toArray()
    var keys = this._getKeyList().map(val => "everrow-" + val).toArray()

    var topSpacerHeight = reverse ? this.state.backHeight : this.state.frontHeight;
    var bottomSpacerHeight = reverse ? this.state.frontHeight : this.state.backHeight;

    if (reverse) {
      rows.reverse();
    }
    
    var renderRows = rows.map((ID, index) =>{
      return (
        <div style={{overflow: "hidden"}} key={keys[index]} ref={refs[index]}>
          {this._renderRow(ID, index)}
        </div>
      )
    })

    return (
      <div ref="root" className={this.props.className} key={this.props.key} onScroll={this._handleScroll}>
        <div ref="topCap">
          {this.props.reverse ? this.props.backCap : this.props.frontCap}
        </div>
        <div ref="topSpacer" style={{height: topSpacerHeight}} />
        <div key="renderRows" ref="renderRows">
          {renderRows}
        </div>
        <div ref="bottomSpacer" style={{height: bottomSpacerHeight}} />
        <div ref="bottomCap">
          {!this.props.reverse ? this.props.backCap : this.props.frontCap}
        </div>
      </div>
    )
  }

})

module.exports = Everscroll
