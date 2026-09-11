#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const hb=all.filter(v=>v.university==='Högskolan i Borås');
console.log('HB batch 7 start',hb.length);
