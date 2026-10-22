const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../diagnostics/quick-close.js','utf8');
const start=source.indexOf('// native-policy-start'),end=source.indexOf('// native-policy-end');
assert(start>=0&&end>start,'native policy markers');
const policyExports='({nativeBallChoice,nativeThrowSpec,nativeThrowBytes,researchNormalize,researchParseRules,researchRewardTokenMatches,researchMatchesRule,researchShouldRemove,gymBerryChoice})';
const p=vm.runInNewContext(source.slice(start,end)+'\n'+policyExports,{});

// Ball choice is a strict mask: only enabled ball types with stock are eligible.
assert.equal(p.nativeBallChoice(7,{1:1,2:0,3:1}),1);
assert.equal(p.nativeBallChoice(2,{1:1,2:0,3:1}),0);
assert.equal(p.nativeBallChoice(4,{3:2}),3);
assert.equal(p.nativeBallChoice(7,{1:1,2:1,3:1}),1);
assert.equal(p.nativeBallChoice(0,{1:1}),0);
assert.equal(p.nativeBallChoice('7',{1:1}),0);
assert.equal(p.nativeBallChoice(7,null),0);
assert.equal(p.nativeBallChoice(7,{1:-1,2:0,3:0}),0);

// Throw specs: grade selects the reticle radius; flags carry Nice and Curve bits.
assert.deepEqual({...p.nativeThrowSpec(1,false,0)},{ball:1,reticle:1,grade:0,flags:0});
assert.deepEqual({...p.nativeThrowSpec(2,true,3)},{ball:2,reticle:0.1,grade:3,flags:257});
assert.deepEqual({...p.nativeThrowSpec(3,true,2)},{ball:3,reticle:0.5,grade:2,flags:257});
assert.deepEqual({...p.nativeThrowSpec(9,false,9)},{ball:1,reticle:1,grade:0,flags:0});

// PokeballThrow ABI: float reticle at 0, int item at 4, bool Nice at 8, bool Curve at 9.
const excellent=p.nativeThrowBytes(p.nativeThrowSpec(2,true,3));
assert.equal(excellent.length,12);
assert.equal(new DataView(excellent.buffer).getFloat32(0,true),Math.fround(0.1));
assert.equal(new DataView(excellent.buffer).getInt32(4,true),2);
assert.deepEqual([...excellent.slice(8)], [1,1,0,0]);
const plain=p.nativeThrowBytes(p.nativeThrowSpec(1,false,0));
assert.equal(new DataView(plain.buffer).getFloat32(0,true),1);
assert.equal(new DataView(plain.buffer).getInt32(4,true),1);
assert.deepEqual([...plain.slice(8)],[0,0,0,0]);

// Research filter normalisation and task|reward grammar.
assert.equal(p.researchNormalize('  Catch 3 Pok\u00e9mon! '),'catch3pokemon');
const rules=p.researchParseRules('Catch 3 Pok\u00e9mon|i:1\n\nTrade a Pok\u00e9mon|\n*|p:25');
assert.deepEqual([...rules].map(r=>({...r})),[
 {text:'catch3pokemon',reward:'i:1'},
 {text:'tradeapokemon',reward:'*'},
 {text:'*',reward:'p:25'},
]);
assert.deepEqual([...p.researchParseRules(null)],[]);
assert.deepEqual([...p.researchParseRules('')],[]);

assert.equal(p.researchRewardTokenMatches('*','i:1:5'),true);
assert.equal(p.researchRewardTokenMatches('i:1','i:1:5'),true);
assert.equal(p.researchRewardTokenMatches('i:1','i:1'),true);
assert.equal(p.researchRewardTokenMatches('i:1:?','i:1:5'),true);
assert.equal(p.researchRewardTokenMatches('i:1:?','i:2:5'),false);
assert.equal(p.researchRewardTokenMatches('i:1','i:10:5'),false);

assert.equal(p.researchMatchesRule({text:'*',reward:'i:1'},['anything'],['i:1:5']),true);
assert.equal(p.researchMatchesRule({text:'catch3pokemon',reward:'*'},['catch3pokemon'],[]),true);
assert.equal(p.researchMatchesRule({text:'catch3pokemon',reward:'i:1'},['catch3pokemon'],['i:2:5']),false);
assert.equal(p.researchShouldRemove([{text:'*',reward:'p:25'}],['trade'],['p:25']),true);
assert.equal(p.researchShouldRemove([],['trade'],['p:25']),false);
assert.equal(p.researchShouldRemove([{text:'*',reward:'*'}],[],[]),false);

// Gym berries keep the preferred choice when stocked, otherwise the first available.
assert.equal(p.gymBerryChoice(703,{701:0,703:2,705:1}),703);
assert.equal(p.gymBerryChoice(703,{701:0,703:0,705:1}),705);
assert.equal(p.gymBerryChoice(0,{707:1}),707);
assert.equal(p.gymBerryChoice(999,{}),0);

console.log('PASS native catch policy: ball masks, throw ABI, research grammar/matching, gym berry fallback');
