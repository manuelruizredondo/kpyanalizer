import * as csstree from 'css-tree';
const css = `
.p-0\\! { padding: 0 !important; }
.mb-0\\! { margin-bottom: 0 !important; }
.regular { color: red !important; }
.text-center\\!:hover { text-align: center !important; }
`;
const ast = csstree.parse(css, { positions: true });
csstree.walk(ast, {
  enter(node) {
    if (node.type === 'Rule' && node.prelude) {
      console.log('Selector raw:', csstree.generate(node.prelude));
    }
    if (node.type === 'ClassSelector') {
      console.log('  ClassSelector name:', JSON.stringify(node.name));
    }
  }
});
