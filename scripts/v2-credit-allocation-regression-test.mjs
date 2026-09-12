import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/features/credit-transfer/credit-allocation.js',import.meta.url),'utf8');
const window={};
const context=vm.createContext({window,console});
vm.runInContext(source,context,{filename:'credit-allocation.js'});
assert.ok(window.StudieLotsV2?.creditAllocation);
console.log('v2 credit-allocation regression source moved to src');
