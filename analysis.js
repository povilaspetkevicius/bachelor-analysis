const flightModel = require('./models').flightModel;
const _ = require('underscore');
const statistics = require('simple-statistics');

var disruption = ["Atšaukta", "ATŠAUKTA", "VĖLUOJA", "Vėluojama", "Nežinoma"];

countCovarianceAndCorrelation = async function (params) {
    let allFlights = [];
    await flightModel.aggregate(
        [
            {
                $group:
                {
                    _id:
                    {
                        flightNumber: "$flightNumber",
                        date: "$date",

                    },
                    count:
                        { $sum: 1 }
                }

            },
            {
                $sort:
                    { date: -1 }
            }
        ]
    ).then((cb) => {
        cb.forEach((doc) => {
            allFlights.push(doc);
        })
    });
    let disruptedFlights = [];
    await flightModel.aggregate(
        [
            {
                $match:
                {
                    $and: [{
                        $or:
                            [
                                { 'status': "Vėluojama" },
                                { 'status': "Atšaukta" },
                                { 'status': "VĖLUOJA" },
                                { 'status': 'ATŠAUKTA' },
                                { 'status': 'Nežinoma' }
                            ]
                    }
                    ]
                }
            },
            {
                $group:
                {
                    _id:
                    {
                        flightNumber: "$flightNumber",
                        date: "$date",

                    },
                    count:
                        { $sum: 1 }
                }

            },
            {
                $sort:
                    { count: -1 }
            }
        ]
    ).then((cb) => {
        cb.forEach((doc) => {
            disruptedFlights.push(doc);
        })
    });

    let uniqueDates = await flightModel.find().distinct('date', (err, res) => {
        if (err) {
            throw err;
        } else {
            return res;
        }
    });
    let uniqueflightNumbers = await flightModel.find().distinct('flightNumber', (err, res) => {
        if (err) {
            throw err;
        } else {
            return res;
        }
    });
    let sampleArray = [];
    for (let f of uniqueflightNumbers) {
        let meanArray = [];
        for (let d of uniqueDates) {

            let t_allFlights = await allFlights.filter(x => {
                return (x._id.date === d) && (x._id.flightNumber === f);
            });
            let t_disruptedFlights = await disruptedFlights.filter((x) => {
                return (x._id.date === d) && (x._id.flightNumber === f);
            });
            let sum_a = await t_allFlights.reduce((sum, currValue) => {
                return sum + currValue.count;
            }, 0);

            let sum_b = await t_disruptedFlights.reduce((sum, currValue) => {
                return sum + currValue.count;
            }, 0);
            mean = await sum_b / sum_a;
            if (!isNaN(mean) && isFinite(mean)) {
                meanArray.push(mean);
            } else {
                meanArray.push(0);
            }

        }

        sampleArray.push({ flightNumber: f, arrayOfMeans: meanArray });

        meanArray = [];

    }

    let pairs = [];

    for (let x of sampleArray) {
        for (let y of sampleArray) {
            let correlation;
            let covariance;
            if (x.flightNumber !== y.flightNumber) {
                correlation = await statistics.sampleCorrelation(x.arrayOfMeans, y.arrayOfMeans).toFixed(3);
                covariance = await statistics.sampleCovariance(x.arrayOfMeans, y.arrayOfMeans).toFixed(3);
                if (!isNaN(correlation) && !isNaN(covariance) && covariance !== 0) {
                    pairs.push({
                        flightNumber1: x.flightNumber,
                        flightNumber2: y.flightNumber,
                        correlationOfFlightDisruptions: correlation,
                        covarianceOfFlightDisruptions: covariance
                    });
                }
            }
        }
    }
    console.log(pairs.length);
    console.log(params.flightNumber);
    if (params.flightNumber.length > 0) {
        pairs = await pairs.filter((x) => {
            console.log(x.flightNumber1);
            return x.flightNumber1 === params.flightNumber;
        })
    } else if (params.airport.length > 0) {
        airportFlights = await getDistinctFlights(params.airport);
        pairs = await pairs.filter(async (x) => {
            let t_pairs = await pairs;
            return t_pairs.map((y) => { return y.flightNumber1 }).indexOf(x.flightNumber1);
        })
    }
    pairs = await pairs.slice(0,4);
    return pairs;

}

getDistinctFlights = async function (airport) {
    flightModel.find({ airport: airport }, (err, flights) => {
        console.log(flights.length);
        if (err) {
            throw err;
        } else if (flights.length === 0) {
            return null;
        } else {
            let flightNo = [];
            flights.forEach((el) => {
                flightNo.push(el.flightNumber);
            });
            return _.uniq(flightNo);
        }
    })
}

countAverageOfDisruptions = async function (searchParams) {
    let allFlights;
    let disruptedFlights;

    let flights = await flightModel.find(searchParams, (err, flight) => {
        if (err) {
            throw err;
        } else {
            return flight;
        }
    });
    allFlights = await flights.length;
    disruptedFlights = await flights.filter((x) => {
        return disruption.find((d) => {
            return d == x.status
        })
    }).length;
    avg = await disruptedFlights / allFlights;
    return avg;
};

countFlights = async function (searchParams) {

    let flightsCount = await flightModel.find(searchParams, (err, flight) => {
        if (err) {
            throw err;
        } else {
            return flight;
        }
    });
    let countAllFlights = await flightsCount.length;
    let countDisruptedFlights = await flightsCount.filter((x) => {
        return disruption.find((d) => {
            return d == x.status
        })
    }).length;
    return { countAllFlights, countDisruptedFlights };
};

countStandartDeviation = async function (params) {
    let allFlights = [];
    let flightNumber = params.flight ? params.flight : '';
    let airport = params.airport ? params.airport : '';
    await flightModel.aggregate(
        [
            {
                $match:
                {
                    $or:
                        [
                            { 'flightNumber': flightNumber },
                            { 'airport': airport },
                        ]
                }
            },
            {
                $group:
                {
                    _id:
                    {
                        flightNumber: "$flightNumber",
                        date: "$date",

                    },
                    count:
                        { $sum: 1 }
                }

            },
            {
                $sort:
                    { date: -1 }
            }
        ]
    ).then((cb) => {
        cb.forEach((doc) => {
            allFlights.push(doc);
        })
    });
    let disruptedFlights = [];
    await flightModel.aggregate(
        [
            {
                $match:
                {
                    $and: [
                        {
                            $or:
                                [
                                    { 'flightNumber': flightNumber },
                                    { 'airport': airport },
                                ]
                        }, {
                            $or:
                                [
                                    { 'status': "Vėluojama" },
                                    { 'status': "Atšaukta" },
                                    { 'status': "VĖLUOJA" },
                                    { 'status': 'ATŠAUKTA' },
                                    { 'status': 'Nežinoma' }
                                ]
                        }
                    ]
                }
            },
            {
                $group:
                {
                    _id:
                    {
                        flightNumber: "$flightNumber",
                        date: "$date",

                    },
                    count:
                        { $sum: 1 }
                }

            },
            {
                $sort:
                    { count: -1 }
            }
        ]
    ).then((cb) => {
        cb.forEach((doc) => {
            disruptedFlights.push(doc);
        })
    });
    let allMeans = [];
    if (params.airport) {
        let flightsArr = [];
        let uniqueDates = [];
        allFlights.forEach((e) => {
            if (uniqueDates.length === 0) {
                uniqueDates.push(e._id.date);
            } else {
                if (uniqueDates.indexOf(e._id.date) < 0) {
                    uniqueDates.push(e._id.date);
                }
            }
        })

        for (let d of uniqueDates) {
            let t_allFlights = await allFlights.filter(x => {
                return x._id.date === d;
            });
            let t_disruptedFlights = await disruptedFlights.filter((x) => {
                return x._id.date === d;
            });

            let sum_a = await t_allFlights.reduce((sum, currValue) => {
                return sum + currValue.count;
            }, 0);

            let sum_b = await t_disruptedFlights.reduce((sum, currValue) => {
                return sum + currValue.count;
            }, 0);
            flightsArr.push(sum_b / sum_a);
        }

        allMeans = await flightsArr;
        return statistics.standardDeviation(allMeans);
    } else if (params.flight) {
        allFlights.forEach((flight) => {
            disruptedFlight = disruptedFlights.find((x) => { return x.date === flight.date });
            if (disruptedFlight) {
                mean = disruptedFlight.count / flight.count;
                allMeans.push(mean);
            } else {
                allMeans.push(0);
            }
        });
        return statistics.standardDeviation(allMeans);
    } else return 0;
}


exports.countStatistics = async function (params) {
    var objectToReturn = {};
    if (params) {
        if (params.airport) {
            objectToReturn.airport = await countAverageOfDisruptions({ airport: params.airport });
            if (params.date) {
                objectToReturn.airportByDate = await countAverageOfDisruptions({ airport: params.airport, date: params.date });
            }
            objectToReturn.airportStandartDeviation = await countStandartDeviation(params);
            objectToReturn.linkedFlights = await countCovarianceAndCorrelation(params);
        }
        if (params.flightNumber) {
            objectToReturn.disruptionAvg = await countAverageOfDisruptions({ flightNumber: params.flightNumber });
            let recordedFlights = await countFlights({ flightNumber: params.flightNumber }).then((res) => { return res });
            objectToReturn.numberOfFlightsonRecord = await recordedFlights.countAllFlights;
            objectToReturn.numberOfDisruptedFlightsOnRecords = await recordedFlights.countDisruptedFlights;
            if (params.date) {
                objectToReturn.flightByDate = await countAverageOfDisruptions({ flightNumber: params.flightNumber, date: params.date });
                let recordedFlights = await countFlights({ flightNumber: params.flightNumber, date: params.date }).then((res) => { return res });
                objectToReturn.numberOfFlightsOnDateOnRecord = await recordedFlights.countAllFlights;
                objectToReturn.numberOfDisruptedFlightsOnDateOnRecord = await recordedFlights.countDisruptedFlights;
            }
            objectToReturn.disruptionStdDeviation = await countStandartDeviation(params);
            objectToReturn.linkedFlights = await countCovarianceAndCorrelation(params);
        }

    }
    return objectToReturn;
}
