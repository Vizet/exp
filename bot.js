// binance bot

var axios = require('axios')
var moment = require('moment')

var RSI = require('./indicators/RSI.js')
var db = require('./DB')

module.exports = class Bot{

    /*      TODO
        * хранение состояния бота в БД
        * загрузка состояния бота их БД
    */

	constructor({symbol, timeframe, buy, sell, startCandles}){
        db.connect(() => {
            this.symbol = symbol
            this.timeframe = timeframe
            this.buy = buy
            this.sell = sell
            this.positionOpen = false
            this.candles = []


            this.streamName = symbol.toLowerCase()+'@kline_'+timeframe // ltcusdt@kline_1h

            this.botHistory = {
                botName: this.streamName,
                startTime: moment().format('HH:mm:ss DD.MM.YYYY'),
                tradeHistory: []
            }


            axios.get('https://api.binance.com/api/v1/klines?symbol='+this.symbol.toUpperCase()+'&interval='+timeframe+'&limit='+startCandles)
                .then(response => {
                    console.log('данные загружены в бота', this.streamName)
                    this.candles = response.data
                    var close = this.candles.map(el => el[4])
                    var rsiRes = RSI(close, 14)
                    console.log(this.streamName, 'RSI', rsiRes.slice(-5))

                })
                .catch(e => console.log('Ошибка при загрузке стартовых данных', e))
        })
	}

	get endLastCandleTime(){
	    return this.candles[this.candles.length][6]
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

    // fake Deal
    makeDeal(action = 'none'){
        axios.get('https://api.binance.com/api/v1/depth?symbol='+this.symbol.toUpperCase()+'&limit=5')
            .then(response => {

                var price = {
                    bid: response.data.bids[0][0], // цена покупки(на бирже)
                    ask: response.data.asks[0][0]  // цена продажи(на бирже)
                }

                if(action === 'buy'){
                    this.botHistory.tradeHistory.push({
                        timeBuy: moment().format('HH:mm:ss DD.MM.YYYY'),
                        butPrice: price.ask
                    })
                    console.log(this.streamName, 'покупка по цене', price.ask)
                }

                if(action === 'sell'){
                    this.botHistory.tradeHistory[this.botHistory.tradeHistory.length - 1].timeSell = moment().format('HH:mm:ss DD.MM.YYYY')
                    this.botHistory.tradeHistory[this.botHistory.tradeHistory.length - 1].sellPrice = price.bid

                    db.get().collection("bots").insert(this.botHistory , (err, res) => {
                        if(err){
                            console.log(this.streamName, 'ошибка при записи в базу')
                        }
                        else{
                            console.log(this.streamName, 'сделка записана в базу')
                        }

                    })

                    console.log(this.streamName, 'продажа по цене', price.bid)
                }

                // console.log('BEST', price)
            })
            .catch(e => console.log('makeDeal что то не так', e))

    }

}