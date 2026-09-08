import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../v2-program-paths.js',import.meta.url),'utf8');
const window={};
const context=vm.createContext({window,console,fetch:async()=>{throw new Error('fetch must not be called in credit matcher tests')},URLSearchParams});
vm.runInContext(source,context,{filename:'v2-program-paths.js'});
const {exactCredit,potentialCredit,creditMatch}=window.StudieLotsV2.paths;

const merit=(name,hp=7.5,subject='',code='')=>({name,hp,subject,code});
const row=(name,hp=7.5,subject='',code='')=>({name,hp,subject,code});

assert.equal(exactCredit(row('Organisation och ledarskap',7.5,'Företagsekonomi','FEK101'),[merit('Helt annan titel',7.5,'Företagsekonomi','FEK101')])?.code,'FEK101','exact course code must remain an exact match');
assert.equal(exactCredit(row('Organisation och ledarskap',7.5),[merit('Organisation och ledarskap',7.5)])?.name,'Organisation och ledarskap','exact normalized full name must remain an exact match');

assert.equal(potentialCredit(row('Idrottsvetenskap teori och metod',7.5,'Idrottsvetenskap'),[merit('Vetenskap teori och metod',7.5,'Vetenskap')]),null,'Idrottsvetenskap must not equal Vetenskap');
assert.equal(potentialCredit(row('Företagsekonomi organisation och ledarskap',7.5,'Företagsekonomi'),[merit('Ekonomi organisation och ledarskap',7.5,'Ekonomi')]),null,'Företagsekonomi must not equal Ekonomi');
assert.equal(potentialCredit(row('Neuropsykologi kognition och beteende',7.5,'Neuropsykologi'),[merit('Psykologi kognition och beteende',7.5,'Psykologi')]),null,'Neuropsykologi must not equal Psykologi');

assert.equal(potentialCredit(row('Organisation ledarskap och förändring',7.5,'Företagsekonomi'),[merit('Organisation ledarskap och förändring',15,'Företagsekonomi')]),null,'similar titles with different known hp must be rejected');

const possible=potentialCredit(row('Organisation ledarskap och förändringsarbete',7.5,'Företagsekonomi'),[merit('Organisation ledarskap och förändring',7.5,'Företagsekonomi')]);
assert.ok(possible&&possible.score>=.72,'similar distinctive title with same hp and subject may be potential');
assert.equal(creditMatch(row('Organisation ledarskap och förändringsarbete',7.5,'Företagsekonomi'),[merit('Organisation ledarskap och förändring',7.5,'Företagsekonomi')])?.kind,'potential','non-exact similarity must stay potential');

// Mirror structure aggregation invariant: only exact matches may count as credited hp.
const programme=[row('Organisation och ledarskap',7.5,'Företagsekonomi','FEK101'),row('Organisation ledarskap och förändringsarbete',7.5,'Företagsekonomi','FEK102')];
const merits=[merit('Organisation och ledarskap',7.5,'Företagsekonomi','FEK101'),merit('Organisation ledarskap och förändring',7.5,'Företagsekonomi','OTHER')];
const matches=programme.map(r=>creditMatch(r,merits));
const creditedHp=programme.reduce((sum,r,i)=>sum+(matches[i]?.kind==='exact'?r.hp:0),0);
const potentialHp=programme.reduce((sum,r,i)=>sum+(matches[i]?.kind==='potential'?r.hp:0),0);
assert.equal(creditedHp,7.5,'potential matches must never increase creditedHp');
assert.equal(potentialHp,7.5,'potential hp must remain separately visible');

console.log('v2 credit-match regression: OK');
