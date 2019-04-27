const express = require('express');
const mongoose = require('mongoose');
const _ = require('underscore');
const Schema = mongoose.Schema;
const app = express()
const port = 3000


let router = express.Router();

let flightRouter = express.Router();

let statusRouter = express.Router();

let airportRouter = express.Router();

const mongo_url = 'mongodb://localhost:27017/airport_data';

const mongo_options = {
    useNewUrlParser: true,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: 500,
    connectTimeoutMS: 10000,
};

var flightSchema = new Schema({
    flightNumber: String,
    date: String,
    airport: String,
    scheduledTimeOfArrival: String,
    scheduledTimeOfDeparture: String,
    expectedTime: String,
    status: String
});
var flightModel = mongoose.model('flight', flightSchema);


mongoose.connect(mongo_url, mongo_options, function (err, res) {
    if (err) {
        writeError(error);
    } else {
        console.log('Succees. connected to: ' + mongo_url);
    }
})

statusRouter.get('/', (req, res) => {
    if (req.flightNo !== '' && req.flightNo.length !== 0) {
        flightModel.find({ flightNumber: req.flightNo }, (err, flights) => {
            if (err) {
                res.status(503).send('Internal error');
            } else if (flights.length === 0) {
                res.status(204).send('No Flights found containing flight number: ' + req.params.flightNumber);
            } else {
                let statuses = [];
                flights = flights.filter((e) => {
                    return e.status.length > 0;
                }).forEach((e) => {
                    statuses.push(e.status);
                });
                res.send(statuses);
            }
        })
    }
});

flightRouter.use('/status', statusRouter);

flightRouter.get('/', (req, res) => {
    if (req.airport.length > 0 && req.airport !== null && req.airport !== undefined) {
        flightModel.find({ airport: req.airport }, (err, flights) => {
            console.log(flights.length);
            if (err) {
                res.status(503).send('Internal server error');
            } else if (flights.length === 0) {
                res.status(204).send('No flights for airport ' + req.airport + ' found');
            } else {
                let flightNo = [];
                flights.forEach((el) => {
                    flightNo.push(el.flightNumber);
                });
                res.send(_.uniq(flightNo));
            }
        })
    } else {
        flightModel.find().distinct('flightNumber', (err, flights) => {
            res.send(flights);
        });
    }
});

flightRouter.get('/all', (req, res) => {
    if (req.airport.length > 0 && req.airport !== null && req.airport !== undefined) {
        flightModel.find({ airport: req.airport }, (err, flights) => {
            if (err) {
                res.status(503).send('Internal server error');
            } else if (flights.length === 0) {
                res.status(204).send('No flights for airport ' + req.airport + ' found');
            } else {
                res.send(flights);
            }
        });
    } else {
        flightModel.find({}, (err, flights) => {
            res.send(flights);
        });
    }
});

flightRouter.get('/:flightNumber', (req, res) => {
    flightModel.find({ flightNumber: req.params.flightNumber }, (err, flights) => {
        if (flights.length === 0) {
            res.status(204).send('No Flights found containing flight number: ' + req.params.flightNumber);
        } else {
            res.status(200).send(flights);
        }
    });

});

flightRouter.use('/:flightNumber/status', function (req, res, next) {
    req.flightNo = req.params.flightNumber
    next();
}, statusRouter);

router.get('/', function (req, res) {
    res.json({ 'message': 'Ping Successfull' });
});

airportRouter.get('/', (req, res) => {
    flightModel.find().distinct('airport', (err, response) => {
        if (err) {
            res.status(503).send('Server error');
        } else {
            res.send(response);
        }
    });
})

airportRouter.use('/:IATA/flight', function (req, res, next) {
    req.airport = req.params.IATA;
    next();
}, flightRouter);


router.use('/flight', flightRouter);

router.use('/airport', airportRouter);

app.use('/api', router);

app.get('*', function (req, res) {
    res.status(404).send('Route does not exist');
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))