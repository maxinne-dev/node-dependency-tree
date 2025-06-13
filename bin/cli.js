#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('node:path');
const process = require('node:process');
const dependencyTree = require('../index.js');
const extractExports = require('../lib/extract-exports.js');
const { version } = require('../package.json');

program
  .version(version)
  .arguments('<filename>')
  .option('-d, --directory <path>', 'The directory containing all JS files', process.cwd())
  .option('--list-form [relative]', 'Print the dependency tree as a list. Pass "relative" to get relative paths.')
  .option('--pretty-tree [type]', 'Print the dependency tree as a pretty tree view. Pass "symbols" to include exported symbols.')
  .option('--ignore-node-modules', 'Ignore dependencies in node_modules')
  .option('-c, --require-config <path>', 'The path to a requirejs config')
  .option('-w, --webpack-config <path>', 'The path to a webpack config')
  .option('--ts-config <path>', 'The path to a typescript config')
  .action(run);

program.parse(process.argv);

function run(filename, options) {
  const treeOptions = {
    filename,
    directory: options.directory,
    requireConfig: options.requireConfig,
    webpackConfig: options.webpackConfig,
    tsConfig: options.tsConfig,
    ignoreNodeModules: !!options.ignoreNodeModules
  };

  if (options.listForm) {
    treeOptions.isListForm = options.listForm === 'relative' ? 'relative' : true;
    const list = dependencyTree.toList(treeOptions);
    console.log(list.join('\n'));
    return;
  }

  const tree = dependencyTree(treeOptions);

  if (options.prettyTree) {
    const showSymbols = options.prettyTree === 'symbols';
    console.log(prettyPrint(tree, '', showSymbols));
  } else {
    console.log(JSON.stringify(tree, null, 2));
  }
}

function prettyPrint(tree, prefix = '', showSymbols = false) {
  let result = '';
  const entries = Object.entries(tree);
  entries.forEach(([key, value], index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    result += `${prefix}${connector}${path.relative(process.cwd(), key)}\n`;

    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    if (showSymbols) {
      const exports = extractExports(key);
      exports.forEach(symbol => {
        result += `${newPrefix}  • ${symbol}\n`;
      });
    }

    if (typeof value === 'object' && Object.keys(value).length > 0) {
      result += prettyPrint(value, newPrefix, showSymbols);
    }
  });
  return result;
}
