const flightModel = require('./models').flightModel;

const statistics = require('simple-statistics');

var disruption = [ "Atšaukta", "ATŠAUKTA", "VĖLUOJA", "Vėluojama", "Nežinoma"];
var stats;

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
                                    { 'status': 'ATŠAUKTA'},
                                    { 'status': 'Nežinoma'}
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
            flightsArr.push(sum_b/sum_a);
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
        }
        if (params.flightNumber) {
            objectToReturn.disruptionAvg = await countAverageOfDisruptions({ flightNumber: params.flightNumber });
            if (params.date) {
                objectToReturn.flightByDate = await countAverageOfDisruptions({ flightNumber: params.flightNumber, date: params.date });
            }
            objectToReturn.disruptionStdDeviation = await countStandartDeviation(params);
        }

    }
    return objectToReturn;
}

// exports.countStats = countStatistics;