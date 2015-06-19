/**
 * import(s)
 */

var debug = require('debug')('socket.io-zeromq');
var Adapter = require('socket.io-adapter');
var format = require('util').format;
var amqp = require('amqplib');
var msgpack = require('msgpack-js');


/**
 * export(s)
 */

module.exports = adapter;

function errorHandler(err) {
    return console.error("[AMQP]", err.message);
    //TODO: process.exit(1) //??
}

function adapter(opts) {
    opts = opts || {};
    opts.host = opts.host || '127.0.0.1';
    opts.port = opts.port || 5672;

    var pub = opts.pubClient;
    var sub = opts.subClient;
    var prefix = opts.key || 'socketiorabbitmq';
    var exchange = 'socketiorabbitmq';
    var rabbitConn;
    var queue;

    this.url = opts.url ? opts.url : format('amqp://%s:%s', this.host, this.port);

    if (!pub) {
        // Create the rabbit connection
        amqp.connect(this.url)
            .then(function (conn) {
                rabbitConn = conn;
                // Create the rabbit channel
                return rabbitConn.createChannel();
            }).then(function (ch) {
                pub = ch;
                // Create the exchange (or do nothing if it exists)
                return pub.assertExchange(exchange, 'topic', {durable: false});
            }).catch(errorHandler);
    } else {
        pub.assertExchange(exchange, 'topic', {durable: false});
    }

    if (!sub) {

        // Create the rabbit connection
        amqp.connect(url)
            .then(function (conn) {
                rabbitConn = conn;

                // Create the rabbit channel
                return rabbitConn.createChannel();
            }).then(function (ch) {
                sub = ch;

                // Create the exchange (or do nothing if it exists)
                return sub.assertExchange(exchange, 'topic', {durable: false});
            }).then(function () {
                // Create the queue
                return sub.assertQueue('', {exclusive: true});
            }).then(function (q) {
                queue = q.queue;
                // Bind the queue to all topics about given key.
                return sub.bindQueue(queue, exchange, format('%s.*', prefix));
            }).catch(errorHandler);
    } else {
        sub.assertQueue('', {exclusive: true})
            .then(function (q) {
                queue = q.queue;
                // Bind the queue to all topics about given key.
                return sub.bindQueue(queue, exchange, format('%s.*', prefix));
            }).catch(errorHandler);
    }

    var key = prefix + '.emitter';

    /*
     * define RabbitMQ Adapter
     */

    function RabbitMQ(nsp) {
        Adapter.call(this, nsp);

        sub.consume(queue, this.onMessage.bind(this));
    }

    RabbitMQ.prototype.__proto__ = Adapter.prototype;

    RabbitMQ.prototype.onMessage = function (msg) {
        if (msg !== null) {
            msg = msg.content;

            var offset = channelOffset(msg);
            var channel = msg.slice(0, offset);
            debug('RabbitMQ#onMessage: channel = %s', channel.toString());


            var payload = msgpack.decode(msg.slice(offset + 1, msg.length));
            debug('RabbitMQ#onMessage: payload = %j', payload);
            if (payload[0] && payload[0].nsp === undefined) {
                payload[0].nsp = '/';
            }

            if (!payload[0] || payload[0].nsp != this.nsp.name) {
                return debug('RabbitMQ#onMessage: ignore different namespace');
            }

            payload.push(true);
            this.broadcast.apply(this, payload);
        }
    };

    RabbitMQ.prototype.broadcast = function (packet, opts, remote) {
        Adapter.prototype.broadcast.call(this, packet, opts);
        if (!remote) {
            var channel = new Buffer(format('%s ', key), 'binary');
            var payload = msgpack.encode([packet, opts]);
            var data = Buffer.concat([channel, payload]);
            debug('RabbitMQ#broadcast: send data length -> channel = %d, payload = %d, data = %d', channel.length, payload.length, data.length);

            //TODO: Examine how redis adapter works
            pub.publish(exchange, key, data);
        }
    };

    RabbitMQ.pubClient = pub;
    RabbitMQ.subClient = sub;
    return RabbitMQ;
}

function channelOffset(msg) {
    var offset = 0;
    for (var i = 0; i < msg.length; i++) {
        if (msg[i] === 0x20) { // space
            offset = i;
            break;
        }
    }
    return offset;
}