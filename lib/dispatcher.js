(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['exports'], function (exports) {
			factory((root.Dispatcher = exports));
		});
	} else if (typeof exports === 'object') {
		// CommonJS
		factory(exports);
	} else {
		// Browser globals
		factory(root);
	}
}(this, function (exports) {
	'use strict';

	/**
	 * @typedef {{subscriber: Object|null, disabled:Boolean, eventData:Object|null}} SubscriptionDescriptor
	 */

	/**
	 * @typedef {Object<Array<SubscriptionDescriptor>>} SubscriptionDescriptorsStorage
	 */

	/**
	 * @constructor
	 */
	function Dispatcher() {
		/**
		 * Has-map of latest values, by triggered events
		 *
		 * @type {Object<*>}
		 * @private
		 */
		this._wasTriggeredWith = {};

		/**
		 * List of names of events, that planned to trigger on requestAnimationFrame
		 *
		 * @type {Object<*>}
		 * @private
		 */
		this._plannedToTrigger = {};
		this._plannedToExecuteTriggers = false;
		this._executingPlannedTriggers = false;

		/**
		 * Subscriptions, that will trigger only latest triggered by RAF value
		 *
		 * @type {SubscriptionDescriptorsStorage}
		 * @private
		 */
		this._plannedSubscriptions = {};
		this._plannedSubscribersWillExecute = false;

		/**
		 * Subscriptions, who will use latest triggered value by RAF
		 *
		 * @type {SubscriptionDescriptorsStorage}
		 * @private
		 */
		this._latestEventsDescriptors = {};
		/**
		 *
		 * @type {SubscriptionDescriptorsStorage}
		 * @private
		 */
		this._eventsDescriptors = {};

		this._requestedBeforeProvided = {};
		this._providers = {};

		/**
		 * Flag, that indicates, that there is a timeout planned, that will remove all disabled handlers
		 *
		 * @type {boolean}
		 * @private
		 */
		this._removingSubscribersRequested = false;
		Object.seal(this);
	}

	/**
	 * Registers event handler on provided storage
	 *
	 * @param {SubscriptionDescriptorsStorage} descriptorsStorage
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} [context]
	 * @private
	 */
	Dispatcher.prototype._registerEventHandlers = function (descriptorsStorage, eventName, handler, context) {
		if (!descriptorsStorage[eventName]) {
			descriptorsStorage[eventName] = [];
		}
		descriptorsStorage[eventName].push({
			handler: handler,
			subscriber: context,
			disabled: false
		});
	};

	/**
	 * Registers some callback to be triggered after some kinda event.
	 *
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} [subscriber] Context of invocation
	 */
	Dispatcher.prototype.subscribe = function (eventName, handler, subscriber) {
		// Handle case, when first argument is not passed
		var eventNames = eventName.split(/[ ,]+/);
		for (var i = 0; i < eventNames.length; i += 1) {
			eventName = eventNames[i];
			this._registerEventHandlers(this._eventsDescriptors, eventName, handler, subscriber);
		}
		return this;
	};

	/**
	 * Will trigger handler, if event eventName has already being triggered, and will subscribe to all subsequent event triggers
	 *
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} context
	 */
	Dispatcher.prototype.subscribeWithPast = function (eventName, handler, context) {
		if (eventName in this._wasTriggeredWith) {
			this._executeHandler(handler, context, this._wasTriggeredWith[eventName]);
		}
		this._registerEventHandlers(this._eventsDescriptors, eventName, handler, context);
	};

	/**
	 * Subscribes to eventName in a way, that handler will be executed not more, than once in RequestAnimationFrame timeout
	 *
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} [context]
	 */
	Dispatcher.prototype.subscribeThrottled = function (eventName, handler, context) {
		this._registerEventHandlers(this._latestEventsDescriptors, eventName, handler, context);
	};

	/**
	 * Subscribes in a way, that handler will be executed immediately if event already occurred, and will continue executed
	 * on event trigger not more, than once in RequestAnimationFrame timeout
	 *
	 * @param {String} eventName
	 * @param {Function} handler
	 * @param {Object} [context]
	 */
	Dispatcher.prototype.subscribeDebounced = function (eventName, handler, context) {
		if (eventName in this._wasTriggeredWith) {
			this._executeHandler(handler, context, this._wasTriggeredWith[eventName]);
		}
		this._registerEventHandlers(this._latestEventsDescriptors, eventName, handler, context);
	};

	/**
	 * Execute handler, catch error, throw in fancy way to continue handler execution
	 *
	 * @param {Function} handler
	 * @param {Object|undefined} context
	 * @param {*} eventData
	 * @private
	 */
	Dispatcher.prototype._executeHandler = function (handler, context, eventData) {
		try {
			handler.call(context || this, eventData);
		} catch (err) {
			requestAnimationFrame(function () {
				throw err;
			});
		}
	};

	/**
	 * For triggers, that work by model: many triggerers, but callbacks called only once,
	 * this function executes callacks in async way
	 *
	 * @private
	 */
	Dispatcher.prototype._executePlannedTriggers = function () {
		this._executingPlannedTriggers = true;
		for (var eventName in this._plannedToTrigger) {
			this.trigger(eventName, this._plannedToTrigger[eventName]);
			delete this._plannedToTrigger[eventName];
		}
		this._executingPlannedTriggers = false;
	};

	/**
	 * @private
	 */
	Dispatcher.prototype._executePlannedSubscribers = function () {
		for (var eventName in this._plannedSubscriptions) {
			// Don't trigger events, which has planned triggers
			if ((eventName in this._plannedToTrigger)) {
				continue;
			}
			this._triggerEvent(this._latestEventsDescriptors, eventName, this._wasTriggeredWith[eventName]);
			delete this._plannedSubscriptions[eventName];
		}
	};

	/**
	 * Notifies about event occurance. If optional parameter triggerOnlyLatest passed, will trigger latest of every triggered
	 * in a RequestAnimationFrame interval
	 *
	 * @param [triggerOnlyLatest] {Boolean}
	 * @param eventName {String}
	 * @param [eventData] {*}
	 */
	Dispatcher.prototype.trigger = function (triggerOnlyLatest, eventName, eventData) {
		// Handle case when first argument if not passed
		if (typeof triggerOnlyLatest === 'string') {
			eventData = eventName;
			eventName = triggerOnlyLatest;
			triggerOnlyLatest = false;
		}
		eventData = eventData != null ? eventData : null;
		if (triggerOnlyLatest) {
			this._plannedToTrigger[eventName] = eventData;
			if (!this._plannedToExecuteTriggers) {
				this._plannedToExecuteTriggers = true;
				requestAnimationFrame((function () {
					this._executePlannedTriggers();
					this._plannedToExecuteTriggers = false;
				}).bind(this));
			}
		} else {
			this._triggerEvent(this._eventsDescriptors, eventName, eventData);
			if (eventName in this._latestEventsDescriptors) {
				if (this._executingPlannedTriggers) {
					this._triggerEvent(this._latestEventsDescriptors, eventName, eventData);
				} else {
					this._plannedSubscriptions[eventName] = null; // mark for execution
					if (!this._plannedSubscribersWillExecute) {
						this._plannedSubscribersWillExecute = true;
						requestAnimationFrame((function () {
							this._executePlannedSubscribers();
							this._plannedSubscribersWillExecute = false;
						}).bind(this));
					}
				}
			}
		}
	};

	/**
	 * General method for executing structures with event descriptors
	 *
	 * @param eventsDescriptors {SubscriptionDescriptorsStorage}
	 * @param eventName {String}
	 * @param eventData [{Object}]
	 * @private
	 */
	Dispatcher.prototype._triggerEvent = function (eventsDescriptors, eventName, eventData) {
		this._wasTriggeredWith[eventName] = eventData != null ? eventData : null;
		var eventDescriptors = eventsDescriptors[eventName] || [];
		for (var i = 0; i < eventDescriptors.length; i += 1) {
			if (!eventDescriptors[i].disabled) {
				this._executeHandler(eventDescriptors[i].handler, eventDescriptors[i].subscriber, this._wasTriggeredWith[eventName]);
			}
		}
	};

	/**
	 * Returns promise, that resolves on some event occurrence
	 *
	 * @param [resolveImmediatelyIfAlreadyTriggered] {Boolean}
	 * @param eventName {String}
	 * @return {Promise}
	 */
	Dispatcher.prototype.when = function (eventName, resolveImmediatelyIfAlreadyTriggered) {
		resolveImmediatelyIfAlreadyTriggered = !!resolveImmediatelyIfAlreadyTriggered;
		return new Promise(function (resolve) {
			var self = this; // Want to avoid binding context to call "unsubscribe method"
			if (resolveImmediatelyIfAlreadyTriggered && (eventName in this._wasTriggeredWith)) {
				resolve(this._wasTriggeredWith[eventName]);
			} else {
				this.subscribe(eventName, function onceHandler(data) {
					resolve(data);
					self.unsubscribe(eventName, onceHandler);
				});
			}
		}.bind(this));
	};

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
	Dispatcher.prototype._markUnsubscribedHandlers = function (eventsDescriptors, eventToUnsubscribe, handler, subscriber) {
		var descriptors;
		if (eventToUnsubscribe && eventsDescriptors[eventToUnsubscribe]) {
			if (!handler && !subscriber) {
				console.warn('Either "handler" or "subscriber" should be defined');
				return;
			}
			descriptors = eventsDescriptors[eventToUnsubscribe];
			for (var i = 0; i < descriptors.length; i += 1) {
				this._markDescriptorDisabled(descriptors[i], handler, subscriber);
			}
		} else {
			for (var eventName in eventsDescriptors) {
				if (eventsDescriptors[eventName]) {
					descriptors = eventsDescriptors[eventName];
					for (var k = 0; k < descriptors.length; k += 1) {
						this._markDescriptorDisabled(descriptors[k], handler, subscriber);
					}
				}
			}
		}
	};

	/**
	 * Marks descriptor as "disabled" if handler or subscriber (or both, if defined) equals
	 * to descriptor's handler and (or) subscriber
	 *
	 * @param {Object} descriptor
	 * @param {Function} [handler]
	 * @param {*} [subscriber]
	 * @private
	 */
	Dispatcher.prototype._markDescriptorDisabled = function (descriptor, handler, subscriber) {
		if (!descriptor.disabled) {
			// Both handler and subscriber defined. Unsubscribe only from matched by both
			if ((handler && subscriber) && descriptor.handler === handler && descriptor.subscriber === subscriber) {
				descriptor.disabled = true;
			} else if (handler && descriptor.handler === handler) {
				descriptor.disabled = true;
			} else if (subscriber && descriptor.subscriber === subscriber) {
				descriptor.disabled = true;
			}
		}
	};

	/**
	 * Makes event callbacks not triggered again, plans cleanup removal cycle
	 *
	 * @param [onlyLatestEventsSubscribers] {Boolean} Flag, indicates, that programmer will
	 * to unsubscribe from only last event
	 * @param eventName {String}
	 * @param [handler] {Function}
	 * @param [subscriber] {Object} this context for {handler}
	 */
	Dispatcher.prototype.unsubscribe = function (onlyLatestEventsSubscribers, eventName, handler, subscriber) {
		// handle function's polymorphism
		if (typeof onlyLatestEventsSubscribers === 'string') {
			subscriber = handler;
			handler = eventName;
			eventName = onlyLatestEventsSubscribers;
			onlyLatestEventsSubscribers = false;
		}
		if (handler && typeof handler !== 'function') {
			subscriber = handler;
			handler = null;
		}
		// Remove ordinary handlers
		if (onlyLatestEventsSubscribers) {
			this._markUnsubscribedHandlers(this._latestEventsDescriptors, eventName, handler, subscriber);
		} else {
			this._markUnsubscribedHandlers(this._eventsDescriptors, eventName, handler, subscriber);
		}
		if (!this._removingSubscribersRequested) {
			this._removingSubscribersRequested = true;
			requestAnimationFrame(function () {
				this._removeHandlers(this._latestEventsDescriptors);
				this._removeHandlers(this._eventsDescriptors);
				this._removingSubscribersRequested = false;
			}.bind(this));
		}
	};

	/**
	 * Returns true for enabled descriptor.
	 * Used for mapping though arrays of descriptors
	 *
	 * @param descriptor
	 * @return {boolean}
	 * @private
	 */
	Dispatcher.prototype._isEnabled = function (descriptor) {
		return !descriptor.disabled;
	};

	/**
	 * Deletes information about handlers, who marked for unsubscription
	 *
	 * @param eventsDescriptors
	 * @private
	 */
	Dispatcher.prototype._removeHandlers = function (eventsDescriptors) {
		for (var eventName in eventsDescriptors) {
			var descriptors = eventsDescriptors[eventName];
			eventsDescriptors[eventName] = descriptors.filter(this._isEnabled);
			if (!eventsDescriptors[eventName].length) {
				delete eventsDescriptors[eventName];
			}
		}
	};

	/**
	 * Request some data by key. May pass one optional parameter. Returns {Promise}, that resolves when
	 * provider of {requestedNamespace} fulfills request
	 *
	 * @param requestedNamespace {String}
	 * @param [args] {*}
	 * @param [callback] {Function} optional callback to use instead of promise
	 * @return {Promise}
	 */
	Dispatcher.prototype.request = function (requestedNamespace, args, callback) {
		if (typeof args === 'function') {
			callback = args;
			args = callback;
		}
		if (this._providers[requestedNamespace]) {
			return new Promise(function (resolve) {
				var resolutionResult = this._providers[requestedNamespace](args);
				this._resolveRequest(resolutionResult, callback, resolve);
			}.bind(this));
		} else {
			if (!this._requestedBeforeProvided[requestedNamespace]) {
				this._requestedBeforeProvided[requestedNamespace] = [];
			}
			return new Promise((function (resolve, reject) {
				this._requestedBeforeProvided[requestedNamespace].push({
					resolver: function (resolutionResult) {
						this._resolveRequest(resolutionResult, callback, resolve)
					}.bind(this),
					rejecter: reject,
					args: args
				});
			}).bind(this));
		}
	};

	/**
	 * Declare callback, that resolves when provider function returns a value. If provider function returns
	 * a promise, returned by this method promise will resolve when provider's promise resolved
	 *
	 * @param providedNamespace
	 * @param providerFunction
	 */
	Dispatcher.prototype.provide = function (providedNamespace, providerFunction) {
		if (this._providers[providedNamespace]) {
			throw new Error('"' + providedNamespace + '" is already provided');
		} else {
			this._providers[providedNamespace] = providerFunction;
			// Resolve pending requests
			var pendingRequestDescriptors = this._requestedBeforeProvided[providedNamespace];
			if (pendingRequestDescriptors) {
				var pendingRequestDescriptor;
				for (var i = 0; i < pendingRequestDescriptors.length; i += 1) {
					pendingRequestDescriptor = pendingRequestDescriptors[i];
					try {
						pendingRequestDescriptor.resolver(providerFunction(pendingRequestDescriptor.args));
					} catch (err) {
						pendingRequestDescriptor.rejecter(err);
					}
				}
			}
		}
	};

	/**
	 * Stops providing data for namespace
	 *
	 * @param what
	 */
	Dispatcher.prototype.stopProviding = function (what) {
		delete this._providers[what];
	};

	/**
	 * General way of resolving data with callback and promise API
	 *
	 * @param {*} resolutionResult
	 * @param {Function|null|undefined} requestCallback
	 * @param {Function} promiseResolve
	 * @return {*}
	 * @private
	 */
	Dispatcher.prototype._resolveRequest = function (resolutionResult, requestCallback, promiseResolve) {
		if (requestCallback) {
			if (resolutionResult && typeof resolutionResult.then === 'function') {
				resolutionResult.then(requestCallback);
				return resolutionResult;
			} else {
				requestCallback(resolutionResult);
			}
		}
		promiseResolve(resolutionResult);
	}

	exports.Dispatcher = Dispatcher;
}));
