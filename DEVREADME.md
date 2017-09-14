# Developing Sleeve

This document is for people who want to help develop Sleeve.

## Machine Set up
Right now we only support developing and running on Windows. We will eventually fix this.
* All the software specified in [README](README.md)
* NPM 4.6.1
   * Open powershell as admin
   * Follow instructions at https://www.npmjs.com/package/npm-windows-upgrade to set up
   * npm-windows-upgrade --npm-version 4.6.1
* [VSCode](https://code.visualstudio.com/download)
* Extensions for VSCode
   * Code Spell Checker - Because spelling errors are no fun.
   * Docker - Because eventually we'll be creating docker files file for CI/CD
   * TSLint - MUST HAVE - All code MUST be linted!
* In VSCode go to launch.json and add "console":"integratedTerminal" to the Mocha tests work.
* In the depot run 'npm install' to install the dependencies and 'npm link' to hook the project up to the global environment.
* We are a TypeScript project so you have to compile the project using TypeScript. We use VSCode and the easiest way to get things going is 'ctrl->shift->p' then type in 'Tasks: Run Task' and then hit return and select 'tsc: build - tsconfig.json'. This will start a new terminal window that will leave a build agent running that will automatically update the JS files any time the TS files are edited. But remember, if you exit VSCode the window goes away. I've also found that if the window is open for too long (especially when I put my laptop to sleep a few times) the agent can fail. That leads to really fun bugs where you fix something in TS and then the fix doesn't seem to exist. So checking that the agent is still running is always a good idea if something 'strange' happens.

### What's up with NPM 4.6.1?
There is a bug in NPM 5.3.0 (and the 5 series in general) that makes it not play along very well with linked modules which we need for development. Specifically what happens is that if we 'npm link sleeveforarm' into a test directory (after we executed npm link in the sleeveforarm local github clone) and then call 'npm install' there will be an error because the versions won't match. This is because our development code is (properly) looking for the new version and NPM install doesn't recognize that. I tried working around this by just using the same version (e.g. setting development to the same version that is published in NPM) but in that case npm install overwrites the linked local directory and replaces it with the one in NPM.

So for now, we just use NPM 4.6.1. This lets us run tests and experiment with the tool on our dev machines.
### What's up with integratedTerminal?
There is a [bug in VS Code](https://github.com/Microsoft/vscode/issues/19750) that prevents process.stdout and process.stderr from outputting during testing. This is a problem because Winston uses those two functions to output (not console.log which still works). The nasty work around is to go to launch.json and add "console":"integratedTerminal" to the Mocha tests and then while running tests switch to the terminal tab and then the integrated node terminal sub-tab to see the output to console from logging while running tests.

Note that there is a [PR](https://github.com/Microsoft/vscode-node-debug2/pull/138) out to fix this issue.

## Understanding Sleeve's Architecture
### The goal
Sleeve wants to let developers focus on writing their code, not on dealing with Azure. To do that Sleeve needs to be able to reason about all the resources in an Azure Service. This allows Sleeve to automatically handle a lot of toil for the user.

For example, if Sleeve knows the user has two Web Apps and a CosmosDB instance then it can do things like automatically set up the firewall rules in CosmosDB to only support requests from the two Web Apps. We can also setup helper libraries in the Web Apps that will automatically tell the Web Apps the right URL to use for their CosmosDB instance. When we deploy for local development we can figure out which resources need to be left on the machine and which ones need to be available in Azure and set up the local environment to get the pointers right as well as set up the firewall rules. Etc. The point is that by having a complete view of the service with all of its component resources we can figure out HA issues, logging issues, security configurations, even network configurations for the user.

### Project Structure

Sleeve requires a project structure where there is a root directory that then contains a sub directory for each resource instance in the service. The name of the directory is used to name the resource. In each directory is a minimum of a sleeve.js file. The sleeve.js file is set up to import a module that represents the options we support for the resource. The module is written in Typescript so if the user uses a Typescript aware IDE like VSCode then they will get full autocomplete. Note however that sleeve.js itself is just generic Javascript so the user doesn't need to every know anything about Typescript. The exposed API is Fluent so it's easy to "dot together" a bunch of config options. In the fullness of time we will support setting options both globally but also allow overrides based on deployment type. E.g. using one plan for dev deployments and a different plan for production deployments.

### Sleeve CLI Commands

The Sleeve workflow starts with an init command that sets up a project. Currently it creates a KeyVault and also a root sleeve.js file that contains the resource group. The name of the resource group will be taken from the name of the root directory it is contained in it.

To add resources one uses the setup command which will create a subdirectory with the supplied name, put in a sleeve.js file as described above and where appropriate will put in default files to get the user going. For a storage resource there might not be any default files. But for computer resources we will typically put in a scaffold to support source code development, test development, as well as hook in libraries we provide to make it easier to interact with Azure. More on those libraries later on.

To do a deployment one calls the deploy command and specifies the kind of deployment one wants. At this point Sleeve will walk the directory structure, pick up all the sleeve.js files which identify the resource types to be created and any specific options the user wants. By default we use the default resource group created in the sleeve.js file in the root directory for all resources.

### How deployment works

To understand how Sleeve does a deployment one has to understand a little bit about our code structure. Each resource type is represented by three values:
* X.ts - this inherits from resource or for most resources, resourceNotResourceGroup and exposes public APIs that are intended to be used by the end developer to config the resource.
* XInfrastructure.ts - This inherits from X.ts and implements the IInfrastructure interface. This is where we add the methods that manage setting up new resource instances (e.g. creating sub-directories, putting in the sleeve.js file, etc.) and deploying resources.
* Assets - We have an assets folder where we keep the content that needs to be copied into new resource instances.

The cli tool (start with cli.ts but the real fun is in cliUtilities.ts) is the one who walks the directories during a deployment and collects together the sleeve.js files, requires them and uses them to instantiate the XInfrastructure.ts versions of the X.ts object that is in the sleeve.js file. The cli will first call hydrate on each resource to do initial set up and most importantly pass in an array containing all the resources in the environment. This array will be filled in when deployResource is subsequently called.

The next step after all the resources are created and hydrate is called is for deployResource to be called on all of them. DeployResource is called in parallel on all the resources. This can create fun dependency issues. The way we deal with these issues is via the getBaseDeployClassInstance interface.

When deployResource is called once the resource is instantiated in Azure (as needed, depends on the deployment type) then it will return a class to anyone who called getBaseDeployClassInstance. When the class is returned  (e.g. the resolution of the promise returned by getBaseDeployClassInstance) that means both that the resource is instantiated in Azure and that extra functionality exposed by the base class is now available from that resource type.

For example, when all resources but a resource group get a deployResource command the first thing they will do is issue an 'await' on the getBaseDeployClassInstance method of their resource group. This is necessary because the resource can't be created until its resource group has been created.

Another good example are web apps. If there are storage resources then the web app needs to configure firewall rules on the storage resource as well as get the location of the storage resource so the web app can set environment variables pointing to where the storage resource is located. So when deployResource is called on a web app resource first it will wait for it's resource group, then it will issue its own commands to create its base representation (e.g. create a web app plan and a web app instance) and then it will wait for all the storage resources to be created and as they return values from getBaseDeployClassInstance it will then use the interfaces in the returned class to set firewall rules and get location values. Once it has all the location values from all the storage resources then it will use a separate command to set the environment variables on itself (so that the code its hosting can find the storage resources) and then begin deploying its source code to its web app instance.

So we are, in effect, creating a graph. Each resource waits on the resources it has dependencies on and continues when they are in the right state. This means that we naturally will perform resource creation actions in parallel where possible. But it also means that if we aren't careful we could have dead locks.

Now the fair question is - why are we doing what ARM does? After all ARM knows how to deal with this parallelism, it knows all about workflow management. The issue is that we needed to get this project up and running quickly and ARM has a reasonably steep learning curve. So we aren't using ARM, we are using AZ. Because we are using AZ we have to manage everything ourselves.

### Deployment Flavors

Sleeve currently supports two flavors of deployment, Dev and Prod. Dev is intended for situations where a developer wants to debug their service on their machine but has dependent resources that really should be in Azure, even during development.

For example, imagine we have a service with a node Web App and Azure mySQL. We would want to develop the node web app down on the dev's box but it would be great if the mySQL instance we were developing against was in Azure. This is useful because then we know that the behavior we see (modulo latency) is the same as Azure. If we set up a local mySQL instance there is room for subtle configuration and version differences that could give different behavior than in production.

Right now our production deployment just creates everything in Azure. But the longer term goal is to add in CI/CD. Where CI will be based on using docker composer to create and deploy one docker image per resource type that it makes sense to test. We aren't going to test CosmosDB but we will test Web Apps, VMs and Microservices. Because we mandate the structure for the sub-directories that contain the resources we know where tests are and how to call them. If all the tests pass then we will use CD to create a pre-production deployment. For web apps we will use slots. For other resources we will use a dedicated resource group.

We will then change the production deployment command to be a slot/VIP swap. This also means we are not trying to do deployment on green as the customers we are targeting we don't feel are quite ready for that.

This brings up obvious issues about how to handle storage resources. Especially if we are changing state in those resources. A lot of our customers have relatively small amounts of data (in the gigabytes) so in those cases (and where the storage resource type, like mySQL, supports it) we will just copy data out of production into pre-production. But that only works for users who can freeze writes to their system while they prepare for a release.

For other customers we will have to keep the production storage resources where they are and swap everything else. We will support both models.

### The role of resource groups and how we name resources

We use resource groups to manage different deployment types. Eventually dev deployments will include an identifier for the specific dev who created that deployment based on their login ID (see [here](https://github.com/yaronyg/SleeveForARM/issues/12)). But for now a resource group name includes its deployment type and a 2-3 letter code for the DC (we are going to standardize on a 2 letter code, see [here](https://github.com/yaronyg/SleeveForARM/issues/13)) and a single character to indicate deployment type.

All resources that we create in the resource group are prefixed with the resource group's full name along with the name of the resource. Remember that all the names of just about all resources have to be globally unique. Hence the long name structure. But another problem is that while DNS supports DNS names of up to 63 characters, Azure doesn't always support names that long. See [here](https://docs.microsoft.com/en-us/azure/architecture/best-practices/naming-conventions) for the rules but some resources like Windows VMs can't have names longer than 15 characters, storage and key vault use 24 characters and others go up to 63 (and in some cases, for non-DNS named resources, even higher).

### Making it easier to write code in Azure

One of the trickier things to handle in Azure is how to find other resources in your service. How does a Web App find a particular mySQL instance that is part of the service, for example. There are also other issues like, how does one get one's log into Azure Log Analytics or even realize they should do that? Or how does one get one's tests run and results collected for CI?

Solving these problems requires us to put code into the user's project. To that end we provide libraries that we put into our default projects that provide the developer with access to these capabilities and/or automatically set them up for them.

For resource discovery current we just use a standard naming scheme for environment variables in order to share location information.