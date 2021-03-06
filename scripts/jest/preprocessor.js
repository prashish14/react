'use strict';

// React's test can only work in NODE_ENV=test because of how things
// are set up. So we might as well enforce it.
process.env.NODE_ENV = 'test';

var path = require('path');

var babel = require('babel-core');
var coffee = require('coffee-script');

var tsPreprocessor = require('./ts-preprocessor');

// This assumes the module map has been built. This might not be safe.
// We should consider consuming this from a built fbjs module from npm.
var moduleMap = require('fbjs/module-map');
var babelPluginModules = require('fbjs-scripts/babel-6/rewrite-modules');
var createCacheKeyFunction = require('fbjs-scripts/jest/createCacheKeyFunction');

// Use require.resolve to be resilient to file moves, npm updates, etc
var pathToBabel = path.join(
  require.resolve('babel-core'),
  '..',
  'package.json'
);
var pathToModuleMap = require.resolve('fbjs/module-map');
var pathToBabelPluginDevWithCode = require.resolve(
  '../error-codes/dev-expression-with-codes'
);
var pathToBabelPluginModules = require.resolve(
  'fbjs-scripts/babel-6/rewrite-modules'
);
var pathToBabelPluginAsyncToGenerator = require.resolve(
  'babel-plugin-transform-async-to-generator'
);
var pathToBabelrc = path.join(__dirname, '..', '..', '.babelrc');
var pathToErrorCodes = require.resolve('../error-codes/codes.json');

// TODO: make sure this stays in sync with gulpfile
var babelOptions = {
  plugins: [
    pathToBabelPluginDevWithCode, // this pass has to run before `rewrite-modules`
    [
      babelPluginModules,
      {
        map: Object.assign({}, moduleMap, {
          'object-assign': 'object-assign',
        }),
      },
    ],
    // Keep stacks detailed in tests.
    // Don't put this in .babelrc so that we don't embed filenames
    // into ReactART builds that include JSX.
    // TODO: I have not verified that this actually works.
    require.resolve('babel-plugin-transform-react-jsx-source'),
  ],
  retainLines: true,
};

module.exports = {
  process: function(src, filePath) {
    if (filePath.match(/\.coffee$/)) {
      return coffee.compile(src, {bare: true});
    }
    if (filePath.match(/\.ts$/) && !filePath.match(/\.d\.ts$/)) {
      return tsPreprocessor.compile(src, filePath);
    }
    if (
      !filePath.match(/\/node_modules\//) &&
      !filePath.match(/\/third_party\//)
    ) {
      // for test files, we also apply the async-await transform, but we want to
      // make sure we don't accidentally apply that transform to product code.
      var isTestFile = !!filePath.match(/\/__tests__\//);
      return babel.transform(
        src,
        Object.assign(
          {filename: path.relative(process.cwd(), filePath)},
          babelOptions,
          isTestFile
            ? {
                plugins: [pathToBabelPluginAsyncToGenerator].concat(
                  babelOptions.plugins
                ),
              }
            : {}
        )
      ).code;
    }
    return src;
  },

  getCacheKey: createCacheKeyFunction([
    __filename,
    pathToBabel,
    pathToBabelrc,
    pathToModuleMap,
    pathToBabelPluginDevWithCode,
    pathToBabelPluginModules,
    pathToErrorCodes,
  ]),
};
