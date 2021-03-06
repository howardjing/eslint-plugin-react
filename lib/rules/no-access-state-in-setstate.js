/**
 * @fileoverview Prevent usage of this.state within setState
 * @author Rolf Erik Lekang, Jørgen Aaberg
 */

'use strict';

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Reports when this.state is accessed within setState',
      category: 'Possible Errors',
      recommended: false
    }
  },

  create: function(context) {
    function isSetStateCall(node) {
      return node.type === 'CallExpression' &&
        node.callee.property &&
        node.callee.property.name === 'setState' &&
        node.callee.object.type === 'ThisExpression';
    }

    // The methods array contains all methods or functions that are using this.state
    // or that are calling another method or function using this.state
    const methods = [];
    // The vars array contains all variables that contains this.state
    const vars = [];
    return {
      CallExpression(node) {
        // Appends all the methods that are calling another
        // method containg this.state to the methods array
        methods.map(method => {
          if (node.callee.name === method.methodName) {
            let current = node.parent;
            while (current.type !== 'Program') {
              if (current.type === 'MethodDefinition') {
                methods.push({
                  methodName: current.key.name,
                  node: method.node
                });
                break;
              }
              current = current.parent;
            }
          }
        });

        // Finding all CallExpressions that is inside a setState
        // to further check if they contains this.state
        let current = node.parent;
        while (current.type !== 'Program') {
          if (isSetStateCall(current)) {
            const methodName = node.callee.name;
            methods.map(method => {
              if (method.methodName === methodName) {
                context.report(
                  method.node,
                  'Use callback in setState when referencing the previous state.'
                );
              }
            });

            break;
          }
          current = current.parent;
        }
      },

      MemberExpression(node) {
        if (
          node.property.name === 'state' &&
          node.object.type === 'ThisExpression'
        ) {
          let current = node;
          while (current.type !== 'Program') {
            // Reporting if this.state is directly within this.setState
            if (isSetStateCall(current)) {
              context.report(
                node,
                'Use callback in setState when referencing the previous state.'
              );
              break;
            }

            // Storing all functions and methods that contains this.state
            if (current.type === 'MethodDefinition') {
              methods.push({
                methodName: current.key.name,
                node: node
              });
              break;
            } else if (current.type === 'FunctionExpression' && current.parent.key) {
              methods.push({
                methodName: current.parent.key.name,
                node: node
              });
              break;
            }

            // Storing all variables containg this.state
            if (current.type === 'VariableDeclarator') {
              vars.push({
                node: node,
                scope: context.getScope(),
                variableName: current.id.name
              });
              break;
            }

            current = current.parent;
          }
        }
      },

      Identifier(node) {
        // Checks if the identifier is a variable within an object
        let current = node;
        while (current.parent.type === 'BinaryExpression') {
          current = current.parent;
        }
        if (
          current.parent.value === current ||
          current.parent.object === current
        ) {
          while (current.type !== 'Program') {
            if (isSetStateCall(current)) {
              vars
                .filter(v => v.scope === context.getScope() && v.variableName === node.name)
                .map(v => context.report(
                  v.node,
                  'Use callback in setState when referencing the previous state.'
                ));
            }
            current = current.parent;
          }
        }
      },

      ObjectPattern(node) {
        const isDerivedFromThis = node.parent.init.type === 'ThisExpression';
        node.properties.forEach(property => {
          if (property.key.name === 'state' && isDerivedFromThis) {
            vars.push({
              node: property.key,
              scope: context.getScope(),
              variableName: property.key.name
            });
          }
        });
      }
    };
  }
};
