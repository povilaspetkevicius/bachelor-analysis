const flightModel = require('./models').flightModel;

const statistics = require('simple-statistics');

var disruption = ["Atšaukta", "ATŠAUKTA", "VĖLUOJA", "Vėluojama", "Nežinoma"];
var stats;

countAverageOfDisruptions = async function (searchParams) {
    let allFlights;
    let disruptedFlights;
    let flights;
    await flightModel.find(searchParams, (err, flight) => {
        if (err) {
            throw err;
        } else {
            flights = flight;
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




countStandartDeviation = function (params) {
    let allFlights = [];
    let flightNumber = params.flight ? params.flight : '';
    let airport = params.airport ? params.airport : '';
    flightModel.aggregate(
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
    flightModel.aggregate(
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
                                    { 'status': "VĖLUOJA" }
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
                uniqueDates.push(e.date);
            } else {
                if (uniqueDates.indexOf(e.date) < 0) {
                    uniqueDates.push(e.date);
                }
            }
        })

        uniqueDates.forEach((d) => {
            let sum_dis = 0;
            allFlights.find((fl) => {
                return fl.date == d
            }).forEach((f) => {
                sum_all = sum_all + f.count;
            });
            disruptedFlights.find((fl) => {
                return fl.date == d
            }).forEach((f) => {
                sum_dis = sum_dis + f.count;
            })
            flightsArr.push(sum_all / sum_dis);
        })
        allMeans = flightsArr;
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
            objectToReturn.airport = countAverageOfDisruptions({ airport: params.airport });
            if (params.date) {
                objectToReturn.airportByDate = countAverageOfDisruptionOnDay({ airport: params.airport, date: params.date });
            }
            objectToReturn.airportStandartDeviation = countStandartDeviation(params);
        }
        if (params.flightNumber) {
            objectToReturn.disruptionAvg = await countAverageOfDisruptions({ flightNumber: params.flightNumber });
            if (params.date) {
                objectToReturn.flightByDate = await countAverageOfDisruptionOnDay({ flightNumber: params.flightNumber, date: params.date });
            }
            objectToReturn.disruptionStdDeviation = await countStandartDeviation(params);
        }

    }
    return objectToReturn;
}

// exports.countStats = countStatistics;