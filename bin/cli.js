#!/usr/bin/env node

'use strict';

const path = require('node:path');
const process = require('node:process');
const { program } = require('commander');
const dependencyTree = require('../index.js');
const extractExports = require('../lib/extract-exports.js');
const { version } = require('../package.json');

function getSymbolsText(filePath, prefix, withSymbols) {
  if (!withSymbols) {
    return '';
  }

  const exports = extractExports(filePath);
  if (!exports.length) {
    return '';
  }

  return exports.map(symbol => `${prefix}* ${symbol.name} (${symbol.kind})`).join('\n') + '\n';
}

function formatPrettyTree(tree, withSymbols) {
  const rootPath = Object.keys(tree)[0];
  if (!rootPath) {
    return '';
  }

  let output = `${path.basename(rootPath)}\n`;
  output += getSymbolsText(rootPath, '  ', withSymbols);

  function buildTreeString(subTree, prefix) {
    let result = '';
    const dependencies = Object.keys(subTree);
    dependencies.forEach((dep, i) => {
      const isLast = i === dependencies.length - 1;
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += `${prefix}${isLast ? '└──' : '├──'} ${path.basename(dep)}\n`;
      result += getSymbolsText(dep, newPrefix, withSymbols);
      result += buildTreeString(subTree[dep], newPrefix);
    });
    return result;
  }

  output += buildTreeString(tree[rootPath], '');
  return output.trim();
}

program
  .version(version)
  .argument('[filename]', 'The path to the file to get the dependency tree for.')
  .option('-d, --directory <path>', 'The directory containing all JS files', process.cwd())
  .option('--list-form [relative]', 'Print the dependency tree as a list. Pass "relative" to get relative paths.')
  .option('--pretty-tree [type]', 'Print the dependency tree as a pretty tree view, like the tree command. The optional type can be symbols to include exported symbols.')
  .option('--ignore-node-modules', 'Ignore dependencies in node_modules.')
  .option('-c, --require-config <path>', 'The path to a requirejs config.')
  .option('-w, --webpack-config <path>', 'The path to a webpack config.')
  .option('--ts-config <path>', 'The path to a typescript config.')
  .parse(process.argv);

const cliOptions = program.opts();
let [filename] = program.args;

if (cliOptions.prettyTree && typeof cliOptions.prettyTree === 'string' && cliOptions.prettyTree !== 'symbols') {
  if (!filename) {
    filename = cliOptions.prettyTree;
  }

  cliOptions.prettyTree = true;
}

if (!filename) {
  console.error("error: missing required argument 'filename'");
  process.exit(1);
}

const treeOptions = {
  filename,
  directory: cliOptions.directory,
  requireConfig: cliOptions.requireConfig,
  webpackConfig: cliOptions.webpackConfig,
  tsConfig: cliOptions.tsConfig,
  ignoreNodeModules: cliOptions.ignoreNodeModules
};

if (cliOptions.listForm) {
  const list = dependencyTree.toList({
    ...treeOptions,
    isListForm: cliOptions.listForm
  });
  console.log(list.join('\n'));
  process.exit(0);
}

const tree = dependencyTree(treeOptions);

if (cliOptions.prettyTree) {
  const prettyTree = formatPrettyTree(tree, cliOptions.prettyTree === 'symbols');
  console.log(prettyTree);
  process.exit(0);
}

console.log(JSON.stringify(tree, null, 2));
