#!/usr/bin/env node

'use strict';

const process = require('node:process');
const dependencyTree = require('../');
const { program } = require('commander');
const { version } = require('../package.json');

program
  .version(version)
  .arguments('<filename>')
  .option(
    '-d, --directory <path>',
    'the directory to resolve modules from',
    process.cwd()
  )
  .option(
    '--list-form [type]',
    'output as a list. Pass \'relative\' to get relative paths'
  )
  .option(
    '--ignore-node-modules',
    'exclude modules from node_modules'
  )
  .option(
    '-c, --require-config <path>',
    'path to a requirejs config'
  )
  .option(
    '-w, --webpack-config <path>',
    'path to a webpack config'
  )
  .action((filename, options) => {
    try {
      const treeOptions = {
        filename,
        directory: options.directory,
        isListForm: options.listForm,
        ignoreNodeModules: !!options.ignoreNodeModules,
        requireConfig: options.requireConfig,
        webpackConfig: options.webpackConfig
      };

      const result = dependencyTree(treeOptions);

      if (options.listForm) {
        console.log(result.join('\n'));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
