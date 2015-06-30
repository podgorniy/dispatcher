'use strict'

var Dispatcher = require('../lib/dispatcher').Dispatcher

describe('Dispatcher test suite', function () {
	var dispatcher;
	beforeEach(function () {
		dispatcher = new Dispatcher();
	})

	it('Basic event usage', function () {
		var a = 10
		dispatcher.subscribe('event', function () {
			a = 20
		})
		dispatcher.trigger('event')
		expect(a).toBe(20)
		dispatcher.subscribe('event', function () {
			a = 30
		})
		dispatcher.trigger('event')
		expect(a).toBe(30)
	})

	it('Supports subscription with context', function () {
		var a = null
		var context = {}
		dispatcher.subscribe('eventName', function () {
			a = this
		}, context)
		dispatcher.trigger('eventName')
		expect(a).toBe(context)
	})

	it('Supports subscription with multiple events, space or coma separated', function () {
		var a = 10
		dispatcher.subscribe('event1 event2  event3 , event4', function () {
			a += 10;
		})
		dispatcher.trigger('event1')
		dispatcher.trigger('event2')
		dispatcher.trigger('event3')
		dispatcher.trigger('event4')
		expect(a).toBe(50)
	})

	it('Events with namespaces', function () {
		var a = 10
		dispatcher.subscribe('event:context1', function () {
			a = 20
		})
		dispatcher.trigger('event:context1')
		expect(a).toBe(20)
		dispatcher.subscribe('event:context2', function () {
			a += 10
		})
		dispatcher.trigger('event:context2')
		dispatcher.trigger('event:context2')
		expect(a).toBe(40)
	})

	it('Planned triggers executors', function (done) {
		var a = 10
		dispatcher.subscribe('event', function (data) {
			a = data
		})

		dispatcher.trigger(true, 'event', 10)
		expect(a).toBe(10)
		dispatcher.trigger(true, 'event', 20)
		expect(a).toBe(10)
		dispatcher.trigger('event', 100)
		dispatcher.trigger(true, 'event', 30)
		expect(a).toBe(100)
		setTimeout(function () {
			expect(a).toBe(30)
			done()
		}, 100)
	})

	it('Planned trigger executors work with promise-basd API', function (done) {
		var a = 10
		var b = 10
		var c = 10
		dispatcher.when('eventName').then(function (data) {
			a += 10
			b = data
		})
		dispatcher.trigger(true, 'eventName', 10)
		dispatcher.trigger(true, 'eventName', 20)
		dispatcher.trigger(true, 'eventName', 30)
		dispatcher.when('eventName').then(function () {
			c = 40
		})
		setTimeout(function () {
			expect(a).toBe(20)
			expect(b).toBe(30)
			expect(c).toBe(40)
			done()
		}, 50)
	})

	it('Does not fire callback functions more, than required', function (done) {
		var test = {
			cb: function () {
			}
		}
		spyOn(test, 'cb')
		dispatcher.subscribe('eventName', test.cb)
		dispatcher.trigger(true, 'eventName')
		expect(test.cb).not.toHaveBeenCalled()
		dispatcher.trigger('eventName')
		expect(test.cb.calls.count()).toEqual(1)
		expect(test.cb).toHaveBeenCalled()
		setTimeout(function () {
			expect(test.cb.calls.count()).toEqual(2)
			done()
		}, 100)
	})

	it('Basic promise-based events', function (done) {
		var a = 10
		var b = 10
		dispatcher.when('event').then(function () {
			a = 20
		})
		dispatcher.trigger('event')
		setTimeout(function () {
			dispatcher.when('event', true).then(function () {
				b = 30
			})
		}, 0)
		setTimeout(function () {
			expect(a).toBe(20)
			expect(b).toBe(30)
			done()
		}, 100)
	})

	it('Latest triggerer plays fine with planned trigger executors', function (done) {
		var a = 10
		var test = {
			cb: function () {
			}
		}
		spyOn(test, 'cb')
		dispatcher.subscribeThrottled('eventName', function (data) {
			test.cb()
			a = data
		})
		dispatcher.trigger('eventName', 100500)
		dispatcher.trigger(true, 'eventName', 100)
		dispatcher.trigger('eventName', 100500)
		expect(a).toBe(10)
		expect(test.cb).not.toHaveBeenCalled()
		setTimeout(function () {
			expect(a).toBe(100)
			expect(test.cb.calls.count()).toEqual(1)
			done()
		}, 100)
	})

	it('Planned handler plays nicely with planned trigger', function (done) {
		var a = 10
		var b = 10
		dispatcher.trigger(true, 'eventName')
		dispatcher.subscribeThrottled('eventName', function () {
			a += 10
		}, true)
		dispatcher.subscribeDebounced('eventName', function () {
			b += 10
		})
		dispatcher.trigger(true, 'eventName')
		setTimeout(function () {
			expect(a).toBe(20)
			expect(b).toBe(20)
			done()
		}, 100)
	})

	it('Does not allow to unsubscribe from all handlers by eventName', function () {
		var a = 10
		var context = {}
		dispatcher.subscribe('eventName', function () {
			a += 10
		}, context)
		dispatcher.subscribe('eventName', function () {
			a += 10
		})
		dispatcher.unsubscribe('eventName')
		dispatcher.trigger('eventName')
		expect(a).toBe(30)
	})

	it('Unsubscribe from specific handler', function () {
		var a = 10
		var handlerToUnsubscribe = function () {
			a = 50
		}
		dispatcher.subscribe('eventName', function () {
			a = 20
		})
		dispatcher.subscribe('eventName', handlerToUnsubscribe)
		dispatcher.trigger('eventName')
		expect(a).toBe(50)
		dispatcher.unsubscribe('eventName', handlerToUnsubscribe)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
	})

	it('Unsubscribe from specific handler by context', function () {
		var a = 10
		var b = null
		var context = {}
		dispatcher.subscribe('eventName', function () {
			a = 30
		})
		dispatcher.subscribe('eventName', function () {
			a = 20
			b = this
		}, context)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(context)
		dispatcher.unsubscribe('eventName', context)
		b = null
		dispatcher.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(null)
	})

	it('Unsubscribe from all latest triggered event handlers by callback', function (done) {
		var a = 10
		var callback = function () {
			a = 20
		}
		dispatcher.subscribeThrottled('eventName', callback)
		dispatcher.unsubscribe(true, 'eventName', callback)
		dispatcher.trigger('eventName')
		setTimeout(function () {
			expect(a).toBe(10)
			done()
		}, 100)
	})

	it('Unsubscribe from all latest triggered event handlers by context', function (done) {
		var a = 10
		var callback = function () {
			a = 20
		}
		var context = {}
		dispatcher.subscribeThrottled('eventName', callback, context)
		dispatcher.unsubscribe(true, 'eventName', context)
		dispatcher.trigger('eventName')
		setTimeout(function () {
			expect(a).toBe(10)
			done()
		}, 100)
	})

	it('Unsubscribe from specific latest triggered event handler', function (done) {
		var a = 10
		var callbackToUnsubscribe = function () {
			a = 20
		}
		dispatcher.subscribeThrottled('eventName', function () {
			a = 40
		})
		dispatcher.subscribeThrottled('eventName', callbackToUnsubscribe)
		dispatcher.subscribeThrottled('eventName', function () {
			a = 40
		})
		dispatcher.unsubscribe(true, 'eventName', callbackToUnsubscribe)
		dispatcher.trigger('eventName')
		setTimeout(function () {
			expect(a).toBe(40)
			done()
		}, 100)
	})

	it('Unsubscribe from latest triggered event handler by context', function (done) {
		var a = 0
		var b = 10
		var context = {}
		dispatcher.subscribeThrottled('eventName', function () {
			a = 10
		}, context)
		dispatcher.subscribe('eventName', function () {
			a = 20
			b = 20
		}, context)
		dispatcher.subscribe('eventName', function () {
			a = 30
		})
		dispatcher.unsubscribe(true, 'eventName', context)
		dispatcher.trigger('eventName')
		setTimeout(function () {
			expect(b).toBe(20)
			dispatcher.unsubscribe('eventName', context)
			dispatcher.trigger('eventName')
			setTimeout(function () {
				expect(a).toBe(30)
				done();
			}, 30)
		}, 100)
	})

	it('Unsubscribe from one handlers should not affect any other', function () {
		var a = 10
		var b = 10
		var c = 10
		var h1 = function () {a += 10;}
		var h2 = function () {b += 10; dispatcher.unsubscribe('eventName', h1); dispatcher.unsubscribe('eventName', h2); dispatcher.unsubscribe('eventName', h3) }
		var h3 = function () {c += 10;}
		dispatcher.subscribe('eventName', h1)
		dispatcher.subscribe('eventName', h2)
		dispatcher.subscribe('eventName', h3)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		expect(c).toBe(10)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		expect(c).toBe(10)
	})

	it('Unsubscribe from one handlers should not affect any other', function () {
		var a = 10
		var b = 10
		var c = 10
		var h1 = function () {a += 10;}
		var h2 = function () {b += 10;}
		var h3 = function () {c += 10;}
		dispatcher.subscribe('eventName', h1)
		dispatcher.subscribe('eventName', h2)
		dispatcher.subscribe('eventName', h3)
		dispatcher.subscribe('eventName', h1)
		dispatcher.subscribe('eventName', h2)
		dispatcher.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(30)
		expect(c).toBe(20)
		dispatcher.unsubscribe('eventName', h1)
		dispatcher.unsubscribe('eventName', h2)
		dispatcher.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(30)
		expect(c).toBe(30)
	})

	it('Unsubscribe from one handlers should not affect any other', function () {
		var a = 10
		var b = 10
		var c = 10
		var h1 = function () {a += 10;}
		var h2 = function () {b += 10; dispatcher.unsubscribe('eventName', h2)}
		var h3 = function () {c += 10;}
		dispatcher.subscribe('eventName', h1)
		dispatcher.subscribe('eventName', h2)
		dispatcher.subscribe('eventName', h3)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		expect(c).toBe(20)
		dispatcher.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(20)
		expect(c).toBe(30)
	})

	it('Unsubscribe from context only', function () {
		var a = 10
		var b = 10
		var context = {}
		dispatcher.subscribe('eventName', function () {
			a = 20
		})
		dispatcher.subscribe('eventName', function () {
			b += 10
		}, context)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		dispatcher.unsubscribe('eventName', context)
		dispatcher.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
	})

	it('Unsubscribe requires either context or handler', function () {
		var a = 10
		var context = {}
		dispatcher.subscribe('event', function () {
			a += 10
		})
		dispatcher.subscribe('event', function () {
			a += 10
		}, context)
		dispatcher.subscribe('event', function () {
			a += 10
		}, context, true)
	})

	it('Implements basic provider functionality', function (done) {
		var requestResult
		dispatcher.provide('dataContext', function () {
			return 100500
		})
		dispatcher.request('dataContext').then(function (data) {
			requestResult = data
		})
		setTimeout(function () {
			expect(requestResult).toBe(100500)
			done()
		}, 100)
	})

	it('Allows to request data, before it\'s provided', function (done) {
		var requestResult
		dispatcher.request('dataContext').then(function (data) {
			requestResult = data
		})
		setTimeout(function () {
			dispatcher.provide('dataContext', function () {
				return 100500
			})
		}, 50)
		setTimeout(function () {
			expect(requestResult).toBe(100500)
			done()
		}, 100)
	})

	it('Allows to pass parameters with request', function (done) {
		var a
		var b
		dispatcher.request('data', 50).then(function (resp) {
			a = resp
		})
		dispatcher.provide('data', function (param) {
			if (param === 50) {
				return 'fifty'
			}
			if (param === 60) {
				return 'sixty'
			}
		})
		dispatcher.request('data', 60).then(function (resp) {
			b = resp
		})
		setTimeout(function () {
			expect(a).toBe('fifty')
			expect(b).toBe('sixty')
			done()
		}, 100)
	})

	it('Allows to pass arguments and function-callback with request', function (done) {
		var a = 10
		dispatcher.request('data', function (data) {
			a = data
		})
		dispatcher.provide('data', function () {
			return 20
		})
		setTimeout(function () {
			expect(a).toBe(20)
			done()
		}, 100)
	})

	it('Does not allow 2 providers for same namespace', function () {
		dispatcher.provide('data', function () {})
		expect(function () {
			dispatcher.provide('data', function () {})
		}).toThrowError()
	})

	it('Allows to stop providing data', function (done) {
		dispatcher.provide('data', function () {
			return 10
		})
		dispatcher.request('data').then(function (data) {
			expect(data).toEqual(10)
		})
		dispatcher.stopProviding('data')
		var promiseSullFilled = false
		var requestAfterStopProviding = dispatcher.request('data').then(function () {
			promiseSullFilled = true
		})
		setTimeout(function () {
			expect(promiseSullFilled).toBe(false)
			done()
		}, 100)
	})

	it('Provider may return Promise', function (done) {
		var a
		dispatcher.request('data').then(function (data) {
			a = data
		})
		dispatcher.provide('data', function () {
			return new Promise(function (resolve) {
				setTimeout(function () {
					resolve(100500)
				}, 50)
			})
		})
		setTimeout(function () {
			expect(a).toEqual(100500)
			done()
		}, 100)
	})

	xit('Broken handler should not break all handlers executions', function () {
		var a = 10
		dispatcher.subscribe('event', function () {
			a += 10
		})
		dispatcher.subscribe('event', function () {
			throw new Error('error')
		})
		dispatcher.subscribe('event', function () {
			a += 10
		})
		dispatcher.trigger('event')
		expect(a).toBe(30)
	})

	it('Subsription returns reference to dispatcher instantce', function () {
		var a = 10
		dispatcher.subscribe('event', function () {
			a += 10
		}).subscribe('eventName', function () {
			a += 10
		})
		dispatcher.trigger('event')
		dispatcher.trigger('eventName')
		expect(a).toBe(30)
	})

	it('"subscribeWithPast" works properly', function (done) {
		var data = 100500
		dispatcher.trigger('event', data)
		setTimeout(function () {
			var context = {}
			var a = 10
			dispatcher.subscribe('event', function (eventData) {
				a = 20
			}, context)

			dispatcher.subscribeWithPast('event', function (eventData) {
				expect(this).toBe(context)
				expect(eventData).toBe(100500)
				expect(a).toBe(10) // expect handler from top not being called
				done()
			}, context)
		}, 100)
	})


	it('"subscribeThrottled" works properly', function (done) {
		var a = 10
		var subscriberContext = {}

		dispatcher.subscribeThrottled('event', function (eventData) {
			a = eventData
			expect(this).toBe(subscriberContext)
		}, subscriberContext)
		dispatcher.trigger('event', 100500)
		expect(a).toBe(10)
		dispatcher.trigger('event', 123)
		// Trigger short after block of code
		setTimeout(function () {
			dispatcher.trigger('event', 999)
		}, 1)
		setTimeout(function () {
			expect(a).toBe(999)
			done()
		}, 100)
	})

	it('"subscribeDebounced" works correctly 1', function (done) {
		var subscriberContext = {}
		dispatcher.trigger('event', 100)
		setTimeout(function () {
			dispatcher.subscribeDebounced('event', function (eventData) {
				expect(eventData).toBe(100)
				expect(this).toBe(subscriberContext)
			}, subscriberContext)
			setTimeout(done, 100)
		}, 50)
	})

	it('"subscribeDebounced" works correctly 2', function (done) {
		var subscriberContext = {}
		setTimeout(function () {
			dispatcher.subscribeDebounced('event', function (eventData) {
				expect(eventData).toBe(300)
				expect(this).toBe(subscriberContext)
			}, subscriberContext)
			dispatcher.trigger('event', 100)
			dispatcher.trigger('event', 200)
			dispatcher.trigger('event', 300)
			setTimeout(done, 100)
		}, 50)
	})
})