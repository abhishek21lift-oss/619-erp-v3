const ts = require('typescript');
const fs = require('fs');
const files = process.argv.slice(2);
let ok = true;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ES2022, true,
    f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errs = sf.parseDiagnostics || [];
  if (errs.length) {
    ok = false;
    for (const e of errs) {
      const pos = sf.getLineAndCharacterOfPosition(e.start || 0);
      console.log(`${f}(${pos.line+1},${pos.character+1}): ${ts.flattenDiagnosticMessageText(e.messageText, '\n')}`);
    }
  } else {
    console.log(`OK ${f}`);
  }
}
process.exit(ok ? 0 : 1);
