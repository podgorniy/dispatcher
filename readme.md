Flower: makes things work together 

#Rationale

Managing events in large systems sucks. Flower makes this problem less noticable. Flower targets simplifying development
and support of module interactions by following ideas:

  - Modules should know nothing about each other. Modules describe only requirements and reactions on events.
  - Events used for "push" model data flow, when data consumed by subscribers. 
  - Requests used for "pull" model, when information is requested on demand of consumer, and returned by provider.
  - Promises for requests and single events simplify chaining of callbacks.
  - Performance optimisations available could be done by both consumer and triggerer.


#API

##flower.on(eventName, handler [, context])
Will execute `handler` when event with `eventName` will be triggered. Optional parameter `context` will be used as `this` during
`handler` invocation.

```
var flower = new Flower()
var handlerContext = {user: 'Fred'}
flower.on('event', function (eventData) {
    console.log(this) // {user: 'Fred'}
    console.log(eventData) // 100500
}, handlerContext)
flower.trigger('event', 100500);
```

```
var cat = {
    word: 'mew',
    say: function () {
        console.log('Cat says ' + this.word)
    }
}
var dog = {
    word: 'bark',
    say: function () {
        console.log('Dog says ' + this.word)
    }
}
var flower = new Flower()
flower.on('showFood', cat.say, cat)
flower.on('showFood', dog.say, dog)
flower.trigger('showFood')
// log: Cat says mew
// log: Dog says bark
```

Now unsubscribe all `cat` handlers from event `'showFood'`, trigger event, and see, that only `dog` reacts on an action.


```
flower.off('showFood', cat)
flower.trigger('showFood')
// log: Dog says bark
```

##flower.onWithRAF(eventName, handler [, context])
Will execute `handler` once after at least one trigger of event `eventName`. `handler` will be executed latest event data, provided by `trigger` method,
regardless how many times event `eventName` was triggered between two `requestAnimationFrame` occurances (about 16ms in ideal situation). Execution is
done inside `requestAnimationFrame`. You would like to use this kind of subscription in some view, that subscribes to data, that
changes more frequently, that page renders.
  
```
var flower = new Flower()
flower.onWithRAF('event', function (eventData) {
    console.log('event triggered', eventData)
})
flower.trigger('event', 100500)
flower.trigger('event', 200600)
// After short timeout log: 'event triggered', 200600
```

##flower.onWithPast(eventName, handler [, context])
Works like '.on', but executes `handler` (with `this` equals optional `context`) if event `eventName` was already triggered
 
```
var flower = new Flower()
flower.trigger('event', 'uno')
flower.onWithPast('event', function (eventData) {
    console.log(eventData) // "uno"
})
flower.trigger('event', 'tuo'); // "tuo"
```

##flower.onWithRAFAndPast(eventName, handler [, context])
##flower.onWithPastAndRAF(eventName, handler [, context])
Two equal methods. Triggers `handler` with this equals optional `context`, if event `eventName` was already triggered,
and continue triggering handler not more, than once in a `requestAnimationFrame` interval. 


##flower.trigger(eventName, data)
Triggers event `eventName` and passes `data` as argument to event handler.

Plays nicely with handlers, that subscribed to latest triggered event and with '.when' method

```
var flower = new Flower()
flower.on('eventName', function (data) {console.log('eventName', data)})
flower.on(true, 'eventName', function (data) {console.info('eventName', data)})
flower.trigger('eventName', 0) // log: 0
flower.trigger('eventName', 1) // log: 1
flower.trigger('eventName', 100500) // log: 100500
// info: 100500
```

##flower.when(resolveImmediatelyIfAlreadyTriggered, eventName)
Returns promise, that resolves when event `'eventName'` is triggered. You might want tot use this method for chaining events with
`Promise.all` or for subscribing for event once. Plays nicely with throttled event executors, unexisting events and pasing data to event handlers.
If optional boolean argument `resolveImmediatelyIfAlreadyTriggered` is `true`, resolves promise if event was triggered

 ```
 var flower = new Flower()
 flower.when('eventName', function (data) {
    console.log('event', 'eventName', 'occured', data)
 });
 flower.trigger(true, 'eventName', 0)
 flower.trigger(true, 'eventName', 1)
 flower.trigger(true, 'eventName', 100500)
 ```
 
##flower.request(provisionName, args)
Returns a promise, that resolves, with data from provider function. May pass arguments to provider function

```
var flower = new Flower()
flower.provide('userId', function () {
    return 100500
})
flower.request('userId').then(function (uid) {
    console.log(uid); // 100500
})
```

##flower.provide(provisionName, providerFunction)
Declares provider of some `provisionName` (a string - name of provided information). `providerFunction` should return 
data of provision. 

```
var flower = new Flower()
flower.provide('userId', function () {
    return 100500
})
flower.request('userId').then(function (uid) {
    console.log(uid); // 100500
})
```

Argument, passed with request, will be passed to provider function. If `providerFunction` function returns a promise, client, who requested provision, will be fullfilled
with promise from `providerFunction`.

```
var flower = new Flower()
flower.provide('adverts', function (userId) {
    return new Promise(function (resolve) {
        setTimeout(function() {
            resolve('adv-userId' + Date.now())
        }, 2000)
    })
})
flower.request('adverts', 'Sergey').then(function (advertId) {
    console.log(advertId); // adv-userId1432843002151
})
```