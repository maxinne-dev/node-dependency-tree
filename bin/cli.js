#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('node:path');
const process = require('node:process');
const dependencyTree = require('../index.js');
const { version } = require('../package.json');

program
  .version(version)
  .argument('<filename>', 'The path to the file to get the dependency tree for')
  .option('-d, --directory <path>', 'The directory containing all JS files', process.cwd())
  .option('--list-form [relative]', 'Print the dependency tree as a list. Pass "relative" to get relative paths.')
  .option('--ignore-node-modules', 'Ignore dependencies in node_modules')
  .option('-c, --require-config <path>', 'The path to a requirejs config')
  .option('-w, --webpack-config <path>', 'The path to a webpack config')
  .option('--ts-config <path>', 'The path to a typescript config')
  .option('--pretty-tree', 'Print the dependency tree as a pretty tree view')
  .parse(process.argv);

const options = program.opts();
const [filename] = program.args;

const treeOptions = {
  filename,
  directory: options.directory,
  requireConfig: options.requireConfig,
  webpackConfig: options.webpackConfig,
  tsConfig: options.tsConfig,
  ignoreNodeModules: options.ignoreNodeModules
};

function buildFileTree(fileList) {
  const fileTree = {};
  for (const filePath of fileList) {
    const parts = filePath.split(path.sep);
    let currentLevel = fileTree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      if (isLastPart) {
        if (currentLevel[part]) {
          throw new Error(`Path conflict: a file and a directory have the same name: ${part}`);
        }
        currentLevel[part] = null;
      } else {
        if (currentLevel[part] === null) {
          throw new Error(`Path conflict: a file and a directory have the same name: ${part}`);
        }
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
      }
    }
  }
  return fileTree;
}

function printTree(node, prefix = '', isRoot = true) {
  if (isRoot) {
    const rootDir = path.basename(process.cwd());
    console.log(rootDir);
  }
  const entries = Object.keys(node).sort((a, b) => {
    const aIsDir = node[a] !== null;
    const bIsDir = node[b] !== null;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${connector}${entry}`);
    
    const children = node[entry];
    if (children !== null) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      printTree(children, newPrefix, false);
    }
  });
}

if (options.prettyTree) {
  treeOptions.isListForm = 'relative';
  const fileList = dependencyTree.toList(treeOptions);
  const fileTree = buildFileTree(fileList);
  printTree(fileTree);
} else if (options.listForm) {
  treeOptions.isListForm = options.listForm === 'relative' ? 'relative' : true;
  const list = dependencyTree.toList(treeOptions);
  console.log(list.join('\n'));
} else {
  const tree = dependencyTree(treeOptions);
  console.log(JSON.stringify(tree, null, 2));
}
