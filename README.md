# Trigger 

The translation between any orchestration system and the application state. This application 
is the workhorse of Harbor. It takes the application state and turns it into a living breathing 
application. Trigger's main goal is to create the entire stack in one function call. 

## Goals of Trigger

* create the underlying origin orhcestration application
* create edge layer load balancing

## How Does This Work 

Trigger is made up of providers. A provider is a orchestration system implementation. Each provider contains 
the same public methods, which do different actions depending upon the details that provider requires. 

When a provider is triggered, the api will request for the products state. This is done via a POST to trigger.

```
/trigger/:shipment/:environment/:provider
```

The application state can be fed from anywhere. The current model that drives trigger lives in [shipit](shipit).
The place that trigger reads the state from is just an environment variable, which defaults to `http://localhost:8081`.


[shipit]: https://github.com/turnerlabs/trigger-api
