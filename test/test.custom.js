/**
 * import(s)
 */

var expect = require('expect.js');
var http = require('http').Server;
var io = require('socket.io');
var ioc = require('socket.io-client');
var async = require('async');
var amqp = require('amqplib/callback_api');
var Adapter = require('../');

function client(url, ns, opts) {
    if (typeof ns === 'object') {
        opts = ns;
        ns = null;
    }

    return ioc(url, opts);
}

function _connect(url, cb) {
    amqp.connect(url, function (err, conn) {
        if (err) {
            return console.error("[AMQP]", err.message);
        }

        conn.createChannel(function on_open(err, ch) {
            if (err != null) {
                console.error("[AMQP] create channel error", err.message);
                return cb(err);
            }

            cb(null, ch);
        });
    });
}


/**
 * test(s)
 */

describe('socket.io-rabbitmq', function () {
    describe('broadcast', function () {

        var url = process.env.RABBITMQ_URL ? process.env.RABBITMQ_URL : "amqp://192.168.59.103:5672";

        var publisher;
        var subscriber;

        beforeEach(function (done) {
            async.parallel([
                    function (callback) {
                        _connect(url, function cb(err, ch) {
                            if (err) return callback(err);

                            publisher = ch;
                            callback(null);
                        });
                    },
                    function (callback) {
                        _connect(url, function cb(err, ch) {
                            if (err) return callback(err);

                            subscriber = ch;
                            callback(null);
                        });
                    }
                ],
                function (err, results) {
                    done();
                });
        });


        afterEach(function (done) {
            publisher.close();
            subscriber.close();
            done();
        });


        it('should broadcast from a socket', function (done) {

            var srv = http();
            var sio = io(srv, {
                adapter: Adapter({
                    pubClient: publisher,
                    subClient: subscriber,
                    url: url
                })
            });


            srv.listen(8084, function () {
                var sockUrl = "http://localhost:8084";
                var cli = client(sockUrl, {forceNew: true});
                var cli2 = client(sockUrl, {forceNew: true});

                cli.on('connect', function () {
                    cli.emit('my event', {hello: 'world'});
                });

                cli2.on('connect', function () {
                    cli2.on('news', function (data) {
                        expect(data.hello).to.equal('world');
                        done();
                    });
                });

                sio.on('connection', function (socket) {
                    socket.on('my event', function (data) {
                        socket.broadcast.emit('news', data);
                    });
                });
            });

        });

    });
});
