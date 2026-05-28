import * as csstree from 'css-tree';

// inline copy of isHelperImportantRule
function isHelperImportantRule(prelude) {
  if (!prelude) return false;
  let isHelper = false;
  csstree.walk(prelude, {
    enter(node) {
      if (isHelper) return;
      if (node.type === 'ClassSelector') {
        if (node.name.endsWith('!')) isHelper = true;
      }
    },
  });
  return isHelper;
}

const css = `
.p-0\\! { padding: 0 !important; }
.mb-0\\! { margin-bottom: 0 !important; }
.md\\:hover\\:text-center\\! { text-align: center !important; }
.btn { color: red !important; }
.regular { padding: 10px !important; }
`;
const ast = csstree.parse(css, { positions: true });

let importantCount = 0;
let inHelperRule = false;
csstree.walk(ast, {
  enter(node) {
    if (node.type === 'Rule') {
      inHelperRule = isHelperImportantRule(node.prelude);
      console.log('Rule:', csstree.generate(node.prelude), '→ helper?', inHelperRule);
    }
    if (node.type === 'Declaration' && node.important && !inHelperRule) {
      importantCount++;
    }
  }
});
console.log('Total counted !important:', importantCount, '(expected 2)');
