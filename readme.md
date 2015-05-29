Flower: makes things work together 

#Rationale
Flower targets simplifying development and support of module interactions by following ideas:

  - Modules should know nothing about each other. Modules describe only requirements and reactions on events.
  - Events used for "push" model data flow, when data consumed by subscribers. 
  - Requests used for "pull" model, when information is requested on demand of consumer, and returned by provider.
  - Promises for requests and single events simplify chaining of callbacks.
  - Performance optimisations available could be done by both consumer and triggerer.


#API

##flower.on(eventName, handler)
Simple as events in javascript. Will execure `handler` when event with `eventName` will be triggered.

```
var flower = new Flower()
flower.on('event', function () {
    console.log('event triggered')
})
flower.trigger('event'); // log: 'event triggered'
flower.trigger('event'); // log: 'event triggered'
```

##flower.on(true, eventName, handler)
Will execute `handler` once after at least one trigger of event `eventName`, but execute `handler` only once, regardless how many
times event `eventName` was triggered between two `requestAnimationFrame` occurances (about 16ms in ideal situation). Execution is
done inside `requestAnimationFrame`. You would like to use this kind of scubscription in some view, that subscribes to data, that 
  changes more frequently, that page renders.
  
```
var flower = new Flower()
flower.on(true, 'event', function () {
    console.log('event triggered')
})
flower.trigger('event')
flower.trigger('event')
// After short timeout log: 'event triggered'
```

##flower.on(eventName, handler, context)
Will subscribe  as usual event, but will execute handler with `this` equals `context`. Also allows to ubsubscribe from event by `context`.
You would like to use this kind of subscription to provide correct context for method of a class, and allow to unsubscribe all
handlers of the class, when class is destroyed

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

##flower.on(eventName, handler, true)
Will subscribe `handler` to event `eventName` and will execute handler if event `'eventName'` already was triggered. You might want this
subscription for views, that initialize after models, or when you don't want to maintain modules initialization explicitly.

```
var flower = new Flower()
flower.trigger('event')
setTimeout(function () {
    flower.on('event', function () {
        console.log('event triggered')
    }, true) // log: event triggered
    flower.trigger('event') // log: event triggered
}, 1000)
```

```
var flower = new Flower()

// module Connection
flower.trigger('connection:ready')

// module User
flower.on('connection:ready', function () {
    authenticateUser()
}, true)
```

##flower.on(true, eventName, handler, context, true)
Executes handler with `this` equals `context`. Executes `handler` if event `'eventName'` was already triggered. Allows callback
to be executed only once per `requestAnimationFrame` (about 16ms). Allows to unsubscribe by `context` without having reference to `handler`


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