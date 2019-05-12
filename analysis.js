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
    await pairs.forEach(async (f) => {
        let indexOfDuplicate = await pairs.findIndex((x) => {
            return (x.flightNumber1 === f.flightNumber2) && (f.flightNumber1 === x.flightNumber2);
        });
        if (indexOfDuplicate) {
            pairs.splice(indexOfDuplicate, 1);
        }
    });
    if (params.flightNumber && params.flightNumber.length > 0) {
        pairs = await pairs.filter((x) => {
            return x.flightNumber1 === params.flightNumber;
        }).sort((a, b) => {
            return (b.correlationOfFlightDisruptions - a.correlationOfFlightDisruptions);
        });
        pairs = await pairs.slice(0, 9);
    } else if (params.airport && params.airport.length > 0) {
        airportFlights = await getDistinctFlights(params.airport);
        pairs = await pairs.filter(async (x) => {
            let t_pairs = await pairs;
            return t_pairs.map((y) => { return y.flightNumber1 }).indexOf(x.flightNumber1);
        });
        let pairs_inverse_correlate = await pairs.sort((a, b) => {
            return (a.correlationOfFlightDisruptions - b.correlationOfFlightDisruptions);
        }).slice(0, 9);
        let pairs_correlate = await pairs.sort((a, b) => {
            return (a.correlationOfFlightDisruptions - b.correlationOfFlightDisruptions);
        }).reverse().slice(0, 9);
        let pairs_inverse_covary = await pairs.sort((a, b) => {
            return (a.covarianceOfFlightDisruptions - b.covarianceOfFlightDisruptions);
        }).slice(0, 9);
        let pairs_covary = await pairs.sort((a, b) => {
            return (a.covarianceOfFlightDisruptions - b.covarianceOfFlightDisruptions);
        }).reverse().slice(0, 9);
        return {
            fl_cov: pairs_covary,
            fl_cov_i: pairs_inverse_covary,
            fl_cor: pairs_correlate,
            fl_cor_i: pairs_inverse_correlate
        };
    }

    return pairs;

}

getDistinctFlights = async function (airport) {
    flightModel.find({ airport: airport }, (err, flights) => {
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

countRatioOfDisruptionsToAllFlights = async function (searchParams) {
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
    let flightNumber = params.flightNumber ? params.flightNumber : '';
    let airport = params.airport ? params.airport : '';
    let allFlights = await flightModel.aggregate(
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
        return cb;
    });
    let disruptedFlights = await flightModel.aggregate(
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
        return cb;
    });
    let allMeans = [];
    let uniqueDates = [];
    let flightsArr = [];

    await allFlights.forEach((e) => {
        if (uniqueDates.length === 0) {
            uniqueDates.push(e._id.date);
        } else {
            if (uniqueDates.indexOf(e._id.date) < 0) {
                uniqueDates.push(e._id.date);
            }
        }
    });
    if (params.airport) {
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
    } else if (params.flightNumber) {
        for (let d of uniqueDates) {
            let t_allFlights = await allFlights.filter(x => {
                return (x._id.date === d) && (x._id.flightNumber === params.flightNumber);
            });
            let t_disruptedFlights = await disruptedFlights.filter((x) => {
                return (x._id.date === d) && (x._id.flightNumber === params.flightNumber);
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
    } else return 0;
}


exports.getStatistics = async function (params) {
    var statistic = {};
    if (params) {
        if (params.airport) {
            statistic.airportMean = await countRatioOfDisruptionsToAllFlights({ airport: params.airport });
            let recordedFlights = await countFlights({ airport: params.airport }).then((res) => { return res });
            statistic.numberOfFlightsonRecord = await recordedFlights.countAllFlights;
            statistic.numberOfDisruptedFlightsOnRecords = await recordedFlights.countDisruptedFlights;
            if (params.date) {
                statistic.airportByDate = await countRatioOfDisruptionsToAllFlights({ airport: params.airport, date: params.date });
            }
            statistic.airportStandartDeviation = await countStandartDeviation(params);
            statistic.linkedFlights = await countCovarianceAndCorrelation(params);
        }
        if (params.flightNumber) {
            statistic.disruptionAvg = await countRatioOfDisruptionsToAllFlights({ flightNumber: params.flightNumber });
            let recordedFlights = await countFlights({ flightNumber: params.flightNumber }).then((res) => { return res });
            statistic.numberOfFlightsonRecord = await recordedFlights.countAllFlights;
            statistic.numberOfDisruptedFlightsOnRecords = await recordedFlights.countDisruptedFlights;
            if (params.date) {
                statistic.flightByDate = await countRatioOfDisruptionsToAllFlights({ flightNumber: params.flightNumber, date: params.date });
                let recordedFlights = await countFlights({ flightNumber: params.flightNumber, date: params.date }).then((res) => { return res });
                statistic.numberOfFlightsOnDateOnRecord = await recordedFlights.countAllFlights;
                statistic.numberOfDisruptedFlightsOnDateOnRecord = await recordedFlights.countDisruptedFlights;
            }
            statistic.disruptionStdDeviation = await countStandartDeviation(params);
            statistic.linkedFlights = await countCovarianceAndCorrelation(params);
        }

    }
    return statistic;
}
