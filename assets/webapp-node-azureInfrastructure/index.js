var ServiceEnvironment = require("sleeveforarm/src/serviceEnvironment");
var appInsights = require("applicationinsights");
appInsights
    .setup()
    .setAutoDependencyCorrelation(false)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .start();

// appInsights will monkeypatch Winston and setAutoCollectConsole
// will cause winston logging events to be sent to Application Insights
var winston = require("winston");

var http = require('http');

var server = http.createServer(function(request, response) {
    // Enables tracking the results of the requests in Application Insights
    appInsights.defaultClient.trackRequest({request: request, response: response});
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.end("Hello World!");

});

var port = process.env.PORT || 1337;
server.listen(port);

console.log("Server running at http://localhost:%d", port);
