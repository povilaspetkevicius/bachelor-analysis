const mongoose = require('mongoose');

createConnection = () => {
    const mongo_url = 'mongodb://localhost:27017/airport_data';

    const mongo_options = {
        useNewUrlParser: true,
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 500,
        connectTimeoutMS: 10000,
    };
    
    mongoose.connect(mongo_url, mongo_options, function (err, res) {
        if (err) {
            writeError(error);
        } else {
            console.log('Succees. connected to: ' + mongo_url);
        }
    })
}

exports.connect = createConnection;