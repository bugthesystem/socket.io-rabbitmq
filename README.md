# socket.io-rabbitmq

socket.io adapter  [rabbitmq](https://www.rabbitmq.com/) implementation.

# Installing

```
$ npm install socket.io-rabbitmq
```

required the following:

- [socket.io-rabbitmq-server](https://github.com/ziyasal/socket.io-rabbitmq-server)


# Usage

```js
var io = require('socket.io')(3000);
var zmq = require('socket.io-rabbitmq');
io.adapter(zmq({
  host: '127.0.0.1',
  port: 5672
}));
```


# API

## adapter(opts)

The following options are allowed:

- `key`: the name of the key to pub/sub events on as prefix (`socket.io-rabbitmq`)
- `host`: host to connect to rabbitmq pub/sub server on (`127.0.0.1`)
- `port`: port to connect to rabbitmq pub/sub server on (`5672`)
- `pubClient`: optional, the rabbitmq client to publish events on
- `subClient`: optional, the rabbitmq client to subscribe to events on

If you decide to supply `pubClient` and `subClient`, make sure you use [amqplib](https://github.com/squaremo/amqp.node/) as a client or one with an equivalent API.


# Testing

First, run the socket.io rabbitmq server

```shell
$ socket.io-rabbitmq-server
```

after that, run the test.

```shell
$ make test
```


# License

[MIT license](https://github.com/ziyasal/socket.io-rabbitmq/blob/master/LICENSE)