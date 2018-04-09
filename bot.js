// binance bot

var axios = require('axios')

module.exports = class Bot{

    /*      TODO
        * хранение состояния бота в БД
        * загрузка состояния бота их БД
    */

	constructor({symbol, timeframe, buy, sell, startCandles}){

	    this.symbol = symbol
        this.timeframe = timeframe
        this.buy = buy
        this.sell = sell
        this.positionOpen = false
        this.candles = []

        this.streamName = symbol.toLowerCase()+'@kline_'+timeframe // ltcusdt@kline_1h


        axios.get('https://api.binance.com/api/v1/klines?symbol='+this.symbol.toUpperCase()+'&interval='+timeframe+'&limit='+startCandles)
            .then(response => {
                console.log('данные загружены в бота')
                this.candles = response.data
            })
            .catch(e => console.log('Ошибка при загрузке стартовых данных', e))

	}

	get endLastCandleTime(){
	    return this.candles[this.candles.length][6]
    }


    buyAsset(){

    }

    sellAsset(){

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

    makeDeal(action = 'none'){
        axios.get('https://api.binance.com/api/v1/depth?symbol=LTCUSDT&limit=5')
            .then(response => {

                var price = {
                    bid: response.data.bids[0][0], // цена покупки(на бирже)
                    ask: response.data.asks[0][0]  // цена продажи(на бирже)
                }

                if(action === 'buy'){
                    console.log(this.symbol, 'покупка по цене', price.ask)
                }

                if(action === 'sell'){
                    console.log(this.symbol, 'продажа по цене', price.bid)
                }

                console.log('BEST', price)
            })
            .catch(e => console.log('makeDeal что то не так', e))

    }

}