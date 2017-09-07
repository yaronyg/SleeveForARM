# SleeveForARM
Making Azure Easy

Short Version:
* Install node v8.4.0
* Go to https://www.npmjs.com/package/npm-windows-upgrade and follow the instructions for install
* Set your version to 4.6.1
   * Open powershell as admin
   * npm-windows-upgrade --npm-version 4.6.1

There is a bug in NPM 5.3.0 (and the 5 series in general) that makes it not play along very well with linked modules which we need for development. Specifically what happens is that if we 'npm link sleeveforarm' into a test directory (after we executed npm link in the sleeveforarm local github clone) and then call 'npm install' there will be an error because the versions won't match. This is because our development code is (properly) looking for the new version and NPM install doesn't recognize that. I tried working around this by just using the same version (e.g. setting development to the same version that is published in NPM) but in that case npm install overwrites the linked local directory and replaces it with the one in NPM.

So for now, we just use NPM 4.6.1.

There is a [bug in VS Code](https://github.com/Microsoft/vscode/issues/19750) that prevents process.stdout and process.stderr from outputting during testing. This is a problem because Winston uses those two functions to output (not console.log which still works). The nasty work around is to go to launch.json and add "console":"integratedTerminal" to the Mocha tests and then while running tests switch to the terminal tab and then the integrated node terminal sub-tab to see the output to console from logging while running tests.
