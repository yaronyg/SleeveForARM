# SleeveForARM
The Sleeve CLI provides an environment to make developing, deploying and managing Azure services easy.

# Disclaimer
This is a very early hack just intended to show the general ideas. It isn't full featured enough to use for anything real yet.

# Preparing the machine for Sleeve
For the moment Sleeve only runs (or at least is tested) on Windows. We will eventually fix this.

Install:
* [Node v8.4.0](https://nodejs.org/en/download/current/)
* [mysql CLI](https://chocolatey.org/packages/mysql) (we will eventually [remove this dependency](https://github.com/yaronyg/SleeveForARM/issues/5))
* [AZ CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)
   * __Please make sure to open a command line and run "az login" to init AZ.__ Sleeve assumes that the local AZ instance has already been logged into whatever account it is supposed to be using.
* npm install sleeveforarm -g

# Sleeve Commands
* `sleeve init` - If you want to create a new project then create a new directory with a short name (5-6 characters is good) and run this command inside the directory. It will set up a basic config.
* `sleeve setup` - Used to add a new resource to the sleeve project. Run this in the main directory. It takes a -n option to give the name of the resource. This will be the name used for the new directory that is created. A short name (5-6 characters) is recommended. It also takes a -t option that identifies the type of resource to create. Run `sleeve setup` by itself to see what options are supported. The newly created directory will contain a sleeve.js file that can be used to configure the resource. That file will support auto-complete so open in an IDE like VS Code and you will see what can be configured. For executable resource types like web apps the directory will contain default files for source and test along with connections to helper libraries.
* `sleeve deploy` - Tells sleeve to deploy the resources in the project. The current choices are dev or prod. 
   * Dev is intended to support developing on the local machine. But certain kinds of resources are best deployed in Azure even when developing locally. For example, if you are building a web app that uses Azure mySQL it's better to develop against an instance of Azure mySQL deployed in Azure than try to set up a local mySQL and hope its configuration and behavior matches Azure. So `sleeve deploy -t dev` creates resources like Azure mySQL that should be put into SQL and also sets up the local environment so that it will connect to the Azure mySQL instance using the bridging libraries (see below).
   * Prod is intended for a straight forward production deployment where we just create the resources in Azure.

# Sleeve Bridge Libraries
When we create a compute based resource we put in sample code. Inside of the sample code will be a connection to a bridge library. For example, in node we call this library ServiceEnvironment and it supports a call `getMySqlConnectionObject` that lets you specify the name of a mySQL resource in the project and it will return a mysql2 connection object to get to that resource. We will be extending these libraries in the future to support other functionality such as connecting logs to Azure Log Analytics and supporting other resource types like connecting to other web apps or storage services like Cosmos DB or caches like Azure Redis.

# An example of using Sleeve

Pick some random 5 or 6 character name. I'll use test below but if you try to use it, it should fail as the name is already grabbed for this demo.
```console
> mkdir test
> cd test
> sleeve init
> sleeve setup -t webapp-node -n webApp
> sleeve setup -t mySqlAzure -n data
> cd data
> notepad mysqlinit.txt
```

The previous commands initialized the project and then added two resources. A node webapp named, originally enough, webApp and an Azure managed mySQL instance called, data. The final steps are to create an initialization file for the mySQL DB.

In the newly created mysqlinit.txt file please copy in the following content:
```sql
CREATE DATABASE IF NOT EXISTS foo;
use foo;
CREATE TABLE IF NOT EXISTS fooers (name VARCHAR(255));
INSERT INTO fooers (name) VALUES ('A Name');
```

Then save and exit notepad. 

At this point to really get the Sleeve experience it would be best if you can open the test directory in VS Code. Then navigate to data/sleeve.js and open it. After "new MySqlAzure()" hit '.' and you should see autocomplete offering 'addMySqlInitialize'. Select that and pass in the argument "mysqlinit.txt". So the final line will look like:

```javascript
module.exports = new MySqlAzure().addMySqlInitializationScript("mysqlinit.txt");
```

The previous tells Sleeve that you have an initialization you want to run on the database and tells us where to find the initialization file.

```console
> cd ..\webApp
> npm install mysql2 --save
```

In order to allow node to talk to the mySQL instance we need mysql2. So we are adding it in. This has nothing to do with Sleeve per se.

Now head back to VS Code and open webApp/index.js. This is a default file we put in place to get the user started. Notice that it contains a require for ServiceEnvironment which is our library to enable finding the mySQL instance. Note that this library works regardles of deployment type, dev, production or CI/CD. So the same code, unchanged, can run in these different environments and still find the dependent resources.

Now please replace the contents of webApp/index.js with the code given below.

```javascript
	var http = require('http');
	var ServiceEnvironment = require("sleeveforarm/src/serviceEnvironment");
	var MySql2 = require("mysql2/promise");

	var connectionObject = ServiceEnvironment.getMySqlConnectionObject("data", "foo");

	var server = http.createServer(function(request, response) {
		MySql2.createConnection(connectionObject)
		.then(function (connection) {
			return connection.query("SELECT * FROM fooers");
		})
		.then(function (results) {
			response.writeHead(200, {"Content-Type": "text/plain"});
			response.end("Hello " + results[0][0].name);
		})
		.catch(function (err) {
			response.writeHead(500, {"Content-Type": "text/plain"});
			response.end("Error " + err);
		});
	});

	var port = process.env.PORT || 1337;
	server.listen(port);

	console.log("Server running at http://localhost:%d", port);
```

Now back to the console:
```console
> cd ..
> sleeve deploy -t dev
```

Now get some coffee because this part takes a while, about 4-5 minutes. What we are doing is creating a resource group, a key vault and a mySQL instance in Azure. We are not creating a web app because this is a dev deployment and we will run the webApp locally. We are also setting up the environment so that the webApp, running locally, will be able to find the mySQL instance in Azure.

Also note that you can run sleeve deploy commands as often as you like. They are idempotent. However beware that it takes just as long to run the command when the resources don't exist as when they are just being created.

Now back to the console:
```console
> cd webApp
> node index.js
```

Now head over to your favorite browser and open up `http://localhost:1337`. You should see "Hello A Name" which as the code above shows is a value that Node got out of mySQL. Note that you might get "Not Set!" which happens if the mySQL DB isn't quite ready. Just hit refresh in that case.

Now let's put everything up into Azure.

```console
> ctrl-c (to kill node)
> cd ..
> sleeve deploy -t prod
```

This command will also take 4-5 minutes. But when it's done we will have a full deployment running in Azure. The last line after the command will say something like "Web app is available at http://testscupwebapp.azurewebsites.net". You can hit that URL to see the fully functioning service. You should see "Hello A Name" as above.

So we have deployed exactly the same code in two completely different environments but everything works.

# Helping to develop Sleeve
For those interested in helping to develop Sleeve, please see [the Dev README](DEVREADME.md).