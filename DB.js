var mongoClient = require('mongodb').MongoClient

console.log('Моудль DB заупщен')
let state = {
    db: null
}

exports.connect = function(done){
    if(state.db){
        return done()
    }

    mongoClient.connect("mongodb://localhost:27017/admin", function(err, database){
        if(err){
            return console.log('Ошибка подключеняи к БД', err)
        }

        state.db = database
        done()
    })
}

exports.get = function () {
    return state.db.db('admin')
}