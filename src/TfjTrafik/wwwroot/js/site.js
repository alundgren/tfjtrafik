var app = angular.module('app', ['ngGeolocation']).controller('ctr', ['$scope', '$http', '$q', '$timeout', '$geolocation', function ($scope, $http, $q, $timeout, $geolocation) {
    var locationApiCacheKey = 'tfj.v1.reserobot.cache.location'
    var tripsApiCacheKey = 'tfj.v1.reserobot.cache.trips'
    var tripsKey = 'tfj.v3.trips'

    var locationApiCache
    var tripsApiCache
    var trips

    function loadFromLocalStorage(key, defaultValue) {
        var m = localStorage.getItem(key)
        if (m) {
           return JSON.parse(m)
        } else {
            return defaultValue
        }
    }

    function saveToLocalStorate(key, value) {
        localStorage.setItem(key, JSON.stringify(value))
    }

    function loadLocationApiCache() {
        locationApiCache = loadFromLocalStorage(locationApiCacheKey, {})
    }
    function saveLocationApiCache() {
        saveToLocalStorate(locationApiCacheKey, locationApiCache)
    }
    function loadTripsApiCache() {
        t = loadFromLocalStorage(tripsApiCacheKey, {})
        if (!t.forDate || t.forDate !== moment().format('YYYY-MM-DD')) {
            //Wipe the trip cache every day since old values are useless and we dont want it just grow endlessly
            t = { forDate: moment().format('YYYY-MM-DD') }
        }
        tripsApiCache = t
    }

    function saveTripsApiCache() {
        saveToLocalStorate(tripsApiCacheKey, tripsApiCache)
    }
    function loadTrips() {
        trips = loadFromLocalStorage(tripsKey, [])
    }
    function saveTrips() {
        trips = saveToLocalStorate(tripsKey, trips)
    }

    function memoize(func, cache, saveCache, makeKey) {
        var slice = Array.prototype.slice

        return function () {
            var args = slice.call(arguments)
            var key = makeKey(args)
            if (key in cache) {
                var p = $q.defer()
                $timeout(function () {
                    p.resolve(cache[key])
                })
                return p.promise
            } else {
                var p = $q.defer()
                func.apply(this, args).then(function (successResult) {
                    cache[key] = successResult
                    saveCache()
                    p.resolve(successResult)
                }, function (failResult) {
                    p.reject(failResult)
                })
                return p.promise
            }
        }
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);  // deg2rad below
        var dLon = deg2rad(lon2 - lon1);
        var a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d;
    }

    function callTripApi(location1Id, location2Id, date, time) {
        return $q(function (resolve, reject) {
            $http.post(initialData.tripsApiUrl, {
                originId: location1Id,
                destId: location2Id,
                passlist: '0',
                date: date,
                time: time
            }).success(function (result) {
                resolve(result)
            }).error(function (error) {
                reject(error)
            })
        })
    }

    function callLocationApi(input) {
        return $q(function (resolve, reject) {
            $http.post(initialData.locationApiUrl, {
                input: input,
            }).success(function (result) {
                resolve(result)
            }).error(function (error) {
                reject(error)
            })
        })
    }

    function toKey(args) {
        var key = ''
        for (var i = 0; i < args.length; i++) {
            key = key + "_" + args[i]
        }
        return key
    }

    var callTripApiCached
    var callLocationApiCached

    $scope.simplifyLocationName = function (name, pairedName) {
        if (!name || !pairedName) {
            return name
        }
        var n1 = /^(.+?)(\([^\(]+\))?$/g.exec(name)
        var n2 = /^(.+?)(\([^\(]+\))?$/g.exec(pairedName)
        if (n1[2] && n2[2] && n1[2] == n2[2]) {
            return n1[1]
        } else {
            return name
        }
    }
    $scope.getTrip = function (location1, location2, date, time) {
        callTripApiCached(location1.id, location2.id, date, time).then(
            function (successResult) {
                var result = []
                angular.forEach(successResult.Trip, function (trip) {
                    var leg = trip.LegList.Leg[0]
                    var originDateTime = moment(leg.Origin.date + ' ' + leg.Origin.time, 'YYYY-MM-DD HH:mm:ss', true)
                    var destinationDateTime = moment(leg.Destination.date + ' ' + leg.Destination.time, 'YYYY-MM-DD HH:mm:ss', true)

                    var originCompactDateTime
                    var destinationCompactDateTime
                    if (leg.Origin.date == leg.Destination.date) {
                        originCompactDateTime = originDateTime.format('HH:mm')
                        destinationCompactDateTime = destinationDateTime.format('HH:mm')
                    } else {
                        originCompactDateTime = originDateTime.format('YYYY-MM-DD HH:mm')
                        destinationCompactDateTime = destinationDateTime.format('YYYY-MM-DD HH:mm')
                    }

                    var r = {
                        originCompactDateTime: originCompactDateTime,
                        destinationCompactDateTime: destinationCompactDateTime,
                        durationInMinutes: destinationDateTime.diff(originDateTime, 'minutes')
                    }

                    result.push(r)
                })
                $scope.currentTrips[location1.id + '_' + location2.id] = result
            },
            function (failResult) {
                //TODO: Handle
            })
    }

    $scope.searchFromLocationViableHits = function () {
        if (!$scope.addTrip.searchFromLocationHits) {
            return []
        }
        var vh = []
        angular.forEach($scope.addTrip.searchFromLocationHits, function (hit) {
            var distance = getDistanceFromLatLonInKm($scope.position.current.coords.latitude, $scope.position.current.coords.longitude, hit.lat, hit.lon)
            hit.distance = distance
            if (hit.distance < 75) {
                vh.push(hit)
            }
        })
        return vh
    }
    $scope.searchFromLocation = function () {
        if (!$scope.addTrip.searchFromLocationInput) {
            return
        }
        callLocationApiCached($scope.addTrip.searchFromLocationInput).then(
            function (successResult) {
                $scope.addTrip.searchFromLocationHits = successResult.StopLocation
            },
            function (failResult) {
                console.log(failResult)
            })
    }
    $scope.pickFrom = function (h) {
        $scope.addTrip.from = h
    }

    $scope.pickTo = function (h) {
        $scope.addTrip.to = h
    }
    $scope.searchToLocationViableHits = function () {
        if (!$scope.addTrip.searchToLocationHits) {
            return []
        }
        var vh = []
        angular.forEach($scope.addTrip.searchToLocationHits, function (hit) {
            var distance = getDistanceFromLatLonInKm($scope.position.current.coords.latitude, $scope.position.current.coords.longitude, hit.lat, hit.lon)
            hit.distance = distance
            if (hit.distance < 75) {
                vh.push(hit)
            }
        })
        return vh
    }
    $scope.searchToLocation = function () {
        if (!$scope.addTrip.searchToLocationInput) {
            return
        }
        callLocationApiCached($scope.addTrip.searchToLocationInput).then(
            function (successResult) {
                $scope.addTrip.searchToLocationHits = successResult.StopLocation
            },
            function (failResult) {
                console.log(failResult)
            })
    }

    $scope.onShowAddTrip = function () {
        $scope.addTrip = { }
        $geolocation.getCurrentPosition({
            timeout: 60000,
            enableHighAccuracy: true,
            maximumAge: 120000
        }).then(function (position) {
            $scope.position = {
                current: position,
                isGood: position.coords.accuracy < 300,
                accuracy: position.coords.accuracy.toFixed()
            }
        }, function (error) {
            $scope.position = {
                error: error
            }
        })
    }

    $scope.addTripNow = function () {
        $scope.trips.push({
            from: $scope.addTrip.from,
            to: $scope.addTrip.to,
            triggerLocation: { lat: $scope.position.current.coords.latitude, lon: $scope.position.current.coords.longitude }
        })
        saveTrips()
        $('#closeAddTrip').click()
        refresh()
    }

    $scope.nearbyTrips = function () {
        var r = []
        angular.forEach($scope.trips, function (value) {
            if (!value.isFarAway) {
                r.push(value)
            }
        })
        return r
    }

    $scope.current = function (trip) {
        return $scope.currentTrips[trip.from.id + '_' + trip.to.id]
    }

    function actualRefresh() {
        var m = moment()

        if ($scope.position && $scope.position.date && m.diff($scope.position.date, 'minutes') < 5) {
            var c = $scope.position.current.coords
            
            angular.forEach($scope.trips, function (value) {
                value.isFarAway = getDistanceFromLatLonInKm(c.latitude, c.longitude, value.triggerLocation.lat, value.triggerLocation.lon) > 3
            })
        } else {
            angular.forEach($scope.trips, function (value) {
                value.isFarAway = null
            })
        }

        angular.forEach($scope.nearbyTrips(), function (trip) {
            $scope.getTrip(trip.from, trip.to, m.format('YYYY-MM-DD'), m.format('HH:mm'))
        })
    }
    function refresh() {
        var trips = $scope.trips
        $geolocation.getCurrentPosition({
            timeout: 60000,
            enableHighAccuracy: true,
            maximumAge: 120000
        }).then(function (position) {
            $scope.position = {
                current: position,
                isGood: position.coords.accuracy < 300,
                accuracy: position.coords.accuracy.toFixed(),
                date: moment()
            }
            actualRefresh()
        }, function (error) {
            $scope.position = {
                error: error
            }
            actualRefresh()
        })
    }

    function startAutoRefresh() {
        //Note: Since multiple times are returned on each search it doesn't have to refresh very often (which drains the battery because of the GPS)
        //Just enough to make sure that switching location gets picked up. Like every 10 minutes should be fine
        //TODO: Allow this to be toggled on and off
        refresh()
        $timeout(function () {
            startAutoRefresh()
        }, 10*1000*60)
    }

    $scope.refresh = function () {
        refresh()
    }
    
    function init() {
        loadLocationApiCache()
        loadTripsApiCache()
        loadTrips()
        $scope.addTrip = {}
        $scope.trips = trips
        $scope.currentTrips = {}
        window.scope = $scope
        callTripApiCached = memoize(callTripApi, tripsApiCache, saveTripsApiCache, toKey)
        callLocationApiCached = memoize(callLocationApi, locationApiCache, saveLocationApiCache, toKey)

        startAutoRefresh()
    }

    init()
}])