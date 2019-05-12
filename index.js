const express = require('express');
const mongo = require('./db');
const stats = require('./analysis');
const _ = require('underscore');
const app = express()
const port = 3000

app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

let router = express.Router();

let flightRouter = express.Router();

let statusRouter = express.Router();

let airportRouter = express.Router();

var flightModel = require('./models').flightModel;

var flightInfoModel = require('./models').flightInfoModel;

mongo.connect();
statusRouter.get('/', (req, res) => {
    if (req.flightNo !== undefined && req.flightNo !== '' && req.flightNo.length !== 0) {
        flightModel.find({ flightNumber: req.flightNo }, (err, flights) => {
            if (err) {
                res.status(503).send('Internal error');
            } else if (flights.length === 0) {
                res.status(204).send('No Flights found containing flight number: ' + req.flightNo);
            } else {
                let statuses = [];
                flights.sort((a, b) => {
                    return a.date > b.date;
                }).reverse().filter((e) => {
                    return e.status.length > 0;
                }).slice(0, 99).forEach((e) => {
                    statuses.push(e.status);
                });
                res.send(statuses);
            }
        })
    } else if (req.airport !== undefined && req.airport !== '' && req.airport.length !== 0) {
        flightModel.find({ airport: req.airport }, (err, flights) => {
            if (err) {
                res.status(503).send('Internal error');
            } else if (flights.length === 0) {
                res.status(204).send('No Flights statuses found for airport : ' + req.airport);
            } else {
                let statuses = [];
                flights.sort((a, b) => {
                    return a.date > b.date;
                }).reverse().filter((e) => {
                    return e.status.length > 0;
                }).slice(0, 179).forEach((e) => {
                    statuses.push(e.status);
                });
                res.send(statuses);
            }
        })
    }
});

flightRouter.use('/status', statusRouter);

flightRouter.get('/', (req, res) => {
    if ((req.airport !== null && req.airport !== undefined)
        && req.airport.length > 0) {
        flightModel.find({ airport: req.airport }, (err, flights) => {
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

flightRouter.get('/records', (req, res) => {
    if ((req.airport !== null && req.airport !== undefined)
        && req.airport.length > 0) {

        flightModel.find({ airport: req.airport }, (err, flights) => {
            if (err) {
                res.status(503).send('Internal server error');
            } else if (flights.length === 0) {
                res.status(204).send('No flights for airport ' + req.airport + ' found');
            } else {
                flights = flights.sort((a, b) => {
                    return a.date > b.date;
                }).reverse().filter((e) => {
                    return e.status.length > 0;
                }).slice(0, 99);
                res.send(flights);
            }
        });
    } else {
        flightModel.find({}, (err, flights) => {
            flights = flights.sort((a, b) => {
                return a.date > b.date;
            }).reverse().filter((e) => {
                return e.status.length > 0;
            }).slice(0, 99);
            res.send(flights);
        });
    }
});

flightRouter.get('/info', (req, res) => {
    flightInfoModel.find({}, (err, info) => {
        console.log(info);
        if (err) res.status(503).send('Internal server error');
        else if (info && info.length === 0) {
            res.status(204).send('No flight information for flight' + req.params.fn + ' found.');
        } else {
            res.status(200).send(info);
        }
    })
})

flightRouter.get('/:fn/records', (req, res) => {
    if ((req.aiport !== null && req.aiport !== undefined)
        && req.airport.length > 0) {
        flightModel.find({ flightNumber: req.params.fn, airport: req.airport }, (err, flights) => {
            if (err) {
                res.status(503).send('Internal server error');
            } else if (flights.length === 0) {
                res.status(204).send('No flights for airport ' + req.airport + 'and flight' + req.params.fn + ' found.');
            } else {
                res.send(flights);
            }
        });
    } else {
        flightModel.find({ flightNumber: req.params.fn }, (err, flights) => {
            if (flights.length === 0) {
                res.status(204).send('No Flights found containing flight number: ' + req.params.fn);
            } else {
                res.status(200).send(flights);
            }
        });
    }
});


flightRouter.use('/:flightNumber/status', function (req, res, next) {
    req.flightNo = req.params.flightNumber
    next();
}, statusRouter);

flightRouter.use('/:flightNumber/stats', function (req, res, next) {
    req.flightNumber = req.params.flightNumber;
    try {
        var p = new Promise((resolve, reject) => {
            let s = stats.getStatistics(req);
            resolve(s);
        })
        p.then((result) => {
            res.send(result);
        });
    } catch (err) {
        res.status(503).json({
            'message': 'something went wrong...',
            'error': err
        })
    }
})

flightRouter.use('/:flightNumber/:date/stats', function (req, res) {
    req.flightNumber = req.params.flightNumber;
    req.date = req.params.date;
    try {
        var p = new Promise((resolve, reject) => {
            let s = stats.getStatistics(req);
            resolve(s);
        })
        p.then((result) => {
            res.send(result);
        });
    } catch (err) {
        res.status(503).json({
            'message': 'something went wrong...',
            'error': err
        })
    }
})

router.get('/', function (req, res) {
    res.json({ 'message': 'Ping Successfull' });
});

airportRouter.get('/', (req, res) => {
    flightModel.find().distinct('airport', (err, response) => {
        if (err) {
            res.status(503).send('Server error');
        } else {
            res.json(response);
        }
    });
})

airportRouter.use('/:IATA/flight', function (req, res, next) {
    req.airport = req.params.IATA;
    next();
}, flightRouter);


airportRouter.use('/:IATA/stats', function (req, res) {
    req.airport = req.params.IATA;
    try {
        var p = new Promise((resolve, reject) => {
            let s = stats.getStatistics(req);
            resolve(s);
        })
        p.then((result) => {
            result.airport = req.params.IATA;
            res.send(result);
        });
    } catch (err) {
        res.status(503).json({
            'message': 'something went wrong...',
            'error': err
        })
    }
})

airportRouter.use('/:IATA/:date/stats', function (req, res) {
    req.airport = req.params.IATA;
    req.date = req.params.date;
    try {
        var p = new Promise((resolve, reject) => {
            let s = stats.getStatistics(req);
            resolve(s);
        })
        p.then((result) => {
            result.airport = req.params.IATA;
            result.date = req.params.date;
            res.send(result);
        });
    } catch (err) {
        res.status(503).json({
            'message': 'something went wrong...',
            'error': err
        })
    }
})
airportRouter.use('/:IATA/status', function (req, res, next) {
    req.airport = req.params.IATA;
    next();
}, statusRouter);

router.use('/flight', flightRouter);
router.use('/util/date', (req, res) => {
    flightModel.find().distinct('date', (err, date) => {
        if (err) {
            res.status(503).send("Internal error");
        } else {
            res.send(date);
        }
    })
})

router.use('/airport', airportRouter);

app.use('/api', router);

app.get('*', function (req, res) {
    res.status(404).send('Route does not exist');
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))