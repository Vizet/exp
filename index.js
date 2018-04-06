var express = require('express')
var axios = require('axios')
var io = require('socket.io').listen(80)
const WebSocket = require('ws')

var mongoClient = require('mongodb').MongoClient
var Bot = require('./bot.js')

var app = express()

var botState = {
    positionStatus: 'none'
}

var dbGlobal // что то нужно с этим сделать

// юзаю сокеты для конекта к стриму свечей

const ws = new WebSocket('wss://stream.binance.com:9443/ws/ltcusdt@kline_1m');

function makeDeal(action = 'none'){
    axios.get('https://api.binance.com/api/v1/depth?symbol=LTCUSDT&limit=5')
    .then(response => {

        var price = {
            bid: response.data.bids[0][0], // цена покупки(на бирже)
            ask: response.data.asks[0][0]  // цена продажи(на бирже)
        }

        if(action == 'buy'){
            console.log('покупка по цене', price.ask)
        }

        if(action == 'sell'){
            console.log('продажа по цене', price.bid)
        }

        console.log('BEST', price)
    })
    .catch(e => console.log('makeDeal что то не так', e))

}

ws.on('message', function incoming(data) {
    
    objData = JSON.parse(data)
    if(objData.k.x){
        console.log('свеча закрыта', objData.k.x)

        axios.get('https://api.binance.com/api/v1/klines?symbol=LTCUSDT&interval=1m&limit=3')
        .then(response => {
            // логику принятия решений пишу пока здесь
            var arr = response.data.map(el => el[4] > el[1] ? 'green' : 'red')
            arr.pop() // удаляем последнюю свечу тк она текущая - те только открылась


            if(botState.positionStatus == 'none'){
                // позиция не открыта, ищем вход
                const twoRedCandles = arr.every(el => el == 'red')
                

                if(twoRedCandles){
                    // покупаем
                    makeDeal('buy')

                }else{
                    console.log('нет условий для покупки', arr)
                }
                console.log(arr.every(el => el == 'red'))
            }

            if(botState.positionStatus = 'opened'){
                const oneGreenCandle = arr[arr.length - 1] == 'green'

                if(oneGreenCandle){
                    // закрываем позицию(продаем)
                    makeDeal('sell')

                }else{
                    console.log('еще не продаем')
                }
            }

            console.log('получил весь чарт', arr)

        })

    }else{
        console.log('открыта', objData.k.x)
    }

    // эта часть должна быть внтри бота

    
});

mongoClient.connect("mongodb://localhost:27017/admin", function(err, db){
    if(err){
        return console.log('что-то пошло не так', err)
    }

    console.log('конект к db прошел')

    // добавленеи документа в коллекцию

    // var collection = db.db('admin').collection("bots")
    // var bot = {
    //     name: 'my first bot1',
    //     type: 'some type',
    //     currency: 'LTCUSDT',
    //     birzha: 'binance'
    // }

    // collection.insertOne(bot, function(err, res){
    //     console.log('вроде как что то произошло')
    // })

    db.close()
})

var b = new Bot();
b.sayRak()



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


io.on('connection', function (socket) {
    console.log('socket connect')

    socket.on('dnoevent', function (txt) {
        console.log('txt', txt)
    })
})

app.listen('3000', function () {
    console.log('started')
})