#!/usr/bin/env node
'use strict';

const path = require('node:path');
const process = require('node:process');
const { program } = require('commander');
const dependencyTree = require('../index.js');
const extractExports = require('../lib/extract-exports.js');
const { version } = require('../package.json');

program
  .version(version)
  .arguments('<filename>')
  .option('-d, --directory <path>', 'The directory containing all JS files', process.cwd())
  .option('--list-form [relative]', 'Print the dependency tree as a list. Pass "relative" to get relative paths')
  .option('--pretty-tree [type]', 'Print the dependency tree as a pretty tree view. The optional type can be "symbols" to include exported symbols.')
  .option('--ignore-node-modules', 'Ignore dependencies in node_modules')
  .option('-c, --require-config <path>', 'The path to a requirejs config')
  .option('-w, --webpack-config <path>', 'The path to a webpack config')
  .option('--ts-config <path>', 'The path to a typescript config')
  .parse(process.argv);

const options = program.opts();
const [filename] = program.args;

if (!filename) {
  console.error('Error: filename not given');
  process.exit(1);
}

const config = {
  filename,
  directory: options.directory,
  requireConfig: options.requireConfig,
  webpackConfig: options.webpackConfig,
  tsConfig: options.tsConfig,
  ignoreNodeModules: options.ignoreNodeModules
};

if (options.listForm) {
  config.isListForm = options.listForm === 'relative' ? 'relative' : true;
  const list = dependencyTree.toList(config);
  console.log(list.join('\n'));
  process.exit(0);
}

const tree = dependencyTree(config);
const rootFilename = path.resolve(process.cwd(), filename);

if (options.prettyTree) {
  if (tree[rootFilename]) {
    console.log(path.basename(rootFilename));
    prettyPrintFile(rootFilename, tree[rootFilename], '');
  } else {
    console.log(path.basename(rootFilename));
  }
} else {
  console.log(JSON.stringify(tree, null, 2));
}

function getSymbolShortKind(kind) {
  switch (kind) {
    case 'class': { return 'C';
    }

    case 'function': { return 'f';
    }

    case 'variable': { return 'v';
    }

    case 'method': { return 'm';
    }

    case 'property': { return 'p';
    }

    case 'getter': { return 'get';
    }

    case 'setter': { return 'set';
    }

    case 'constructor': { return 'ctor';
    }

    case 're-export': { return '->';
    }

    case 'interface': { return '•';
    }

    default: { return '•';
    }
  }
}

function prettyPrintSymbols(symbols, prefix) {
  for (const [i, symbol] of symbols.entries()) {
    const isLast = i === symbols.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    console.log(`${prefix}${connector}${getSymbolShortKind(symbol.kind)} ${symbol.name}`);

    if (symbol.children && symbol.children.length > 0) {
      prettyPrintSymbols(symbol.children, newPrefix);
    }
  }
}

function prettyPrintFile(filePath, subTree, prefix) {
  const showSymbols = options.prettyTree === 'symbols';

  const symbols = showSymbols ? extractExports(filePath).map(s => ({ ...s, _type: 'symbol' })) : [];
  const dependencies = Object.keys(subTree).map(d => ({ path: d, _type: 'dependency' }));

  const children = [...symbols, ...dependencies];

  for (const [i, child] of children.entries()) {
    const isLast = i === children.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    if (child._type === 'symbol') {
      console.log(`${prefix}${connector}${getSymbolShortKind(child.kind)} ${child.name}`);
      if (child.children && child.children.length > 0) {
        prettyPrintSymbols(child.children, newPrefix);
      }
    } else { // Dependency
      console.log(`${prefix}${connector}${path.basename(child.path)}`);
      prettyPrintFile(child.path, subTree[child.path], newPrefix);
    }
  }
}
