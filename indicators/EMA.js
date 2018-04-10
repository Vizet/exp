module.exports = function(series, period){


    lastArrElem = (arr) => arr[arr.length - 1]


    function EMA(series, period){
        var k = 2 / ( period + 1)

        var EMAresult = []
        series.forEach((el, i) => {
            if(i == 0){
                EMAresult.push(el)
            }else{
                let EMAelem = ( el - lastArrElem(EMAresult) ) * k + lastArrElem(EMAresult)
                EMAresult.push( EMAelem )
            }
        })

        return EMAresult
    }

    return EMA(series, period)
}