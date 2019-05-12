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
var flightInfoModel = require('mongoose').model('airport', new Schema({
    flightNumber: String,
    airline: String,
    arrival: String,
    arrivalIATA: String,
    departure: String,
    departureIATA: String
}));
exports.flightModel = flightModel;
exports.flightInfoModel = flightInfoModel;