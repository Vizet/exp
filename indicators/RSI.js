module.exports = function (series, period) {
    summ = (series) => series.reduce( (sum, el) => sum + el )

    average = (series) => summ(series) / series.length

    lastArrElem = (arr) => arr[arr.length - 1]


    function RMA(series, period){
        var RMAresult = []

        series.forEach((el, i) => {
            if(i < period - 1){
                RMAresult.push(0)
            }else if(i == period - 1){
                RMAresult.push( average(series.slice(0, period)) )
            }
            else{
                RMAresult.push( (lastArrElem(RMAresult)*(period - 1) + el) / period )
            }
        })

        return RMAresult
    }


    function RSI(series, period){
        var change = series.map( (el, i) => (i == 0) ? 0 : el - series[i - 1] )

        var gain = change.map(el => (el > 0) ? el : 0)
        var loss = change.map(el => (el < 0) ? Math.abs(el) : 0)


        var avgGain = RMA(gain, period)
        var avgLoss = RMA(loss, period)


        var RS = avgLoss.map( (el, i) => (el == 0) ? 0 : avgGain[i] / el)
        var RSIresult = RS.map( el=> 100 - 100 / (1 + el) )

        return RSIresult
    }

    return RSI(series, period)
}