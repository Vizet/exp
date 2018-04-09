var express = require('express')
var axios = require('axios')
var _ = require('lodash')

const WebSocket = require('ws')
var io = require('socket.io').listen(80)

var mongoClient = require('mongodb').MongoClient
var Bot = require('./bot.js')

var app = express()

var botState = {
    positionStatus: 'none',
    priceInfo: {

    }
}

var DB

var candleArr = []






// юзаю сокеты для конекта к стриму свечей



function objCandleToArray(objCandle) {
    return [
        objCandle.t,
        objCandle.o,
        objCandle.h,
        objCandle.l,
        objCandle.c,
        objCandle.v,
        objCandle.T,
        objCandle.q,
        objCandle.n,
        objCandle.V,
        objCandle.Q,

    ]
}


function makeDeal(action = 'none'){
    axios.get('https://api.binance.com/api/v1/depth?symbol=LTCUSDT&limit=5')
        .then(response => {

            var price = {
                bid: response.data.bids[0][0], // цена покупки(на бирже)
                ask: response.data.asks[0][0]  // цена продажи(на бирже)
            }

            if(action === 'buy'){
                console.log('фактическая цена открытия', price.ask)
                botState.priceInfo.openPriceFact = price.ask
                DB.db('admin').collection("bots").insert(botState.priceInfo, function(err, res){
                    console.log('записали сделку в базу')
                })
            }

            if(action === 'sell'){
                console.log('фактическая цена закрытия', price.bid)
                botState.priceInfo.clsoePriceFact = price.bid

                // тут запись в базу

                DB.db('admin').collection("bots").insert(botState.priceInfo, function(err, res){
                    console.log('записали сделку в базу')
                })
            }

            // console.log('BEST', price)
            console.log('--------------------------------------------------')
        })
        .catch(e => console.log('makeDeal что то не так', e))

}



function startBot(){
    axios.get('https://api.binance.com/api/v1/time')
        .then(response => {
            console.log('time', Date.now() - response.data.serverTime)
        })
        .catch(e => console.log(e))

    axios.get('https://api.binance.com/api/v1/klines?symbol=LTCUSDT&interval=1h&limit=3')
        .then(response => {
            candleArr = response.data
            // console.log('candleArr', candleArr)
            // setInterval(checkCandleEndTime.bind(this), 1000)
        })
        .catch(e => console.log(e))
}


var botsCollection = {};

function startBots(botsArray){
    botsArray.forEach(currentBotOptions => {

        let streamName = currentBotOptions.symbol.toLowerCase()+'@kline_'+currentBotOptions.timeframe // ltcusdt@kline_1h

        botsCollection[streamName] = new Bot(currentBotOptions)
    })


    console.log('botsCollection', botsCollection)

    let streamStr = Object.keys(botsCollection).join('/')
    console.log('streamStr', streamStr)

    const ws = new WebSocket('wss://stream.binance.com:9443/stream?streams='+streamStr);

    ws.on('message', function (streamData) {
        try{
            let objData = JSON.parse(streamData)
            botsCollection[objData.stream].processNewCandle(objData.data)
        }
        catch(e){
            console.log('ошибка при обработке новых данных', e, streamData)
        }

    })

}

startBots([
    {
        symbol: 'ltcusdt',
        timeframe: '1h',
        buy: function (candles) {
            let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
            let twoRedCandles = colorCandlesArr.every(el => el === 'red')
            return twoRedCandles
        },
        sell: function (candles) {
            let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
            let oneGreenCandle = colorCandlesArr[colorCandlesArr.length - 1] === 'green'
            return oneGreenCandle
        },
        startCandles: 3
    },
    {
        symbol: 'neousdt',
        timeframe: '1h',
        buy: function (candles) {
            let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
            let twoRedCandles = colorCandlesArr.every(el => el === 'red')
            return twoRedCandles
        },
        sell: function (candles) {
            let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
            let oneGreenCandle = colorCandlesArr[colorCandlesArr.length - 1] === 'green'
            return oneGreenCandle
        },
        startCandles: 3
    }
])



// const ws = new WebSocket('wss://stream.binance.com:9443/ws/ltcusdt@kline_1h');


// ws.on('message', function(data) {
//
//     let currentCandle = JSON.parse(data)
//
//     if(currentCandle.k.t === candleArr[candleArr.length - 1][0]){
//         console.log('текущая свеча уже в массиве, удаляем')
//         candleArr.pop()
//     }
//
//     if(currentCandle.k.x){
//         candleArr.push( objCandleToArray(currentCandle.k) )
//
//         // логику принятия решений пишу пока здесь
//
//         let colorCandlesArr = candleArr.slice(candleArr.length - 2, candleArr.length).map(el => el[4] > el[1] ? 'green' : 'red')
//
//         console.log('свеча закрылась, colorCandlesArr', colorCandlesArr)
//
//
//         if(botState.positionStatus === 'none'){
//             // позиция не открыта, ищем вход
//             const twoRedCandles = colorCandlesArr.every(el => el === 'red')
//
//
//             if(twoRedCandles){
//                 // покупаем
//                 makeDeal('buy')
//                 console.log('цена открытия позиции', colorCandlesArr, currentCandle.k.o)
//                 botState.positionStatus = 'opened'
//                 botState.priceInfo.openPrice = currentCandle.k.o
//
//             }else{
//                 // console.log('нет условий для покупки', colorCandlesArr)
//             }
//         }else if(botState.positionStatus === 'opened'){
//             // уже купили, пытаемся продать
//             const oneGreenCandle = colorCandlesArr[colorCandlesArr.length - 1] === 'green'
//
//             if(oneGreenCandle){
//                 // закрываем позицию(продаем)
//                 makeDeal('sell')
//                 console.log('цена закрытия позиции', colorCandlesArr, currentCandle.k.c)
//                 botState.priceInfo.closePrice = currentCandle.k.c
//
//                 botState.positionStatus = 'none'
//
//             }else{
//                 // console.log('еще не продаем', colorCandlesArr)
//             }
//         }
//
//
//
//     }else{
//         // console.log('открыта', objData.k.x)
//     }
//
//     // эта часть должна быть внтри бота
//
//
// });









// cors on
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
})

app.get('/', function (req, res) {
    console.log('user request')
})


mongoClient.connect("mongodb://localhost:27017/admin", function(err, database){
    if(err){
        return console.log('ошибка при коннекте к монге', err)
    }

    console.log('конект к db прошел')

    DB = database

    // добавленеи документа в коллекцию


    app.listen('3000', function () {

        // startBot()

        var dno = {
            a: 1,
            b: 2
        }

        // DB.db('admin').collection("bots").insert(_.cloneDeep(dno) , function(err, res){
        //     console.log('записали сделку в базу')
        // })
        //
        // DB.db('admin').collection("bots").insert(_.cloneDeep(dno), function(err, res){
        //     console.log('записали сделку в базу')
        // })


    })

    // botHistory.insertOne(bot, function(err, res){
    //     console.log('вроде как что то произошло')
    // })

})

