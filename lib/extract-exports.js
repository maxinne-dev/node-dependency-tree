'use strict';

const fs = require('node:fs');
const ts = require('typescript');

function getSymbolText(node, sourceFile) {
  const text = node.getText(sourceFile);
  return text.replace(/\s+/g, ' ').trim();
}

module.exports = function extractExports(filename) {
  try {
    const content = fs.readFileSync(filename, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filename,
      content,
      ts.ScriptTarget.Latest,
      true, // Set parent nodes
      filename.endsWith('.tsx') ? ts.ScriptKind.TSX :
        filename.endsWith('.ts') ? ts.ScriptKind.TS :
          filename.endsWith('.jsx') ? ts.ScriptKind.JSX :
            ts.ScriptKind.JS
    );

    const exports = [];

    function visit(node) {
      if (ts.isExportAssignment(node)) {
        exports.push(getSymbolText(node, sourceFile));
        return;
      }

      if (ts.isExportDeclaration(node)) {
        exports.push(getSymbolText(node, sourceFile));
        return;
      }

      if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        exports.push(getSymbolText(node, sourceFile));
        return;
      }

      if (
        ts.isExpressionStatement(node) &&
        ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const { left } = node.expression;
        if (ts.isPropertyAccessExpression(left)) {
          if (
            ts.isIdentifier(left.expression) &&
            left.expression.text === 'module' &&
            left.name.text === 'exports'
          ) {
            exports.push(getSymbolText(node, sourceFile));
            return;
          }

          if (
            ts.isIdentifier(left.expression) &&
            left.expression.text === 'exports'
          ) {
            exports.push(getSymbolText(node, sourceFile));
            return;
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return exports;
  } catch {
    return [];
  }
};
