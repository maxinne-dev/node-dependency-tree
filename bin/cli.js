#!/usr/bin/env node
'use strict';

const process = require('node:process');
const { program } = require('commander');
const dependencyTree = require('../index.js');
const { version } = require('../package.json');

program
  .version(version)
  .argument('<filename>', 'The path to the file to trace the dependency tree of')
  .option('-d, --directory <path>', 'the directory to resolve modules from')
  .option('--list-form', 'output in list form, one dependency per line')
  .option('-c, --require-config <path>', 'path to a requirejs config')
  .option('-w, --webpack-config <path>', 'path to a webpack config')
  .option('--ts-config <path>', 'path to a typescript config')
  .option('--ignore-node-modules', 'ignore dependencies in node_modules')
  .parse(process.argv);

const options = program.opts();
const [filename] = program.args;

if (!filename) {
  program.help();
}

const treeOptions = {
  filename,
  directory: options.directory || process.cwd(),
  isListForm: options.listForm,
  requireConfig: options.requireConfig,
  webpackConfig: options.webpackConfig,
  tsConfig: options.tsConfig,
  ignoreNodeModules: options.ignoreNodeModules
};

const tree = dependencyTree(treeOptions);

if (options.listForm) {
  // In list form, the output is an array of strings
  console.log(tree.join('\n'));
} else {
  // In object form, it's a tree object
  console.log(JSON.stringify(tree, null, 2));
}
