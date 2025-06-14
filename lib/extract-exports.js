'use strict';

const fs = require('node:fs');
const ts = require('typescript');

function getFunctionLikeSignature(node, sourceFile) {
  const name = node.name ? node.name.getText(sourceFile) : (ts.isConstructorDeclaration(node) ? 'constructor' : '(anonymous)');
  const params = node.parameters.map(p => p.getText(sourceFile).replaceAll(/\s+/g, ' ')).join(', ');
  const type = node.type ? `: ${node.type.getText(sourceFile)}` : '';
  return `${name}(${params})${type}`;
}

function getVariableLikeSignature(node, sourceFile) {
  const name = node.name.getText(sourceFile);
  const type = node.type ? `: ${node.type.getText(sourceFile)}` : '';
  let initializer = '';
  if (node.initializer) {
    const initText = node.initializer.getText(sourceFile);
    initializer = initText.length > 80 || initText.includes('\n') ? ' = ...' : ` = ${initText.replaceAll(/\s+/g, ' ')}`;
  }

  return `${name}${type}${initializer}`;
}

function getInterfaceSignature(node, sourceFile) {
  const text = node.getText(sourceFile);
  if (text.length > 120 || text.includes('\n')) {
    return `interface ${node.name.getText(sourceFile)} { ... }`;
  }

  return text.replaceAll(/\s\s+/g, ' ').trim();
}

function getSymbolSignature(node, sourceFile) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isFunctionExpression(node)) {
    return getFunctionLikeSignature(node, sourceFile);
  }

  if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
    return getVariableLikeSignature(node, sourceFile);
  }

  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    return node.name ? node.name.getText(sourceFile) : '(anonymous class)';
  }

  if (ts.isInterfaceDeclaration(node)) {
    return getInterfaceSignature(node, sourceFile);
  }

  if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return node.name.getText(sourceFile);
  }

  return node.getText(sourceFile).replaceAll(/\s+/g, ' ').trim();
}

function getSymbolKind(node) {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return 'function';
  }

  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    return 'class';
  }

  if (ts.isInterfaceDeclaration(node)) {
    return 'interface';
  }

  if (ts.isVariableDeclaration(node)) {
    return 'variable';
  }

  if (ts.isMethodDeclaration(node)) {
    return 'method';
  }

  if (ts.isConstructorDeclaration(node)) {
    return 'constructor';
  }

  if (ts.isPropertyDeclaration(node)) {
    return 'property';
  }

  if (ts.isGetAccessorDeclaration(node)) {
    return 'getter';
  }

  if (ts.isSetAccessorDeclaration(node)) {
    return 'setter';
  }

  if (ts.isExportSpecifier(node)) {
    return 're-export';
  }

  return 'unknown';
}

function getScriptKind(filename) {
  if (filename.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  if (filename.endsWith('.ts')) {
    return ts.ScriptKind.TS;
  }

  if (filename.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }

  return ts.ScriptKind.JS;
}

function extractNode(node, sourceFile) {
  if (!node) {
    return null;
  }

  const symbol = {
    name: getSymbolSignature(node, sourceFile),
    kind: getSymbolKind(node)
  };

  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    symbol.children = node.members.map(member => extractNode(member, sourceFile)).filter(Boolean);
  }

  return symbol;
}

module.exports = function(filename) {
  try {
    const content = fs.readFileSync(filename, 'utf8');
    const sourceFile = ts.createSourceFile(
      filename,
      content,
      ts.ScriptTarget.Latest,
      true, // Set parent nodes
      getScriptKind(filename)
    );

    const exports = [];

    const visit = node => {
      if (ts.isExportAssignment(node)) { // `export default ...`
        const symbol = extractNode(node.expression, sourceFile);
        if (symbol) {
          if (!node.expression.name) { // Handle anonymous default exports
            symbol.name = `default ${symbol.name}`.replace('default (anonymous)', 'default');
          }

          exports.push(symbol);
        }

        return;
      }

      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const specifier of node.exportClause.elements) {
            exports.push({
              name: specifier.name.getText(sourceFile),
              kind: 're-export'
            });
          }
        } else { // `export * from ...`
          exports.push({ name: node.getText(sourceFile), kind: 're-export' });
        }

        return;
      }

      if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            exports.push(extractNode(declaration, sourceFile));
          }
        } else {
          exports.push(extractNode(node, sourceFile));
        }

        return;
      }

      if (
        ts.isExpressionStatement(node) &&
        ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const { left, right } = node.expression;
        if (ts.isPropertyAccessExpression(left)) {
          const expressionText = left.expression.getText(sourceFile);
          if ((expressionText === 'module' && left.name.text === 'exports') || expressionText === 'exports') {
            const name = left.getText(sourceFile);
            const rightText = right.getText(sourceFile).replaceAll(/\s+/g, ' ');
            exports.push({
              name: `${name} = ${rightText.length > 80 ? '...' : rightText}`,
              kind: 'variable'
            });
            return;
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return exports.filter(Boolean);
  } catch {
    return [];
  }
};
