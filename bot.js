// binance bot

var axios = require('axios')
var moment = require('moment')

var RSI = require('./indicators/RSI.js')
var db = require('./DB')
var ObjectID = require('mongodb').ObjectID

const binance = require('node-binance-api');

module.exports = class Bot{

    /*      TODO
        * хранение состояния бота в БД
        * загрузка состояния бота их БД
    */

	constructor({symbol, timeframe, buy, sell, startCandles, quantity, mode}){
        // db.connect(() => {
        this.symbol = symbol
        this.timeframe = timeframe
        this.startCandles = startCandles
        this.buy = buy
        this.sell = sell
        this.positionOpen = false
        this.candles = []
        this.quantity = quantity
        this.mode = mode

        this.positionOpen = false
        this.lastDeal = {}
        this.mongoID = null

        this.streamName = symbol.toLowerCase()+'@kline_'+timeframe // ltcusdt@kline_1h
	}

	init(){
        this.initDbConnect()


        axios.get('https://api.binance.com/api/v1/klines?symbol='+this.symbol.toUpperCase()+'&interval='+this.timeframe+'&limit='+this.startCandles)
            .then(response => {
                console.log('данные загружены в бота', this.streamName)
                this.candles = response.data
                var close = this.candles.map(el => el[4])
                var rsiRes = RSI(close, 4)
                console.log(this.streamName, 'RSI', rsiRes.slice(-5))

            })
            .catch(e => console.log('Ошибка при загрузке стартовых данных', e))
    }

	initDbConnect(){
	    let insertData= {
            botName: this.streamName,
            startTime: moment().format('HH:mm:ss DD.MM.YYYY'),
            tradeHistory: []
        }

	    db.connect(() =>{
	        console.log(this.streamName, 'Лог бота создан')
            db.get().collection("bots").insert(insertData , (err, res) => {
                if(err){
                    console.log(this.streamName, 'ошибка создания лога')
                }
                else{
                    console.log(this.streamName, 'лог успешно создан')
                }

                this.mongoID = insertData._id;

            })
        })
    }

    updateDbLog(){
        db.get().collection("bots").updateOne({_id: ObjectID(this.mongoID)}, {$push: {tradeHistory: this.lastDeal}}, (err, res) => {
            if(err){
                console.log('ошибка обновленяи записи', err)
            }else{
                console.log('------------------------------------------')
            }

            this.lastDeal = {}

        })
    }


    objCandleToArray(objCandle) {
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


    processNewCandle(newCandle){

        if(this.candles.length > 0 && newCandle.k.t === this.candles[this.candles.length - 1][0]){
            this.candles.pop()
        }

        if(newCandle.k.x){
            this.candles.push(this.objCandleToArray(newCandle.k))

            if(!this.positionOpen){
                if(this.buy(this.candles)){
                    this.makeDeal('buy')
                    this.positionOpen = true
                }
            }
            else{
                if(this.sell(this.candles)){
                    this.makeDeal('sell')
                    this.positionOpen = false
                }
            }

        }
    }

    makeDeal(action = 'none'){
        let realMode = true

        if(realMode){
            this.realDeal(action)
        }else{
            this.fakeDeal(action)
        }
    }

    realDeal(action = 'none'){
        if(action === 'buy'){
            binance.marketBuy(this.symbol.toUpperCase(), this.quantity, (error, response) => {
                if(error){
                    console.log('ошибка покупки', error)
                }
                else{
                    binance.trades(this.symbol.toUpperCase(), (error, trades, symbol) => {
                        if(error){
                            console.log('ошибка получения информации о ордере на покупку', error)
                        }
                        else{
                            this.lastDeal.buyPrice = trades.find(el => el.orderId == response.orderId).price
                            this.lastDeal.timeBuy = moment().format('HH:mm:ss DD.MM.YYYY')
                            console.log(this.streamName, this.lastDeal.timeBuy, this.lastDeal.buyPrice)
                        }
                    })
                }

            })
        }

        if(action === 'sell'){
            binance.marketSell(this.symbol.toUpperCase(), this.quantity, (error, response) => {
                if(error){
                    console.log('ошибка продажи', error)
                }
                else{
                    binance.trades(this.symbol.toUpperCase(), (error, trades, symbol) => {
                        if(error){
                            console.log('ошибка получения информации о ордере на продажу', error)
                        }
                        else {
                            this.lastDeal.buyPrice = trades.find(el => el.orderId === response.orderId).price
                            this.lastDeal.timeSell = moment().format('HH:mm:ss DD.MM.YYYY')
                            this.updateDbLog()

                            console.log(this.streamName, this.lastDeal.timeBuy, this.lastDeal.buyPrice);
                        }
                    })
                }

            })
        }
    }

    // emulate Deal (only gets price)
    fakeDeal(action = 'none'){
        binance.bookTickers(this.symbol.toUpperCase(), (error, ticker) => {
            if(action === 'buy'){
                this.lastDeal.timeBuy = moment().format('HH:mm:ss DD.MM.YYYY')
                this.lastDeal.buyPrice = ticker.askPrice

                console.log(this.streamName, this.lastDeal.timeBuy, 'покупка по цене', ticker.askPrice)
            }

            if(action === 'sell'){
                this.lastDeal.timeSell = moment().format('HH:mm:ss DD.MM.YYYY')
                this.lastDeal.sellPrice = ticker.bidPrice

                this.updateDbLog()

                console.log(this.streamName, this.lastDeal.timeSell,'продажа по цене', ticker.bidPrice)
            }

        });
    }

    runBacktest(){
        axios.get('https://api.binance.com/api/v1/klines?symbol='+this.symbol.toUpperCase()+'&interval='+this.timeframe+'&limit=200')
            .then(response => {

                let allCandles = response.data
                allCandles = allCandles.map(candle => candle.map(el => parseFloat(el)))

                let currentCandles = []
                var positionOpen = false

                var needToBuy = false
                var needToSell = false

                let tradeLog = []

                console.log('Данные для бэктеста получены')

                allCandles.forEach( (thisCandle, i) => {
                    currentCandles = allCandles.slice(0, i + 1)

                    if(needToBuy){
                        console.log(this.streamName, moment(thisCandle[0]).format('HH:mm:ss DD.MM.YYYY'), 'покупка по цене', thisCandle[1])
                        needToBuy = false
                        // tradeLog.push({buy: thisCandle[1]})
                    }

                    if(needToSell){
                        console.log(this.streamName, moment(thisCandle[0]).format('HH:mm:ss DD.MM.YYYY'), 'продажа по цене', thisCandle[1])
                        needToSell = false
                        // tradeLog[tradeLog.length - 1].sell = thisCandle[1]
                    }

                    // console.log(positionOpen, this.buy(currentCandles), this.sell(currentCandles))

                    if(i > 30){
                        if(positionOpen == false){
                            if(this.buy(currentCandles)){
                                positionOpen = true
                                needToBuy = true
                            }
                        }
                        else{
                            if(this.sell(currentCandles)){
                                positionOpen = false
                                needToSell = true
                            }
                        }
                    }
                })

                // console.log('Всего сделок', tradeLog.length)
                // console.log('Прибыльных', tradeLog.reduce( (sum, el) => sum + (el.sell > el.buy) ? 1 : 0) )

            })
            .catch(e => console.log('Ошибка при загрузке бэктеста', e))
    }

}