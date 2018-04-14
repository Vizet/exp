var express = require('express')
var axios = require('axios')
const WebSocket = require('ws')
var io = require('socket.io').listen(80)
var mongoClient = require('mongodb').MongoClient

const Bot = require('./bot.js')
const RSI = require('./indicators/RSI.js')
const db = require('./DB')

var app = express()



// юзаю сокеты для конекта к стриму свечей


var botsCollection = {};

function startBots(botsArray){
    botsArray.forEach(currentBot=> {
        botsCollection[currentBot.streamName] = currentBot
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


let bnbBot = new Bot({
    symbol: 'bnbusdt',
    timeframe: '1h',
    buy: function (candles) {
        // colorBar
        let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
        let twoRedCandles = colorCandlesArr.every(el => el === 'red')


        // RSI
        let prices = candles.map(el => parseFloat(el[4]))
        let currentRSI = RSI(prices, 4).slice(-1)

        let candleSizes = candles.map(el => Math.abs(el[4] - el[1]))
        let avgCandleSize =  candleSizes.slice(-10).reduce( (sum, el) => sum + el) / 10
        let lastCandleSize = candleSizes[candleSizes.length - 1]

        let lastCandle = candles[candles.length - 1]
        let lastCandleRed = lastCandle[1] > lastCandle[4]

        let RSIbuy = (currentRSI < 24) && (lastCandleSize > avgCandleSize / 5) && lastCandleRed
        return twoRedCandles || RSIbuy
    },
    sell: function (candles) {


        // RSI
        let prices = candles.map(el => parseFloat(el[4]))
        let currentRSI = RSI(prices, 4).slice(-1)

        let candleSizes = candles.map(el => Math.abs(el[4] - el[1]))
        let lastCandleSize = candleSizes[candleSizes.length - 1]
        let avgCandleSize =  candleSizes.slice(-10).reduce( (sum, el) => sum + el) / 10

        let lastCandle = candles[candles.length - 1]
        let lastCandleGreen = lastCandle[4] > lastCandle[1]

        // console.log('sell', currentRSI, lastCandle, avgCandleSize, lastCandle[4], lastCandle[1])

        // FIX THIS
        let RSIsell = (currentRSI > 24) && (lastCandleSize > avgCandleSize / 2) && lastCandleGreen

        return RSIsell
    },
    startCandles: 500
})

bnbBot.runBacktest()



// cors on
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
})

app.get('/', function (req, res) {
    console.log('user request')
})

db.connect(function () {
    app.listen('3000', function () {
        // startBots([
        //     new Bot({
        //         symbol: 'bnbusdt',
        //         timeframe: '1m',
        //         buy: function (candles) {
        //             // colorBar
        //             let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
        //             let twoRedCandles = colorCandlesArr.every(el => el === 'red')
        //
        //             // RSI
        //             let currentRSI = RSI(candles, 4).slice(-1)
        //             let lastCandle = candles[candles.length]
        //             let avgCandleSize =  candles.slice(-10).reduce( (sum, el) => sum + el) / 10
        //
        //             let RSIbuy = (currentRSI < 24) && (lastCandle > avgCandleSize / 5) && (lastCandle[1] > lastCandle[4])
        //             return twoRedCandles || RSIbuy
        //         },
        //         sell: function (candles) {
        //             // colorBar
        //             let colorCandlesArr = candles.slice(candles.length - 2, candles.length).map(el => el[4] > el[1] ? 'green' : 'red')
        //             let oneGreenCandle = colorCandlesArr[colorCandlesArr.length - 1] === 'green'
        //
        //             // RSI
        //             let currentRSI = RSI(candles, 4).slice(-1)
        //             let lastCandle = candles[candles.length]
        //             let avgCandleSize =  candles.slice(-10).reduce( (sum, el) => sum + el) / 10
        //
        //             // FIX THIS
        //             let RSIsell = (currentRSI > 24) && (lastCandle > avgCandleSize / 2) && (lastCandle[4] > lastCandle[1])
        //
        //             return RSIsell
        //         },
        //         startCandles: 500
        //     })
        // ])
    })
})
// DB.db('admin').collection("bots").insert(_.cloneDeep(dno) , function(err, res){
//     console.log('записали сделку в базу')
// })