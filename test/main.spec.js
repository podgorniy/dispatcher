'use strict'

var Flower = require('../lib/flower').Flower

describe('Flower test suite', function () {
	var flower;
	beforeEach(function () {
		flower = new Flower();
	})

	it('Basic event usage', function () {
		var a = 10
		flower.on('event', function () {
			a = 20
		})
		flower.trigger('event')
		expect(a).toBe(20)
		flower.on('event', function () {
			a = 30
		})
		flower.trigger('event')
		expect(a).toBe(30)
	})

	it('Supports subscription with context', function () {
		var a = null
		var context = {}
		flower.on('eventName', function () {
			a = this
		}, context)
		flower.trigger('eventName')
		expect(a).toBe(context)
	})

	it('Support subscription to latest triggered event', function (done) {
		var a = 10
		flower.on(true, 'eventName', function (eventData) {
			a = eventData
		})
		flower.trigger('eventName', 100)
		expect(a).toBe(10)
		flower.trigger('eventName', 200)
		setTimeout(function () {
			expect(a).toBe(200)
			done()
		}, 50)
	})

	it('Supports subscription with immediate invocation', function () {
		var a = 10
		flower.trigger('eventName', 100)
		flower.on('eventName', function (eventData) {
			a = eventData
		}, true)
		expect(a).toBe(100)
		flower.trigger('eventName', 200)
		expect(a).toBe(200)
	})

	it('Supports subscription with immediate invocation and context', function () {
		var a = 10
		var b = null
		var context = {}
		flower.trigger('eventName', 100)
		flower.on('eventName', function (eventData) {
			a = eventData
			b = this
		}, context, true)
		expect(a).toBe(100)
		expect(b).toBe(context)
		flower.trigger('eventName', 200)
		expect(a).toBe(200)
		expect(b).toBe(context)
	})

	it('Supports subscription with multiple events, space or coma separated', function () {
		var a = 10
		flower.on('event1 event2  event3 , event4', function () {
			a += 10;
		})
		flower.trigger('event1')
		flower.trigger('event2')
		flower.trigger('event3')
		flower.trigger('event4')
		expect(a).toBe(50)
	})

	it('Events with namespaces', function () {
		var a = 10
		flower.on('event:context1', function () {
			a = 20
		})
		flower.trigger('event:context1')
		expect(a).toBe(20)
		flower.on('event:context2', function () {
			a += 10
		})
		flower.trigger('event:context2')
		flower.trigger('event:context2')
		expect(a).toBe(40)
	})

	it('Planned triggers executors', function (done) {
		var a = 10
		flower.on('event', function (data) {
			a = data
		})

		flower.trigger(true, 'event', 10)
		expect(a).toBe(10)
		flower.trigger(true, 'event', 20)
		expect(a).toBe(10)
		flower.trigger('event', 100)
		flower.trigger(true, 'event', 30)
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
		flower.when('eventName').then(function (data) {
			a += 10
			b = data
		})
		flower.trigger(true, 'eventName', 10)
		flower.trigger(true, 'eventName', 20)
		flower.trigger(true, 'eventName', 30)
		flower.when('eventName').then(function () {
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
		flower.on('eventName', test.cb)
		flower.trigger(true, 'eventName')
		expect(test.cb).not.toHaveBeenCalled()
		flower.trigger('eventName')
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
		flower.when('event').then(function () {
			a = 20
		})
		flower.trigger('event')
		setTimeout(function () {
			flower.when('event', true).then(function () {
				b = 30
			})
		}, 0)
		setTimeout(function () {
			expect(a).toBe(20)
			expect(b).toBe(30)
			done()
		}, 100)
	})

	it('Allows to react only to latest triggerer among multiples', function (done) {
		var a = 10
		var b = 10
		flower.on(true, 'eventName', function (eventData) {
			a = eventData
		})
		flower.on(true, 'eventName', function (eventData) {
			b = eventData
		})
		flower.trigger('eventName', 20)
		flower.trigger('eventName', 30)
		expect(b).toEqual(10) // callback was not called
		setTimeout(function () {
			expect(a).toEqual(30)
			expect(b).toEqual(30)
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
		flower.on(true, 'eventName', function (data) {
			test.cb()
			a = data
		})
		flower.trigger('eventName', 100500)
		flower.trigger(true, 'eventName', 100)
		flower.trigger('eventName', 100500)
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
		flower.trigger(true, 'eventName')
		flower.on('eventName', function () {
			a += 10
		}, true)
		flower.on(true, 'eventName', function () {
			b += 10
		}, true)
		flower.trigger(true, 'eventName')
		setTimeout(function () {
			expect(a).toBe(20)
			expect(b).toBe(20)
			done()
		}, 100)
	})

	it('Does not allow to unsubscribe from all handlers by eventName', function () {
		var a = 10
		var context = {}
		flower.on('eventName', function () {
			a += 10
		}, context)
		flower.on('eventName', function () {
			a += 10
		})
		flower.off('eventName')
		flower.trigger('eventName')
		expect(a).toBe(30)
	})

	it('Unsubscribe from specific handler', function () {
		var a = 10
		var handlerToUnsubscribe = function () {
			a = 50
		}
		flower.on('eventName', function () {
			a = 20
		})
		flower.on('eventName', handlerToUnsubscribe)
		flower.trigger('eventName')
		expect(a).toBe(50)
		flower.off('eventName', handlerToUnsubscribe)
		flower.trigger('eventName')
		expect(a).toBe(20)
	})

	it('Unsubscribe from specific handler by context', function () {
		var a = 10
		var b = null
		var context = {}
		flower.on('eventName', function () {
			a = 30
		})
		flower.on('eventName', function () {
			a = 20
			b = this
		}, context)
		flower.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(context)
		flower.off('eventName', context)
		b = null
		flower.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(null)
	})

	it('Unsubscribe from all latest triggered event handlers by callback', function (done) {
		var a = 10
		var callback = function () {
			a = 20
		}
		flower.on(true, 'eventName', callback)
		flower.off(true, 'eventName', callback)
		flower.trigger('eventName')
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
		flower.on(true, 'eventName', callback, context)
		flower.off(true, 'eventName', context)
		flower.trigger('eventName')
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
		flower.on(true, 'eventName', function () {
			a = 40
		})
		flower.on(true, 'eventName', callbackToUnsubscribe)
		flower.on(true, 'eventName', function () {
			a = 40
		})
		flower.off(true, 'eventName', callbackToUnsubscribe)
		flower.trigger('eventName')
		setTimeout(function () {
			expect(a).toBe(40)
			done()
		}, 100)
	})

	it('Unsubscribe from latest triggered event handler by context', function (done) {
		var a = 10
		var b = 10
		var context = {}
		flower.on(true, 'eventName', function () {
			a = 30
		})
		flower.on(true, 'eventName', function () {
			a = 20
			b = 20
		}, context)
		flower.on(true, 'eventName', function () {
			a = 30
		})
		flower.off(true, 'eventName', context)
		flower.trigger('eventName')
		setTimeout(function () {
			expect(b).toBe(10)
			expect(a).toBe(30)
			done();
		}, 100)
	})

	it('Unsubscribe from one handlers should not affect any other', function () {
		var a = 10
		var b = 10
		var c = 10
		var h1 = function () {a += 10;}
		var h2 = function () {b += 10; flower.off('eventName', h1); flower.off('eventName', h2); flower.off('eventName', h3) }
		var h3 = function () {c += 10;}
		flower.on('eventName', h1)
		flower.on('eventName', h2)
		flower.on('eventName', h3)
		flower.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		expect(c).toBe(10)
		flower.trigger('eventName')
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
		flower.on('eventName', h1)
		flower.on('eventName', h2)
		flower.on('eventName', h3)
		flower.on('eventName', h1)
		flower.on('eventName', h2)
		flower.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(30)
		expect(c).toBe(20)
		flower.off('eventName', h1)
		flower.off('eventName', h2)
		flower.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(30)
		expect(c).toBe(30)
	})

	it('Unsubscribe from one handlers should not affect any other', function () {
		var a = 10
		var b = 10
		var c = 10
		var h1 = function () {a += 10;}
		var h2 = function () {b += 10; flower.off('eventName', h2)}
		var h3 = function () {c += 10;}
		flower.on('eventName', h1)
		flower.on('eventName', h2)
		flower.on('eventName', h3)
		flower.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		expect(c).toBe(20)
		flower.trigger('eventName')
		expect(a).toBe(30)
		expect(b).toBe(20)
		expect(c).toBe(30)
	})

	it('Unsubscribe from context only', function () {
		var a = 10
		var b = 10
		var context = {}
		flower.on('eventName', function () {
			a = 20
		})
		flower.on('eventName', function () {
			b += 10
		}, context)
		flower.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
		flower.off('eventName', context)
		flower.trigger('eventName')
		expect(a).toBe(20)
		expect(b).toBe(20)
	})

	it('Unsubscribe requires either context or handler', function () {
		var a = 10
		var context = {}
		flower.on('event', function () {
			a += 10
		})
		flower.on('event', function () {
			a += 10
		}, context)
		flower.on('event', function () {
			a += 10
		}, context, true)
	})

	it('Implements basic provider functionality', function (done) {
		var requestResult
		flower.provide('dataContext', function () {
			return 100500
		})
		flower.request('dataContext').then(function (data) {
			requestResult = data
		})
		setTimeout(function () {
			expect(requestResult).toBe(100500)
			done()
		}, 100)
	})

	it('Allows to request data, before it\'s provided', function (done) {
		var requestResult
		flower.request('dataContext').then(function (data) {
			requestResult = data
		})
		setTimeout(function () {
			flower.provide('dataContext', function () {
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
		flower.request('data', 50).then(function (resp) {
			a = resp
		})
		flower.provide('data', function (param) {
			if (param === 50) {
				return 'fifty'
			}
			if (param === 60) {
				return 'sixty'
			}
		})
		flower.request('data', 60).then(function (resp) {
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
		flower.request('data', function (data) {
			a = data
		})
		flower.provide('data', function () {
			return 20
		})
		setTimeout(function () {
			expect(a).toBe(20)
			done()
		}, 100)
	})

	it('Does not allow 2 providers for same namespace', function () {
		flower.provide('data', function () {})
		expect(function () {
			flower.provide('data', function () {})
		}).toThrowError()
	})

	it('Allows to stop providing data', function (done) {
		flower.provide('data', function () {
			return 10
		})
		flower.request('data').then(function (data) {
			expect(data).toEqual(10)
		})
		flower.stopProviding('data')
		var promiseSullFilled = false
		var requestAfterStopProviding = flower.request('data').then(function () {
			promiseSullFilled = true
		})
		setTimeout(function () {
			expect(promiseSullFilled).toBe(false)
			done()
		}, 100)
	})

	it('Provider may return Promise', function (done) {
		var a
		flower.request('data').then(function (data) {
			a = data
		})
		flower.provide('data', function () {
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

	it('Broken handler should not break all handlers executions', function () {
		var a = 10
		flower.on('event', function () {
			brokenShit()
		})
		flower.on('event', function () {
			a = 20
		})
		flower.trigger('event')
		expect(a).toBe(20)
	})

	it('Subsription returns reference to flower instantce', function () {
		var a = 10
		flower.on('event', function () {
			a += 10
		}).on('eventName', function () {
			a += 10
		})
		flower.trigger('event')
		flower.trigger('eventName')
		expect(a).toBe(30)
	})
})