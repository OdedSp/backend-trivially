const mongodb = require ('mongodb')

exports.dbConnect =  function dbConnect() {
    
        return new Promise((resolve, reject) => {
            // Connection URL
            var url = 'mongodb://localhost:27017/trivue';
            // Use connect method to connect to the Server
            mongodb.MongoClient.connect(url, function (err, db) {
                if (err) {
                    cl('Cannot connect to DB', err)
                    reject(err);
                }
                else {
                    //cl('Connected to DB');
                    resolve(db);
                }
            });
        });
    }

