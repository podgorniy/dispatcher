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
		this._wasTriggered = {}

		// List of names of events, that planned to trigger on requestAnimationFrame
		// this list event will. Used by .on(true, EVENT_NAME) invocation type
		this._plannedToTrigger = {}
		this._plannedToExecuteTriggers = false
		this._executingPlannedTriggers = false

		// Triggerers, that will trigger only latest triggered by RAF value
		this._plannedSubscriptions = {}
		this._plannedSubscribersWillExecute = false

		// Subscribers, who will use latest triggered value by RAF
		/**
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
		this.bindMethods()
		Object.seal(this)
	}


	Flower.prototype.bindMethods = function () {
		this.on = this.on.bind(this)
		this.off = this.off.bind(this)
		this.trigger = this.trigger.bind(this)
		this.when = this.when.bind(this)
		this.provide = this.provide.bind(this)
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
	 * Registers some callback to be triggered after some kinda event. Allows to trigger callback immidiatly,
	 * if event already occured. Allows to trigger callback only once per RequestAnimation frame
	 *
	 * flower.on('event', callback)
	 * flower.on(true, 'event', callback) // subscribe to latest of multiple triggered events
	 * flower.on(true, 'event', callback, context) // subscribe to latest of multiple triggered events
	 * flower.on(true, 'event', callback, context, true) // subscribe to latest of multiple triggered events
	 * flower.on('event', callback, context) // define "this" context
	 * flower.on('event', callback, true) // invoke subscription, if
	 * flower.on('event', callback, context, true) // invoke subscription, if
	 *
	 * @param {Boolean} [subscribeToLatestEvents] Skips callback invocation for multiple sync triggerers, and uses only latest triggerer
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} [subscriber] Context of invocation
	 * @param {Boolean} [invokeImmediatelyIfPossible] Invoke callback, if event was already triggered
	 */

	Flower.prototype.on = function (subscribeToLatestEvents, eventName, handler, subscriber, invokeImmediatelyIfPossible) {
		// Handle case, when first argument is not passed
		if (typeof subscribeToLatestEvents === 'string') {
			invokeImmediatelyIfPossible = subscriber
			subscriber = handler
			handler = eventName
			eventName = subscribeToLatestEvents
			subscribeToLatestEvents = false
		}
		// Handle optional last parameters
		if (typeof subscriber === 'boolean') {
			invokeImmediatelyIfPossible = subscriber
			subscriber = null
		}
		var eventNames = eventName.split(/[ ,]+/)
		for (var i = 0; i < eventNames.length; i += 1) {
			eventName = eventNames[i]
			// Executes callback, if event already has been triggered
			if (invokeImmediatelyIfPossible) {
				if (eventName in this._wasTriggered) {
					try {
						handler.call(subscriber || this, this._wasTriggered[eventName])
					} catch (err) {
						requestAnimationFrame(function () {
							throw(err)
						})
					}
				}
			}
			// function body Logic
			if (subscribeToLatestEvents) {
				this._registerEventHandlers(this._latestEventsDescriptors, eventName, handler, subscriber)
			} else {
				// Classical sync subscription
				this._registerEventHandlers(this._eventsDescriptors, eventName, handler, subscriber)
			}
		}
		return this
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
			this._triggerEvent(this._latestEventsDescriptors, eventName, this._wasTriggered[eventName])
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
		this._wasTriggered[eventName] = eventData != null ? eventData : null
		var eventDescriptors = eventsDescriptors[eventName] || []
		for (var i = 0; i < eventDescriptors.length; i += 1) {
			if (!eventDescriptors[i].disabled) {
				try {
					eventDescriptors[i].handler.call(eventDescriptors[i].subscriber || this, this._wasTriggered[eventName])
				} catch (err) {
					requestAnimationFrame(function () {
						throw(err)
					})
				}
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
			if (resolveImmediatelyIfAlreadyTriggered && (eventName in this._wasTriggered)) {
				resolve(this._wasTriggered[eventName])
			} else {
				this.on(eventName, function onceHandler(data) {
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
		var descriptor
		var descriptors
		if (eventToUnsubscribe && eventsDescriptors[eventToUnsubscribe]) {
			if (!handler && !subscriber) {
				return
			}
			descriptors = eventsDescriptors[eventToUnsubscribe]
			for (var i = 0; i < descriptors.length; i += 1) {
				descriptor = descriptors[i]
				if (!descriptor.disabled &&
					((handler && descriptor.handler === handler) || (subscriber && descriptor.subscriber === subscriber))) {
					descriptor.disabled = true
				}
			}
		} else {
			for (var eventName in eventsDescriptors) {
				if (eventsDescriptors[eventName]) {
					descriptors = eventsDescriptors[eventName]
					for (var k = 0; k < descriptors.length; k += 1) {
						descriptor = descriptors[k]
						if (!descriptor.disabled &&
							((handler && descriptor.handler === handler) || (subscriber && descriptor.subscriber === subscriber))) {
							descriptor.disabled = true
						}
					}
				}
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
				this._removeHandlers()
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
