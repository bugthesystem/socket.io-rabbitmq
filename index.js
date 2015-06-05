/**
 * import(s)
 */

var debug = require('debug')('socket.io-zeromq');
var Adapter = require('socket.io-adapter');
var format = require('util').format;
var amqp = require('amqplib/callback_api');
var msgpack = require('msgpack-js');
var uid2 = require('uid2');


/**
 * export(s)
 */

module.exports = adapter;

function adapter(opts) {
    opts = opts || {};
    opts.host = opts.host || '127.0.0.1';
    opts.port = opts.port || 5672;

    var pub = opts.pubClient;
    var sub = opts.subClient;
    var prefix = opts.key || 'socket.io-rabbitmq';

    this.url = opts.url ? opts.url : format('amqp://%s:%s', this.host, this.port);

    if (!pub) {
        _connect(this.url, function cb(err, ch) {
            if (err) return console.error("[AMQP]", err.message);

            pub = ch;
        });
    }

    if (!sub) {
        _connect(this.url, function cb(err, ch) {
            if (err) return console.error("[AMQP]", err.message);

            sub = ch;
        });
    }

    var key = prefix + '#emitter';


    /*
     * define RabbitMQ Adapter
     */

    function RabbitMQ(nsp) {
        Adapter.call(this, nsp);

        var self = this;
        sub.consume(key, this.onMessage.bind(this), {noAck: true});
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
            pub.publish("", key, data);
        }
    };

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


function _connect(url, cb) {
    amqp.connect(url, function (err, conn) {
        if (err) {
            return console.error("[AMQP]", err.message);
        }
        conn.on("error", function (err) {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", err.message);
            }
        });
        conn.on("close", function () {
            return console.error("[AMQP] reconnecting");
        });

        conn.createChannel(function on_open(err, ch) {
            if (err != null) {
                console.error("[AMQP] create channel error", err.message);
                return cb(err);
            }

            cb(null, ch);
        });
    });
}