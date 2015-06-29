(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['exports'], function (exports) {
			factory((root.Flower = exports));
		});
	} else if (typeof exports === 'object') {
		// CommonJS
		factory(exports);
	} else {
		// Browser globals
		factory(root);
	}
}(this, function (exports) {
	'use strict'

	function Flower() {
		// has-map of latest values, by triggered events
		this._wasTriggeredWith = {}

		// List of names of events, that planned to trigger on requestAnimationFrame
		// this list event will. Used by .subscribe(true, EVENT_NAME) invocation type
		this._plannedToTrigger = {}
		this._plannedToExecuteTriggers = false
		this._executingPlannedTriggers = false

		// Triggerers, that will trigger only latest triggered by RAF value
		this._plannedSubscriptions = {}
		this._plannedSubscribersWillExecute = false

		/**
		 * Subscribers, who will use latest triggered value by RAF
		 *
		 * @type {Array<Object>}
		 * @private
		 */
		this._latestEventsDescriptors = {}
		/**
		 *
		 * @type {{handler: Function, subscriber: Object}}
		 * @private
		 */
		this._eventsDescriptors = {}

		this._requestedBeforeProvided = {}
		this._providers = {}

		this._removingSubscribersRequested = false
		Object.seal(this)
	}


	Flower.prototype._registerEventHandlers = function (handlersStorage, eventName, handler, subscriber) {
		if (!handlersStorage[eventName]) {
			handlersStorage[eventName] = []
		}
		handlersStorage[eventName].push({
			handler: handler,
			subscriber: subscriber
		})
	}


	/**
	 * Registers some callback to be triggered after some kinda event.
	 *
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} [subscriber] Context of invocation
	 */

	Flower.prototype.subscribe = function (eventName, handler, subscriber) {
		// Handle case, when first argument is not passed
		var eventNames = eventName.split(/[ ,]+/)
		for (var i = 0; i < eventNames.length; i += 1) {
			eventName = eventNames[i]
			this._registerEventHandlers(this._eventsDescriptors, eventName, handler, subscriber)
		}
		return this
	}


	Flower.prototype.subscribeWithPast = function (eventName, handler, context) {
		if (eventName in this._wasTriggeredWith) {
			this._executeHandler(handler, context, this._wasTriggeredWith[eventName])
		}
		this._registerEventHandlers(this._eventsDescriptors, eventName, handler, context)
	}


	Flower.prototype.onWithRAF = function (eventName, handler, context) {
		this._registerEventHandlers(this._latestEventsDescriptors, eventName, handler, context)
	}


	Flower.prototype.onWithRAFAndPast =
	Flower.prototype.onWithPastAndRAF = function (eventName, handler, context) {
		if (eventName in this._wasTriggeredWith) {
			this._executeHandler(handler, context, this._wasTriggeredWith[eventName])
		}
		this._registerEventHandlers(this._latestEventsDescriptors, eventName, handler, context)
	}

	/**
	 * Execute handler, catch error, throw in fancy way to continue handler execution
	 *
	 * @param {Function} handler
	 * @param {Object|undefined} context
	 * @param {*} eventData
	 * @private
	 */
	Flower.prototype._executeHandler = function (handler, context, eventData) {
		try {
			handler.call(context || this, eventData)
		} catch (err) {
			requestAnimationFrame(function () {
				throw err
			})
		}
	}


	/**
	 * For triggers, that work by model: many triggerers, but callbacks called only once,
	 * this function executes callacks in async way
	 *
	 * @private
	 */
	Flower.prototype._executePlannedTriggers = function () {
		this._executingPlannedTriggers = true
		for (var eventName in this._plannedToTrigger) {
			this.trigger(eventName, this._plannedToTrigger[eventName])
			delete this._plannedToTrigger[eventName]
		}
		this._executingPlannedTriggers = false
	}

	/**
	 * @private
	 */
	Flower.prototype._executePlannedSubscribers = function () {
		for (var eventName in this._plannedSubscriptions) {
			// Don't trigger events, which has planned triggers
			if ((eventName in this._plannedToTrigger)) {
				continue
			}
			this._triggerEvent(this._latestEventsDescriptors, eventName, this._wasTriggeredWith[eventName])
			delete this._plannedSubscriptions[eventName]
		}
	}

	/**
	 * Notifies about something.
	 *
	 * @param [triggerOnlyLatest] {Boolean}
	 * @param eventName {String}
	 * @param [eventData] {*}
	 */
	Flower.prototype.trigger = function (triggerOnlyLatest, eventName, eventData) {
		// Handle case when first argument if not passed
		if (typeof triggerOnlyLatest === 'string') {
			eventData = eventName
			eventName = triggerOnlyLatest
			triggerOnlyLatest = false
		}
		eventData = eventData != null ? eventData : null
		if (triggerOnlyLatest) {
			this._plannedToTrigger[eventName] = eventData
			if (!this._plannedToExecuteTriggers) {
				this._plannedToExecuteTriggers = true
				requestAnimationFrame((function () {
					this._executePlannedTriggers()
					this._plannedToExecuteTriggers = false
				}).bind(this))
			}
		} else {
			this._triggerEvent(this._eventsDescriptors, eventName, eventData)
			if (eventName in this._latestEventsDescriptors) {
				if (this._executingPlannedTriggers) {
					this._triggerEvent(this._latestEventsDescriptors, eventName, eventData)
				} else {
					this._plannedSubscriptions[eventName] = null // mark for execution by _executePlannedSubscribers
					if (!this._plannedSubscribersWillExecute) {
						this._plannedSubscribersWillExecute = true
						requestAnimationFrame((function () {
							this._executePlannedSubscribers()
							this._plannedSubscribersWillExecute = false
						}).bind(this))
					}
				}
			}
		}
	}

	/**
	 * General method for executing structures with event descriptors
	 *
	 * @param eventsDescriptors {{subscriber: Object|null, disabled:Boolean, eventData:Object|null}}
	 * @param eventName {String}
	 * @param eventData [{Object}]
	 * @private
	 */
	Flower.prototype._triggerEvent = function (eventsDescriptors, eventName, eventData) {
		this._wasTriggeredWith[eventName] = eventData != null ? eventData : null
		var eventDescriptors = eventsDescriptors[eventName] || []
		for (var i = 0; i < eventDescriptors.length; i += 1) {
			if (!eventDescriptors[i].disabled) {
				this._executeHandler(eventDescriptors[i].handler, eventDescriptors[i].subscriber, this._wasTriggeredWith[eventName])
			}
		}
	}

	/**
	 * Returns promise, that resolves on some event occurrence
	 *
	 * @param [resolveImmediatelyIfAlreadyTriggered] {Boolean}
	 * @param eventName {String}
	 * @return {Promise}
	 */
	Flower.prototype.when = function (eventName, resolveImmediatelyIfAlreadyTriggered) {
		resolveImmediatelyIfAlreadyTriggered = !!resolveImmediatelyIfAlreadyTriggered
		return new Promise(function (resolve) {
			var self = this // Want to avoid binding context to call "off method"
			if (resolveImmediatelyIfAlreadyTriggered && (eventName in this._wasTriggeredWith)) {
				resolve(this._wasTriggeredWith[eventName])
			} else {
				this.subscribe(eventName, function onceHandler(data) {
					resolve(data)
					self.off(eventName, onceHandler)
				})
			}
		}.bind(this))
	}

	/**
	 * Marks corresponding handlers as "unsubscribe". This means, that these handlers won't be triggered by trigger function
	 * and will be removed on next handlers removal cycle
	 *
	 * @param eventsDescriptors {Object}
	 * @param eventToUnsubscribe {String}
	 * @param [handler] {Function}
	 * @param [subscriber] {Object}
	 * @private
	 */
	Flower.prototype._markUnsubscribedHandlers = function (eventsDescriptors, eventToUnsubscribe, handler, subscriber) {
		var descriptors
		if (eventToUnsubscribe && eventsDescriptors[eventToUnsubscribe]) {
			if (!handler && !subscriber) {
				console.warn('Either "handler" or "subscriber" should be defined')
				return
			}
			descriptors = eventsDescriptors[eventToUnsubscribe]
			for (var i = 0; i < descriptors.length; i += 1) {
				this._markDescriptorDisabled(descriptors[i], handler, subscriber)
			}
		} else {
			for (var eventName in eventsDescriptors) {
				if (eventsDescriptors[eventName]) {
					descriptors = eventsDescriptors[eventName]
					for (var k = 0; k < descriptors.length; k += 1) {
						this._markDescriptorDisabled(descriptors[k], handler, subscriber)
					}
				}
			}
		}
	}

	/**
	 * Marks descriptor as "disabled" if handler or subscriber (or both, if defined) equals
	 * to descriptor's handler and (or) subscriber
	 *
	 * @param {Object} descriptor
	 * @param {Function} [handler]
	 * @param {*} [subscriber]
	 * @private
	 */
	Flower.prototype._markDescriptorDisabled = function (descriptor, handler, subscriber) {
		if (!descriptor.disabled) {
			// Both handler and subscriber defined. Unsubscribe only from matched by both
			if ((handler && subscriber) && descriptor.handler === handler && descriptor.subscriber === subscriber) {
				descriptor.disabled = true
			} else if (handler && descriptor.handler === handler) {
				descriptor.disabled = true
			} else if (subscriber && descriptor.subscriber === subscriber) {
				descriptor.disabled = true
			}
		}
	}


	/**
	 * Makes event callbacks not triggered again, plans cleanup removal cycle
	 *
	 * @param [onlyLatestEventsSubscribers] {Boolean} Flag, indicates, that programmer will
	 * to unsubscribe from only last event
	 * @param eventName {String}
	 * @param [handler] {Function}
	 * @param [subscriber] {Object} this context for {handler}
	 */
	Flower.prototype.off = function (onlyLatestEventsSubscribers, eventName, handler, subscriber) {
		// handle function's polymorphism
		if (typeof onlyLatestEventsSubscribers === 'string') {
			subscriber = handler
			handler = eventName
			eventName = onlyLatestEventsSubscribers
			onlyLatestEventsSubscribers = false
		}
		if (handler && typeof handler !== 'function') {
			subscriber = handler
			handler = null
		}
		// Remove ordinary handlers
		if (onlyLatestEventsSubscribers) {
			this._markUnsubscribedHandlers(this._latestEventsDescriptors, eventName, handler, subscriber)
		} else {
			this._markUnsubscribedHandlers(this._eventsDescriptors, eventName, handler, subscriber)
		}
		if (!this._removingSubscribersRequested) {
			this._removingSubscribersRequested = true
			requestAnimationFrame(function () {
				this._removeHandlers(this._latestEventsDescriptors)
				this._removeHandlers(this._eventsDescriptors)
				this._removingSubscribersRequested = false
			}.bind(this))
		}
	}

	/**
	 * Returns true for enabled descriptor.
	 * Used for mapping though arrays of descriptors
	 *
	 * @param descriptor
	 * @return {boolean}
	 * @private
	 */
	Flower.prototype._isEnabled = function (descriptor) {
		return !descriptor.disabled
	}

	/**
	 * Deletes information about handlers, who marked for unsubscription
	 *
	 * @param eventsDescriptors
	 * @private
	 */
	Flower.prototype._removeHandlers = function (eventsDescriptors) {
		for (var eventName in eventsDescriptors) {
			var descriptors = eventsDescriptors[eventName]
			eventsDescriptors[eventName] = descriptors.filter(this._isEnabled)
			if (!eventsDescriptors[eventName].length) {
				delete eventsDescriptors[eventName]
			}
		}
	}


	/**
	 * Request some data by key. May pass one optional parameter. Returns {Promise}, that resolves when
	 * provider of {requestedNamespace} fulfills request
	 *
	 * @param requestedNamespace {String}
	 * @param [args] {*}
	 * @param [callback] {Function} optional callback to use instead of promise
	 * @return {Promise}
	 */
	Flower.prototype.request = function (requestedNamespace, args, callback) {
		if (typeof args === 'function') {
			callback = args
			args = callback
		}
		if (this._providers[requestedNamespace]) {
			return new Promise(function (resolve) {
				var resolutionResult = this._providers[requestedNamespace](args)
				if (callback) {
					if (resolutionResult && typeof resolutionResult.then === 'function') {
						resolutionResult.then(callback)
						return resolutionResult
					} else {
						callback(resolutionResult)
					}
				}
				resolve(resolutionResult)
			}.bind(this))
		} else {
			if (!this._requestedBeforeProvided[requestedNamespace]) {
				this._requestedBeforeProvided[requestedNamespace] = []
			}
			return new Promise((function (resolve, reject) {
				this._requestedBeforeProvided[requestedNamespace].push({
					resolver: function (resolutionResult) {
						if (callback) {
							if (resolutionResult && typeof resolutionResult.then === 'function') {
								resolutionResult.then(callback)
							} else {
								callback(resolutionResult)
								resolve(resolutionResult)
							}
						}

						if (resolutionResult && typeof resolutionResult.then === 'function') {
							resolutionResult.then(resolve)
						} else {
							resolve(resolutionResult)
						}
					},
					rejecter: reject,
					args: args
				})
			}).bind(this))
		}
	}


	/**
	 * Declare callback, that resolves when provider function returns a value. If provider function returns
	 * a promise, returned by this method promise will resolve when provider's promise resolved
	 *
	 * @param providedNamespace
	 * @param providerFunction
	 */
	Flower.prototype.provide = function (providedNamespace, providerFunction) {
		if (this._providers[providedNamespace]) {
			throw new Error('"' + providedNamespace + '" is already provided')
		} else {
			this._providers[providedNamespace] = providerFunction
			// Resolve pending requests
			var pendingRequestDescriptors = this._requestedBeforeProvided[providedNamespace]
			if (pendingRequestDescriptors) {
				var pendingRequestDescriptor
				for (var i = 0; i < pendingRequestDescriptors.length; i += 1) {
					pendingRequestDescriptor = pendingRequestDescriptors[i]
					try {
						pendingRequestDescriptor.resolver(providerFunction(pendingRequestDescriptor.args))
					} catch (err) {
						pendingRequestDescriptor.rejecter(err)
					}
				}
			}
		}
	}


	Flower.prototype.stopProviding = function (what) {
		delete this._providers[what]
	}


	exports.Flower = Flower;
}));
