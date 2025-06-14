#!/usr/bin/env node
'use strict';

const path = require('node:path');
const process = require('node:process');
const { program } = require('commander');
const dependencyTree = require('../index.js');
const extractExports = require('../lib/extract-exports.js');

function getKindChar(kind) {
  switch (kind) {
    case 'function':
      return 'ƒ';
    case 'class':
      return 'C';
    case 'method':
    case 'constructor':
      return 'm';
    case 'property':
    case 'variable':
    case 'getter':
    case 'setter':
      return 'p';
    default:
      return '•';
  }
}

function printSymbols(filename, prefix) {
  const exports = extractExports(filename);
  if (!exports.length) {
    return;
  }

  exports.forEach((exp, index) => {
    const isLast = index === exports.length - 1;
    const connector = isLast ? '└──' : '├──';
    console.log(`${prefix}${connector} ${getKindChar(exp.kind)} ${exp.name}`);
    if (exp.children?.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      for (const [childIndex, child] of exp.children.entries()) {
        const isLastChild = childIndex === exp.children.length - 1;
        const childConnector = isLastChild ? '└──' : '├──';
        console.log(`${childPrefix}${childConnector} ${getKindChar(child.kind)} ${child.name}`);
      }
    }
  });
}

function prettyPrintRecursive(subtree, prefix, withSymbols) {
  const keys = Object.keys(subtree);
  for (const [index, key] of keys.entries()) {
    const isLast = index === keys.length - 1;
    const connector = isLast ? '└──' : '├──';
    console.log(`${prefix}${connector} ${path.basename(key)}`);
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    if (withSymbols) {
      printSymbols(key, nextPrefix);
    }

    prettyPrintRecursive(subtree[key], nextPrefix, withSymbols);
  }
}

function prettyPrint(tree, withSymbols) {
  const root = Object.keys(tree)[0];
  if (!root) {
    return;
  }

  console.log(path.basename(root));
  if (withSymbols) {
    printSymbols(root, '');
  }

  prettyPrintRecursive(tree[root], '', withSymbols);
}

program
  .version(require('../package.json').version)
  .argument('<filename>')
  .option('-d, --directory <path>', 'The directory containing all JS files (defaults to current working directory)', process.cwd())
  .option('--list-form [relative]', 'Print the dependency tree as a list. Pass "relative" to get relative paths.')
  .option('--pretty-tree [type]', 'Print the dependency tree as a pretty tree view, like the `tree` command. The optional type can be `symbols` to include exported symbols.')
  .option('--ignore-node-modules', 'Ignore dependencies in `node_modules`.')
  .option('-c, --require-config <path>', 'The path to a requirejs config.')
  .option('-w, --webpack-config <path>', 'The path to a webpack config.')
  .option('--ts-config <path>', 'The path to a typescript config.')
  .action((filename, options) => {
    const treeOptions = {
      filename,
      directory: options.directory,
      requireConfig: options.requireConfig,
      webpackConfig: options.webpackConfig,
      tsConfig: options.tsConfig,
      ignoreNodeModules: options.ignoreNodeModules
    };

    if (options.listForm) {
      const list = dependencyTree.toList({
        ...treeOptions,
        isListForm: options.listForm
      });
      console.log(list.join('\n'));
    } else if (options.prettyTree) {
      const tree = dependencyTree(treeOptions);
      prettyPrint(tree, options.prettyTree === 'symbols');
    } else {
      const tree = dependencyTree(treeOptions);
      console.log(JSON.stringify(tree, null, 2));
    }
  });

program.parse(process.argv);
