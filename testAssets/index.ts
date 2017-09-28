import * as http from "http";
import * as MySql2 from "mysql2/promise";
import * as ServiceEnvironment from "sleeveforarm/src/serviceEnvironment";

let responseString = "Not Set!";

async function setUpDb() {
        try {
        const connectionObject =
            ServiceEnvironment.getMySqlConnectionObject("mySql");
        const connection = await MySql2.createConnection(connectionObject);
        try {
            const result = await connection.query("CREATE DATABASE foo");
        } catch (err) {
            if (err.code !== "ER_DB_CREATE_EXISTS") {
                throw err;
            }
        }
        await connection.query("USE foo");
        try {
            await connection.query("CREATE TABLE fooers (name VARCHAR(255))");
        } catch (err) {
            if (err.code !== "ER_TABLE_EXISTS_ERROR") {
                throw err;
            }
        }
        await connection.query("INSERT INTO fooers (name) VALUES ('A Name')");
        await connection.query(
            "INSERT INTO fooers (name) VALUES ('Another Name')");
        const [customers, fields] =
            await connection.query("SELECT * FROM fooers");
        if (customers.length < 2 || customers[0].name !== "A Name" ||
            customers[1].name !== "Another Name") {
            throw new Error(`Returned data failed test`);
        }
        responseString = customers[0].name;
    } catch (err) {
        responseString = "FAILURE! " + err;
    }
}

setUpDb();

const server = http.createServer(function(request, response) {

    // tslint:disable-next-line:max-line-length
    // if the conming URL contains /trycdn, which means we like to try if the CDN works. then the request
    // will be redirect to the CDN endpoint.
    const needReDirect = request.url.indexOf("cdn") > 0;

    if (needReDirect) {
         const urlToRedirect = ServiceEnvironment.getCDNEndpoint();
         response.writeHead(302, {Location: urlToRedirect});
         response.end();

    }else {
        response.writeHead(200, {"Content-Type": "text/plain"});
        response.end(responseString);
    }
});

const port = process.env.PORT || 1337;
server.listen(port);

console.log("Server running at http://localhost:%d", port);
