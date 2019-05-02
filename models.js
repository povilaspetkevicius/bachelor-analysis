const Schema = require('mongoose').Schema;

var flightSchema = new Schema({
    flightNumber: String,
    date: String,
    airport: String,
    scheduledTimeOfArrival: String,
    scheduledTimeOfDeparture: String,
    expectedTime: String,
    status: String
})
var flightModel = require('mongoose').model('flight', flightSchema);
exports.flightModel = flightModel;