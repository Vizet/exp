var express = require('express')
var axios = require('axios')
var io = require('socket.io').listen(80)

var app = express()

// cors on
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
})

app.get('/', function (req, res) {
    console.log('user request')

    axios.get('https://yobit.net/api/3/ticker/etc_usd')
        .then(function (response) {
            res.send(response.data)
        })
        .catch(function (err) {
            res.send('Какая то ошибка')
        })
})

// wss://stream.binance.com:9443

io.on('connection', function (socket) {
    console.log('socket connect')

    socket.on('dnoevent', function (txt) {
        console.log('txt', txt)
    })
})

app.listen('3000', function () {
    console.log('started')
})