# SleeveForARM
Making Azure Easy

Short Version:
* Go to https://www.npmjs.com/package/npm-windows-upgrade and follow the instructions for install
* Set your version to 4.6.1

There is a bug in NPM 5.3.0 (and the 5 series in general) that makes it not play along very well with linked modules which we need for development. Specifically what happens is that if we 'npm link sleeveforarm' into a test directory (after we executed npm link in the sleeveforarm local github clone) and then call 'npm install' there will be an error because the versions won't match. This is because our development code is (properly) looking for the new version and NPM install doesn't recognize that. I tried working around this by just using the same version (e.g. setting development to the same version that is published in NPM) but in that case npm install overwrites the linked local directory and replaces it with the one in NPM.

So for now, we just use NPM 4.6.1.